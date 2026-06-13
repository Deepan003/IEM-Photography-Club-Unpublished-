import { Router } from 'express'
import CoreMember  from '../models/CoreMember.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

const router = Router()
const admin  = [requireAuth, requireRole('admin')]

router.get('/', async (req, res) => {
  const all = await CoreMember.find()
    .populate('linkedUser', 'name email profilePhoto role')
    .sort({ year: -1, order: 1, name: 1 })

  // Auto-purge stale linked entries: user was promoted → demoted but record wasn't cleaned up
  const stale = all.filter(m => m.linkedUser && !['admin', 'core'].includes(m.linkedUser.role))
  if (stale.length) {
    await CoreMember.deleteMany({ _id: { $in: stale.map(m => m._id) } })
  }

  const members = all.filter(m => !stale.some(s => s._id.equals(m._id)))
  res.json({ members })
})

router.post('/', admin, async (req, res) => {
  try {
    const { name, year, designation, stream, photoUrl, s3Key, coverPhoto, coverPhotoS3Key, linkedUser, order } = req.body
    if (!name || !year) return res.status(400).json({ error: 'Name and year are required.' })
    const member = await CoreMember.create({ name, year, designation, stream, photoUrl, s3Key, coverPhoto, coverPhotoS3Key, linkedUser, order: order||0 })
    res.status(201).json({ member })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', admin, async (req, res) => {
  try {
    const { name, year, designation, stream, photoUrl, s3Key, coverPhoto, coverPhotoS3Key, linkedUser, order } = req.body
    const member = await CoreMember.findByIdAndUpdate(
      req.params.id,
      { name, year, designation, stream, photoUrl, s3Key, coverPhoto, coverPhotoS3Key, linkedUser, order },
      { new: true }
    )
    if (!member) return res.status(404).json({ error: 'Not found.' })
    res.json({ member })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', admin, async (req, res) => {
  const m = await CoreMember.findById(req.params.id)
  if (!m) return res.status(404).json({ error: 'Not found.' })
  if (m.s3Key) await deleteObject(m.s3Key).catch(() => {})
  if (m.coverPhotoS3Key) await deleteObject(m.coverPhotoS3Key).catch(() => {})
  for (const p of m.gallery || []) {
    if (p.s3Key) deleteObject(p.s3Key).catch(() => {})
  }
  await m.deleteOne()
  res.json({ message: 'Member deleted.' })
})

// ── Single member (public) ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
      .populate('linkedUser', 'name email profilePhoto role')
    if (!m) return res.status(404).json({ error: 'Not found.' })
    const plain = m.toObject()
    plain.gallery = (plain.gallery || []).sort((a, b) => a.order - b.order)
    res.json({ member: plain })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Cover photo ───────────────────────────────────────────────────────────────
router.patch('/:id/cover', admin, async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
    if (!m) return res.status(404).json({ error: 'Not found.' })
    const { coverPhoto, coverPhotoS3Key } = req.body
    if (m.coverPhotoS3Key && m.coverPhotoS3Key !== coverPhotoS3Key) {
      deleteObject(m.coverPhotoS3Key).catch(() => {})
    }
    m.coverPhoto = coverPhoto; m.coverPhotoS3Key = coverPhotoS3Key
    await m.save()
    res.json({ ok: true, coverPhoto: m.coverPhoto })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/cover', admin, async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
    if (!m) return res.status(404).json({ error: 'Not found.' })
    if (m.coverPhotoS3Key) deleteObject(m.coverPhotoS3Key).catch(() => {})
    m.coverPhoto = undefined; m.coverPhotoS3Key = undefined
    await m.save()
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/cover-position', admin, async (req, res) => {
  try {
    const { coverPhotoPosition } = req.body
    await CoreMember.findByIdAndUpdate(req.params.id, { coverPhotoPosition })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Gallery ───────────────────────────────────────────────────────────────────
router.post('/:id/gallery', admin, async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
    if (!m) return res.status(404).json({ error: 'Not found.' })
    const { photos } = req.body
    if (!Array.isArray(photos) || !photos.length) return res.status(400).json({ error: 'photos required' })
    const nextOrder = m.gallery.length ? Math.max(...m.gallery.map(p => p.order)) + 1 : 0
    photos.forEach((p, i) => m.gallery.push({ url: p.url, s3Key: p.s3Key, mobileUrl: p.mobileUrl, mobileKey: p.mobileKey, caption: p.caption || '', order: nextOrder + i }))
    await m.save()
    res.json({ gallery: m.gallery.sort((a, b) => a.order - b.order) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/gallery/:photoId', admin, async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
    if (!m) return res.status(404).json({ error: 'Not found.' })
    const photo = m.gallery.id(req.params.photoId)
    if (!photo) return res.status(404).json({ error: 'Photo not found.' })
    if (photo.s3Key) deleteObject(photo.s3Key).catch(() => {})
    m.gallery.pull(req.params.photoId)
    await m.save()
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/gallery/reorder', admin, async (req, res) => {
  try {
    const m = await CoreMember.findById(req.params.id)
    if (!m) return res.status(404).json({ error: 'Not found.' })
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' })
    orderedIds.forEach((pid, i) => {
      const p = m.gallery.id(pid)
      if (p) p.order = i
    })
    await m.save()
    res.json({ gallery: m.gallery.sort((a, b) => a.order - b.order) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
