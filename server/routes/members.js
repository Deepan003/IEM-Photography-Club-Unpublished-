import { Router }    from 'express'
import User          from '../models/User.js'
import CoreMember    from '../models/CoreMember.js'
import { requireAuth } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

const router = Router()

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

// Public: get one member's public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name role profilePhoto bio department enrollmentNumber startYear endYear createdAt')
    if (!user || user.status !== 'approved') return res.status(404).json({ error: 'Not found.' })
    res.json({ user })
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
