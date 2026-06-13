import { Router }    from 'express'
import multer         from 'multer'
import sharp          from 'sharp'
import { randomUUID } from 'crypto'
import rateLimit      from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { getPresignedUploadUrl, putBuffer, getPublicUrl } from '../utils/s3.js'
import { fileTypeFromBuffer } from 'file-type'

// 20 file uploads per minute per IP — prevents runaway loops & storage abuse
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please wait a minute before trying again.' },
})

const router  = Router()
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },   // 25 MB max
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'), false)
    }
    cb(null, true)
  },
})

const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },  // 100 MB max for video
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed.'), false)
    }
    cb(null, true)
  },
})

const ALLOWED_FOLDERS = [
  'postcards','gallery','events','profiles','competitions','core','posts','magazines',
  'core-gallery','core-covers','event-gallery','activities',
]

const uploadAttachment = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB max for attachments
})

// ── POST /api/upload/file  (image → server → S3, two sizes via sharp) ─────────
router.post('/file', uploadLimiter, requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    // Verify actual file type via magic bytes — the Content-Type header is spoofable
    const fileType = await fileTypeFromBuffer(req.file.buffer)
    if (!fileType || !fileType.mime.startsWith('image/')) {
      return res.status(400).json({ error: 'File is not a valid image.' })
    }

    const folder = ALLOWED_FOLDERS.includes(req.body?.folder) ? req.body.folder : 'uploads'
    const uuid   = randomUUID()

    // Compress to desktop (1920px) and mobile (900px) JPEG variants
    const [desktopBuf, mobileBuf] = await Promise.all([
      sharp(req.file.buffer)
        .rotate()                                // honour EXIF orientation
        .resize({ width: 1920, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })      // PNG alpha → white
        .jpeg({ quality: 85, progressive: true })
        .toBuffer(),
      sharp(req.file.buffer)
        .rotate()
        .resize({ width: 900, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer(),
    ])

    const key       = `${folder}/${uuid}.jpg`
    const mobileKey = `${folder}/${uuid}_mobile.jpg`

    const [result, mobileResult] = await Promise.all([
      putBuffer(key,       desktopBuf, 'image/jpeg'),
      putBuffer(mobileKey, mobileBuf,  'image/jpeg'),
    ])

    res.json({
      key:       result.key,
      publicUrl: result.publicUrl,
      mobileKey: mobileResult.key,
      mobileUrl: mobileResult.publicUrl,
    })
  } catch (err) {
    console.error('\n[upload/file] ❌', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/upload/video  (video → server → S3, no processing) ──────────────
router.post('/video', uploadLimiter, requireAuth, uploadVideo.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    const folder = ALLOWED_FOLDERS.includes(req.body?.folder) ? req.body.folder : 'uploads'
    const ext    = (req.file.originalname.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
    const key    = `${folder}/${randomUUID()}.${ext}`

    const result = await putBuffer(key, req.file.buffer, req.file.mimetype)

    res.json({ key: result.key, publicUrl: result.publicUrl, mobileKey: null, mobileUrl: null })
  } catch (err) {
    console.error('\n[upload/video] ❌', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/upload/attachment  (any file type, 50 MB max) ──────────────────
router.post('/attachment', uploadLimiter, requireAuth, uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    const ext  = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const key  = `attachments/${randomUUID()}.${ext}`

    const result = await putBuffer(key, req.file.buffer, req.file.mimetype)
    res.json(result)
  } catch (err) {
    console.error('\n[upload/attachment] ❌', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/upload/presigned  (optional — kept for reference) ───────────────
router.post('/presigned', uploadLimiter, requireAuth, async (req, res) => {
  try {
    const { filename, contentType, folder = 'uploads' } = req.body
    if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required.' })
    if (!contentType.startsWith('image/')) return res.status(400).json({ error: 'Only images allowed.' })
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'uploads'
    const result     = await getPresignedUploadUrl(safeFolder, filename, contentType)
    res.json(result)
  } catch (err) {
    console.error('\n[upload/presigned] ❌', err.message)
    console.error('  AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✓' : '❌ MISSING')
    console.error('  S3_BUCKET_NAME:',    process.env.S3_BUCKET_NAME    ? '✓' : '❌ MISSING')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/upload/proxy-image  (server-side image fetch for PDF generation) ──
// Only proxies images from the known S3 bucket — prevents open-proxy abuse
router.get('/proxy-image', async (req, res) => {
  const { url } = req.query
  const BUCKET_HOST = process.env.S3_BUCKET_NAME
    ? `${process.env.S3_BUCKET_NAME}.s3`
    : 'college-photography-competition-iem.s3'
  if (!url || !url.startsWith('https://') || !url.includes(BUCKET_HOST)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL.' })
  }
  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(upstream.status).end()
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(buf)
  } catch { res.status(502).end() }
})

export default router
