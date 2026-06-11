import { Router } from 'express'
import SocialLink  from '../models/SocialLink.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const admin  = [requireAuth, requireRole('admin')]

router.get('/', async (req, res) => {
  try {
    const links = await SocialLink.find({ active: true }).sort({ order: 1 })
    res.json({ links })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/all', admin, async (req, res) => {
  try {
    const links = await SocialLink.find().sort({ order: 1 })
    res.json({ links })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', admin, async (req, res) => {
  try {
    const { platform, label, url, icon, order } = req.body
    if (!platform || !label || !url) return res.status(400).json({ error: 'platform, label and url required.' })
    const link = await SocialLink.create({ platform, label, url, icon: icon||'🔗', order: order||0 })
    res.status(201).json({ link })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', admin, async (req, res) => {
  try {
    const link = await SocialLink.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!link) return res.status(404).json({ error: 'Not found.' })
    res.json({ link })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', admin, async (req, res) => {
  try {
    await SocialLink.findByIdAndDelete(req.params.id)
    res.json({ message: 'Deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
