import { Router }    from 'express'
import User          from '../models/User.js'
import CoreMember    from '../models/CoreMember.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

const router = Router()
const adminOrCore = [requireAuth, requireRole('admin', 'core')]

// Academic session base: June 1 starts new session
function sessionBase() {
  const now = new Date()
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
}

// Public: list active members — approved AND tenure extends into current session
router.get('/', async (req, res) => {
  try {
    const base = sessionBase()
    const members = await User.find({
      status: 'approved',
      $or: [{ endYear: null }, { endYear: { $exists: false } }, { endYear: { $gt: base } }],
    }).select('name role profilePhoto department enrollmentNumber startYear endYear')
      .sort({ role: -1, name: 1 })
      .lean()
    res.json({ members })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Public: list alumni — User passouts + past CoreMembers without linked accounts
router.get('/passout', async (req, res) => {
  try {
    const base = sessionBase()
    const curSessionStr = `${base}-${String(base + 1).slice(-2)}`

    // 1. User-based alumni (explicit passout OR approved with past endYear)
    const userAlumni = await User.find({
      $or: [
        { status: 'passout' },
        { status: 'approved', endYear: { $exists: true, $ne: null, $lte: base } },
      ],
    }).select('name role profilePhoto department startYear endYear').lean()

    // 2. CoreMember alumni — past sessions, no linked User account
    const pastCoreEntries = await CoreMember.find({
      year: { $ne: curSessionStr },
      $or: [{ linkedUser: null }, { linkedUser: { $exists: false } }],
    }).select('name year designation photoUrl').lean()

    // Convert CoreMember → alumni shape
    const coreAlumni = pastCoreEntries.map(m => {
      const baseYear = parseInt(m.year.split('-')[0])
      const endYear  = isNaN(baseYear) ? null : baseYear + 1
      const desig    = (m.designation || '').toLowerCase()
      const role     = desig.includes('coord') ? 'coordinator' : 'core'
      return { _id: m._id, name: m.name, role, profilePhoto: m.photoUrl || null, endYear, department: null, startYear: null }
    })

    const members = [...userAlumni, ...coreAlumni].sort((a, b) => (a.endYear || 0) - (b.endYear || 0) || a.name.localeCompare(b.name))
    res.json({ members })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Gallery routes (/me/*) — must be defined before GET /:id ─────────────────

// Authenticated: get own gallery
router.get('/me/gallery', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('gallery coverPhoto coverPhotoS3Key coverPhotoPosition')
    res.json({ gallery: (user.gallery || []).sort((a, b) => a.order - b.order), coverPhoto: user.coverPhoto || null, coverPhotoPosition: user.coverPhotoPosition || '50%' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: add photos to own gallery
router.post('/me/gallery', requireAuth, async (req, res) => {
  try {
    const { photos } = req.body // [{ url, s3Key, caption? }]
    if (!Array.isArray(photos) || !photos.length) return res.status(400).json({ error: 'photos required' })
    const user = await User.findById(req.user._id).select('gallery')
    const startOrder = (user.gallery || []).reduce((max, p) => Math.max(max, p.order), -1) + 1
    const toAdd = photos.slice(0, 50).map((p, i) => ({
      url:       p.url,
      s3Key:     p.s3Key,
      mobileUrl: p.mobileUrl,
      mobileKey: p.mobileKey,
      caption:   p.caption || '',
      order:     startOrder + i,
    }))
    user.gallery.push(...toAdd)
    await user.save()
    res.json({ gallery: user.gallery.sort((a, b) => a.order - b.order) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: delete one gallery photo
router.delete('/me/gallery/:photoId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('gallery')
    const photo = user.gallery.id(req.params.photoId)
    if (!photo) return res.status(404).json({ error: 'Photo not found' })
    const s3Key = photo.s3Key
    user.gallery.pull(req.params.photoId)
    await user.save()
    if (s3Key) await deleteObject(s3Key).catch(() => {})
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: reorder gallery
router.put('/me/gallery/reorder', requireAuth, async (req, res) => {
  try {
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' })
    const user = await User.findById(req.user._id).select('gallery')
    orderedIds.forEach((id, i) => {
      const photo = user.gallery.id(id)
      if (photo) photo.order = i
    })
    await user.save()
    res.json({ gallery: user.gallery.sort((a, b) => a.order - b.order) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: set cover photo
router.patch('/me/cover', requireAuth, async (req, res) => {
  try {
    const { coverPhoto, coverPhotoS3Key } = req.body
    const old = await User.findById(req.user._id).select('coverPhotoS3Key')
    if (old?.coverPhotoS3Key && old.coverPhotoS3Key !== coverPhotoS3Key) {
      await deleteObject(old.coverPhotoS3Key).catch(() => {})
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { coverPhoto, coverPhotoS3Key },
      { new: true }
    ).select('coverPhoto coverPhotoS3Key')
    res.json({ user })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: update own cover photo position
router.patch('/me/cover-position', requireAuth, async (req, res) => {
  try {
    const { coverPhotoPosition } = req.body
    await User.findByIdAndUpdate(req.user._id, { coverPhotoPosition })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Public member profile ─────────────────────────────────────────────────────

// Public: get one member's public profile (includes gallery + coverPhoto)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name role profilePhoto bio department enrollmentNumber startYear endYear createdAt coverPhoto coverPhotoPosition gallery instagramHandle email status')
    if (!user || !['approved', 'passout'].includes(user.status)) return res.status(404).json({ error: 'Not found.' })
    // Sort gallery by order before sending
    const plain = user.toObject()
    plain.gallery = (plain.gallery || []).sort((a, b) => a.order - b.order)
    res.json({ user: plain })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Admin: manage any user's gallery / cover ──────────────────────────────────
router.delete('/:id/gallery/:photoId', adminOrCore, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('gallery')
    if (!user) return res.status(404).json({ error: 'User not found.' })
    const photo = user.gallery.id(req.params.photoId)
    if (!photo) return res.status(404).json({ error: 'Photo not found.' })
    if (photo.s3Key) deleteObject(photo.s3Key).catch(() => {})
    user.gallery.pull(req.params.photoId)
    await user.save()
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/cover-position', adminOrCore, async (req, res) => {
  try {
    const { coverPhotoPosition } = req.body
    await User.findByIdAndUpdate(req.params.id, { coverPhotoPosition })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/cover', adminOrCore, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('coverPhoto coverPhotoS3Key')
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.coverPhotoS3Key) deleteObject(user.coverPhotoS3Key).catch(() => {})
    await User.findByIdAndUpdate(req.params.id, { $unset: { coverPhoto: '', coverPhotoS3Key: '' } })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Authenticated: update own profile (bio, profilePhoto)
router.patch('/me/profile', requireAuth, async (req, res) => {
  try {
    const { bio, profilePhoto, profilePhotoS3Key, instagramHandle } = req.body
    const updates = {}
    if (bio             !== undefined) updates.bio             = bio
    if (profilePhoto    !== undefined) updates.profilePhoto    = profilePhoto
    if (instagramHandle !== undefined) updates.instagramHandle = instagramHandle

    // If new photo, delete old S3 key
    if (profilePhotoS3Key) {
      const old = await User.findById(req.user._id).select('profilePhotoS3Key')
      if (old?.profilePhotoS3Key && old.profilePhotoS3Key !== profilePhotoS3Key) {
        await deleteObject(old.profilePhotoS3Key).catch(() => {})
      }
      updates.profilePhotoS3Key = profilePhotoS3Key
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-password -otpHash -otpExpiry -otpPurpose')
    res.json({ user })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
