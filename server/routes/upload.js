import { Router }    from 'express'
import multer         from 'multer'
import { randomUUID } from 'crypto'
import rateLimit      from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { getPresignedUploadUrl, putBuffer, getPublicUrl } from '../utils/s3.js'

// 20 file uploads per minute per IP — prevents runaway loops & storage abuse
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please wait a minute before trying again.' },
})

const router  = Router()
const storage = multer.memoryStorage()
const upload  = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },   // 25 MB max
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'), false)
    }
    cb(null, true)
  },
})

const ALLOWED_FOLDERS = ['postcards','gallery','events','profiles','competitions','core','posts','magazines']

const uploadAttachment = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB max for attachments
})

// ── POST /api/upload/file  (browser sends file → server → S3) ─────────────────
// This avoids the S3 CORS issue entirely — no browser-to-S3 direct PUT needed.
// Body: multipart/form-data with field "file" + optional field "folder"
router.post('/file', uploadLimiter, requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    const folder     = ALLOWED_FOLDERS.includes(req.body?.folder) ? req.body.folder : 'uploads'
    const ext        = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const key        = `${folder}/${randomUUID()}.${ext}`

    const result = await putBuffer(key, req.file.buffer, req.file.mimetype)

    res.json(result)
  } catch (err) {
    console.error('\n[upload/file] ❌', err.message)
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
// Only useful if the S3 bucket has CORS configured for direct browser uploads.
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

export default router
