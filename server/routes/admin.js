import { Router }   from 'express'
import rateLimit     from 'express-rate-limit'
import User          from '../models/User.js'
import CoreMember    from '../models/CoreMember.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { sendApprovalEmail, sendRejectionEmail } from '../utils/email.js'

// 60 admin API calls per minute — prevents scraping / enumeration
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please slow down.' },
})

// Returns the current academic year string e.g. "2026-27"
// Before June  → year started previous calendar year: "2025-26"
// June onwards → year starting this calendar year:    "2026-27"
function currentAcademicYear() {
  const now = new Date(), yr = now.getFullYear(), mo = now.getMonth() + 1
  return mo < 6
    ? `${yr - 1}-${String(yr).slice(-2)}`
    : `${yr}-${String(yr + 1).slice(-2)}`
}

const router = Router()
const guard  = [adminLimiter, requireAuth, requireRole('admin', 'core')]

// ── LIST PENDING USERS ────────────────────────────────────────────────────
// GET /api/admin/pending
router.get('/pending', guard, async (req, res) => {
  try {
    const users = await User.find({ status: 'pending_admin' })
      .select('-password -otpHash -otpExpiry -otpPurpose')
      .sort({ createdAt: -1 })
    res.json({ users })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending users.' })
  }
})

// ── LIST ALL USERS ────────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', [requireAuth, requireRole('admin', 'core')], async (req, res) => {
  try {
    const { status, role, q } = req.query
    const filter = {}
    if (status) filter.status = status
    if (role)   filter.role   = role
    if (q)      filter.name   = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

    const users = await User.find(filter)
      .select('-password -otpHash -otpExpiry -otpPurpose')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ users })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' })
  }
})

// ── APPROVE USER ──────────────────────────────────────────────────────────
// POST /api/admin/approve/:id
router.post('/approve/:id', guard, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.status !== 'pending_admin') {
      return res.status(400).json({ error: 'User is not in pending state.' })
    }

    user.status     = 'approved'
    user.approvedBy = req.user._id
    user.approvedAt = new Date()
    await user.save()

    await sendApprovalEmail(user.email, user.name).catch(console.error)
    res.json({ message: `${user.name}'s account approved.` })
  } catch (err) {
    res.status(500).json({ error: 'Approval failed.' })
  }
})

// ── REJECT USER ───────────────────────────────────────────────────────────
// POST /api/admin/reject/:id
router.post('/reject/:id', guard, async (req, res) => {
  try {
    const { reason } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })

    user.status = 'rejected'
    await user.save()

    await sendRejectionEmail(user.email, user.name, reason).catch(console.error)
    res.json({ message: `${user.name}'s application rejected.` })
  } catch (err) {
    res.status(500).json({ error: 'Rejection failed.' })
  }
})

// ── PROMOTE USER ──────────────────────────────────────────────────────────
// POST /api/admin/promote/:id
// Body: { role: 'coordinator' | 'core' }
router.post('/promote/:id', guard, async (req, res) => {
  try {
    const { role } = req.body
    const allowed = req.user.role === 'admin'
      ? ['coordinator', 'core']
      : ['coordinator'] // core can only promote to coordinator

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'You cannot assign that role.' })
    }

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved users can be promoted.' })
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot change admin role.' })
    }

    user.role       = role
    user.promotedBy = req.user._id
    user.promotedAt = new Date()
    await user.save()

    // Auto-create CoreMember entry when promoted to core
    if (role === 'core') {
      const yearStr = currentAcademicYear()
      const exists  = await CoreMember.findOne({
        $or: [{ linkedUser: user._id }, { name: user.name, year: yearStr }],
      })
      if (!exists) {
        await CoreMember.create({
          name:        user.name,
          year:        yearStr,
          designation: 'Core',
          photoUrl:    user.profilePhoto      || '',
          s3Key:       user.profilePhotoS3Key || '',
          linkedUser:  user._id,
          order:       0,
        })
      }
    }

    res.json({ message: `${user.name} promoted to ${role}.` })
  } catch (err) {
    res.status(500).json({ error: 'Promotion failed.' })
  }
})

// ── DEMOTE USER ───────────────────────────────────────────────────────────
// POST /api/admin/demote/:id
router.post('/demote/:id', guard, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot demote the admin.' })
    }
    if (user.role === 'photographer') {
      return res.status(400).json({ error: 'Already at base role.' })
    }

    const wasCore = user.role === 'core'

    const hierarchy = { core: 'coordinator', coordinator: 'photographer' }
    user.role = hierarchy[user.role] || 'photographer'
    await user.save()

    // Remove the auto-linked CoreMember entry created on promotion so the
    // demoted user no longer appears on the Core Committee page/tab.
    if (wasCore) {
      await CoreMember.deleteOne({ linkedUser: user._id, year: currentAcademicYear() })
    }

    res.json({ message: `${user.name} demoted to ${user.role}.` })
  } catch (err) {
    res.status(500).json({ error: 'Demotion failed.' })
  }
})

// ── BAN USER ──────────────────────────────────────────────────────────────
// POST /api/admin/ban/:id
router.post('/ban/:id', guard, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot ban the admin account.' })
    user.status = 'banned'
    await user.save()
    res.json({ message: `${user.name} has been banned.` })
  } catch (err) {
    res.status(500).json({ error: 'Ban failed.' })
  }
})

// ── UNBAN USER ────────────────────────────────────────────────────────────
// POST /api/admin/unban/:id
router.post('/unban/:id', guard, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.status !== 'banned') return res.status(400).json({ error: 'User is not banned.' })
    user.status = 'approved'
    await user.save()
    res.json({ message: `${user.name} has been unbanned.` })
  } catch (err) {
    res.status(500).json({ error: 'Unban failed.' })
  }
})

// ── PERMANENTLY DELETE USER ────────────────────────────────────────────────
// DELETE /api/admin/delete/:id  — admin only
router.delete('/delete/:id', [requireAuth, requireRole('admin')], async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete the admin account.' })
    const name = user.name
    await User.deleteOne({ _id: req.params.id })
    res.json({ message: `${name}'s account and all data have been permanently deleted.` })
  } catch (err) {
    res.status(500).json({ error: 'Delete failed.' })
  }
})

export default router
