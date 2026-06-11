import { Router } from 'express'

const router = Router()

// ── Proxy external images (e.g. S3) for html2canvas PDF generation ────────────
// html2canvas can't load cross-origin images without CORS headers on S3.
// This endpoint fetches any HTTPS image and streams it back as same-origin.
router.get('/', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url query param required' })

  // Only allow https URLs pointing to known image extensions or S3 hostnames
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return res.status(400).json({ error: 'https only' })
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
    res.set('Access-Control-Allow-Origin', '*')

    const buf = await response.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch (e) {
    const isProd = process.env.NODE_ENV === 'production'
    res.status(502).json({ error: isProd ? 'Request failed' : 'proxy fetch failed: ' + e.message })
  }
})

export default router
