import nodemailer          from 'nodemailer'
import { Router }          from 'express'
import rateLimit           from 'express-rate-limit'
import GlobalAnnouncement  from '../models/GlobalAnnouncement.js'
import ContactFolder       from '../models/ContactFolder.js'
import User                from '../models/User.js'
import AppSettings         from '../models/AppSettings.js'
import Event               from '../models/Event.js'
import Competition         from '../models/Competition.js'
import Activity            from '../models/Activity.js'
import { computeAcademicYear } from '../utils/yearCalc.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

// Announcement emails are expensive (bulk SMTP) — max 10 sends per 10 minutes
const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { error: 'Too many announcements sent. Please wait before sending again.' },
})

const router = Router()

// ── Auth helpers ──────────────────────────────────────────────────────────────
const adminOrCore = [requireAuth, requireRole('admin','core')]

async function canAnnounce(req, res, next) {
  const { user } = req
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (['admin','core'].includes(user.role)) return next()
  if (user.role === 'coordinator') {
    const s = await AppSettings.findOne({ key: 'coordinator.canSendAnnouncements' })
    if (s?.value === true) return next()
  }
  return res.status(403).json({ error: 'Not authorised' })
}
const announceAccess = [requireAuth, canAnnounce]

// ── Email transport ───────────────────────────────────────────────────────────
function mailer() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}
const FROM = () => process.env.EMAIL_FROM || `"IEM Photography Club" <${process.env.EMAIL_USER}>`

// ── Auto-link bare URLs ───────────────────────────────────────────────────────
function autoLink(html) {
  return html.replace(/(?<![="'>])((?:https?:\/\/|www\.)[^\s<>"']+)/g, (m) => {
    const href = m.startsWith('http') ? m : `https://${m}`
    return `<a href="${href}" style="color:#f87171;text-decoration:underline">${m}</a>`
  })
}

// ── Email HTML builder ────────────────────────────────────────────────────────
function buildEmailHtml(subject, content) {
  content = autoLink(content)
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;-webkit-font-smoothing:antialiased;mso-line-height-rule:exactly">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a">
  <tr>
    <td align="center" style="padding:48px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px">

        <!-- Accent bar -->
        <tr>
          <td style="height:3px;background:linear-gradient(to right,#dc2626,#b91c1c,#7f1d1d);border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background-color:#111111;padding:40px 48px 32px;border-left:1px solid rgba(220,38,38,0.18);border-right:1px solid rgba(220,38,38,0.18)">
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#6b7280">IEM Photography Club &nbsp;&bull;&nbsp; Official Communication</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;line-height:1.35;color:#f3f4f6;letter-spacing:-0.01em">${subject}</h1>
          </td>
        </tr>

        <!-- Hairline divider -->
        <tr>
          <td style="border-left:1px solid rgba(220,38,38,0.18);border-right:1px solid rgba(220,38,38,0.18);font-size:0;line-height:0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:1px;background:linear-gradient(to right,rgba(220,38,38,0.45),rgba(220,38,38,0.08),transparent);font-size:0">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#0e0e0e;padding:40px 48px;border-left:1px solid rgba(220,38,38,0.18);border-right:1px solid rgba(220,38,38,0.18)">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.85;color:#d1d5db">${content}</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#080808;padding:24px 48px;border:1px solid rgba(220,38,38,0.12);border-top:1px solid #1c1c1c;border-radius:0 0 10px 10px">
            <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#4b5563">You are receiving this email as a member of <span style="color:#9ca3af;font-weight:600">IEM Photography Club</span>.</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#374151">&copy; ${year} IEM Photography Club &nbsp;&bull;&nbsp; Kolkata, India</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ── Build member recipient list ────────────────────────────────────────────────
async function buildMemberRecipients(preset, filters = {}) {
  const base = { status: 'approved' }
  if      (preset === 'cores')        base.role = 'core'
  else if (preset === 'coordinators') base.role = 'coordinator'
  else if (preset === 'role' && filters.role)     base.role       = filters.role
  else if (preset === 'stream' && filters.stream) base.department = filters.stream

  const users = await User.find(base).select('name email startYear endYear')

  if (preset === 'year' && filters.year) {
    const y = Number(filters.year)
    return users.filter(u => {
      const yr = computeAcademicYear(u.startYear, u.endYear)
      return yr.year === y && !yr.isPassout
    })
  }
  return users
}

// ── Send emails in batches ────────────────────────────────────────────────────
async function sendBatch(tr, from, recipients, subject, html, cc = [], bcc = [], attachments = []) {
  let sent = 0
  let firstError = null
  const opts = { from }
  if (cc.length)  opts.cc  = cc.join(',')
  if (bcc.length) opts.bcc = bcc.join(',')
  if (attachments.length) {
    opts.attachments = attachments.map(a => ({
      filename:    a.name,
      path:        a.url,
      contentType: a.mime || undefined,
    }))
  }

  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10)
    await Promise.all(batch.map(r =>
      tr.sendMail({ ...opts, to: r.email, subject, html })
        .then(() => { sent++ })
        .catch(e => {
          console.error(`[announce] failed ${r.email}:`, e.message)
          if (!firstError) firstError = e
        })
    ))
  }

  // If nothing was sent at all, surface the SMTP error so callers can report it
  if (sent === 0 && firstError) throw firstError
  return sent
}

// ── Context helpers ───────────────────────────────────────────────────────────

async function getContextRecipients(type, id) {
  if (type === 'event') {
    const ev = await Event.findById(id).populate('members.user', 'name email')
    if (!ev) return []
    const excIds = new Set((ev.excludedCores || []).map(x => x.toString()))
    const memberEmails = new Set()
    const list = []
    for (const m of ev.members || []) {
      const u = m.user
      if (u?.email) { memberEmails.add(u.email); list.push({ name: u.name, email: u.email, type: 'user' }) }
    }
    const cores = await User.find({ role: 'core', status: 'approved' }).select('name email _id')
    for (const cu of cores) {
      if (!excIds.has(cu._id.toString()) && !memberEmails.has(cu.email))
        list.push({ name: cu.name, email: cu.email, type: 'user' })
    }
    return list
  }
  if (type === 'competition') {
    const comp = await Competition.findById(id).populate('volunteers.user', 'name email')
    if (!comp) return []
    return (comp.volunteers || []).filter(v => v.user?.email).map(v => ({ name: v.user.name, email: v.user.email, type: 'user' }))
  }
  if (type === 'activity') {
    const act = await Activity.findById(id).populate('volunteers.user', 'name email')
    if (!act) return []
    return (act.volunteers || []).filter(v => v.user?.email).map(v => ({ name: v.user.name, email: v.user.email, type: 'user' }))
  }
  return []
}

async function checkContextAccess(type, id, userId) {
  const uid = userId.toString()
  if (type === 'event') {
    const ev = await Event.findById(id, 'members coordCanAnnounce')
    if (!ev || ev.coordCanAnnounce === false) return false
    return (ev.members || []).some(m => {
      const mUid = typeof m.user === 'object' ? m.user?._id?.toString() : m.user?.toString()
      return mUid === uid && m.eventRole === 'coordinator'
    })
  }
  if (type === 'competition') {
    const comp = await Competition.findById(id, 'volunteers coordCanAnnounce')
    if (!comp || comp.coordCanAnnounce === false) return false
    return (comp.volunteers || []).some(v => {
      const vUid = typeof v.user === 'object' ? v.user?._id?.toString() : v.user?.toString()
      return vUid === uid && v.role === 'coordinator'
    })
  }
  if (type === 'activity') {
    const act = await Activity.findById(id, 'volunteers coordCanAnnounce')
    if (!act || act.coordCanAnnounce === false) return false
    return (act.volunteers || []).some(v => {
      const vUid = typeof v.user === 'object' ? v.user?._id?.toString() : v.user?.toString()
      return vUid === uid && v.role === 'coordinator'
    })
  }
  return false
}

// ── BIN helpers ───────────────────────────────────────────────────────────────
const BIN_TTL_MS = 15 * 24 * 60 * 60 * 1000 // 15 days

// Purge items that have been in the bin for >15 days (called on bin fetch)
async function purgeExpiredBin(userId) {
  const cutoff = new Date(Date.now() - BIN_TTL_MS)
  await GlobalAnnouncement.deleteMany({
    sentBy: userId,
    binned: true,
    binnedAt: { $lt: cutoff },
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SENT HISTORY
// ══════════════════════════════════════════════════════════════════════════════

router.get('/', announceAccess, async (req, res) => {
  try {
    const q = { status: 'sent', binned: { $ne: true } }
    if (!['admin','core'].includes(req.user.role)) q.sentBy = req.user._id
    const anns = await GlobalAnnouncement.find(q)
      .populate('sentBy','name')
      .sort({ createdAt: -1 })
      .limit(200)
    res.json({ announcements: anns })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// DRAFTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/drafts', announceAccess, async (req, res) => {
  try {
    const drafts = await GlobalAnnouncement.find({
      status: 'draft', sentBy: req.user._id, binned: { $ne: true },
      contextType: null,  // global drafts only — context drafts have contextType set
    }).sort({ updatedAt: -1 })
    res.json({ drafts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/drafts', announceAccess, async (req, res) => {
  try {
    const { subject='', content='', kind='broadcast', recipientPreset='all', filters={},
            customRecipients=[], toRecipients=[], ccEmails=[], bccEmails=[], attachments=[] } = req.body
    const draft = await GlobalAnnouncement.create({
      kind, status: 'draft', subject: subject||'(no subject)', content: content||'',
      sentBy: req.user._id, recipientPreset, filters, customRecipients,
      toRecipients, ccEmails, bccEmails, attachments,
    })
    res.json({ draft })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/drafts/:id', announceAccess, async (req, res) => {
  try {
    const draft = await GlobalAnnouncement.findOneAndUpdate(
      { _id: req.params.id, sentBy: req.user._id, status: 'draft' },
      { $set: req.body },
      { new: true }
    )
    if (!draft) return res.status(404).json({ error: 'Draft not found' })
    res.json({ draft })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/drafts/:id', announceAccess, async (req, res) => {
  try {
    await GlobalAnnouncement.deleteOne({ _id: req.params.id, sentBy: req.user._id, status: 'draft' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// BIN (TRASH)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/announce/bin  — list binned items, auto-purge expired ones first
router.get('/bin', announceAccess, async (req, res) => {
  try {
    await purgeExpiredBin(req.user._id)
    const q = { sentBy: req.user._id, binned: true }
    const items = await GlobalAnnouncement.find(q).sort({ binnedAt: -1 }).limit(200)
    res.json({ items })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/bin/bulk  — move multiple items to bin
router.post('/bin/bulk', announceAccess, async (req, res) => {
  try {
    const { ids = [] } = req.body
    if (!ids.length) return res.status(400).json({ error: 'No IDs provided.' })
    await GlobalAnnouncement.updateMany(
      { _id: { $in: ids }, sentBy: req.user._id },
      { $set: { binned: true, binnedAt: new Date() } }
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/:id/bin  — move single item to bin
router.post('/:id/bin', announceAccess, async (req, res) => {
  try {
    const item = await GlobalAnnouncement.findOneAndUpdate(
      { _id: req.params.id, sentBy: req.user._id },
      { $set: { binned: true, binnedAt: new Date() } },
      { new: true }
    )
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/:id/restore  — restore from bin
router.post('/:id/restore', announceAccess, async (req, res) => {
  try {
    const item = await GlobalAnnouncement.findOneAndUpdate(
      { _id: req.params.id, sentBy: req.user._id, binned: true },
      { $set: { binned: false }, $unset: { binnedAt: 1 } },
      { new: true }
    )
    if (!item) return res.status(404).json({ error: 'Not found in bin' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/announce/bin  — empty entire bin (permanent)
router.delete('/bin', announceAccess, async (req, res) => {
  try {
    await GlobalAnnouncement.deleteMany({ sentBy: req.user._id, binned: true })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/announce/bin/bulk  — permanently delete selected items
router.delete('/bin/bulk', announceAccess, async (req, res) => {
  try {
    const { ids = [] } = req.body
    if (!ids.length) return res.status(400).json({ error: 'No IDs.' })
    await GlobalAnnouncement.deleteMany({ _id: { $in: ids }, sentBy: req.user._id, binned: true })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/announce/bin/:id  — permanently delete single binned item
router.delete('/bin/:id', announceAccess, async (req, res) => {
  try {
    await GlobalAnnouncement.deleteOne({ _id: req.params.id, sentBy: req.user._id, binned: true })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// PREVIEW + SEND
// ══════════════════════════════════════════════════════════════════════════════

router.post('/preview', announceAccess, async (req, res) => {
  try {
    const { recipientPreset = 'all', filters = {}, customRecipients = [] } = req.body
    if (recipientPreset === 'custom') {
      return res.json({
        count: customRecipients.length,
        recipients: customRecipients.map(r => ({ name: r.name || r.email, email: r.email })),
      })
    }
    const users = await buildMemberRecipients(recipientPreset, filters)
    res.json({
      count: users.length,
      recipients: users.map(u => ({ name: u.name, email: u.email })),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/send', sendLimiter, announceAccess, async (req, res) => {
  try {
    const {
      subject, content, recipientPreset = 'all', filters = {},
      customRecipients = [], ccEmails = [], bccEmails = [], attachments = [],
      draftId,
    } = req.body
    if (!subject?.trim()) return res.status(400).json({ error: 'Subject is required.' })
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' })

    let recipients = []
    if (recipientPreset === 'custom') {
      recipients = customRecipients.filter(r => r.email)
    } else {
      const members = await buildMemberRecipients(recipientPreset, filters)
      recipients = members.map(u => ({ email: u.email, name: u.name }))
    }
    if (!recipients.length) return res.status(400).json({ error: 'No recipients matched.' })

    const html = buildEmailHtml(subject, content)
    const tr   = mailer()
    const sent = await sendBatch(tr, FROM(), recipients, subject, html, ccEmails, bccEmails, attachments)

    if (draftId) await GlobalAnnouncement.deleteOne({ _id: draftId, sentBy: req.user._id })

    const preview = content.replace(/<[^>]+>/g,'').slice(0,120)
    const record = await GlobalAnnouncement.create({
      kind: 'broadcast', status: 'sent', subject, content, preview,
      sentBy: req.user._id, recipientPreset, filters,
      customRecipients: recipientPreset === 'custom' ? customRecipients : [],
      resolvedRecipients: recipients.map(r => ({ name: r.name || r.email, email: r.email, type: r.type || 'external' })),
      ccEmails, bccEmails, attachments, recipientCount: sent,
    })
    res.json({ message: `Sent to ${sent} recipient(s).`, announcement: record })
  } catch (e) {
    console.error('[broadcast]', e)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSE EMAIL
// ══════════════════════════════════════════════════════════════════════════════

router.post('/compose/send', sendLimiter, announceAccess, async (req, res) => {
  try {
    const { subject, content, toRecipients = [], ccEmails = [], bccEmails = [], attachments = [], draftId } = req.body
    if (!subject?.trim())    return res.status(400).json({ error: 'Subject is required.' })
    if (!content?.trim())    return res.status(400).json({ error: 'Content is required.' })
    if (!toRecipients.length) return res.status(400).json({ error: 'At least one recipient required.' })

    const html = buildEmailHtml(subject, content)
    const tr   = mailer()
    const sent = await sendBatch(tr, FROM(), toRecipients.filter(r=>r.email), subject, html, ccEmails, bccEmails, attachments)

    if (draftId) await GlobalAnnouncement.deleteOne({ _id: draftId, sentBy: req.user._id })

    const preview = content.replace(/<[^>]+>/g,'').slice(0,120)
    const record = await GlobalAnnouncement.create({
      kind: 'compose', status: 'sent', subject, content, preview,
      sentBy: req.user._id, toRecipients, ccEmails, bccEmails, attachments,
      recipientCount: sent,
    })
    res.json({ message: `Sent to ${sent} recipient(s).`, announcement: record })
  } catch (e) {
    console.error('[compose]', e)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT FOLDERS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/folders', adminOrCore, async (req, res) => {
  try {
    const folders = await ContactFolder.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
    res.json({ folders })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/folders', adminOrCore, async (req, res) => {
  try {
    const { name, description = '', color = '#dc2626', contacts = [] } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Folder name required.' })
    const folder = await ContactFolder.create({ name, description, color, contacts, createdBy: req.user._id })
    res.json({ folder })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/announce/folders/:id — update folder (name, description, color, contacts)
router.patch('/folders/:id', adminOrCore, async (req, res) => {
  try {
    const folder = await ContactFolder.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: req.body },
      { new: true }
    )
    if (!folder) return res.status(404).json({ error: 'Folder not found' })
    res.json({ folder })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/folders/:id/contacts  — add contacts (merge, no dupes)
router.post('/folders/:id/contacts', adminOrCore, async (req, res) => {
  try {
    const { contacts = [] } = req.body
    const folder = await ContactFolder.findOne({ _id: req.params.id, createdBy: req.user._id })
    if (!folder) return res.status(404).json({ error: 'Folder not found' })
    const existing = new Set(folder.contacts.map(c => c.email.toLowerCase()))
    const toAdd = contacts.filter(c => c.email && !existing.has(c.email.toLowerCase()))
    folder.contacts.push(...toAdd)
    await folder.save()
    res.json({ folder })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/folders/:id', adminOrCore, async (req, res) => {
  try {
    await ContactFolder.deleteOne({ _id: req.params.id, createdBy: req.user._id })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXT ANNOUNCEMENTS (per event / competition / activity)
// ══════════════════════════════════════════════════════════════════════════════

const CTX_TYPES = ['event','competition','activity']

async function ctxAuth(req, res) {
  const { type, id } = req.params
  if (!CTX_TYPES.includes(type)) { res.status(400).json({ error: 'Invalid context type' }); return false }
  const isPriv = ['admin','core'].includes(req.user.role)
  if (isPriv) return true
  const ok = await checkContextAccess(type, id, req.user._id)
  if (!ok) { res.status(403).json({ error: 'Not authorised' }); return false }
  return true
}

// GET /api/announce/ctx/:type/:id — sent history for this context
router.get('/ctx/:type/:id', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params
    if (!CTX_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid context type' })
    const isPriv = ['admin','core'].includes(req.user.role)
    if (!isPriv) {
      // enrolled members can read history; access check without coordinator restriction
      // just require auth — reading is always open to enrolled members (frontend controls visibility)
    }
    const anns = await GlobalAnnouncement.find({
      contextType: type, contextId: id, status: 'sent', binned: { $ne: true },
    }).populate('sentBy','name').sort({ createdAt: -1 }).limit(100)
    res.json({ announcements: anns })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/announce/ctx/:type/:id/preview — enrolled recipients count + list
router.get('/ctx/:type/:id/preview', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    const recipients = await getContextRecipients(req.params.type, req.params.id)
    res.json({ count: recipients.length, recipients })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/ctx/:type/:id/send — send to context members
router.post('/ctx/:type/:id/send', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    const { type, id } = req.params
    const { subject, content, ccEmails=[], bccEmails=[], attachments=[], draftId } = req.body
    if (!subject?.trim()) return res.status(400).json({ error: 'Subject is required.' })
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' })

    const recipients = await getContextRecipients(type, id)
    if (!recipients.length) return res.status(400).json({ error: 'No recipients found for this context.' })

    const html = buildEmailHtml(subject, content)
    const tr   = mailer()
    const sent = await sendBatch(tr, FROM(), recipients, subject, html, ccEmails, bccEmails, attachments)

    if (draftId) await GlobalAnnouncement.deleteOne({ _id: draftId, sentBy: req.user._id })

    const preview = content.replace(/<[^>]+>/g,'').slice(0,120)
    const record = await GlobalAnnouncement.create({
      kind: 'broadcast', status: 'sent', subject, content, preview,
      sentBy: req.user._id, recipientPreset: 'custom',
      customRecipients: recipients,
      resolvedRecipients: recipients,
      ccEmails, bccEmails, attachments,
      recipientCount: sent,
      contextType: type, contextId: id,
    })
    res.json({ message: `Sent to ${sent} recipient(s).`, announcement: record })
  } catch (e) {
    console.error('[ctx/send]', e)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/announce/ctx/:type/:id/drafts
router.get('/ctx/:type/:id/drafts', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    const { type, id } = req.params
    const drafts = await GlobalAnnouncement.find({
      status: 'draft', sentBy: req.user._id, binned: { $ne: true },
      contextType: type, contextId: id,
    }).sort({ updatedAt: -1 })
    res.json({ drafts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/announce/ctx/:type/:id/drafts
router.post('/ctx/:type/:id/drafts', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    const { type, id } = req.params
    const { subject='', content='', ccEmails=[], bccEmails=[], attachments=[] } = req.body
    const draft = await GlobalAnnouncement.create({
      kind: 'broadcast', status: 'draft',
      subject: subject || '(no subject)', content: content || '',
      sentBy: req.user._id,
      recipientPreset: 'custom', customRecipients: [],
      ccEmails, bccEmails, attachments,
      contextType: type, contextId: id,
    })
    res.json({ draft })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/announce/ctx/:type/:id/drafts/:did
router.patch('/ctx/:type/:id/drafts/:did', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    const draft = await GlobalAnnouncement.findOneAndUpdate(
      { _id: req.params.did, sentBy: req.user._id, status: 'draft' },
      { $set: req.body }, { new: true }
    )
    if (!draft) return res.status(404).json({ error: 'Draft not found' })
    res.json({ draft })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/announce/ctx/:type/:id/drafts/:did
router.delete('/ctx/:type/:id/drafts/:did', requireAuth, async (req, res) => {
  try {
    if (!(await ctxAuth(req, res))) return
    await GlobalAnnouncement.deleteOne({ _id: req.params.did, sentBy: req.user._id, status: 'draft' })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// MEMBER SEARCH
// ══════════════════════════════════════════════════════════════════════════════

router.get('/member-search', announceAccess, async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json({ users: [] })
    const users = await User.find({
      status: 'approved',
      $or: [
        { name:  { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ],
    }).select('name email profilePhoto department startYear endYear role').limit(50)
    res.json({ users })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// COORDINATOR PERMISSION CHECK
// ══════════════════════════════════════════════════════════════════════════════

router.get('/coord-permission', requireAuth, async (req, res) => {
  try {
    const s = await AppSettings.findOne({ key: 'coordinator.canSendAnnouncements' })
    res.json({ allowed: s?.value === true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
