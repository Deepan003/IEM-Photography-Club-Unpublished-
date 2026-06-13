import { Router }     from 'express'
import GallerySection  from '../models/GallerySection.js'
import GalleryPhoto    from '../models/GalleryPhoto.js'
import Event           from '../models/Event.js'
import User            from '../models/User.js'
import AppSettings     from '../models/AppSettings.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

const router  = Router()
const canEdit = [requireAuth, requireRole('admin','core','coordinator')]

// ── Gallery display endpoint for home page ────────────────────────────────────
// Returns events with photos, sorted newest-first (current session first naturally).
// showInGallery = true  → force-on, always included even without photos
// showInGallery = false → force-off, never included
// showInGallery = null  → auto mode: included only if it has gallery photos
// Status (upcoming/ongoing/past) is NOT a filter — an upcoming event with pre-uploaded
// photos should appear so the current session is always represented.
router.get('/event-cinema', async (req, res) => {
  try {
    // Fetch candidates: everything that isn't force-hidden
    const candidates = await Event.find({
      showInGallery: { $ne: false },
    })
      // Manual order first (galleryOrder 1, 2, … for pinned events),
      // then most-recent events first so current-session events naturally lead
      .sort({ galleryOrder: 1, eventDate: -1, startDate: -1, createdAt: -1 })
      .limit(24)   // over-fetch so photo-less filtering doesn't leave us short
      .lean()

    const withPhotos = await Promise.all(candidates.map(async ev => {
      const photos = await GalleryPhoto.find({ event: ev._id, type: 'event' })
        .sort({ order: 1, createdAt: 1 })
        .limit(20)
        .populate('photographer.userId', 'name profilePhoto')
        .lean()
      return { ...ev, photos }
    }))

    // Auto-mode events with zero photos are not ready to display — exclude them.
    // Force-on events (showInGallery === true) are always kept.
    const result = withPhotos
      .filter(ev => ev.showInGallery === true || ev.photos.length > 0)
      .slice(0, 12)

    res.json({ events: result })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Member search for photographer attribution ────────────────────────────────
router.get('/member-search', requireAuth, async (req, res) => {
  const q = req.query.q?.trim()
  if (!q || q.length < 1) return res.json({ users: [] })
  const users = await User.find({
    status: 'approved',
    name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  }).select('name profilePhoto department startYear endYear').limit(10).lean()
  res.json({ users })
})

// ── Sections ──────────────────────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  const { type = 'club', event } = req.query
  const filter = { type }
  if (event) filter.event = event
  const sections = await GallerySection.find(filter).sort({ order:1, name:1 }).lean()
  res.json({ sections })
})

router.post('/sections', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const { name, type='club', event, order } = req.body
    const section = await GallerySection.create({ name, type, event, order: order||0, createdBy: req.user._id })
    res.status(201).json({ section })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/sections/:id', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    // Move every photo in this section to General (no section) before deleting
    await GalleryPhoto.updateMany({ section: req.params.id }, { $unset: { section: 1 } })
    await GallerySection.findByIdAndDelete(req.params.id)
    res.json({ message: 'Section deleted. Photos moved to General.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Photos ────────────────────────────────────────────────────────────────────
router.get('/photos', async (req, res) => {
  const filter = {}
  if (req.query.type)    filter.type    = req.query.type
  if (req.query.section) filter.section = req.query.section
  if (req.query.event)   filter.event   = req.query.event
  const photos = await GalleryPhoto.find(filter)
    .populate('addedBy', 'name')
    .populate('section', 'name')
    .populate('photographer.userId', 'name profilePhoto')
    .sort({ order: 1, createdAt: -1 })
    .limit(Number(req.query.limit) || 200)
    .lean()
  res.json({ photos })
})

router.post('/photos', requireAuth, async (req, res) => {
  try {
    const { imageUrl, s3Key, mobileUrl, mobileS3Key, caption, section, event: eventId, type='club', featured, photographer, order } = req.body
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' })

    const userRole = req.user.role

    // Club gallery: admin, core, or coordinator with canUploadGallery permission
    if (type === 'club' && !['admin','core'].includes(userRole)) {
      if (userRole !== 'coordinator') {
        return res.status(403).json({ error: 'Only admin or core can upload to club gallery.' })
      }
      const setting = await AppSettings.findOne({ key: 'coordinator.canUploadGallery' })
      const allowed = setting ? setting.value : true
      if (!allowed) return res.status(403).json({ error: 'Gallery upload is disabled for coordinators.' })
    }

    // Event gallery: admin, core, OR event-coordinator in that specific event
    if (type === 'event') {
      if (!['admin','core'].includes(userRole)) {
        // Check event membership — anyone who is event coordinator can upload (regardless of global role)
        const ev = await Event.findById(eventId)
        if (!ev) return res.status(404).json({ error: 'Event not found.' })
        const membership = ev.members?.find(m => m.user?.toString() === req.user._id.toString())
        if (!membership || membership.eventRole !== 'coordinator') {
          return res.status(403).json({ error: 'Only event coordinators, core, or admin can upload to event gallery.' })
        }
        if (ev.coordCanUpload === false) {
          return res.status(403).json({ error: 'Coordinator uploads are disabled for this event.' })
        }
      }
    }

    const photo = await GalleryPhoto.create({
      imageUrl, s3Key, mobileUrl: mobileUrl||undefined, mobileS3Key: mobileS3Key||undefined,
      caption: caption||undefined, section, event: eventId, type, featured: !!featured,
      photographer: photographer || undefined,
      order: order || 0,
      addedBy: req.user._id,
    })
    await photo.populate('photographer.userId', 'name profilePhoto')
    res.status(201).json({ photo })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Update photo (caption, order, photographer)
router.patch('/photos/:id', canEdit, async (req, res) => {
  try {
    const photo = await GalleryPhoto.findById(req.params.id)
    if (!photo) return res.status(404).json({ error: 'Not found.' })
    const { caption, order, photographer } = req.body
    if (caption      !== undefined) photo.caption      = caption
    if (order        !== undefined) photo.order        = order
    if (photographer !== undefined) photo.photographer = photographer
    await photo.save()
    await photo.populate('photographer.userId', 'name profilePhoto')
    res.json({ photo })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/photos/:id', canEdit, async (req, res) => {
  const photo = await GalleryPhoto.findById(req.params.id)
  if (!photo) return res.status(404).json({ error: 'Not found.' })
  // Coordinator can only delete their own photos; admin/core can delete any
  const isOwner = photo.addedBy?.toString() === req.user?._id?.toString()
  const isPriv  = ['admin','core'].includes(req.user.role)
  if (!isOwner && !isPriv) return res.status(403).json({ error: 'Not allowed.' })
  if (photo.s3Key) await deleteObject(photo.s3Key).catch(() => {})
  await photo.deleteOne()
  res.json({ message: 'Photo deleted.' })
})

// Get coordinators list (users with coordinator role who can manage gallery)
router.get('/coordinators', requireAuth, async (req, res) => {
  try {
    const coordinators = await User.find({ role: { $in: ['coordinator','core','admin'] } })
      .select('name email profilePhoto role department startYear endYear')
      .sort({ role: 1, name: 1 })
    res.json({ coordinators })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Promote photographer to coordinator (admin/core only)
router.patch('/coordinators/:userId', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const { role } = req.body  // 'coordinator' or 'photographer'
    if (!['coordinator','photographer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' })
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true })
      .select('name email profilePhoto role')
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({ user })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Bulk reorder photos — club-level admin/core/coordinator OR event-level coordinator
router.put('/photos/reorder', requireAuth, async (req, res) => {
  try {
    const { orderedIds, eventId } = req.body
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required.' })

    const userRole = req.user.role
    const hasClubAccess = ['admin','core','coordinator'].includes(userRole)

    if (!hasClubAccess) {
      // Check if user is an event-level coordinator for this specific event
      if (!eventId) return res.status(403).json({ error: 'Not authorized.' })
      const ev = await Event.findById(eventId)
      const membership = ev?.members?.find(m => m.user?.toString() === req.user._id.toString())
      if (!membership || membership.eventRole !== 'coordinator') {
        return res.status(403).json({ error: 'Only coordinators of this event can reorder photos.' })
      }
      if (ev.coordCanReorder === false) {
        return res.status(403).json({ error: 'Coordinator reordering is disabled for this event.' })
      }
    }

    await Promise.all(orderedIds.map((id, i) => GalleryPhoto.findByIdAndUpdate(id, { order: i })))
    res.json({ message: 'Reordered.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
