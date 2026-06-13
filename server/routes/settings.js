import { Router }   from 'express'
import AppSettings  from '../models/AppSettings.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const admin       = [requireAuth, requireRole('admin')]
const adminOrCore = [requireAuth, requireRole('admin','core')]

const SECTION_DEFAULTS = {
  postcards:           true,
  'event-gallery':     true,
  gallery:             true,
  members:             true,
  core:                true,
  competitions:        true,
  activities:          true,
  magazines:           true,
  'show-past-sessions':      true,
  'show-past-events':        true,
  'show-past-competitions':  true,
  'show-past-activities':    true,
}

// ── Section visibility (public read, admin/core write) ────────────────────────
router.get('/sections', async (req, res) => {
  try {
    const stored = await AppSettings.findOne({ key: 'sectionVisibility' })
    const value  = stored?.value || {}
    res.json({ sections: { ...SECTION_DEFAULTS, ...value } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/sections', adminOrCore, async (req, res) => {
  try {
    const { sectionId, visible } = req.body
    if (!(sectionId in SECTION_DEFAULTS)) {
      return res.status(400).json({ error: 'Unknown section' })
    }
    const stored  = await AppSettings.findOne({ key: 'sectionVisibility' })
    const current = stored?.value || {}
    const updated = { ...SECTION_DEFAULTS, ...current, [sectionId]: !!visible }
    await AppSettings.findOneAndUpdate(
      { key: 'sectionVisibility' },
      { key: 'sectionVisibility', value: updated, label: 'Section Visibility', updatedBy: req.user._id },
      { upsert: true, new: true }
    )
    res.json({ sections: updated })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Default permission settings if not in DB yet
const DEFAULTS = {
  'coordinator.canUploadGallery':         { value: true,  label: 'Upload to Club Gallery' },
  'coordinator.canCreatePostcardSection': { value: false, label: 'Create Postcard Sections' },
  'coordinator.canSendAnnouncements':     { value: false, label: 'Send Global Announcements' },
  // Member gallery controls
  'member.gallery.enabled':   { value: true, label: 'Enable My Gallery for Members' },
  'member.gallery.maxPhotos': { value: 0,    label: 'Maximum Photos per Member (0 = No Limit)' },
}

// GET public subtitle / join content (no auth required — used by all visitors)
router.get('/content', async (req, res) => {
  try {
    const stored = await AppSettings.find({ key: /^(subtitle-|join-|connect-|desktopHeroMode$)/ })
    const content = {}
    stored.forEach(s => { content[s.key] = s.value })
    res.json({ content })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET coordinator permissions (any authenticated user — coordinators need to read their own limits)
router.get('/coord-permissions', requireAuth, async (req, res) => {
  try {
    const result = {}
    for (const [key, def] of Object.entries(DEFAULTS)) {
      if (!key.startsWith('coordinator.')) continue
      const found = await AppSettings.findOne({ key })
      const shortKey = key.replace('coordinator.', '')
      result[shortKey] = found ? found.value : def.value
    }
    res.json({ permissions: result })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET gallery settings (authenticated members need to know their limits)
router.get('/gallery', requireAuth, async (req, res) => {
  try {
    const keys = ['member.gallery.enabled', 'member.gallery.maxPhotos']
    const result = {}
    for (const key of keys) {
      const found = await AppSettings.findOne({ key })
      const shortKey = key.replace('member.gallery.', '')
      result[shortKey] = found != null ? found.value : DEFAULTS[key].value
    }
    res.json({ gallery: result })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET all settings (admin or core)
router.get('/', adminOrCore, async (req, res) => {
  try {
    const stored = await AppSettings.find()
    // Merge stored with defaults
    const result = {}
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const found = stored.find(s => s.key === key)
      result[key] = { key, value: found ? found.value : def.value, label: def.label }
    }
    res.json({ settings: Object.values(result) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH a setting (admin or core)
router.patch('/:key', adminOrCore, async (req, res) => {
  try {
    const { value } = req.body
    const setting = await AppSettings.findOneAndUpdate(
      { key: req.params.key },
      { key: req.params.key, value, label: DEFAULTS[req.params.key]?.label, updatedBy: req.user._id },
      { upsert: true, new: true }
    )
    res.json({ setting })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
