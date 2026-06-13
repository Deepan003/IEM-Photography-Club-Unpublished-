import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── Proxy S3 images for html2canvas PDF generation ────────────────────────────
// html2canvas can't load cross-origin images from S3 without taint.
// Restricted to known S3 bucket — not an open proxy.
router.get('/', requireAuth, async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url query param required' })

  // Only allow https URLs pointing to our S3 bucket
  const BUCKET_HOST = process.env.S3_BUCKET_NAME
    ? `${process.env.S3_BUCKET_NAME}.s3`
    : 'college-photography-competition-iem.s3'

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return res.status(400).json({ error: 'https only' })
    if (!parsed.hostname.includes(BUCKET_HOST)) {
      return res.status(403).json({ error: 'URL not from allowed host.' })
    }
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IEMPhotoClub-PDF/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return res.status(response.status).json({ error: 'upstream error' })

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.set('Content-Type', contentType)
    res.set('Cache-Control', 'private, max-age=300')

    const buf = await response.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch (e) {
    const isProd = process.env.NODE_ENV === 'production'
    res.status(502).json({ error: isProd ? 'Request failed' : 'proxy fetch failed: ' + e.message })
  }
})

export default router
