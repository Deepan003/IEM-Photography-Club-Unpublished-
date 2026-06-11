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
    const { name, year, designation, photoUrl, s3Key, linkedUser, order } = req.body
    if (!name || !year) return res.status(400).json({ error: 'Name and year are required.' })
    const member = await CoreMember.create({ name, year, designation, photoUrl, s3Key, linkedUser, order: order||0 })
    res.status(201).json({ member })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', admin, async (req, res) => {
  try {
    const member = await CoreMember.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!member) return res.status(404).json({ error: 'Not found.' })
    res.json({ member })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', admin, async (req, res) => {
  const m = await CoreMember.findById(req.params.id)
  if (!m) return res.status(404).json({ error: 'Not found.' })
  if (m.s3Key) await deleteObject(m.s3Key).catch(() => {})
  await m.deleteOne()
  res.json({ message: 'Member deleted.' })
})

export default router
