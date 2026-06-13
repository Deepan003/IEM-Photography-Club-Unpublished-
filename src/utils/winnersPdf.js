// ─── Image loading ─────────────────────────────────────────────────────────────

async function proxyFetch(url) {
  if (!url) return null
  try {
    const r = await fetch(`/api/upload/proxy-image?url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    const blob = await r.blob()
    return new Promise((resolve) => {
      const rd = new FileReader()
      rd.onload  = () => resolve(rd.result)
      rd.onerror = () => resolve(null)
      rd.readAsDataURL(blob)
    })
  } catch { return null }
}

async function localFetch(path) {
  try {
    const r = await fetch(path)
    if (!r.ok) return null
    const blob = await r.blob()
    return new Promise((resolve) => {
      const rd = new FileReader()
      rd.onload  = () => resolve(rd.result)
      rd.onerror = () => resolve(null)
      rd.readAsDataURL(blob)
    })
  } catch { return null }
}

function loadImg(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// ─── Canvas crop helpers ───────────────────────────────────────────────────────

// Circle-crop: output is always (px × px) → addImage must use (mm × mm) square
async function circularCrop(dataUrl, px = 400) {
  if (!dataUrl) return null
  const img = await loadImg(dataUrl)
  if (!img) return null
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d')
  ctx.beginPath()
  ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2)
  ctx.clip()
  // cover-fit into the square
  const s = Math.max(px / img.naturalWidth, px / img.naturalHeight)
  const sw = px / s, sh = px / s
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, px, px)
  try { return c.toDataURL('image/png') } catch { return null }
}

// Rect-crop: output is exactly (twPx × thPx) — caller ensures aspect matches display
// This prevents ANY stretching: if you place the result at twMm × thMm and
// twPx/thPx == twMm/thMm the image is pixel-perfect with no distortion.
async function rectCrop(dataUrl, twPx, thPx) {
  if (!dataUrl) return null
  const img = await loadImg(dataUrl)
  if (!img) return null
  const c = document.createElement('canvas')
  c.width = twPx; c.height = thPx
  const ctx = c.getContext('2d')
  // cover-fit: scale so the image fills twPx × thPx, then center-crop
  const s = Math.max(twPx / img.naturalWidth, thPx / img.naturalHeight)
  const sw = twPx / s, sh = thPx / s
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, twPx, thPx)
  try { return c.toDataURL('image/jpeg', 0.93) } catch { return null }
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

const GOLD   = [212, 175, 55]
const SILVER = [168, 169, 173]
const BRONZE = [205, 127, 50]
const MEDAL  = [GOLD, SILVER, BRONZE]

// Card dimensions (mm) — must be kept in sync with image crop sizes below
const CARD_W     = 194          // W(210) - 2×margin(8)
const CARD_H     = { feature: 80, normal: 68, small: 52 }
const PHOTO_W    = { feature: 92, normal: 80, small: 80 }
// photoH = cardH - 6 (3mm top + 3mm bottom padding)
const PHOTO_H    = {
  feature: CARD_H.feature - 6,   // 74
  normal:  CARD_H.normal  - 6,   // 62
  small:   CARD_H.small   - 6,   // 46
}

function cardType(idx) {
  return idx === 0 ? 'feature' : idx < 3 ? 'normal' : 'small'
}

// 4 px per mm → high quality crops
const PX_PER_MM = 4

// ─── PDF drawing helpers ────────────────────────────────────────────────────────

function drawBg(doc, W, H) {
  doc.setFillColor(8, 8, 20); doc.rect(0, 0, W, H, 'F')
}

function rule(doc, x1, y, x2, r = 70, g = 60, b = 60) {
  doc.setDrawColor(r, g, b); doc.setLineWidth(0.3); doc.line(x1, y, x2, y)
}

// ─── Cover page ─────────────────────────────────────────────────────────────────
async function drawCover(doc, comp, clubLogoRaw, compBannerRaw, W, H) {
  drawBg(doc, W, H)

  // Warm glow bloom
  doc.setFillColor(80, 20, 20)
  doc.setGState(new doc.GState({ opacity: 0.4 }))
  doc.ellipse(W / 2, 62, 58, 44, 'F')
  doc.setGState(new doc.GState({ opacity: 1 }))

  // Club logo — 44mm circle, top center
  const LOGO_MM = 44
  const logoCx = W / 2, logoCy = 22 + LOGO_MM / 2
  if (clubLogoRaw) {
    const circled = await circularCrop(clubLogoRaw, LOGO_MM * PX_PER_MM)
    if (circled) {
      // Gold ring
      doc.setFillColor(...GOLD)
      doc.circle(logoCx, logoCy, LOGO_MM / 2 + 1.5, 'F')
      doc.addImage(circled, 'PNG', logoCx - LOGO_MM / 2, logoCy - LOGO_MM / 2, LOGO_MM, LOGO_MM)
    }
  } else {
    doc.setFillColor(200, 30, 30); doc.circle(logoCx, logoCy, LOGO_MM / 2 + 1.5, 'F')
    doc.setFillColor(240, 240, 240); doc.circle(logoCx, logoCy, LOGO_MM / 2, 'F')
  }

  // Club name
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.setTextColor(200, 200, 220)
  doc.text('IEM  PHOTOGRAPHY  CLUB', W / 2, logoCy + LOGO_MM / 2 + 8, { align: 'center' })

  // Gold star dividers
  const divY = logoCy + LOGO_MM / 2 + 14
  rule(doc, 22, divY, W / 2 - 9, 180, 140, 30)
  rule(doc, W / 2 + 9, divY, W - 22, 180, 140, 30)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.setTextColor(...GOLD)
  doc.text('✦', W / 2, divY + 1.5, { align: 'center' })

  // Competition name — huge
  const nameY = divY + 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  const nameLines = doc.splitTextToSize((comp.name || 'Competition').toUpperCase(), 162)
  doc.text(nameLines.slice(0, 3), W / 2, nameY, { align: 'center', lineHeightFactor: 1.3 })
  const afterNameY = nameY + nameLines.slice(0, 3).length * 22 * 0.352 * 1.3 + 5

  // "OFFICIAL RESULTS" red pill
  const tagW = 62, tagH = 9, tagX = W / 2 - tagW / 2
  doc.setFillColor(200, 30, 30); doc.roundedRect(tagX, afterNameY, tagW, tagH, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 240, 200)
  doc.text('OFFICIAL  RESULTS', W / 2, afterNameY + 6, { align: 'center' })

  // Date
  const d = comp.prizeDistributionDate || comp.resultDate || comp.endDate
  if (d) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 140, 100)
    doc.text(new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, afterNameY + tagH + 8, { align: 'center' })
  }

  // Competition banner image — fixed 150×80mm in center
  if (compBannerRaw) {
    const BNR_W = 150, BNR_H = 80
    const bnrX = W / 2 - BNR_W / 2
    const bnrY = afterNameY + tagH + (d ? 18 : 10)
    const cropped = await rectCrop(compBannerRaw, BNR_W * PX_PER_MM, BNR_H * PX_PER_MM)
    if (cropped) {
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.5)
      doc.roundedRect(bnrX - 0.5, bnrY - 0.5, BNR_W + 1, BNR_H + 1, 2, 2, 'S')
      doc.addImage(cropped, 'JPEG', bnrX, bnrY, BNR_W, BNR_H)
    }
  }

  // Congratulations band — fixed at vertical center of the lower half of the page
  // Band is always at the same position regardless of competition name length
  const cY = H - 68
  const cH = 32
  doc.setFillColor(55, 12, 12); doc.rect(0, cY, W, cH, 'F')
  rule(doc, 0, cY, W, 180, 140, 30)
  rule(doc, 0, cY + cH, W, 70, 45, 20)
  // Center-align text vertically within the band
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 240, 180)
  doc.text('★  CONGRATULATIONS  ★', W / 2, cY + cH / 2 - 3, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(220, 180, 130)
  doc.text('To each and every participant of ' + (comp.name || 'this competition'), W / 2, cY + cH / 2 + 8, { align: 'center' })

  // Red bottom bar
  doc.setFillColor(200, 30, 30); doc.rect(0, H - 10, W, 10, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255)
  doc.text('IEM Photography Club', 8, H - 3.5)
  doc.text('iem-photography.in', W - 8, H - 3.5, { align: 'right' })
}

// ─── Single winner card ───────────────────────────────────────────────────────
// w.portraitImg  → PNG, (portraitMm × portraitMm) square canvas
// w.winningImg   → JPEG, exactly (PHOTO_W[type] × PHOTO_H[type]) pixels canvas
// Both are placed at the mm dimensions they were cropped to — zero distortion.
async function drawWinnerCard(doc, w, idx, x, y, cardW, cardH) {
  const type = cardType(idx)
  const isFeature = type === 'feature'
  const rgb = MEDAL[idx] || [140, 140, 155]
  const [mr, mg, mb] = rgb

  // Card background
  doc.setFillColor(14, 14, 28)
  doc.setDrawColor(mr * 0.6, mg * 0.6, mb * 0.6)
  doc.setLineWidth(0.35)
  doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD')

  // Medal-color left accent bar
  doc.setFillColor(mr, mg, mb)
  doc.roundedRect(x, y, 4, cardH, 2, 2, 'F')

  // ── Winning photo (right column) ─────────────────────────────────────────────
  const photoW = PHOTO_W[type]
  const photoH = PHOTO_H[type]
  const photoX = x + cardW - photoW - 4
  const photoY = y + 3   // 3mm top padding

  if (w.winningImg) {
    // The image was cropped to (photoW*PX_PER_MM) × (photoH*PX_PER_MM)
    // Placing at exactly photoW × photoH mm → exact ratio, no distortion
    doc.setFillColor(20, 20, 36); doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F')
    doc.addImage(w.winningImg, 'JPEG', photoX, photoY, photoW, photoH)
    doc.setDrawColor(mr, mg, mb); doc.setLineWidth(0.5)
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(120, 120, 140)
    doc.text('Winning Photo', photoX + photoW / 2, y + cardH - 1, { align: 'center' })
  } else {
    doc.setFillColor(20, 20, 36); doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F')
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(55, 55, 75)
    doc.text('No photo', photoX + photoW / 2, photoY + photoH / 2 + 2.5, { align: 'center' })
  }

  // ── Portrait (circular) ───────────────────────────────────────────────────────
  const portraitMm = isFeature ? 30 : 24
  // Centre the portrait vertically in the card
  const portraitCx = x + 4 + 14 + portraitMm / 2
  const portraitCy = y + cardH / 2

  if (w.portraitImg) {
    // Glow ring
    doc.setFillColor(mr, mg, mb)
    doc.setGState(new doc.GState({ opacity: 0.22 }))
    doc.circle(portraitCx, portraitCy, portraitMm / 2 + 3.5, 'F')
    doc.setGState(new doc.GState({ opacity: 1 }))
    // Medal border ring
    doc.setDrawColor(mr, mg, mb); doc.setLineWidth(isFeature ? 1.2 : 0.9)
    doc.circle(portraitCx, portraitCy, portraitMm / 2 + 0.8, 'S')
    // Portrait image — placed as a square (same aspect as the circle-crop canvas)
    doc.addImage(w.portraitImg, 'PNG',
      portraitCx - portraitMm / 2, portraitCy - portraitMm / 2,
      portraitMm, portraitMm)
  } else {
    // Initials fallback
    doc.setFillColor(mr * 0.4, mg * 0.4, mb * 0.4)
    doc.circle(portraitCx, portraitCy, portraitMm / 2, 'F')
    doc.setDrawColor(mr, mg, mb); doc.setLineWidth(0.8)
    doc.circle(portraitCx, portraitCy, portraitMm / 2, 'S')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(isFeature ? 13 : 10); doc.setTextColor(255, 255, 255)
    const initials = (w.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    doc.text(initials, portraitCx, portraitCy + (isFeature ? 4.5 : 3.5), { align: 'center' })
  }

  // ── Text block ────────────────────────────────────────────────────────────────
  const textX    = portraitCx + portraitMm / 2 + 6
  const textMaxW = photoX - textX - 5
  const baseY    = y + cardH / 2 - (isFeature ? 12 : 9)

  // Rank pill
  const rankLabels = ['1ST PLACE', '2ND PLACE', '3RD PLACE']
  const rankLabel = rankLabels[idx] || `${idx + 1}TH PLACE`
  doc.setFont('helvetica', 'bold'); doc.setFontSize(isFeature ? 7 : 6); doc.setTextColor(mr, mg, mb)
  doc.text(rankLabel, textX, baseY)

  // Name
  doc.setFont('helvetica', 'bold'); doc.setFontSize(isFeature ? 17 : 13); doc.setTextColor(255, 255, 255)
  const nameLines = doc.splitTextToSize(w.name || '', textMaxW)
  const nameLH = (isFeature ? 17 : 13) * 0.352 * 1.25
  doc.text(nameLines.slice(0, 2), textX, baseY + (isFeature ? 8 : 6.5), { lineHeightFactor: 1.25 })

  // Prize label
  const prizeY = baseY + (isFeature ? 8 : 6.5) + Math.min(nameLines.length, 2) * nameLH + 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(isFeature ? 9 : 7.5); doc.setTextColor(mr, mg, mb)
  doc.text(w.label || (idx === 0 ? '1st Prize' : idx === 1 ? '2nd Prize' : '3rd Prize'), textX, prizeY)
}

// ─── Results page header ───────────────────────────────────────────────────────
function drawResultsHeader(doc, comp, clubLogoB64, W) {
  doc.setFillColor(18, 12, 12); doc.rect(0, 0, W, 24, 'F')
  doc.setFillColor(200, 30, 30); doc.rect(0, 0, W, 1.4, 'F')
  doc.setFillColor(...GOLD); doc.rect(0, 23.4, W, 0.6, 'F')

  if (clubLogoB64) doc.addImage(clubLogoB64, 'PNG', 6, 4, 14, 14)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(200, 200, 220)
  doc.text('IEM PHOTOGRAPHY CLUB', 25, 9.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
  doc.text(doc.splitTextToSize((comp.name || '').toUpperCase(), 115)[0] || '', 25, 18)

  // WINNERS tag
  const tw = 32
  doc.setFillColor(200, 30, 30); doc.roundedRect(W - tw - 6, 8, tw, 8, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 230, 180)
  doc.text('WINNERS', W - 6 - tw / 2, 13, { align: 'center' })
}

// ─── Page footer ──────────────────────────────────────────────────────────────
function drawPageFooter(doc, W, H, pageNum, totalPages, compName) {
  doc.setFillColor(14, 14, 26); doc.rect(0, H - 10, W, 10, 'F')
  rule(doc, 0, H - 10, W, 46, 40, 40)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 100, 120)
  doc.text('IEM Photography Club', 8, H - 3.5)
  doc.text(compName || '', W / 2, H - 3.5, { align: 'center' })
  doc.text(`Page ${pageNum} / ${totalPages}`, W - 8, H - 3.5, { align: 'right' })
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateWinnersPDF(comp) {
  const { jsPDF } = await import('jspdf')
  const W = 210, H = 297
  const winners = comp.winners || []

  // 1. Fetch all raw images in parallel (proxy for S3, local for club logo)
  const [clubLogoRaw, compBannerRaw, ...winImgRaws] = await Promise.all([
    localFetch('/IEM_20260416_215615_0000.png'),
    proxyFetch(comp.bannerUrl),
    ...winners.flatMap(w => [proxyFetch(w.photoUrl), proxyFetch(w.winningPhotoUrl)]),
  ])

  // Circular-crop the club logo (used in results page header — small, ~14mm)
  const clubLogoCircle = clubLogoRaw ? await circularCrop(clubLogoRaw, 14 * PX_PER_MM) : null

  // 2. Process each winner's images with EXACT pixel dimensions matching the display area
  //    → crop canvas aspect ratio == display mm aspect ratio → zero distortion
  const winnersData = []
  for (let i = 0; i < winners.length; i++) {
    const type = cardType(i)
    const portraitMm = i === 0 ? 30 : 24
    const pw = PHOTO_W[type], ph = PHOTO_H[type]

    const [portrait, winning] = await Promise.all([
      // Portrait: crop to a square matching portraitMm×portraitMm — placed exactly at portraitMm×portraitMm
      winImgRaws[i * 2]
        ? circularCrop(winImgRaws[i * 2], portraitMm * PX_PER_MM)
        : Promise.resolve(null),
      // Winning photo: crop to pw*PX × ph*PX → placed at pw×ph mm → exact ratio
      winImgRaws[i * 2 + 1]
        ? rectCrop(winImgRaws[i * 2 + 1], pw * PX_PER_MM, ph * PX_PER_MM)
        : Promise.resolve(null),
    ])
    winnersData.push({ ...winners[i], portraitImg: portrait, winningImg: winning })
  }

  // 3. Build the PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Cover page
  await drawCover(doc, comp, clubLogoRaw, compBannerRaw, W, H)

  // Results pages
  if (winners.length === 0) {
    doc.addPage(); drawBg(doc, W, H)
    drawResultsHeader(doc, comp, clubLogoCircle, W)
    doc.setFont('helvetica', 'italic'); doc.setFontSize(12); doc.setTextColor(100, 100, 120)
    doc.text('No winners have been announced yet.', W / 2, H / 2, { align: 'center' })
  } else {
    const MARGIN   = 8
    const GAP      = 5
    const HDR_H    = 28   // results page header
    const FTR_H    = 12
    const USABLE_H = H - HDR_H - FTR_H - 4

    // Assign heights from design tokens
    const cards = winnersData.map((w, i) => {
      const type = cardType(i)
      return { w, idx: i, h: CARD_H[type] }
    })

    // Pack cards onto pages
    const pages = [[]]
    let usedH = 0
    for (const card of cards) {
      const isFirst = pages[pages.length - 1].length === 0
      const needed  = card.h + (isFirst ? 0 : GAP)
      if (!isFirst && usedH + needed > USABLE_H) {
        pages.push([])
        usedH = 0
      }
      pages[pages.length - 1].push(card)
      usedH += (pages[pages.length - 1].length === 1 ? 0 : GAP) + card.h
    }

    const totalPages = 1 + pages.length

    for (let pi = 0; pi < pages.length; pi++) {
      doc.addPage(); drawBg(doc, W, H)
      drawResultsHeader(doc, comp, clubLogoCircle, W)
      drawPageFooter(doc, W, H, pi + 2, totalPages, comp.name)

      let curY = HDR_H + 4
      for (const card of pages[pi]) {
        await drawWinnerCard(doc, card.w, card.idx, MARGIN, curY, CARD_W, card.h)
        curY += card.h + GAP
      }
    }
  }

  // Diagonal watermark on every page
  const nPages = doc.getNumberOfPages()
  for (let p = 1; p <= nPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(44); doc.setTextColor(255, 255, 255)
    doc.setGState(new doc.GState({ opacity: 0.022 }))
    doc.text('IEM PHOTOGRAPHY', W / 2, H / 2 + 18, { align: 'center', angle: 42 })
    doc.setGState(new doc.GState({ opacity: 1 }))
  }

  const safeName = (comp.name || 'competition').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  doc.save(`${safeName}_winners.pdf`)
}
