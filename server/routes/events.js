import nodemailer  from 'nodemailer'
import { Router }  from 'express'
import Event        from '../models/Event.js'
import Announcement from '../models/Announcement.js'
import User         from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { deleteObject }             from '../utils/s3.js'
import GalleryPhoto                from '../models/GalleryPhoto.js'

const router = Router()
const senior = [requireAuth, requireRole('admin', 'core')]

// ── Middleware: admin/core OR coordinator of this specific event ───────────────
async function adminOrEventCoord(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })
  if (['admin', 'core'].includes(req.user.role)) return next()
  try {
    const event = await Event.findById(req.params.id).select('members')
    if (!event) return res.status(404).json({ error: 'Event not found.' })
    const m = event.members.find(m => m.user?.toString() === req.user._id.toString())
    if (m?.eventRole === 'coordinator') return next()
    return res.status(403).json({ error: 'Not authorized.' })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}

// ── Email transporter (lazy-initialised, reuses env vars set by dotenv) ───────
function createMailer() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}
const FROM = () => process.env.EMAIL_FROM || process.env.EMAIL_USER

// ── Event-added notification email ────────────────────────────────────────────
async function sendEventAddedEmail(to, memberName, event, isReAdded = false) {
  const subject = isReAdded
    ? `You've been re-added to "${event.name}"`
    : `You've been added to the event "${event.name}"`
  const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const dateParts = [
    event.startDate && `Start: ${fmtD(event.startDate)}`,
    event.endDate   && `End: ${fmtD(event.endDate)}`,
    event.eventDate && `Event Day: ${fmtD(event.eventDate)}`,
  ].filter(Boolean)
  const dates = dateParts.length
    ? dateParts.join(' · ')
    : (event.dates||[]).map(fmtD).join(' — ') || 'TBD'

  const html = `
  <div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
    <div style="border-bottom:2px solid #dc2626;padding-bottom:16px;margin-bottom:24px">
      <h2 style="margin:0;color:#fff;font-size:18px;letter-spacing:3px;text-transform:uppercase">📷 IEM Photography Club</h2>
    </div>
    ${event.logoUrl ? `<img src="${event.logoUrl}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-bottom:20px;display:block">` : ''}
    <h3 style="color:#fff;margin:0 0 8px;font-size:20px">${subject}</h3>
    <p style="color:#aaa;font-size:14px;margin:0 0 20px">Hi ${memberName},</p>
    <div style="background:#111;border:1px solid #333;border-radius:10px;padding:18px;margin-bottom:20px">
      <p style="color:#aaa;font-size:13px;margin:4px 0"><strong style="color:#fff">📅 Date:</strong> ${dates}</p>
      ${event.venue ? `<p style="color:#aaa;font-size:13px;margin:4px 0"><strong style="color:#fff">📍 Venue:</strong> ${event.venue}</p>` : ''}
      ${event.description ? `<p style="color:#aaa;font-size:13px;margin:8px 0 0">${event.description}</p>` : ''}
    </div>
    <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
  </div>`

  await createMailer().sendMail({ from: FROM(), to, subject, html })
}

// ── Announcement email ────────────────────────────────────────────────────────
async function sendAnnouncementEmail(to, name, event, content) {
  const html = `
  <div style="background:#050505;padding:40px 36px;font-family:'Segoe UI',sans-serif;max-width:540px;margin:auto;border-radius:18px;border:1px solid rgba(220,38,38,0.2);box-shadow:0 24px 80px rgba(0,0,0,0.8)">
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#7f1d1d);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px rgba(220,38,38,0.4);flex-shrink:0">📷</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.14em;text-transform:uppercase">IEM Photography Club</div>
          <div style="font-size:11px;color:#555;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px">Official Communication</div>
        </div>
      </div>
      <div style="height:2px;background:linear-gradient(to right,#dc2626,#9f1239,rgba(159,18,57,0));border-radius:1px;margin-bottom:20px"></div>
      <p style="margin:0 0 6px;color:#dc2626;font-size:12px;letter-spacing:2px;text-transform:uppercase">📢 Event Announcement</p>
      <h3 style="margin:0;color:#fff;font-size:20px;font-weight:700">${event.name}</h3>
    </div>
    <p style="color:#aaa;font-size:16px;margin:0 0 16px">Hi ${name},</p>
    <div style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;color:#d4d4d4;font-size:16px;line-height:1.85">
      ${content}
    </div>
    <p style="color:#444;font-size:13px;margin:24px 0 0;border-top:1px solid #111;padding-top:16px">IEM Photography Club — ${new Date().toLocaleDateString('en-IN')}</p>
  </div>`

  await createMailer().sendMail({
    from: FROM(), to,
    subject: `📢 ${event.name} — Announcement`,
    html,
  })
}

// ── EVENTS CRUD ───────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const [events, coreUsers] = await Promise.all([
      Event.find(filter)
        .populate('createdBy', 'name')
        .select('-members.notified -members.everAdded')
        .sort({ galleryOrder: 1, createdAt: -1 }),
      User.find({ role: 'core' }, '_id'),
    ])
    const allCoreIds = coreUsers.map(c => c._id.toString())
    const out = events.map(e => {
      const excludedSet = new Set((e.excludedCores || []).map(x => x?.toString()))
      const activeCoreIds = allCoreIds.filter(id => !excludedSet.has(id))
      const explicitIds   = (e.members || []).map(m => m.user?.toString() || m.user)
      return {
        ...e.toObject(),
        memberIds: [...new Set([...explicitIds, ...activeCoreIds])],
      }
    })
    res.json({ events: out })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const [event, coreUsers] = await Promise.all([
      Event.findById(req.params.id)
        .populate('members.user', 'name email profilePhoto role department startYear endYear')
        .populate('excludedCores', '_id role')
        .populate('createdBy', 'name'),
      User.find({ role: 'core' }, 'name email profilePhoto role department startYear endYear'),
    ])
    if (!event) return res.status(404).json({ error: 'Event not found.' })
    // Compute implicit core members (all cores minus excluded, minus those already explicit)
    const excludedSet  = new Set((event.excludedCores || []).map(u => u._id?.toString()))
    const explicitSet  = new Set((event.members || []).map(m => {
      const u = m.user; return (u && typeof u === 'object') ? u._id?.toString() : u?.toString()
    }))
    const coreMembers = coreUsers
      .filter(c => !excludedSet.has(c._id.toString()) && !explicitSet.has(c._id.toString()))
      .map(c => ({ user: c, eventRole: 'core', isImplicit: true }))
    res.json({ event, coreMembers })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', senior, async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ event })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', [requireAuth, adminOrEventCoord], async (req, res) => {
  try {
    const old = await Event.findById(req.params.id).populate('members.user', 'name email')
    if (!old) return res.status(404).json({ error: 'Event not found.' })

    // Coordinators can only edit if coordCanEditDetails is enabled
    if (!['admin', 'core'].includes(req.user.role) && old.coordCanEditDetails === false) {
      return res.status(403).json({ error: 'Detail editing is disabled for coordinators on this event.' })
    }

    const nameChanged = req.body.name && req.body.name.trim() !== old.name

    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('members.user', 'name email')

    // Notify members when event name changes
    if (nameChanged) {
      const mailer  = createMailer()
      const members = (event.members || []).map(m => m.user).filter(u => u?.email)
      for (const u of members) {
        const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
          <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
          <p style="color:#aaa;font-size:14px">Hi ${u.name},</p>
          <p style="color:#ddd;font-size:14px">The event you were part of has been renamed:</p>
          <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px;margin:16px 0">
            <p style="color:#999;font-size:12px;margin:0 0 4px">Previous name</p>
            <p style="color:#fff;font-size:16px;margin:0 0 12px;text-decoration:line-through;opacity:0.6">${old.name}</p>
            <p style="color:#999;font-size:12px;margin:0 0 4px">New name</p>
            <p style="color:#fff;font-size:18px;margin:0;font-weight:600">${event.name}</p>
          </div>
          <p style="color:#555;font-size:12px;margin:0">IEM Photography Club — automated notification</p>
        </div>`
        await mailer.sendMail({ from: FROM(), to: u.email, subject: `Event renamed: "${event.name}"`, html }).catch(() => {})
      }
    }

    res.json({ event })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Toggle isOpenToAll — controls whether non-members can view event detail
router.patch('/:id/open-to-all', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const { isOpenToAll } = req.body
    const event = await Event.findByIdAndUpdate(req.params.id, { isOpenToAll }, { new: true })
    if (!event) return res.status(404).json({ error: 'Not found.' })
    res.json({ event })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Toggle showInGallery + set gallery order
router.patch('/:id/gallery-order', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const { showInGallery, galleryOrder, coordCanUpload, coordCanReorder, coordCanAnnounce, coordCanEditDetails } = req.body
    const upd = {}
    if (showInGallery       !== undefined) upd.showInGallery       = showInGallery
    if (galleryOrder        !== undefined) upd.galleryOrder        = galleryOrder
    if (coordCanUpload      !== undefined) upd.coordCanUpload      = coordCanUpload
    if (coordCanReorder     !== undefined) upd.coordCanReorder     = coordCanReorder
    if (coordCanAnnounce    !== undefined) upd.coordCanAnnounce    = coordCanAnnounce
    if (coordCanEditDetails !== undefined) upd.coordCanEditDetails = coordCanEditDetails
    const event = await Event.findByIdAndUpdate(req.params.id, upd, { new: true })
    if (!event) return res.status(404).json({ error: 'Not found.' })
    res.json({ event })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', [requireAuth, requireRole('admin','core')], async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
    if (!event) return res.status(404).json({ error: 'Not found.' })
    // Delete all gallery photos for this event (separate collection)
    const galleryPhotos = await GalleryPhoto.find({ event: event._id })
    const galleryKeys = galleryPhotos.flatMap(p => [p.s3Key, p.mobileS3Key].filter(Boolean))
    await Promise.all(galleryKeys.map(k => deleteObject(k).catch(() => {})))
    await GalleryPhoto.deleteMany({ event: event._id })

    if (event.logoS3Key) await deleteObject(event.logoS3Key).catch(() => {})
    await event.deleteOne()
    res.json({ message: 'Event deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── MEMBER MANAGEMENT ─────────────────────────────────────────────────────────
router.post('/:id/members', senior, async (req, res) => {
  try {
    const { userId, eventRole = 'photographer' } = req.body
    const [event, user] = await Promise.all([
      Event.findById(req.params.id),
      User.findById(userId).select('name email'),
    ])
    if (!event) return res.status(404).json({ error: 'Event not found.' })
    if (!user)  return res.status(404).json({ error: 'User not found.' })

    const existing = event.members.find(m => m.user.toString() === userId)
    let isReAdded = false

    if (existing) {
      // Re-added after removal — bump counter so a new email fires
      existing.eventRole  = eventRole
      existing.everAdded += 1
      existing.addedAt    = new Date()
      isReAdded = true
    } else {
      event.members.push({ user: userId, eventRole, everAdded: 1 })
    }

    // If this user was a core that was previously excluded, clear the exclusion
    if (event.excludedCores?.length) {
      event.excludedCores = event.excludedCores.filter(id => id.toString() !== userId)
    }

    await event.save()

    // Send notification only to this newly added/re-added user
    sendEventAddedEmail(user.email, user.name, event, isReAdded).catch(console.error)

    await event.populate('members.user', 'name email profilePhoto role')
    res.json({ event })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/members/:userId', senior, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
    if (!event) return res.status(404).json({ error: 'Not found.' })
    // Core users cannot remove other cores or admins
    if (req.user.role === 'core') {
      const targetUser = await User.findById(req.params.userId).select('role')
      if (targetUser && ['admin','core'].includes(targetUser.role)) {
        return res.status(403).json({ error: 'Core members cannot remove admins or other cores.' })
      }
    }
    // If removing a core, add to excludedCores so they leave the implicit list
    const targetUser = await User.findById(req.params.userId).select('role')
    if (targetUser?.role === 'core') {
      const alreadyExcluded = event.excludedCores?.some(id => id.toString() === req.params.userId)
      if (!alreadyExcluded) {
        if (!event.excludedCores) event.excludedCores = []
        event.excludedCores.push(req.params.userId)
      }
    }
    event.members = event.members.filter(m => m.user.toString() !== req.params.userId)
    await event.save()
    res.json({ message: 'Member removed.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/members/:userId/role', senior, async (req, res) => {
  try {
    const { eventRole } = req.body
    const event = await Event.findById(req.params.id)
    if (!event) return res.status(404).json({ error: 'Not found.' })

    const member  = event.members.find(m => m.user.toString() === req.params.userId)
    const oldRole = member?.eventRole

    // Core users cannot promote/demote other cores or promote anyone to core
    if (req.user.role === 'core') {
      const targetUser = await User.findById(req.params.userId).select('role')
      if (targetUser?.role === 'core' || oldRole === 'core' || eventRole === 'core') {
        return res.status(403).json({ error: 'Core members cannot change the role of other cores.' })
      }
    }

    if (member) {
      member.eventRole = eventRole
    } else {
      // Implicit member (e.g. a core) — explicitly add with the new role
      event.members.push({ user: req.params.userId, eventRole, everAdded: 1, addedAt: new Date() })
    }
    await event.save()

    // Send role-change email
    if (oldRole !== eventRole) {
      const user = await User.findById(req.params.userId).select('name email')
      if (user?.email) {
        const isPromotion = ['core','coordinator'].indexOf(eventRole) > ['core','coordinator'].indexOf(oldRole)
        const verb = isPromotion ? 'promoted' : 'demoted'
        const html = `<div style="background:#050505;padding:40px 32px;font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border-radius:16px;border:1px solid #222">
          <h2 style="color:#fff;font-size:16px;letter-spacing:3px;text-transform:uppercase;border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:20px">📷 IEM Photography Club</h2>
          <p style="color:#aaa;font-size:14px">Hi ${user.name},</p>
          <p style="color:#ddd;font-size:14px">Your role in <strong>${event.name}</strong> has been updated:</p>
          <div style="background:#111;border:1px solid #333;border-radius:10px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:16px">
            <div style="text-align:center">
              <p style="color:#888;font-size:11px;margin:0 0 4px">Previous</p>
              <p style="color:#fff;font-size:15px;margin:0;text-decoration:line-through;opacity:0.5">${oldRole}</p>
            </div>
            <div style="font-size:20px;color:#dc2626">→</div>
            <div style="text-align:center">
              <p style="color:#888;font-size:11px;margin:0 0 4px">New role</p>
              <p style="color:${isPromotion?'#4ade80':'#f87171'};font-size:18px;margin:0;font-weight:700;text-transform:capitalize">${eventRole}</p>
            </div>
          </div>
          <p style="color:#aaa;font-size:13px">You have been ${verb} within the event team. ${isPromotion ? 'Congratulations!' : 'Please check with your event lead for more details.'}</p>
          <p style="color:#555;font-size:12px;margin:20px 0 0">IEM Photography Club — automated notification</p>
        </div>`
        createMailer().sendMail({
          from: FROM(), to: user.email,
          subject: `Your role in "${event.name}" has been updated`,
          html,
        }).catch(() => {})
      }
    }

    res.json({ message: 'Role updated.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
router.get('/:id/announcements', requireAuth, async (req, res) => {
  try {
    const Announcement = (await import('../models/Announcement.js')).default
    // Determine what this user can see based on their event role
    const event = await Event.findById(req.params.id)
    const member = event?.members?.find(m => m.user?.toString() === req.user._id.toString())
    const eventRole = member?.eventRole || null
    const clubRole  = req.user.role

    // Admin/core see all. Coordinators see all + coordinator. Photographers see only 'all'.
    let filter = { event: req.params.id }
    if (!['admin','core'].includes(clubRole)) {
      if (eventRole === 'coordinator') {
        // Coordinators see: all, coordinators-only, and core announcements
        filter.recipientType = { $in: ['all', 'coordinators', 'core'] }
      } else {
        // Photographers see: all-member announcements only
        filter.recipientType = { $in: ['all'] }
      }
    }

    const list = await Announcement.find(filter)
      .populate('sentBy', 'name')
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 })
    res.json({ announcements: list })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/announcements', requireAuth, async (req, res) => {
  try {
    const Announcement = (await import('../models/Announcement.js')).default
    const { content, subject, recipientType = 'all', recipientId } = req.body
    if (!content) return res.status(400).json({ error: 'Content required.' })

    const event = await Event.findById(req.params.id)
      .populate('members.user', 'name email role profilePhoto')
    if (!event) return res.status(404).json({ error: 'Not found.' })

    const isAdmin = ['admin','core'].includes(req.user.role)
    const membership = event.members?.find(m => m.user?._id?.toString() === req.user._id.toString())
    const isEventCoord = membership?.eventRole === 'coordinator'

    // Only admin/core OR event coordinators (when allowed) can post
    if (!isAdmin) {
      if (!isEventCoord) return res.status(403).json({ error: 'Not authorized.' })
      if (event.coordCanAnnounce === false) return res.status(403).json({ error: 'Coordinator announcements are disabled for this event.' })
    }

    const sentByRole = isAdmin ? req.user.role : 'coordinator'

    const ann = await Announcement.create({
      event: req.params.id, subject, content, recipientType,
      recipient: recipientId || undefined,
      sentBy: req.user._id, sentByRole,
    })

    // Determine recipients
    let targets
    if (recipientType === 'individual' && recipientId) {
      targets = event.members.filter(m => m.user?._id?.toString() === recipientId).map(m => m.user)
    } else if (recipientType === 'coordinators') {
      targets = event.members.filter(m => m.eventRole === 'coordinator').map(m => m.user)
    } else if (recipientType === 'core') {
      targets = event.members.filter(m => m.eventRole === 'core').map(m => m.user)
    } else {
      targets = event.members.map(m => m.user)
    }

    // Build sender label for email
    const senderLabel = sentByRole === 'coordinator' ? `${req.user.name} (Coordinator)` : req.user.name

    // Fire-and-forget emails with optional custom subject
    targets.forEach(u => {
      if (subject) {
        createMailer().sendMail({
          from: FROM(),
          to: u.email,
          subject: `📢 ${subject}`,
          html: `<div style="background:#050505;padding:40px 36px;font-family:'Segoe UI',sans-serif;max-width:540px;margin:auto;border-radius:18px;border:1px solid rgba(220,38,38,0.2);box-shadow:0 24px 80px rgba(0,0,0,0.8)">
            <div style="margin-bottom:24px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#7f1d1d);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px rgba(220,38,38,0.4);flex-shrink:0">📷</div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.14em;text-transform:uppercase">IEM Photography Club</div>
                  <div style="font-size:11px;color:#555;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px">Official Communication</div>
                </div>
              </div>
              <div style="height:2px;background:linear-gradient(to right,#dc2626,#9f1239,rgba(159,18,57,0));border-radius:1px;margin-bottom:20px"></div>
              <p style="margin:0 0 6px;color:#dc2626;font-size:12px;letter-spacing:2px;text-transform:uppercase">📢 Event Announcement</p>
              <h3 style="margin:0;color:#fff;font-size:20px;font-weight:700">${event.name}</h3>
            </div>
            <p style="color:#aaa;font-size:16px;margin:0 0 16px">Hi ${u.name},</p>
            <div style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;color:#d4d4d4;font-size:16px;line-height:1.85">${content}</div>
            <p style="color:#444;font-size:13px;margin:24px 0 0;border-top:1px solid #111;padding-top:16px">IEM Photography Club — ${new Date().toLocaleDateString('en-IN')}</p>
          </div>`,
        }).catch(console.error)
      } else {
        sendAnnouncementEmail(u.email, u.name, event, content).catch(console.error)
      }
    })

    res.status(201).json({ announcement: ann })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
