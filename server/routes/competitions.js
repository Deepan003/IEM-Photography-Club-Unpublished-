import nodemailer  from 'nodemailer'
import { Router }   from 'express'
import Competition   from '../models/Competition.js'
import User          from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

function createMailer() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}
const FROM = () => `"IEM Photography Club" <${process.env.EMAIL_USER}>`

async function sendVolunteerAddedEmail(toEmail, toName, comp, role) {
  try {
    const mailer = createMailer()
    const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
      <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
      <p style="color:#aaa;font-size:14px">Hi ${toName},</p>
      <p style="color:#ddd;font-size:14px">You have been added as a <strong style="color:#fff">${role}</strong> for the competition:</p>
      <div style="background:#111;border:1px solid #333;border-radius:10px;padding:18px;margin:16px 0">
        <p style="color:#fff;font-size:18px;margin:0;font-weight:600">${comp.name}</p>
        ${comp.details?.venue ? `<p style="color:#888;font-size:13px;margin:8px 0 0">📍 ${comp.details.venue}</p>` : ''}
        ${comp.eventDate ? `<p style="color:#888;font-size:13px;margin:4px 0 0">📅 ${new Date(comp.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>` : ''}
      </div>
      <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
    </div>`
    await mailer.sendMail({ from: FROM(), to: toEmail, subject: `You've been added to ${comp.name}`, html })
  } catch { /* non-fatal */ }
}

async function sendVolRoleChangeEmail(toEmail, toName, comp, from, to) {
  try {
    const mailer = createMailer()
    const promoted = to === 'coordinator'
    const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
      <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
      <p style="color:#aaa;font-size:14px">Hi ${toName},</p>
      <p style="color:#ddd;font-size:14px">Your role in <strong>${comp.name}</strong> has been ${promoted ? 'upgraded' : 'updated'}:</p>
      <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:16px">
        <div style="text-align:center"><p style="color:#888;font-size:11px;margin:0 0 4px">Previous</p><p style="color:#aaa;font-size:16px;margin:0;font-weight:600;text-transform:capitalize">${from}</p></div>
        <div style="color:#dc2626;font-size:20px">→</div>
        <div style="text-align:center"><p style="color:#888;font-size:11px;margin:0 0 4px">New Role</p><p style="color:${promoted?'#4ade80':'#f87171'};font-size:18px;margin:0;font-weight:700;text-transform:capitalize">${to}</p></div>
      </div>
      <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
    </div>`
    await mailer.sendMail({ from: FROM(), to: toEmail, subject: `Role update in ${comp.name}`, html })
  } catch { /* non-fatal */ }
}

const router = Router()
const admin  = [requireAuth, requireRole('admin','core')]

const POPULATE_VOLS   = 'volunteers.user'
const POPULATE_FIELDS = 'name email profilePhoto role'
const POPULATE_EXCL   = { path: 'excludedCores', select: '_id role name email profilePhoto department startYear endYear' }

// ── Middleware: admin/core OR volunteer of this competition (when allowed) ─────
async function adminOrCompVolunteer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })
  if (['admin', 'core'].includes(req.user.role)) return next()
  try {
    const comp = await Competition.findById(req.params.id).select('volunteers allowVolunteersEdit')
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (!comp.allowVolunteersEdit) return res.status(403).json({ error: 'Not authorized.' })
    const vol = comp.volunteers.find(v => v.user?.toString() === req.user._id.toString())
    if (vol) return next()
    return res.status(403).json({ error: 'Not authorized.' })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}

async function refreshStatuses() {
  const comps = await Competition.find({ manualStatus: false })
  for (const c of comps) {
    const computed = c.computeStatus()
    if (c.status !== computed) { c.status = computed; await c.save() }
  }
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await refreshStatuses()
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const comps = await Competition.find(filter)
      .populate('createdBy', 'name')
      .populate(POPULATE_VOLS, POPULATE_FIELDS)
      .populate('winners.user', 'name profilePhoto')
      .sort({ createdAt: -1 })
    res.json({ competitions: comps })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [comp, coreUsers] = await Promise.all([
      Competition.findById(req.params.id)
        .populate('createdBy', 'name')
        .populate(POPULATE_VOLS, POPULATE_FIELDS)
        .populate(POPULATE_EXCL)
        .populate('winners.user', 'name profilePhoto')
        .populate('submissions.user', 'name profilePhoto department')
        .populate('announcements.createdBy', 'name role'),
      User.find({ role: 'core' }, 'name email profilePhoto role department startYear endYear'),
    ])
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const excludedSet = new Set((comp.excludedCores || []).map(u => u._id?.toString()))
    const explicitSet = new Set((comp.volunteers  || []).map(v => {
      const u = v.user
      return typeof u === 'object' ? u._id?.toString() : u?.toString()
    }))
    const coreMembers = coreUsers
      .filter(c => !excludedSet.has(c._id.toString()) && !explicitSet.has(c._id.toString()))
      .map(c => ({ user: c, role: 'coordinator', isImplicit: true }))
    res.json({ competition: comp, coreMembers })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', admin, async (req, res) => {
  try {
    const comp = await Competition.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put('/:id', admin, async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const { volunteers, coordinators, announcements, ...rest } = req.body
    Object.assign(comp, rest)
    if (!comp.manualStatus) comp.status = comp.computeStatus()
    await comp.save()
    await comp.populate(POPULATE_VOLS, POPULATE_FIELDS)
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const keys = [comp.bannerS3Key, comp.competitionBannerS3Key, ...comp.gallery.map(g=>g.s3Key)].filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k)))
    await comp.deleteOne()
    res.json({ message: 'Competition deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PUBLISH FORM ──────────────────────────────────────────────────────────────
router.patch('/:id/publish', admin, async (req, res) => {
  try {
    const { googleFormUrl, publish } = req.body
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (googleFormUrl !== undefined) comp.googleFormUrl = googleFormUrl
    if (publish !== undefined) comp.formPublished = publish
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── VISIBILITY ────────────────────────────────────────────────────────────────
router.patch('/:id/open-to-all', admin, async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    comp.isOpenToAll = !!req.body.isOpenToAll
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── COORDINATOR PERMISSIONS ───────────────────────────────────────────────────
router.patch('/:id/coord-perms', admin, async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const fields = ['coordCanEditDetails','coordCanManageGallery','coordCanManageWinners','coordCanManageVolunteers','coordCanAnnounce','allowVolunteersEdit','showInGallery','manualStatus','status','hideWinnersTab','showWinnersOnMain']
    fields.forEach(f => { if (req.body[f] !== undefined) comp[f] = req.body[f] })
    // Keep allowVolunteersEdit in sync with coordCanEditDetails as the master toggle
    if (req.body.coordCanEditDetails !== undefined) comp.allowVolunteersEdit = req.body.coordCanEditDetails
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GALLERY ───────────────────────────────────────────────────────────────────
router.post('/:id/gallery', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const { imageUrl, s3Key, mobileUrl, mobileKey, caption } = req.body
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    comp.gallery.push({ imageUrl, s3Key, mobileUrl, mobileKey, caption, order: comp.gallery.length })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/gallery/:photoId', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const photo = comp.gallery.id(req.params.photoId)
    if (photo?.s3Key) await deleteObject(photo.s3Key)
    comp.gallery.pull({ _id: req.params.photoId })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Reorder gallery
router.patch('/:id/gallery/reorder', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const { orderedIds } = req.body  // array of photo _ids in new order
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    orderedIds.forEach((id, idx) => {
      const photo = comp.gallery.id(id)
      if (photo) photo.order = idx
    })
    comp.gallery.sort((a, b) => a.order - b.order)
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── WINNERS ───────────────────────────────────────────────────────────────────
router.post('/:id/winners', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const { name, label, position, photoUrl, photoS3Key, winningPhotoUrl, winningPhotoS3Key } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Winner name is required.' })
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    // Coordinators can only add winners if coordCanManageWinners is enabled
    if (!['admin','core'].includes(req.user.role) && !comp.coordCanManageWinners) {
      return res.status(403).json({ error: 'Winner management is not enabled for this competition.' })
    }
    comp.winners.push({ name: name.trim(), label: label || '1st Prize', position, photoUrl, photoS3Key, winningPhotoUrl, winningPhotoS3Key })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/winners/:winnerId', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (!['admin','core'].includes(req.user.role) && !comp.coordCanManageWinners) {
      return res.status(403).json({ error: 'Winner management is not enabled.' })
    }
    const w = comp.winners.id(req.params.winnerId)
    if (!w) return res.status(404).json({ error: 'Winner not found.' })
    const { name, label, position, photoUrl, photoS3Key, winningPhotoUrl, winningPhotoS3Key } = req.body
    if (name            !== undefined) w.name            = name
    if (label           !== undefined) w.label           = label
    if (position        !== undefined) w.position        = position
    if (photoUrl        !== undefined) w.photoUrl        = photoUrl
    if (photoS3Key      !== undefined) w.photoS3Key      = photoS3Key
    if (winningPhotoUrl    !== undefined) w.winningPhotoUrl    = winningPhotoUrl
    if (winningPhotoS3Key  !== undefined) w.winningPhotoS3Key  = winningPhotoS3Key
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/winners/:winnerId', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (!['admin','core'].includes(req.user.role) && !comp.coordCanManageWinners) {
      return res.status(403).json({ error: 'Winner management is not enabled.' })
    }
    const w = comp.winners.id(req.params.winnerId)
    const keys = [w?.photoS3Key, w?.winningPhotoS3Key].filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k)))
    comp.winners.pull({ _id: req.params.winnerId })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── LINKS ─────────────────────────────────────────────────────────────────────
router.post('/:id/links', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const { name, url, type } = req.body
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required.' })
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    comp.links.push({ name, url, type: type||'external' })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/links/:linkId', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const link = comp.links.id(req.params.linkId)
    if (!link) return res.status(404).json({ error: 'Link not found.' })
    const { name, url, type } = req.body
    if (name !== undefined) link.name = name
    if (url  !== undefined) link.url  = url
    if (type !== undefined) link.type = type
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/links/:linkId', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    comp.links.pull({ _id: req.params.linkId })
    await comp.save()
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── VOLUNTEERS ────────────────────────────────────────────────────────────────
router.post('/:id/volunteers', admin, async (req, res) => {
  try {
    const { userId } = req.body
    const [comp, user] = await Promise.all([
      Competition.findById(req.params.id),
      User.findById(userId).select('name email role'),
    ])
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    // If this user was a core that was previously excluded, clear the exclusion
    if (user.role === 'core' && comp.excludedCores?.length) {
      comp.excludedCores = comp.excludedCores.filter(id => id.toString() !== userId)
    }
    const already = comp.volunteers.some(v => v.user?.toString() === userId)
    if (!already) comp.volunteers.push({ user: userId, role: 'volunteer' })
    await comp.save()
    sendVolunteerAddedEmail(user.email, user.name, comp, 'volunteer')
    await comp.populate(POPULATE_VOLS, POPULATE_FIELDS)
    await comp.populate(POPULATE_EXCL)
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/volunteers/:userId', admin, async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    // Core users cannot remove other core members or admins (mirrors event logic)
    const targetUser = await User.findById(req.params.userId).select('role')
    if (req.user.role === 'core' && targetUser && ['admin','core'].includes(targetUser.role)) {
      return res.status(403).json({ error: 'Core members cannot remove admins or other core members.' })
    }
    // If removing a core, add to excludedCores so they leave the implicit list
    if (targetUser?.role === 'core') {
      if (!comp.excludedCores) comp.excludedCores = []
      const alreadyExcluded = comp.excludedCores.some(id => id.toString() === req.params.userId)
      if (!alreadyExcluded) comp.excludedCores.push(req.params.userId)
    }
    comp.volunteers = comp.volunteers.filter(v => v.user?.toString() !== req.params.userId)
    await comp.save()
    res.json({ message: 'Volunteer removed.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Set volunteer role (promote/demote) — sends email
router.patch('/:id/volunteers/:userId/role', admin, async (req, res) => {
  try {
    const { role } = req.body
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    const vol = comp.volunteers.find(v => v.user?.toString() === req.params.userId)
    if (!vol) return res.status(404).json({ error: 'Volunteer not found.' })
    // Core users cannot change the role of other core members
    if (req.user.role === 'core') {
      const targetUser = await User.findById(req.params.userId).select('role')
      if (targetUser?.role === 'core') {
        return res.status(403).json({ error: 'Core members cannot modify the role of other core members.' })
      }
    }
    const oldRole = vol.role
    vol.role = role
    await comp.save()
    if (oldRole !== role) {
      const user = await User.findById(req.params.userId).select('name email')
      if (user?.email) sendVolRoleChangeEmail(user.email, user.name, comp, oldRole, role)
    }
    await comp.populate(POPULATE_VOLS, POPULATE_FIELDS)
    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
router.post('/:id/announcements', [requireAuth, adminOrCompVolunteer], async (req, res) => {
  try {
    const { message, content, subject, recipientType = 'all', pinned } = req.body
    const body = (content || message || '').trim()
    if (!body) return res.status(400).json({ error: 'Content required.' })

    const comp = await Competition.findById(req.params.id)
      .populate('volunteers.user', 'name email role')
    if (!comp) return res.status(404).json({ error: 'Not found.' })

    const isPriv = ['admin','core'].includes(req.user.role)
    const sentByRole = isPriv ? req.user.role : 'coordinator'

    comp.announcements.unshift({
      message: body, subject: subject?.trim() || undefined,
      recipientType, sentByRole, pinned: !!pinned, createdBy: req.user._id,
    })
    await comp.save()
    await comp.populate('announcements.createdBy', 'name role')

    // Fire-and-forget emails to participants
    const allVols = (comp.volunteers || []).map(v => v.user).filter(u => u?.email)
    const coordsOnly = (comp.volunteers || []).filter(v => v.role === 'coordinator').map(v => v.user).filter(u => u?.email)
    const targets = recipientType === 'coordinators' ? coordsOnly : allVols
    const senderLabel = sentByRole === 'coordinator' ? `${req.user.name} (Coordinator)` : req.user.name
    const emailSubject = subject?.trim() ? `📢 ${subject.trim()}` : `📢 Announcement: ${comp.name}`
    targets.forEach(u => {
      createMailer().sendMail({
        from: FROM(), to: u.email, subject: emailSubject,
        html: `<div style="background:#050505;padding:40px 36px;font-family:'Segoe UI',sans-serif;max-width:540px;margin:auto;border-radius:18px;border:1px solid rgba(220,38,38,0.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#7f1d1d);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📷</div>
            <div><div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.14em;text-transform:uppercase">IEM Photography Club</div>
            <div style="font-size:11px;color:#555;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px">Competition Announcement</div></div>
          </div>
          <div style="height:2px;background:linear-gradient(to right,#dc2626,#9f1239,rgba(159,18,57,0));border-radius:1px;margin-bottom:20px"></div>
          <p style="margin:0 0 6px;color:#dc2626;font-size:12px;letter-spacing:2px;text-transform:uppercase">📢 ${comp.name}</p>
          ${subject ? `<h3 style="margin:0 0 16px;color:#fff;font-size:18px;font-weight:700">${subject}</h3>` : ''}
          <p style="color:#aaa;font-size:15px;margin:0 0 12px">Hi ${u.name},</p>
          <div style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;color:#d4d4d4;font-size:15px;line-height:1.85">${body}</div>
          <p style="color:#555;font-size:12px;margin:20px 0 0;border-top:1px solid #111;padding-top:14px">Sent by ${senderLabel} · IEM Photography Club</p>
        </div>`,
      }).catch(() => {})
    })

    res.json({ competition: comp })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/announcements/:aId', admin, async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    comp.announcements.pull({ _id: req.params.aId })
    await comp.save()
    res.json({ message: 'Announcement deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── SUBMIT (member uploads entry) ─────────────────────────────────────────────
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const { imageUrl, s3Key, title, description } = req.body
    const comp = await Competition.findById(req.params.id)
    if (!comp) return res.status(404).json({ error: 'Not found.' })
    if (!['active','upcoming'].includes(comp.status)) {
      return res.status(400).json({ error: 'This competition is not accepting submissions.' })
    }
    const already = comp.submissions.find(s => s.user?.toString() === req.user._id.toString())
    if (already) return res.status(400).json({ error: 'You have already submitted.' })
    comp.submissions.push({ user: req.user._id, imageUrl, s3Key, title, description })
    await comp.save()
    res.json({ message: 'Submission received!' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
