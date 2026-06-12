import { Router }     from 'express'
import multer          from 'multer'
import { randomUUID }  from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth.js'
import HeroTheme       from '../models/HeroTheme.js'
import { putBuffer }   from '../utils/s3.js'

const router      = Router()
const adminOrCore = requireRole('admin', 'core')

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('video/')) return cb(new Error('Only video files are allowed'), false)
    cb(null, true)
  },
})

// GET /api/hero-themes/active — public, used by MainPage
router.get('/active', async (req, res) => {
  try {
    const theme = await HeroTheme.findOne({ isActive: true })
    res.json({ theme: theme || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/hero-themes — admin/core only
router.get('/', requireAuth, adminOrCore, async (req, res) => {
  try {
    const themes = await HeroTheme.find().sort({ isDefault: -1, createdAt: 1 })
    res.json({ themes })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/hero-themes — create custom preset
router.post('/', requireAuth, adminOrCore, async (req, res) => {
  try {
    const { isActive, isDefault, ...rest } = req.body
    const theme = await HeroTheme.create({ ...rest, isDefault: false, isActive: false })
    res.json({ theme })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/hero-themes/:id — update preset fields (never touches isActive/isDefault)
router.put('/:id', requireAuth, adminOrCore, async (req, res) => {
  try {
    const { isActive, isDefault, ...updateData } = req.body
    const theme = await HeroTheme.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    if (!theme) return res.status(404).json({ error: 'Theme not found' })
    res.json({ theme })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/hero-themes/:id
router.delete('/:id', requireAuth, adminOrCore, async (req, res) => {
  try {
    const theme = await HeroTheme.findById(req.params.id)
    if (!theme)          return res.status(404).json({ error: 'Theme not found' })
    if (theme.isDefault) return res.status(400).json({ error: 'Cannot delete the default theme' })
    if (theme.isActive)  return res.status(400).json({ error: 'Cannot delete the active theme — switch to another first' })
    await theme.deleteOne()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/hero-themes/:id/activate — set as active theme
router.post('/:id/activate', requireAuth, adminOrCore, async (req, res) => {
  try {
    await HeroTheme.updateMany({}, { isActive: false })
    const theme = await HeroTheme.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true })
    if (!theme) return res.status(404).json({ error: 'Theme not found' })
    res.json({ theme })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/hero-themes/upload-video — server-side video upload to S3 (50 MB max)
router.post('/upload-video', requireAuth, adminOrCore, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file provided' })
    const ext    = (req.file.originalname.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
    const key    = `videos/themes/${randomUUID()}.${ext}`
    const result = await putBuffer(key, req.file.buffer, req.file.mimetype)
    res.json(result)
  } catch (e) {
    console.error('[hero-themes/upload-video]', e.message)
    res.status(500).json({ error: e.message })
  }
})

export default router
