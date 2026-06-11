import { Router }     from 'express'
import PostcardSection from '../models/PostcardSection.js'
import Postcard        from '../models/Postcard.js'
import AppSettings     from '../models/AppSettings.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

const router  = Router()
const canEdit = [requireAuth, requireRole('admin','core')]

// ── SECTIONS ──────────────────────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  const sections = await PostcardSection.find().sort({ order:1, name:1 })
  res.json({ sections })
})

router.post('/sections', requireAuth, async (req, res) => {
  try {
    const { name, order } = req.body
    if (!name) return res.status(400).json({ error: 'Section name is required.' })
    const isPriv = ['admin','core'].includes(req.user.role)
    if (!isPriv) {
      if (req.user.role !== 'coordinator') return res.status(403).json({ error: 'Not allowed.' })
      const setting = await AppSettings.findOne({ key: 'coordinator.canCreatePostcardSection' })
      if (!setting?.value) return res.status(403).json({ error: 'Section creation is disabled for coordinators.' })
    }
    const section = await PostcardSection.create({ name, order: order||0, createdBy: req.user._id })
    res.status(201).json({ section })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/sections/:id', canEdit, async (req, res) => {
  try {
    // Move every postcard in this section to General (no section) before deleting
    await Postcard.updateMany({ section: req.params.id }, { $unset: { section: 1 } })
    await PostcardSection.findByIdAndDelete(req.params.id)
    res.json({ message: 'Section deleted. Postcards moved to General.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POSTCARDS ─────────────────────────────────────────────────────────────────
// Public: list postcards (optionally filter by section)
router.get('/', async (req, res) => {
  const filter = { approved: true }
  if (req.query.section) filter.section = req.query.section
  const postcards = await Postcard.find(filter)
    .populate('photographer', 'name profilePhoto')
    .populate('section', 'name')
    .sort({ createdAt: -1 })
    .limit(Number(req.query.limit) || 100)
  res.json({ postcards })
})

// Member uploads a postcard (single image or multi-image carousel)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { imageUrl, s3Key, images, section, caption } = req.body
    if (!images?.length && !imageUrl) return res.status(400).json({ error: 'At least one image is required.' })
    if (images?.length > 15) return res.status(400).json({ error: 'Maximum 15 photos per postcard.' })
    if (caption && caption.length > 50) return res.status(400).json({ error: 'Caption must be 50 characters or fewer.' })

    const postcard = await Postcard.create({
      images: images || [],
      imageUrl: imageUrl || undefined,
      s3Key: s3Key || undefined,
      section, caption,
      photographer: req.user._id,
    })
    await postcard.populate('photographer', 'name profilePhoto')
    await postcard.populate('section', 'name')
    res.status(201).json({ postcard })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Update caption/images — owner or admin/core
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const card = await Postcard.findById(req.params.id)
    if (!card) return res.status(404).json({ error: 'Postcard not found.' })
    const isOwner = card.photographer.toString() === req.user._id.toString()
    const isPriv  = ['admin','core'].includes(req.user.role)
    if (!isOwner && !isPriv) return res.status(403).json({ error: 'Not allowed.' })
    const { caption, images } = req.body
    if (caption !== undefined) {
      if (String(caption).length > 50) return res.status(400).json({ error: 'Caption must be 50 characters or fewer.' })
      card.caption = caption
    }
    if (images !== undefined) {
      if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: 'At least one image is required.' })
      card.images = images
    }
    await card.save()
    res.json({ postcard: card })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const card = await Postcard.findById(req.params.id)
    if (!card) return res.status(404).json({ error: 'Not found.' })
    const isOwner = card.photographer.toString() === req.user._id.toString()
    const isPriv  = ['admin','core'].includes(req.user.role)
    if (!isOwner && !isPriv) return res.status(403).json({ error: 'Not allowed.' })
    const { caption, images } = req.body
    if (caption !== undefined) {
      if (caption.length > 50) return res.status(400).json({ error: 'Caption must be 50 characters or fewer.' })
      card.caption = caption
    }
    if (images !== undefined) {
      if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: 'At least one image is required.' })
      card.images = images
    }
    await card.save()
    res.json({ postcard: card })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Delete — owner or admin/core
router.delete('/:id', requireAuth, async (req, res) => {
  const card = await Postcard.findById(req.params.id)
  if (!card) return res.status(404).json({ error: 'Not found.' })
  const isOwner = card.photographer.toString() === req.user._id.toString()
  const isPriv  = ['admin','core'].includes(req.user.role)
  if (!isOwner && !isPriv) return res.status(403).json({ error: 'Not allowed.' })
  if (card.s3Key) await deleteObject(card.s3Key).catch(() => {})
  await card.deleteOne()
  res.json({ message: 'Postcard deleted.' })
})

export default router
