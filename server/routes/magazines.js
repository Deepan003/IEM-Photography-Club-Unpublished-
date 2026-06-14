import { Router } from 'express'
import Magazine from '../models/Magazine.js'
import User     from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'
import { sendMagazinePublishedEmail } from '../utils/email.js'

const router = Router()

// ── GET single magazine by public share link (no auth — only if published) ────
router.get('/public/:id', async (req, res) => {
  try {
    const mag = await Magazine.findById(req.params.id)
      .populate('user', 'name profilePhoto')
    if (!mag || mag.status !== 'published') {
      return res.status(404).json({ error: 'Magazine not found or not published.' })
    }
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── SAVE thumbnail URL after first-page capture on publish ────────────────────
router.patch('/:id/thumbnail', requireAuth, async (req, res) => {
  try {
    const { thumbnailUrl } = req.body
    const mag = await Magazine.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { thumbnailUrl },
      { new: true }
    )
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── LIST published magazines (public) ────────────────────────────────────────
router.get('/published', async (req, res) => {
  try {
    const mags = await Magazine.find({ status: 'published' })
      .populate('user', 'name profilePhoto role')
      .sort({ name: 1 })   // alphabetical by name
    res.json({ magazines: mags })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── ADMIN: list ALL magazines ─────────────────────────────────────────────────
router.get('/admin/all', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const mags = await Magazine.find({})
      .populate('user', 'name email profilePhoto role')
      .sort({ updatedAt: -1 })
    res.json({ magazines: mags })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── ADMIN: reset + unpublish a magazine (does NOT permanently delete) ─────────
// Clears all uploaded images from S3, wipes page content, sets status back to draft.
// The user's magazine record remains so they can see it and rebuild from scratch.
router.delete('/admin/:id', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const mag = await Magazine.findById(req.params.id)
    if (!mag) return res.status(404).json({ error: 'Not found.' })

    // 1. Delete all uploaded S3 images from this magazine
    const keys = mag.pages.flatMap(p => (p.images || []).map(i => i.s3Key)).filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k).catch(() => {})))

    // 2. Reset pages to empty (no images, no custom text) + unpublish
    mag.pages      = []
    mag.status     = 'draft'
    mag.publishedAt = undefined
    await mag.save()

    res.json({ message: 'Magazine has been reset and unpublished.', magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── LIST user's magazines ─────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const mags = await Magazine.find({ user: req.user._id }).sort({ updatedAt: -1 })
    res.json({ magazines: mags })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET one magazine ──────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const mag = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CREATE a new magazine (draft) ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { templateId, slot = 1, name } = req.body
    if (!templateId) return res.status(400).json({ error: 'templateId is required.' })
    if (![1, 2].includes(Number(slot))) return res.status(400).json({ error: 'slot must be 1 or 2.' })

    const slotNum = Number(slot)
    const allDrafts = await Magazine.find({ user: req.user._id, status: 'draft' })

    // If this slot already has a draft, overwrite it
    const sameSlot = allDrafts.find(m => m.slot === slotNum)
    if (sameSlot) {
      await Magazine.deleteOne({ _id: sameSlot._id })
    } else if (allDrafts.length >= 2) {
      // Both slots taken, can't create a 3rd draft
      return res.status(400).json({ error: 'Maximum 2 draft magazines allowed. Delete one to continue.' })
    }

    const mag = await Magazine.create({
      user: req.user._id,
      templateId,
      slot: slotNum,
      name: name || '',
      pages: [],
      status: 'draft',
    })
    res.status(201).json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── SAVE / UPDATE — saves to draftPages only, does NOT affect live pages ──────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { pages, name } = req.body
    const mag = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })

    if (mag.status === 'published') {
      // Published magazine: save changes to draftPages, keep live pages intact
      if (pages !== undefined) { mag.draftPages = pages; mag.draftUpdatedAt = new Date() }
    } else {
      // Draft magazine: save directly to pages (no separate draft needed)
      if (pages !== undefined) mag.pages = pages
    }
    if (name !== undefined) mag.name = name
    await mag.save()
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DISCARD DRAFT — clear draftPages without publishing ───────────────────────
router.patch('/:id/discard-draft', requireAuth, async (req, res) => {
  try {
    const mag = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    mag.draftPages = []
    mag.draftUpdatedAt = undefined
    await mag.save()
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PUBLISH — copies draftPages → pages (if draft exists), marks as published ─
router.patch('/:id/publish', requireAuth, async (req, res) => {
  try {
    const mag = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    // If there's a saved draft, promote it to live
    if (mag.draftPages?.length > 0) {
      mag.pages = mag.draftPages
      mag.draftPages = []
      mag.draftUpdatedAt = undefined
    }
    await Magazine.updateMany({ user: req.user._id, status: 'published', _id: { $ne: mag._id } }, { status: 'draft' })
    mag.status = 'published'
    mag.publishedAt = new Date()
    await mag.save()
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── UNPUBLISH ─────────────────────────────────────────────────────────────────
router.patch('/:id/unpublish', requireAuth, async (req, res) => {
  try {
    const mag = await Magazine.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: 'draft' },
      { new: true }
    )
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    res.json({ magazine: mag })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── SEND PUBLISH EMAIL — with PDF attachment ──────────────────────────────────
router.post('/:id/send-publish-email', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, isRepublish } = req.body
    const mag  = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })

    const user = await User.findById(req.user._id).select('name email')
    if (!user?.email) return res.status(400).json({ error: 'No email on file.' })

    // Fire-and-forget — enqueued with auto-retry, returns void
    sendMagazinePublishedEmail({
      to:           user.email,
      name:         user.name || 'there',
      magazineName: mag.name || 'Your Magazine',
      isRepublish:  !!isRepublish,
      pdfBase64,
    })

    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const mag = await Magazine.findOne({ _id: req.params.id, user: req.user._id })
    if (!mag) return res.status(404).json({ error: 'Not found.' })
    // Clean up S3 keys
    const keys = mag.pages.flatMap(p => p.images.map(i => i.s3Key)).filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k).catch(() => {})))
    await mag.deleteOne()
    res.json({ message: 'Deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
