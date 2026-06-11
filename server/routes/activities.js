import nodemailer from 'nodemailer'
import { Router }  from 'express'
import Activity     from '../models/Activity.js'
import User         from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

function createMailer() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}
const FROM = () => `"IEM Photography Club" <${process.env.EMAIL_USER}>`

async function sendVolunteerAddedEmail(toEmail, toName, act, role) {
  try {
    const mailer = createMailer()
    const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
      <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
      <p style="color:#aaa;font-size:14px">Hi ${toName},</p>
      <p style="color:#ddd;font-size:14px">You have been added as a <strong style="color:#fff">${role}</strong> for the activity:</p>
      <div style="background:#111;border:1px solid #333;border-radius:10px;padding:18px;margin:16px 0">
        <p style="color:#fff;font-size:18px;margin:0;font-weight:600">${act.name}</p>
        ${act.venue ? `<p style="color:#888;font-size:13px;margin:8px 0 0">📍 ${act.venue}</p>` : ''}
        ${act.eventDate ? `<p style="color:#888;font-size:13px;margin:4px 0 0">📅 ${new Date(act.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>` : ''}
      </div>
      <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
    </div>`
    await mailer.sendMail({ from: FROM(), to: toEmail, subject: `You've been added to ${act.name}`, html })
  } catch { /* non-fatal */ }
}

async function sendVolRoleChangeEmail(toEmail, toName, act, from, to) {
  try {
    const mailer = createMailer()
    const promoted = to === 'coordinator'
    const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
      <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
      <p style="color:#aaa;font-size:14px">Hi ${toName},</p>
      <p style="color:#ddd;font-size:14px">Your role in <strong>${act.name}</strong> has been ${promoted ? 'upgraded' : 'updated'}:</p>
      <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:16px">
        <div style="text-align:center"><p style="color:#888;font-size:11px;margin:0 0 4px">Previous</p><p style="color:#aaa;font-size:16px;margin:0;font-weight:600;text-transform:capitalize">${from}</p></div>
        <div style="color:#dc2626;font-size:20px">→</div>
        <div style="text-align:center"><p style="color:#888;font-size:11px;margin:0 0 4px">New Role</p><p style="color:${promoted?'#4ade80':'#f87171'};font-size:18px;margin:0;font-weight:700;text-transform:capitalize">${to}</p></div>
      </div>
      <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
    </div>`
    await mailer.sendMail({ from: FROM(), to: toEmail, subject: `Role update in ${act.name}`, html })
  } catch { /* non-fatal */ }
}

const router = Router()
const admin  = [requireAuth, requireRole('admin','core')]

const POPULATE_VOLS   = 'volunteers.user'
const POPULATE_FIELDS = 'name email profilePhoto role'
const POPULATE_EXCL   = { path: 'excludedCores', select: '_id role name email profilePhoto department startYear endYear' }

async function adminOrActVolunteer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })
  if (['admin', 'core'].includes(req.user.role)) return next()
  try {
    const act = await Activity.findById(req.params.id).select('volunteers allowVolunteersEdit')
    if (!act) return res.status(404).json({ error: 'Not found.' })
    if (!act.allowVolunteersEdit) return res.status(403).json({ error: 'Not authorized.' })
    const vol = act.volunteers.find(v => v.user?.toString() === req.user._id.toString())
    if (vol) return next()
    return res.status(403).json({ error: 'Not authorized.' })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}

async function refreshStatuses() {
  const acts = await Activity.find({ manualStatus: false })
  for (const a of acts) {
    const computed = a.computeStatus()
    if (a.status !== computed) { a.status = computed; await a.save() }
  }
}

router.get('/', async (req, res) => {
  try {
    await refreshStatuses()
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const [acts, coreUsers] = await Promise.all([
      Activity.find(filter)
        .populate('createdBy', 'name')
        .populate(POPULATE_VOLS, POPULATE_FIELDS)
        .sort({ createdAt: -1 }),
      User.find({ role: 'core' }, '_id'),
    ])
    const coreIds = coreUsers.map(c => c._id.toString())
    const activities = acts.map(a => {
      const excluded = new Set((a.excludedCores || []).map(id => id.toString()))
      const explicitVolIds = new Set((a.volunteers || []).map(v => {
        const uid = v.user && typeof v.user === 'object' ? v.user._id?.toString() : v.user?.toString()
        return uid
      }).filter(Boolean))
      const implicitCoreIds = coreIds.filter(id => !excluded.has(id) && !explicitVolIds.has(id))
      const memberIds = [
        ...(a.volunteers || []).map(v => {
          const uid = v.user && typeof v.user === 'object' ? v.user._id?.toString() : v.user?.toString()
          return uid
        }).filter(Boolean),
        ...implicitCoreIds,
      ]
      return { ...a.toObject(), memberIds }
    })
    res.json({ activities })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const [act, coreUsers] = await Promise.all([
      Activity.findById(req.params.id)
        .populate('createdBy', 'name')
        .populate(POPULATE_VOLS, POPULATE_FIELDS)
        .populate(POPULATE_EXCL)
        .populate('announcements.createdBy', 'name role'),
      User.find({ role: 'core' }, '_id name email profilePhoto department startYear endYear role'),
    ])
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const excludedSet = new Set((act.excludedCores || []).map(u => (u && typeof u === 'object' ? u._id?.toString() : u?.toString())))
    const explicitSet = new Set((act.volunteers || []).map(v => {
      const uid = v.user && typeof v.user === 'object' ? v.user._id?.toString() : v.user?.toString()
      return uid
    }).filter(Boolean))
    const coreMembers = coreUsers
      .filter(c => !excludedSet.has(c._id.toString()) && !explicitSet.has(c._id.toString()))
      .map(c => ({ user: c, role: 'coordinator', isImplicit: true }))
    res.json({ activity: act, coreMembers })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', admin, async (req, res) => {
  try {
    const act = await Activity.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', admin, async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const { volunteers, announcements, ...rest } = req.body
    Object.assign(act, rest)
    if (!act.manualStatus) act.status = act.computeStatus()
    await act.save()
    await act.populate(POPULATE_VOLS, POPULATE_FIELDS)
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', admin, async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const keys = [act.bannerS3Key, act.activityBannerS3Key, ...act.gallery.map(g => g.s3Key)].filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k)))
    await act.deleteOne()
    res.json({ message: 'Activity deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/gallery', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const { imageUrl, s3Key, caption } = req.body
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    act.gallery.push({ imageUrl, s3Key, caption, order: act.gallery.length })
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/gallery/:photoId', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const photo = act.gallery.id(req.params.photoId)
    if (photo?.s3Key) await deleteObject(photo.s3Key)
    act.gallery.pull({ _id: req.params.photoId })
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/gallery/reorder', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const { orderedIds } = req.body
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    orderedIds.forEach((id, idx) => {
      const photo = act.gallery.id(id)
      if (photo) photo.order = idx
    })
    act.gallery.sort((a, b) => a.order - b.order)
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/links', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const { name, url, type } = req.body
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required.' })
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    act.links.push({ name, url, type: type || 'external' })
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/links/:linkId', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const link = act.links.id(req.params.linkId)
    if (!link) return res.status(404).json({ error: 'Link not found.' })
    const { name, url, type } = req.body
    if (name !== undefined) link.name = name
    if (url  !== undefined) link.url  = url
    if (type !== undefined) link.type = type
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/links/:linkId', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    act.links.pull({ _id: req.params.linkId })
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/volunteers', admin, async (req, res) => {
  try {
    const { userId } = req.body
    const [act, user] = await Promise.all([
      Activity.findById(req.params.id),
      User.findById(userId).select('name email role'),
    ])
    if (!act) return res.status(404).json({ error: 'Not found.' })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.role === 'core' && act.excludedCores?.length) {
      act.excludedCores = act.excludedCores.filter(id => id.toString() !== userId)
    }
    const already = act.volunteers.some(v => v.user?.toString() === userId)
    if (!already) act.volunteers.push({ user: userId, role: 'volunteer' })
    await act.save()
    sendVolunteerAddedEmail(user.email, user.name, act, 'volunteer')
    await act.populate(POPULATE_VOLS, POPULATE_FIELDS)
    await act.populate(POPULATE_EXCL)
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/volunteers/:userId', admin, async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const targetUser = await User.findById(req.params.userId).select('role')
    if (req.user.role === 'core' && targetUser && ['admin','core'].includes(targetUser.role)) {
      return res.status(403).json({ error: 'Cannot remove an admin or core member.' })
    }
    act.volunteers = act.volunteers.filter(v => v.user?.toString() !== req.params.userId)
    if (targetUser?.role === 'core') {
      if (!act.excludedCores.some(id => id.toString() === req.params.userId)) {
        act.excludedCores.push(req.params.userId)
      }
    }
    await act.save()
    await act.populate(POPULATE_VOLS, POPULATE_FIELDS)
    await act.populate(POPULATE_EXCL)
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/volunteers/:userId/role', admin, async (req, res) => {
  try {
    const { role } = req.body
    if (!['volunteer','coordinator'].includes(role)) return res.status(400).json({ error: 'Invalid role.' })
    const [act, user] = await Promise.all([
      Activity.findById(req.params.id),
      User.findById(req.params.userId).select('name email'),
    ])
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const vol = act.volunteers.find(v => v.user?.toString() === req.params.userId)
    if (!vol) return res.status(404).json({ error: 'Volunteer not found.' })
    const oldRole = vol.role
    vol.role = role
    await act.save()
    if (user && oldRole !== role) sendVolRoleChangeEmail(user.email, user.name, act, oldRole, role)
    await act.populate(POPULATE_VOLS, POPULATE_FIELDS)
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/announcements', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const { message, content, subject, recipientType = 'all' } = req.body
    const body = (content || message || '').trim()
    if (!body) return res.status(400).json({ error: 'Content required.' })

    const act = await Activity.findById(req.params.id)
      .populate('volunteers.user', 'name email role')
    if (!act) return res.status(404).json({ error: 'Not found.' })

    const isPriv = ['admin','core'].includes(req.user.role)
    const sentByRole = isPriv ? req.user.role : 'coordinator'

    act.announcements.unshift({
      message: body, subject: subject?.trim() || undefined,
      recipientType, sentByRole, createdBy: req.user._id,
    })
    await act.save()
    await act.populate('announcements.createdBy', 'name role')

    // Build recipient list: volunteers + implicit core members
    const explicitVols = (act.volunteers || []).map(v => v.user).filter(u => u?.email)
    const excludedSet  = new Set((act.excludedCores || []).map(id => id.toString()))
    const coreUsers    = await User.find({ role: 'core', approved: true }, 'name email')
    const coreTargets  = coreUsers.filter(c => !excludedSet.has(c._id.toString()))
    const coordsOnly   = (act.volunteers || []).filter(v => v.role === 'coordinator').map(v => v.user).filter(u => u?.email)

    let targets
    if (recipientType === 'coordinators') {
      targets = [...coordsOnly, ...coreTargets]
    } else {
      const seen = new Set()
      targets = [...explicitVols, ...coreTargets].filter(u => {
        const k = u._id?.toString() || u._id; if (seen.has(k)) return false; seen.add(k); return true
      })
    }

    const senderLabel = sentByRole === 'coordinator' ? `${req.user.name} (Coordinator)` : req.user.name
    const emailSubject = subject?.trim() ? `📢 ${subject.trim()}` : `📢 Announcement: ${act.name}`
    targets.forEach(u => {
      createMailer().sendMail({
        from: FROM(), to: u.email, subject: emailSubject,
        html: `<div style="background:#050505;padding:40px 36px;font-family:'Segoe UI',sans-serif;max-width:540px;margin:auto;border-radius:18px;border:1px solid rgba(220,38,38,0.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#7f1d1d);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📷</div>
            <div><div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.14em;text-transform:uppercase">IEM Photography Club</div>
            <div style="font-size:11px;color:#555;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px">Activity Announcement</div></div>
          </div>
          <div style="height:2px;background:linear-gradient(to right,#dc2626,#9f1239,rgba(159,18,57,0));border-radius:1px;margin-bottom:20px"></div>
          <p style="margin:0 0 6px;color:#dc2626;font-size:12px;letter-spacing:2px;text-transform:uppercase">📢 ${act.name}</p>
          ${subject ? `<h3 style="margin:0 0 16px;color:#fff;font-size:18px;font-weight:700">${subject}</h3>` : ''}
          <p style="color:#aaa;font-size:15px;margin:0 0 12px">Hi ${u.name},</p>
          <div style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;color:#d4d4d4;font-size:15px;line-height:1.85">${body}</div>
          <p style="color:#555;font-size:12px;margin:20px 0 0;border-top:1px solid #111;padding-top:14px">Sent by ${senderLabel} · IEM Photography Club</p>
        </div>`,
      }).catch(() => {})
    })

    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/announcements/:aId', [requireAuth, adminOrActVolunteer], async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    act.announcements.pull({ _id: req.params.aId })
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/coord-perms', admin, async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id)
    if (!act) return res.status(404).json({ error: 'Not found.' })
    const fields = ['coordCanEditDetails','coordCanManageGallery','coordCanManageVolunteers','coordCanAnnounce','allowVolunteersEdit','showInGallery','manualStatus','status']
    fields.forEach(f => { if (req.body[f] !== undefined) act[f] = req.body[f] })
    if (req.body.coordCanEditDetails !== undefined) act.allowVolunteersEdit = req.body.coordCanEditDetails
    await act.save()
    res.json({ activity: act })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
