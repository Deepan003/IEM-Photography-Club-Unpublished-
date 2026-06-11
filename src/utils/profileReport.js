import { computeAcademicYear, isCurrentSession, currentSession } from './yearCalc.js'

// Lazy-load heavy libs only when a download is actually triggered
let _jsPDF, _XLSX
async function loadJsPDF() {
  if (!_jsPDF) _jsPDF = (await import('jspdf')).jsPDF
  return _jsPDF
}
async function loadXLSX() {
  if (!_XLSX) _XLSX = await import('xlsx')
  return _XLSX
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  darkBg:   [13,   0,   5],
  darkBg2:  [22,   5,  15],
  red:      [220,  38,  38],
  redDim:   [160,  25,  25],
  white:    [255, 255, 255],
  light:    [249, 250, 251],
  border:   [229, 231, 235],
  gray:     [107, 114, 128],
  darkTxt:  [ 17,  24,  39],
  midTxt:   [ 75,  85,  99],
  lightTxt: [156, 163, 175],
}

const ROLE_CLR = {
  admin:        [220,  38,  38],
  core:         [217, 119,   6],
  coordinator:  [ 37,  99, 235],
  photographer: [  5, 150, 105],
}
const ROLE_LBL = {
  admin: 'Admin', core: 'Core Member',
  coordinator: 'Coordinator', photographer: 'Photographer',
}
const STATUS_CLR = {
  upcoming: [234, 179,   8],
  ongoing:  [ 34, 197,  94],
  active:   [ 34, 197,  94],
  past:     [156, 163, 175],
  draft:    [156, 163, 175],
}

// ── Palette additions ─────────────────────────────────────────────────────────
const INK      = [10,  10,  22]   // deep dark bg
const INK2     = [20,  15,  38]   // table header bg
const PAPER    = [248, 248, 252]  // alt row bg
const HDIVIDER = [200, 200, 215]  // horizontal row separator

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}
function bestDate(item) {
  return item.dates?.[0] || item.eventDate || item.startDate || null
}
function imgFmt(b64) {
  if (!b64) return 'JPEG'
  if (b64.startsWith('data:image/png'))  return 'PNG'
  if (b64.startsWith('data:image/gif'))  return 'GIF'
  if (b64.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}
// Direct S3 URLs are blocked by CORS in fetch() even though <img> can display them.
// Rewrite them to the backend proxy path (/api/media/<key>) which has no CORS restriction.
function resolveImgUrl(url) {
  if (!url) return url
  const m = url.match(/https?:\/\/[^/]+\.amazonaws\.com\/(.+)/)
  return m ? `/api/media/${m[1]}` : url
}
async function loadImg(url) {
  if (!url) return null
  try {
    const res = await fetch(resolveImgUrl(url), { signal: AbortSignal.timeout(60000) })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}
// Crop b64 image to targetW:targetH ratio (object-fit: cover, centered)
function cropToRatio(b64, targetW, targetH) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const srcAR = img.width / img.height
      const tgtAR = targetW / targetH
      let sx, sy, sw, sh
      if (srcAR > tgtAR) {
        sh = img.height; sw = sh * tgtAR; sx = (img.width - sw) / 2; sy = 0
      } else {
        sw = img.width; sh = sw / tgtAR; sx = 0; sy = (img.height - sh) / 2
      }
      const canvas = document.createElement('canvas')
      const maxPxR = 300
      const scaleR = Math.min(1, maxPxR / Math.max(Math.round(sw), Math.round(sh)))
      canvas.width = Math.round(sw * scaleR); canvas.height = Math.round(sh * scaleR)
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    img.onerror = () => resolve(b64)
    img.src = b64
  })
}
// Crop to ratio AND apply soft rounded corners — returns PNG with transparent corners
function cropAndRound(b64, targetW, targetH, radiusPct = 0.13, maxPx = 400) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const srcAR = img.width / img.height
      const tgtAR = targetW / targetH
      let sx, sy, sw, sh
      if (srcAR > tgtAR) {
        sh = img.height; sw = sh * tgtAR; sx = (img.width - sw) / 2; sy = 0
      } else {
        sw = img.width; sh = sw / tgtAR; sx = 0; sy = (img.height - sh) / 2
      }
      const rawCw = Math.round(sw), rawCh = Math.round(sh)
      const scale = Math.min(1, maxPx / Math.max(rawCw, rawCh))
      const cw = Math.round(rawCw * scale), ch = Math.round(rawCh * scale)
      const r  = Math.round(Math.min(cw, ch) * radiusPct)
      const canvas = document.createElement('canvas')
      canvas.width = cw; canvas.height = ch
      const ctx = canvas.getContext('2d')
      ctx.beginPath()
      ctx.moveTo(r, 0); ctx.lineTo(cw - r, 0); ctx.quadraticCurveTo(cw, 0, cw, r)
      ctx.lineTo(cw, ch - r); ctx.quadraticCurveTo(cw, ch, cw - r, ch)
      ctx.lineTo(r, ch); ctx.quadraticCurveTo(0, ch, 0, ch - r)
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.closePath(); ctx.clip()
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(b64)
    img.src = b64
  })
}
function dlBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
function dlCSV(content, filename) {
  dlBlob('﻿' + content, filename, 'text/csv;charset=utf-8;')
}
function dlXLSX(wb, filename) {
  const data = _XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
  dlBlob(data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// Matches user IDs whether they are raw strings or populated objects
function matchUid(a, b) {
  return String(a?._id || a) === String(b?._id || b)
}

// ══════════════════════════════════════════════════════════════════════════════
// CSV
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadCSV({
  user, enrolledEvents, enrolledComps, enrolledActs, postcardCount,
  getEventRole, getCompRole, getActRole, academicYear, dept,
  totalEvents, totalComps, totalActs,
}) {
  const XLSX = await loadXLSX()
  enrolledEvents = enrolledEvents.filter(isCurrentSession)
  enrolledComps  = enrolledComps.filter(isCurrentSession)
  enrolledActs   = enrolledActs.filter(isCurrentSession)

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const safe  = user.name.replace(/[^a-zA-Z0-9]/g, '_')

  const fill = rgb => ({ patternType: 'solid', fgColor: { rgb }, bgColor: { rgb: 'FFFFFF' } })
  const fB   = (rgb, sz = 10) => ({ bold: true,  sz, name: 'Calibri', color: { rgb } })
  const fN   = (rgb, sz = 10) => ({ bold: false, sz, name: 'Calibri', color: { rgb } })
  const aC   = (w = false) => ({ horizontal: 'center', vertical: 'center', wrapText: w })
  const aL   = (w = false) => ({ horizontal: 'left',   vertical: 'center', wrapText: w })
  const cs   = (f, fo, a) => ({ fill: f, font: fo, alignment: a })

  const NCOLS   = 6
  const rHex    = { admin: 'DC2626', core: 'D97706', coordinator: '2563EB', photographer: '059669' }[user.role] || '374151'
  const rBg     = { admin: 'FEE2E2', core: 'FEF3C7', coordinator: 'DBEAFE', photographer: 'D1FAE5' }[user.role] || 'F3F4F6'
  const P = {
    titleBg: '160A28', subBg: '1E0D38',
    evBg: '2563EB', evLight: 'EFF6FF', evMid: '1E40AF',
    coBg: 'D97706', coLight: 'FFFBEB', coMid: '92400E',
    acBg: '059669', acLight: 'ECFDF5', acMid: '064E3B',
    hdr: '374151', rowA: 'FFFFFF', rowB: 'F5F3FB',
    gray: '9CA3AF', mid: '374151', light: '6B7280',
  }

  const aoa = [], sty = []
  const push = (vals, styles) => { aoa.push(vals); sty.push(styles) }
  const pad  = n => Array(n).fill('')
  const padS = (n, s) => Array(n).fill(s)
  const emptyRow = () => push(pad(NCOLS), padS(NCOLS, {}))

  // Title bar
  push(
    ['IEM Photography Club  ·  Member Activity Report', ...pad(NCOLS - 1)],
    [cs(fill(P.titleBg), fB('FFFFFF', 13), aL()), ...padS(NCOLS - 1, cs(fill(P.titleBg), fN('FFFFFF'), aL()))]
  )
  push(
    ['Generated', today, ...pad(NCOLS - 2)],
    [cs(fill(P.subBg), fB('AA99CC', 9), aL()), cs(fill(P.subBg), fN('CCBBEE', 9), aL()), ...padS(NCOLS - 2, cs(fill(P.subBg), fN('CCBBEE'), aL()))]
  )
  push(
    ['Session', currentSession(), ...pad(NCOLS - 2)],
    [cs(fill(P.subBg), fB('AA99CC', 9), aL()), cs(fill(P.subBg), fN('DDCCFF', 9), aL()), ...padS(NCOLS - 2, cs(fill(P.subBg), fN('DDCCFF'), aL()))]
  )
  emptyRow()

  // Member Profile section
  push(
    ['MEMBER PROFILE', ...pad(NCOLS - 1)],
    [cs(fill(rBg), fB(rHex, 10), aL()), ...padS(NCOLS - 1, cs(fill(rBg), fN(rHex), aL()))]
  )
  push(
    ['Field', 'Value', ...pad(NCOLS - 2)],
    [cs(fill(P.hdr), fB('F9FAFB', 9), aL()), cs(fill(P.hdr), fB('F9FAFB', 9), aL()), ...padS(NCOLS - 2, cs(fill(P.hdr), fN('F9FAFB'), aL()))]
  )
  const profileFields = [
    ['Full Name',           user.name],
    ['Department / Stream', dept],
    ['Academic Year',       academicYear],
    ['Role',                ROLE_LBL[user.role] || user.role],
    ['Email',               user.email || '—'],
    ['Roll No.',            user.rollNumber || '—'],
    ['Enrollment No.',      user.enrollmentNumber || '—'],
    ['Instagram',           user.instagramHandle ? `@${user.instagramHandle}` : '—'],
    ['Bio',                 user.bio || ''],
    ['Gear / Equipment',    (user.devices || []).map(d => d.name + (d.brand ? ` (${d.brand})` : '')).join('; ') || '—'],
  ]
  profileFields.forEach(([f, v], i) => {
    const bg = i % 2 ? P.rowB : P.rowA
    push(
      [f, v, ...pad(NCOLS - 2)],
      [cs(fill(bg), fB(P.mid, 9), aL()), cs(fill(bg), fN(P.light, 9), aL(true)), ...padS(NCOLS - 2, cs(fill(bg), fN(P.gray), aL()))]
    )
  })
  emptyRow()

  // Activity Summary section
  push(
    ['ACTIVITY SUMMARY', '', `Session ${currentSession()}`, ...pad(NCOLS - 3)],
    [cs(fill(P.hdr), fB('F9FAFB', 10), aL()), cs(fill(P.hdr), fN('F9FAFB'), aL()), cs(fill(P.hdr), fN('9CA3AF', 9), aL()), ...padS(NCOLS - 3, cs(fill(P.hdr), fN('F9FAFB'), aL()))]
  )
  push(
    ['Category', 'Enrolled', 'Total in Session', ...pad(NCOLS - 3)],
    [cs(fill('4B5563'), fB('F9FAFB', 9), aL()), cs(fill('4B5563'), fB('F9FAFB', 9), aC()), cs(fill('4B5563'), fB('F9FAFB', 9), aC()), ...padS(NCOLS - 3, cs(fill('4B5563'), fN('F9FAFB'), aL()))]
  )
  ;[
    { label: 'Events',       enrolled: enrolledEvents.length, total: totalEvents ?? '—', bg: P.evLight, hex: P.evMid },
    { label: 'Competitions', enrolled: enrolledComps.length,  total: totalComps  ?? '—', bg: P.coLight, hex: P.coMid },
    { label: 'Activities',   enrolled: enrolledActs.length,   total: totalActs   ?? '—', bg: P.acLight, hex: P.acMid },
  ].forEach(({ label, enrolled, total, bg, hex }) => push(
    [label, enrolled, total, ...pad(NCOLS - 3)],
    [cs(fill(bg), fB(hex, 10), aL()), cs(fill(bg), fB(hex, 13), aC()), cs(fill(bg), fN(hex, 10), aC()), ...padS(NCOLS - 3, cs(fill(bg), fN(hex), aL()))]
  ))
  const totalPartic = enrolledEvents.length + enrolledComps.length + enrolledActs.length
  push(
    ['Total Participations', totalPartic, '', ...pad(NCOLS - 3)],
    [cs(fill(P.hdr), fB('F9FAFB', 9), aL()), cs(fill(P.hdr), fB('FFFFFF', 13), aC()), cs(fill(P.hdr), fN('F9FAFB'), aL()), ...padS(NCOLS - 3, cs(fill(P.hdr), fN('F9FAFB'), aL()))]
  )
  push(
    ['Postcards Published', postcardCount, '', ...pad(NCOLS - 3)],
    [cs(fill(P.rowA), fN(P.light, 9), aL()), cs(fill(P.rowA), fB(P.mid, 10), aC()), cs(fill(P.rowA), fN(P.gray), aL()), ...padS(NCOLS - 3, cs(fill(P.rowA), fN(P.gray), aL()))]
  )

  // Participation sections (Events / Comps / Activities)
  const sec = (heading, items, getRole, hdrBg, light, mid) => {
    if (!items.length) return
    emptyRow()
    push(
      [heading, `${items.length} item${items.length !== 1 ? 's' : ''}`, ...pad(NCOLS - 2)],
      [cs(fill(hdrBg), fB('FFFFFF', 11), aL()), cs(fill(hdrBg), fN('FFFFFF', 9), aL()), ...padS(NCOLS - 2, cs(fill(hdrBg), fN('FFFFFF'), aL()))]
    )
    push(
      ['#', 'Name', 'Date', 'Role', 'Status', 'Venue'],
      Array(NCOLS).fill(cs(fill('374151'), fB('F9FAFB', 9), aC(true)))
    )
    items.forEach((it, i) => {
      const bg     = i % 2 ? P.rowB : P.rowA
      const status = it.status || '—'
      const sbg    = { ongoing: 'D1FAE5', active: 'D1FAE5', upcoming: 'FEF3C7', past: 'F3F4F6', draft: 'F3F4F6' }[status] || bg
      const sfg    = { ongoing: '064E3B', active: '064E3B', upcoming: '92400E', past: '6B7280', draft: '9CA3AF' }[status] || P.mid
      push(
        [i + 1, it.name, fmtDate(bestDate(it)), getRole(it), status, it.venue || it.details?.venue || '—'],
        [
          cs(fill(bg),    fN(P.gray, 9),  aC()),
          cs(fill(light), fB(mid, 9),     aL()),
          cs(fill(bg),    fN(P.light, 9), aC()),
          cs(fill(bg),    fB(mid, 9),     aC()),
          cs(fill(sbg),   fB(sfg, 9),     aC()),
          cs(fill(bg),    fN(P.light, 9), aL()),
        ]
      )
    })
  }
  sec('EVENTS PARTICIPATED',       enrolledEvents, getEventRole, P.evBg, P.evLight, P.evMid)
  sec('COMPETITIONS PARTICIPATED',  enrolledComps,  getCompRole,  P.coBg, P.coLight, P.coMid)
  sec('ACTIVITIES PARTICIPATED',    enrolledActs,   getActRole,   P.acBg, P.acLight, P.acMid)

  // Assemble workbook
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  aoa.forEach((row, ri) => row.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
    if (ws[ref] && sty[ri]?.[ci]) ws[ref].s = sty[ri][ci]
  }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }]
  ws['!cols']   = [{ wch: 26 }, { wch: 38 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 24 }]
  ws['!rows']   = [{ hpt: 22 }, { hpt: 13 }, { hpt: 13 }, { hpt: 6 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Member Report')
  dlXLSX(wb, `${safe}_IEM_Report.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF — Individual Member Report
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadPDF({
  user, enrolledEvents, enrolledComps, enrolledActs, postcardCount,
  getEventRole, getCompRole, getActRole, academicYear, dept, onProgress,
  totalEvents, totalComps, totalActs,
}) {
  const [jsPDF, XLSX] = await Promise.all([loadJsPDF(), loadXLSX()])
  enrolledEvents = enrolledEvents.filter(isCurrentSession)
  enrolledComps  = enrolledComps.filter(isCurrentSession)
  enrolledActs   = enrolledActs.filter(isCurrentSession)
  onProgress?.('Loading images…')

  const [clubLogoB64, profileB64Raw] = await Promise.all([
    loadImg(`${window.location.origin}/IEM_20260416_215615_0000.png`),
    loadImg(user.profilePhoto),
  ])
  const profileB64 = profileB64Raw ? await cropAndRound(profileB64Raw, 36, 36, 0.11) : null

  const thumbKeys = [
    ...enrolledEvents.map(e => ({ key: `ev_${e._id}`, url: e.logoUrl })),
    ...enrolledComps.map(c  => ({ key: `co_${c._id}`, url: c.bannerUrl })),
    ...enrolledActs.map(a   => ({ key: `ac_${a._id}`, url: a.bannerUrl })),
  ]
  const thumbMap = {}
  await Promise.all(thumbKeys.map(async ({ key, url }) => {
    const b64 = await loadImg(url)
    if (b64) thumbMap[key] = b64
  }))

  onProgress?.('Building PDF…')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, ML = 16, CW = 178
  const FOOTER_Y = H - 16

  const F  = (...rgb) => doc.setFillColor(...rgb)
  const D  = (...rgb) => doc.setDrawColor(...rgb)
  const TC = (...rgb) => doc.setTextColor(...rgb)
  const FT = style    => doc.setFont('helvetica', style || 'normal')
  const FS = size     => doc.setFontSize(size)
  const LW = w        => doc.setLineWidth(w)
  const im = (b64, x, y, w, h) => doc.addImage(b64, imgFmt(b64), x, y, w, h, '', 'FAST')

  const drawFooter = (p, total) => {
    doc.setPage(p)
    F(...INK); doc.rect(0, H - 16, W, 16, 'F')
    F(...C.red); doc.rect(0, H - 16, W, 1, 'F')
    FT('normal'); FS(8.5); TC(145, 130, 130)
    doc.text('IEM Photography Club  ·  Member Activity Report', ML, H - 9)
    FS(8); TC(100, 88, 88)
    doc.text('Auto-generated report. For official use, contact club administration.', ML, H - 3.5)
    FT('bold'); FS(9); TC(165, 150, 150)
    doc.text(`${p} / ${total}`, W - ML, H - 7, { align: 'right' })
  }

  const drawPageCornerLogo = () => {
    if (!clubLogoB64) return
    const LLX = W - ML - 18, LLY = 5, LLS = 16
    im(clubLogoB64, LLX, LLY, LLS, LLS)
    D(...C.red); LW(0.4); doc.rect(LLX, LLY, LLS, LLS, 'S')
  }

  let y = 0

  // ═════════════════════════════════════════════════════════════════════════
  // HEADER  (0 → 68mm)
  // ═════════════════════════════════════════════════════════════════════════
  F(...INK); doc.rect(0, 0, W, 68, 'F')
  F(22, 12, 42); doc.ellipse(ML + 22, 36, 36, 26, 'F')
  F(8, 4, 28); doc.ellipse(W - 40, 22, 30, 24, 'F')
  F(...C.red); doc.rect(0, 0, W, 3, 'F')

  // Club logo — square with red border, no circle
  const LX = ML, LY = 14, LS = 36
  if (clubLogoB64) {
    im(clubLogoB64, LX, LY, LS, LS)
    D(...C.red); LW(0.8); doc.rect(LX, LY, LS, LS, 'S')
  } else {
    F(...C.red); doc.rect(LX, LY, LS, LS, 'F')
    FT('bold'); FS(11); TC(255, 255, 255)
    doc.text('IPC', LX + LS / 2, LY + LS / 2 + 4, { align: 'center' })
  }

  const TX = LX + LS + 7
  FT('normal'); FS(11); TC(180, 130, 130)
  doc.text('IEM PHOTOGRAPHY CLUB', TX, LY + 9)
  FT('bold'); FS(15); TC(255, 255, 255)
  doc.text('Member Activity Report', TX, LY + 20)
  FT('normal'); FS(11); TC(150, 130, 150)
  doc.text(
    `${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}  ·  Session ${currentSession()}`,
    TX, LY + 31
  )
  FT('bold'); FS(22); TC(255, 220, 200)
  doc.text(doc.splitTextToSize(user.name, W - TX - ML)[0], TX, LY + 52)

  F(...C.red); doc.rect(0, 68, W, 2.5, 'F')
  y = 76

  // ═════════════════════════════════════════════════════════════════════════
  // PROFILE CARD
  // ═════════════════════════════════════════════════════════════════════════
  const PW = 36, PH = 36                    // square profile photo
  const PHOTO_XC = ML + 8
  const TEXT_XC  = PHOTO_XC + PW + 10
  const TEXT_WC  = CW - PW - 24

  // Dynamic card height based on content (name is in the header, not the card)
  let neededH = 36  // dept + role badge baseline
  if (user.email)           neededH += 7
  if (user.enrollmentNumber || user.rollNumber) neededH += 7
  if (user.instagramHandle) neededH += 7
  if (user.bio)             neededH += 14
  neededH += 12  // bottom padding
  const CARD_H = Math.max(PH + 22, neededH)

  F(210, 210, 218); doc.roundedRect(ML + 1.5, y + 1.5, CW, CARD_H, 3, 3, 'F')
  F(255, 255, 255); doc.roundedRect(ML, y, CW, CARD_H, 3, 3, 'F')
  F(...C.red); doc.rect(ML, y + 4, 2.5, CARD_H - 8, 'F')

  // Profile photo — portrait 36×48mm, vertically centered, red rect border
  const PX = PHOTO_XC, PY = y + (CARD_H - PH) / 2
  if (profileB64) {
    im(profileB64, PX, PY, PW, PH)
  } else {
    F(30, 30, 50); doc.roundedRect(PX, PY, PW, PH, 4, 4, 'F')
    FT('bold'); FS(16); TC(255, 255, 255)
    const ini = user.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    doc.text(ini, PX + PW / 2, PY + PH / 2 + 5, { align: 'center' })
  }
  D(...C.red); LW(1); doc.roundedRect(PX, PY, PW, PH, 4, 4, 'S')

  // Text block — vertically centered relative to photo
  let ty = PY + 4

  FT('normal'); FS(12); TC(...C.gray)
  doc.text(`${dept}  ·  ${academicYear}`, TEXT_XC, ty); ty += 9

  // Role badge
  const rc = ROLE_CLR[user.role] || ROLE_CLR.photographer
  const rl = ROLE_LBL[user.role] || 'Member'
  FT('bold'); FS(11)
  const bw = doc.getTextWidth(rl) + 10
  F(rc[0], rc[1], rc[2]); doc.roundedRect(TEXT_XC, ty - 2, bw, 7.5, 2, 2, 'F')
  TC(255, 255, 255); doc.text(rl, TEXT_XC + 5, ty + 4)
  ty += 14

  if (user.email) {
    FT('bold'); FS(11); TC(...C.gray); doc.text('Email:', TEXT_XC, ty)
    FT('normal'); FS(11); TC(...C.darkTxt)
    doc.text(doc.splitTextToSize(user.email, TEXT_WC - 17)[0], TEXT_XC + 16, ty); ty += 7
  }
  const enrollRoll = [
    user.enrollmentNumber ? `Enrl: ${user.enrollmentNumber}` : null,
    user.rollNumber       ? `Roll: ${user.rollNumber}`       : null,
  ].filter(Boolean).join('   ·   ')
  if (enrollRoll) {
    FT('normal'); FS(11); TC(...C.midTxt)
    doc.text(enrollRoll, TEXT_XC, ty); ty += 7
  }
  if (user.instagramHandle) {
    FT('normal'); FS(11); TC(...C.darkTxt)
    doc.text(`@${user.instagramHandle}`, TEXT_XC, ty); ty += 7
  }
  if (user.bio && ty < y + CARD_H - 8) {
    FT('italic'); FS(11); TC(120, 120, 145)
    doc.text(doc.splitTextToSize(user.bio, TEXT_WC).slice(0, 2), TEXT_XC, ty)
  }

  y += CARD_H + 8

  // ═════════════════════════════════════════════════════════════════════════
  // STATS STRIP  (4 boxes)
  // ═════════════════════════════════════════════════════════════════════════
  const STATS = [
    { label: 'Events Enrolled',    value: enrolledEvents.length, total: totalEvents ?? null, clr: [220,  38,  38] },
    { label: 'Competitions',       value: enrolledComps.length,  total: totalComps  ?? null, clr: [217, 119,   6] },
    { label: 'Activities',         value: enrolledActs.length,   total: totalActs   ?? null, clr: [ 37,  99, 235] },
    { label: 'Postcards',          value: postcardCount,         total: null,                clr: [  5, 150, 105] },
  ]
  const SW = (CW - 9) / 4
  const STAT_BOX_H = 38

  STATS.forEach((s, i) => {
    const sx = ML + i * (SW + 3)
    const [r, g, b] = s.clr
    F(Math.round(r * 0.07 + 248), Math.round(g * 0.07 + 248), Math.round(b * 0.07 + 248))
    doc.roundedRect(sx, y, SW, STAT_BOX_H, 2.5, 2.5, 'F')
    F(r, g, b); doc.rect(sx, y, SW, 2, 'F')
    D(r, g, b); LW(0.3); doc.roundedRect(sx, y, SW, STAT_BOX_H, 2.5, 2.5, 'D')

    FT('bold'); FS(s.total != null ? 20 : 24); TC(r, g, b)
    doc.text(String(s.value), sx + SW / 2, y + (s.total != null ? 15 : 18), { align: 'center' })

    if (s.total != null) {
      FT('normal'); FS(11); TC(...C.midTxt)
      doc.text(`of ${s.total}`, sx + SW / 2, y + 23, { align: 'center' })
    }

    FT('normal'); FS(11); TC(...C.gray)
    const lblLines = doc.splitTextToSize(s.label, SW - 4)
    doc.text(lblLines, sx + SW / 2, y + STAT_BOX_H - (lblLines.length > 1 ? 10 : 6), { align: 'center' })
  })

  y += STAT_BOX_H + 8

  // ═════════════════════════════════════════════════════════════════════════
  // GEAR  (optional)
  // ═════════════════════════════════════════════════════════════════════════
  if (user.devices?.length > 0) {
    FT('bold'); FS(11); TC(...C.gray)
    doc.text('MY GEAR', ML, y + 5)
    y += 8
    const gcols = 2, gw = (CW - 4) / gcols
    user.devices.forEach((d, i) => {
      const col = i % gcols, gRow = Math.floor(i / gcols)
      const gx = ML + col * (gw + 4), gy = y + gRow * 9
      F(242, 242, 248); doc.roundedRect(gx, gy, gw, 7.5, 1.5, 1.5, 'F')
      D(220, 220, 232); LW(0.2); doc.roundedRect(gx, gy, gw, 7.5, 1.5, 1.5, 'D')
      FT('normal'); FS(11); TC(60, 60, 80)
      doc.text(
        doc.splitTextToSize(`${d.name}${d.brand ? ` - ${d.brand}` : ''}`, gw - 6)[0],
        gx + 4, gy + 5.5
      )
    })
    y += Math.ceil(user.devices.length / gcols) * 9 + 6
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ACTIVITY TABLES
  // ═════════════════════════════════════════════════════════════════════════
  const COL = {
    LOGO:   ML + 2,
    NAME:   ML + 18,
    DATE:   ML + 88,
    ROLE:   ML + 120,
    STATUS: ML + 150,
  }
  const ROW_H = 17

  const drawSection = (title, items, getRole, prefix) => {
    if (!items.length) return
    if (y + 44 > FOOTER_Y) { doc.addPage(); y = 22 }

    F(...INK); doc.rect(ML, y, CW, 12, 'F')
    F(...C.red); doc.rect(ML, y, 4, 12, 'F')
    FT('bold'); FS(13); TC(255, 255, 255)
    doc.text(title, ML + 9, y + 8.5)
    FT('bold'); FS(11); TC(180, 155, 155)
    doc.text(`${items.length}`, ML + CW - 4, y + 8.5, { align: 'right' })
    y += 14

    const drawColHeader = () => {
      F(...INK2); doc.rect(ML, y, CW, 10, 'F')
      FT('bold'); FS(11); TC(200, 190, 210)
      doc.text('LOGO',   COL.LOGO + 1,  y + 7)
      doc.text('NAME',   COL.NAME,      y + 7)
      doc.text('DATE',   COL.DATE,      y + 7)
      doc.text('ROLE',   COL.ROLE,      y + 7)
      doc.text('STATUS', COL.STATUS,    y + 7)
      y += 11
    }
    drawColHeader()

    items.forEach((item, idx) => {
      if (y + ROW_H > FOOTER_Y) {
        doc.addPage(); y = 22
        drawColHeader()
      }

      if (idx % 2 === 0) {
        F(255, 255, 255); doc.rect(ML, y, CW, ROW_H, 'F')
      } else {
        F(...PAPER); doc.rect(ML, y, CW, ROW_H, 'F')
      }

      const [r2, g2, b2] = ROLE_CLR[user.role] || ROLE_CLR.photographer
      F(r2, g2, b2); doc.rect(ML, y, 2, ROW_H, 'F')

      // Logo 13×13mm
      const LSIZ = 13, LLX = COL.LOGO + 1, LLY = y + (ROW_H - LSIZ) / 2
      const logoB64 = thumbMap[`${prefix}_${item._id}`]
      if (logoB64) {
        im(logoB64, LLX, LLY, LSIZ, LSIZ)
        D(210, 210, 220); LW(0.2); doc.rect(LLX, LLY, LSIZ, LSIZ, 'S')
      } else {
        F(r2, g2, b2); doc.roundedRect(LLX, LLY, LSIZ, LSIZ, 2, 2, 'F')
        FT('bold'); FS(11); TC(255, 255, 255)
        doc.text((item.name[0] || '?').toUpperCase(), LLX + LSIZ / 2, LLY + LSIZ / 2 + 2, { align: 'center' })
      }

      const nameW = COL.DATE - COL.NAME - 4
      const nameParts = doc.splitTextToSize(item.name, nameW)
      FT('bold'); FS(12); TC(...C.darkTxt)
      doc.text(nameParts[0], COL.NAME, y + 7)
      if (nameParts[1]) {
        FT('normal'); FS(11); TC(...C.gray)
        doc.text(nameParts[1], COL.NAME, y + 13)
      }

      FT('normal'); FS(11); TC(...C.midTxt)
      doc.text(fmtDate(bestDate(item)), COL.DATE, y + 7)

      FT('normal'); FS(11); TC(...C.midTxt)
      doc.text(
        doc.splitTextToSize(getRole(item), COL.STATUS - COL.ROLE - 4)[0],
        COL.ROLE, y + 7
      )

      const sc = STATUS_CLR[item.status] || STATUS_CLR.past
      F(sc[0], sc[1], sc[2]); doc.circle(COL.STATUS + 2.5, y + 6, 2.2, 'F')
      FT('normal'); FS(11); TC(...C.midTxt)
      doc.text(item.status || '-', COL.STATUS + 7, y + 7)

      D(...HDIVIDER); LW(0.12); doc.line(ML, y + ROW_H, ML + CW, y + ROW_H)
      y += ROW_H
    })

    y += 10
  }

  drawSection('EVENTS PARTICIPATED',       enrolledEvents, getEventRole, 'ev')
  drawSection('COMPETITIONS PARTICIPATED',  enrolledComps,  getCompRole,  'co')
  drawSection('ACTIVITIES PARTICIPATED',    enrolledActs,   getActRole,   'ac')

  // Page 1 already has the logo in the header; add corner logo only on page 2+
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    if (p > 1) drawPageCornerLogo()
    drawFooter(p, total)
  }

  const safe = user.name.replace(/[^a-zA-Z0-9]/g, '_')
  doc.save(`${safe}_IEM_PhotoClub_Report.pdf`)
  onProgress?.(null)
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN BULK XLSX — styled participation matrix (members × activities)
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadAdminBulkCSV({ members, events, comps, acts }) {
  const XLSX = await loadXLSX()
  events = events.filter(isCurrentSession)
  comps  = comps.filter(isCurrentSession)
  acts   = acts.filter(isCurrentSession)

  const today   = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const dateStr = new Date().toISOString().slice(0, 10)

  const roleOrder = { admin: 0, core: 1, coordinator: 2, photographer: 3 }
  const sorted = [...members].sort(
    (a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4) || a.name.localeCompare(b.name)
  )

  const strip  = n => n.replace(/^\[SEED\]\s*/, '')
  const toHex  = arr => arr.map(v => v.toString(16).padStart(2, '0')).join('')
  const FIXED  = 8   // #  Name  Email  Dept  Year  Enrl  Roll  Role
  const NCOLS  = FIXED + events.length + comps.length + acts.length + 4

  // ── Style builders ────────────────────────────────────────────────────────
  const fill   = rgb => ({ patternType: 'solid', fgColor: { rgb }, bgColor: { rgb: 'FFFFFF' } })
  const fB     = (rgb, sz = 10) => ({ bold: true,  sz, name: 'Calibri', color: { rgb } })
  const fN     = (rgb, sz = 10) => ({ bold: false, sz, name: 'Calibri', color: { rgb } })
  const fMono  = (rgb, sz = 9)  => ({ bold: false, sz, name: 'Courier New', color: { rgb } })
  const aC     = (wrap = false) => ({ horizontal: 'center', vertical: 'center', wrapText: wrap })
  const aL     = (wrap = false) => ({ horizontal: 'left',   vertical: 'center', wrapText: wrap })
  const cell   = (fill, font, alignment) => ({ fill, font, alignment })

  // Palette
  const P = {
    titleBg:  '160A28', subBg:    '1E0D38',
    evHdr:    '2563EB', evMid:    '1E40AF', evLight:  'EFF6FF',
    coHdr:    'D97706', coMid:    '92400E', coLight:  'FFFBEB',
    acHdr:    '059669', acMid:    '064E3B', acLight:  'ECFDF5',
    fixHdr:   '374151', fixLight: 'F9FAFB',
    totHdr:   'EA580C', totLight: 'FFF7ED',
    rAdmin:   'FEE2E2', rCore:    'FEF3C7', rCoord:   'DBEAFE', rPhoto:   'D1FAE5',
    rowA:     'FFFFFF', rowB:     'F5F3FB',
    gray:     '9CA3AF', darkTxt:  '111827', midTxt:   '374151', lightTxt: '6B7280',
  }
  const ROLE_BG  = { admin: P.rAdmin, core: P.rCore, coordinator: P.rCoord, photographer: P.rPhoto }
  const ROLE_HEX = { admin: toHex(ROLE_CLR.admin), core: toHex(ROLE_CLR.core), coordinator: toHex(ROLE_CLR.coordinator), photographer: toHex(ROLE_CLR.photographer) }

  // ── Build rows ─────────────────────────────────────────────────────────────
  const aoa = [], sty = []
  const push = (vals, styles) => { aoa.push(vals); sty.push(styles) }
  const pad  = n => Array(n).fill('')
  const padS = (n, s) => Array(n).fill(s)

  // Row 1 — Title
  push(
    ['IEM Photography Club  ·  Members Participation Matrix', ...pad(NCOLS - 1)],
    [cell(fill(P.titleBg), fB('FFFFFF', 14), aL()), ...padS(NCOLS - 1, cell(fill(P.titleBg), fN('FFFFFF'), aL()))]
  )
  // Row 2 — Generated
  push(
    ['Generated', today, ...pad(NCOLS - 2)],
    [cell(fill(P.subBg), fB('AA99CC', 9), aL()), cell(fill(P.subBg), fN('CCBBEE', 9), aL()), ...padS(NCOLS - 2, cell(fill(P.subBg), fN('CCBBEE'), aL()))]
  )
  // Row 3 — Session
  push(
    ['Session', `${currentSession()}`, ...pad(NCOLS - 2)],
    [cell(fill(P.subBg), fB('AA99CC', 9), aL()), cell(fill(P.subBg), fN('DDCCFF', 9), aL()), ...padS(NCOLS - 2, cell(fill(P.subBg), fN('DDCCFF'), aL()))]
  )
  // Row 4 — Counts
  push(
    ['Total Members', members.length, 'Events', events.length, 'Competitions', comps.length, 'Activities', acts.length, ...pad(NCOLS - 8)],
    [
      cell(fill(P.subBg), fB('FFDDBB', 9), aL()), cell(fill(P.subBg), fB('FFFFFF', 13), aC()),
      cell(fill(P.subBg), fB('BBDDFF', 9), aL()), cell(fill(P.subBg), fB(toHex(ROLE_CLR.coordinator), 13), aC()),
      cell(fill(P.subBg), fB('FFDDA0', 9), aL()), cell(fill(P.subBg), fB(toHex(ROLE_CLR.core),       13), aC()),
      cell(fill(P.subBg), fB('BBFFDD', 9), aL()), cell(fill(P.subBg), fB(toHex(ROLE_CLR.photographer),13), aC()),
      ...padS(NCOLS - 8, cell(fill(P.subBg), fN('FFFFFF'), aL())),
    ]
  )
  // Row 5 — Spacer
  push(pad(NCOLS), padS(NCOLS, {}))

  // Row 6 — Category labels
  push(
    [...pad(FIXED), ...events.map(() => 'Event'), ...comps.map(() => 'Competition'), ...acts.map(() => 'Activity'), ...Array(4).fill('Totals')],
    [
      ...padS(FIXED, cell(fill(P.fixHdr), fB(P.fixLight, 8), aC())),
      ...padS(events.length, cell(fill(P.evHdr), fB('FFFFFF', 8), aC())),
      ...padS(comps.length,  cell(fill(P.coHdr), fB('FFFFFF', 8), aC())),
      ...padS(acts.length,   cell(fill(P.acHdr), fB('FFFFFF', 8), aC())),
      ...padS(4,             cell(fill(P.totHdr), fB('FFFFFF', 8), aC())),
    ]
  )
  // Row 7 — Column headers
  push(
    ['#', 'Name', 'Email', 'Department', 'Academic Year', 'Enrollment No.', 'Roll No.', 'Role',
     ...events.map(e => strip(e.name)), ...comps.map(c => strip(c.name)), ...acts.map(a => strip(a.name)),
     'Events', 'Comps', 'Activities', 'Grand Total'],
    [
      ...padS(FIXED, cell(fill(P.fixHdr), fB(P.fixLight, 10), aC(true))),
      ...padS(events.length, cell(fill(P.evMid), fB('FFFFFF', 9), aC(true))),
      ...padS(comps.length,  cell(fill(P.coMid), fB('FFFFFF', 9), aC(true))),
      ...padS(acts.length,   cell(fill(P.acMid), fB('FFFFFF', 9), aC(true))),
      ...padS(4,             cell(fill(P.totHdr), fB('FFFFFF', 10), aC())),
    ]
  )

  // Data rows
  sorted.forEach((u, idx) => {
    const yr    = computeAcademicYear(u.startYear, u.endYear)
    const dept  = u.department === 'OTHER' ? (u.departmentOther || 'Other') : u.department
    const yrlbl = yr.isPassout ? 'Passout' : (yr.label || '')
    const rbg   = ROLE_BG[u.role]  || (idx % 2 ? P.rowB : P.rowA)
    const rhex  = ROLE_HEX[u.role] || P.midTxt
    const rowBg = idx % 2 ? P.rowB : P.rowA

    const evCols = events.map(ev => { const m = (ev.members   || []).find(m => matchUid(m.user, u._id)); return m ? (m.eventRole || 'member')    : '—' })
    const coCols = comps.map(c  => { const v = (c.volunteers  || []).find(v => matchUid(v.user, u._id)); return v ? (v.role      || 'volunteer') : '—' })
    const acCols = acts.map(a   => { const v = (a.volunteers  || []).find(v => matchUid(v.user, u._id)); return v ? (v.role      || 'volunteer') : '—' })

    const totEv = evCols.filter(v => v !== '—').length
    const totCo = coCols.filter(v => v !== '—').length
    const totAc = acCols.filter(v => v !== '—').length
    const tot   = totEv + totCo + totAc

    push(
      [idx + 1, u.name, u.email || '', dept, yrlbl, u.enrollmentNumber || '', u.rollNumber || '', ROLE_LBL[u.role] || u.role,
       ...evCols, ...coCols, ...acCols, totEv, totCo, totAc, tot],
      [
        cell(fill(rowBg), fN(P.gray,    9), aC()),
        cell(fill(rbg),   fB(P.darkTxt,10), aL()),
        cell(fill(rowBg), fN(P.lightTxt,8), aL()),
        cell(fill(rowBg), fN(P.midTxt,  9), aC()),
        cell(fill(rowBg), fN(P.midTxt,  9), aC()),
        cell(fill(rowBg), fMono(P.lightTxt), aC()),
        cell(fill(rowBg), fMono(P.lightTxt), aC()),
        cell(fill(rbg),   fB(rhex,       9), aC()),
        ...evCols.map(v => v !== '—'
          ? cell(fill(P.evLight), fB(P.evMid, 9), aC())
          : cell(fill(rowBg),     fN(P.gray,  9), aC())),
        ...coCols.map(v => v !== '—'
          ? cell(fill(P.coLight), fB(P.coMid, 9), aC())
          : cell(fill(rowBg),     fN(P.gray,  9), aC())),
        ...acCols.map(v => v !== '—'
          ? cell(fill(P.acLight), fB(P.acMid, 9), aC())
          : cell(fill(rowBg),     fN(P.gray,  9), aC())),
        cell(fill(P.totLight), totEv > 0 ? fB(P.evMid, 11) : fN(P.gray, 10), aC()),
        cell(fill(P.totLight), totCo > 0 ? fB(P.coMid, 11) : fN(P.gray, 10), aC()),
        cell(fill(P.totLight), totAc > 0 ? fB(P.acMid, 11) : fN(P.gray, 10), aC()),
        cell(fill(tot > 0 ? P.totLight : rowBg), tot > 0 ? fB(P.totHdr, 13) : fN(P.gray, 10), aC()),
      ]
    )
  })

  // ── Assemble workbook ──────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Apply styles
  aoa.forEach((row, ri) => {
    row.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (ws[ref] && sty[ri]?.[ci]) ws[ref].s = sty[ri][ci]
    })
  })

  // Merge title row across all columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }]

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 24 }, { wch: 30 }, { wch: 12 }, { wch: 11 }, { wch: 17 }, { wch: 10 }, { wch: 14 },
    ...events.map(() => ({ wch: 20 })),
    ...comps.map(()  => ({ wch: 20 })),
    ...acts.map(()   => ({ wch: 20 })),
    { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
  ]

  // Row heights (px points)
  ws['!rows'] = [
    { hpt: 24 }, { hpt: 13 }, { hpt: 13 }, { hpt: 18 }, { hpt: 5 },
    { hpt: 15 }, { hpt: 36 },
    ...sorted.map(() => ({ hpt: 18 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Members Report')
  dlXLSX(wb, `IEM_PhotoClub_Members_Report_${dateStr}.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN BULK PDF  — cover page + per-member activity cards
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadAdminBulkPDF({ members, events, comps, acts, onProgress }) {
  const [jsPDF, XLSX] = await Promise.all([loadJsPDF(), loadXLSX()])
  events = events.filter(isCurrentSession)
  comps  = comps.filter(isCurrentSession)
  acts   = acts.filter(isCurrentSession)
  onProgress?.('Loading club logo…')
  const clubLogoB64 = await loadImg(`${window.location.origin}/IEM_20260416_215615_0000.png`)

  const photoMap = {}
  const BATCH = 6
  for (let i = 0; i < members.length; i += BATCH) {
    await Promise.all(members.slice(i, i + BATCH).map(async u => {
      if (u.profilePhoto) {
        const b64 = await loadImg(u.profilePhoto)
        if (b64) photoMap[u._id] = await cropAndRound(b64, 14, 14)
      }
    }))
    onProgress?.(`Loading photos… ${Math.min(i + BATCH, members.length)} / ${members.length}`)
  }

  onProgress?.('Loading thumbnails…')
  const thumbMap2 = {}
  await Promise.all([
    ...events.map(e => ({ key: `ev_${e._id}`, url: e.logoUrl })),
    ...comps.map(c  => ({ key: `co_${c._id}`, url: c.bannerUrl })),
    ...acts.map(a   => ({ key: `ac_${a._id}`, url: a.bannerUrl })),
  ].map(async ({ key, url }) => {
    const b64 = await loadImg(url)
    if (b64) thumbMap2[key] = b64
  }))

  onProgress?.('Building PDF…')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, ML = 16, CW = 178
  const FOOTER_Y = H - 16
  const PAGE_TOP  = 18

  const F   = (...rgb) => doc.setFillColor(...rgb)
  const D   = (...rgb) => doc.setDrawColor(...rgb)
  const TC  = (...rgb) => doc.setTextColor(...rgb)
  const FT  = style    => doc.setFont('helvetica', style || 'normal')
  const FS  = size     => doc.setFontSize(size)
  const LW  = w        => doc.setLineWidth(w)
  const im  = (b64, x, y, w, h) => doc.addImage(b64, imgFmt(b64), x, y, w, h, '', 'FAST')

  // ── Footer helper ──────────────────────────────────────────────────────────
  const drawFooter = (p, total) => {
    doc.setPage(p)
    F(...INK); doc.rect(0, H - 16, W, 16, 'F')
    F(...C.red); doc.rect(0, H - 16, W, 1, 'F')
    FT('normal'); FS(8.5); TC(145, 130, 130)
    doc.text('IEM Photography Club  ·  Members Activity Report', ML, H - 9)
    FS(8); TC(100, 88, 88)
    doc.text('Auto-generated report. For official use, contact club administration.', ML, H - 3.5)
    FT('bold'); FS(9); TC(165, 150, 150)
    doc.text(`${p} / ${total}`, W - ML, H - 7, { align: 'right' })
  }

  // ── Page logo helper ───────────────────────────────────────────────────────
  const drawPageLogo = () => {
    if (!clubLogoB64) return
    const LLX = W - ML - 16, LLY = 4, LLS = 14
    im(clubLogoB64, LLX, LLY, LLS, LLS)
    D(...C.red); LW(0.35); doc.rect(LLX, LLY, LLS, LLS, 'S')
  }

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  F(...INK); doc.rect(0, 0, W, H, 'F')
  // Depth ellipses
  F(24, 12, 48); doc.ellipse(W / 2 - 45, 88, 58, 46, 'F')
  F(8,   4, 28); doc.ellipse(W / 2 + 58, 52, 42, 32, 'F')
  F(...C.red); doc.rect(0, 0, W, 2.5, 'F')

  const CX = W / 2
  if (clubLogoB64) {
    im(clubLogoB64, CX - 24, 36, 48, 48)
    D(...C.red); LW(0.9); doc.rect(CX - 24, 36, 48, 48, 'S')
  } else {
    F(...C.red); doc.rect(CX - 24, 36, 48, 48, 'F')
    FT('bold'); FS(14); TC(255, 255, 255)
    doc.text('IPC', CX, 65, { align: 'center' })
  }

  FT('bold'); FS(13); TC(180, 140, 140)
  doc.text('IEM PHOTOGRAPHY CLUB', CX, 99, { align: 'center' })
  FT('bold'); FS(22); TC(255, 255, 255)
  doc.text('Members Activity Report', CX, 113, { align: 'center' })
  // Red underline 80mm centered
  F(...C.red); doc.rect(CX - 40, 117, 80, 1.5, 'F')
  FT('normal'); FS(11); TC(145, 125, 125)
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    CX, 127, { align: 'center' }
  )
  FT('bold'); FS(11); TC(200, 145, 145)
  doc.text(`Session: ${currentSession()}`, CX, 137, { align: 'center' })

  // Cover stats — 2×2 grid for breathing room
  const coverStats = [
    { label: 'Total Members', val: members.length, clr: [220,  38,  38] },
    { label: 'Events',        val: events.length,  clr: [217, 119,   6] },
    { label: 'Competitions',  val: comps.length,   clr: [ 37,  99, 235] },
    { label: 'Activities',    val: acts.length,    clr: [  5, 150, 105] },
  ]
  const CSBW = 80, CSBH = 42, CSBGAP = CW - 2 * CSBW
  const CSROW1Y = 142, CSROW2Y = CSROW1Y + CSBH + 8
  ;[[0, 1], [2, 3]].forEach(([a, b], rowIdx) => {
    const sy = rowIdx === 0 ? CSROW1Y : CSROW2Y
    ;[coverStats[a], coverStats[b]].forEach((s, ci) => {
      const sx = ML + ci * (CSBW + CSBGAP)
      const [r, g, b2] = s.clr
      F(r, g, b2); doc.roundedRect(sx, sy, CSBW, CSBH, 3, 3, 'F')
      // Darker top strip
      F(Math.round(r * 0.55), Math.round(g * 0.55), Math.round(b2 * 0.55))
      doc.rect(sx, sy, CSBW, 2, 'F')
      FT('bold'); FS(26); TC(255, 255, 255)
      doc.text(String(s.val), sx + CSBW / 2, sy + 24, { align: 'center' })
      FT('normal'); FS(10); TC(255, 240, 240)
      doc.text(s.label, sx + CSBW / 2, sy + 36, { align: 'center' })
    })
  })

  // ── MEMBER PAGES ───────────────────────────────────────────────────────────
  doc.addPage()
  let y = PAGE_TOP

  const ensureSpace = needed => {
    if (y + needed > FOOTER_Y) { doc.addPage(); y = PAGE_TOP }
  }

  const CARD_H  = 30
  const PW = 14, PH = 14              // square profile photo
  const PHOTO_X = ML + 5
  const TEXT_X  = PHOTO_X + PW + 5
  const TEXT_W  = 96
  const STAT_X  = ML + CW - 42
  const STAT_W  = 11
  const STAT_H  = 11
  const ROW_SM  = 7
  const CAT_CLR = [[220, 38, 38], [217, 119, 6], [37, 99, 235]]

  for (let mi = 0; mi < members.length; mi++) {
    const u    = members[mi]
    const yr   = computeAcademicYear(u.startYear, u.endYear)
    const dept = u.department === 'OTHER' ? (u.departmentOther || 'Other') : u.department
    const ini  = u.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const pB64 = photoMap[u._id] || null
    const rc   = ROLE_CLR[u.role] || ROLE_CLR.photographer

    const myEv = events.filter(ev => (ev.members || []).some(m => matchUid(m.user, u._id)))
    const myCo = comps.filter(c  => (c.volunteers || []).some(v => matchUid(v.user, u._id)))
    const myAc = acts.filter(a   => (a.volunteers || []).some(v => matchUid(v.user, u._id)))

    ensureSpace(CARD_H + 4)

    // ── User card ──────────────────────────────────────────────────────────
    // Shadow
    F(220, 218, 232); doc.roundedRect(ML + 1, y + 1, CW, CARD_H, 2.5, 2.5, 'F')
    // Card
    F(252, 252, 255); doc.roundedRect(ML, y, CW, CARD_H, 2.5, 2.5, 'F')
    // Role-colored left accent bar
    F(...rc); doc.rect(ML, y, 4, CARD_H, 'F')
    // Smooth top-left corner for accent
    doc.roundedRect(ML, y, 4, 5, 2.5, 2.5, 'F')

    // Profile photo — portrait 11×20mm, vertically centered
    const PY = y + (CARD_H - PH) / 2
    const PCX = PHOTO_X + PW / 2, PCY = PY + PH / 2
    if (pB64) {
      im(pB64, PHOTO_X, PY, PW, PH)
    } else {
      F(...rc); doc.roundedRect(PHOTO_X, PY, PW, PH, 2, 2, 'F')
      FT('bold'); FS(6); TC(255, 255, 255)
      doc.text(ini, PCX, PCY + 2.2, { align: 'center' })
    }
    D(...rc); LW(0.35); doc.roundedRect(PHOTO_X, PY, PW, PH, 2, 2, 'S')

    // Name
    FT('bold'); FS(9); TC(20, 20, 35)
    doc.text(doc.splitTextToSize(u.name, TEXT_W)[0], TEXT_X, y + 8)
    // Dept · Year
    FT('normal'); FS(6.5); TC(100, 100, 120)
    doc.text(`${dept}  ·  ${yr.isPassout ? 'Passout' : yr.label || '—'}`, TEXT_X, y + 14)
    // Enrollment / Roll
    const info2 = [
      u.enrollmentNumber ? `Enrl: ${u.enrollmentNumber}` : null,
      u.rollNumber       ? `Roll: ${u.rollNumber}` : null,
    ].filter(Boolean).join('   ')
    if (info2) {
      FT('normal'); FS(5.8); TC(140, 140, 160)
      doc.text(info2, TEXT_X, y + 19.5)
    }
    // Role badge
    const roleLabel2 = ROLE_LBL[u.role] || 'Member'
    FT('bold'); FS(5.5)
    const rbw2 = doc.getTextWidth(roleLabel2) + 6
    F(...rc); doc.roundedRect(TEXT_X, y + 22.5, rbw2, 4.5, 1, 1, 'F')
    TC(255, 255, 255); doc.text(roleLabel2, TEXT_X + rbw2 / 2, y + 25.7, { align: 'center' })

    // Stats boxes right zone — 3 boxes: Ev / Co / Ac, vertically centered
    ;[myEv.length, myCo.length, myAc.length].forEach((val, si) => {
      const sx = STAT_X + si * (STAT_W + 3)
      const [r, g, b] = CAT_CLR[si]
      F(Math.round(r * 0.08 + 238), Math.round(g * 0.08 + 238), Math.round(b * 0.08 + 238))
      doc.roundedRect(sx, y + 7, STAT_W, STAT_H, 1.5, 1.5, 'F')
      F(r, g, b); doc.rect(sx, y + 7, STAT_W, 1.2, 'F')
      FT('bold'); FS(8); TC(r, g, b)
      doc.text(String(val), sx + STAT_W / 2, y + 14.5, { align: 'center' })
      FT('normal'); FS(5); TC(110, 110, 130)
      doc.text(['Ev', 'Co', 'Ac'][si], sx + STAT_W / 2, y + 17.5, { align: 'center' })
    })

    // Index
    FT('normal'); FS(5.5); TC(160, 160, 185)
    doc.text(`#${mi + 1}`, ML + CW - 3, y + 5, { align: 'right' })

    y += CARD_H + 2

    // ── Participation sections ─────────────────────────────────────────────
    const drawBulkCat = (items, label, roleGetter, catClr, prefix) => {
      if (!items.length) return
      ensureSpace(6 + items.length * ROW_SM + 3)

      // Category label bar
      F(...catClr); doc.rect(ML + 3, y, 2.5, 5.5, 'F')
      FT('bold'); FS(6.5); TC(...catClr)
      doc.text(label, ML + 8, y + 4)
      FT('normal'); FS(6); TC(130, 130, 150)
      doc.text(String(items.length), ML + CW - 4, y + 4, { align: 'right' })
      y += 6.5

      items.forEach((item, idx) => {
        ensureSpace(ROW_SM + 1)

        if (idx % 2 === 0) {
          F(...PAPER); doc.rect(ML + 3, y, CW - 3, ROW_SM, 'F')
        } else {
          F(255, 255, 255); doc.rect(ML + 3, y, CW - 3, ROW_SM, 'F')
        }

        // Left accent 1.5mm
        F(...catClr); doc.rect(ML + 3, y, 1.5, ROW_SM, 'F')

        // Thumbnail 5×5mm
        const TSIZE = 5
        const TX = ML + 5.5, TY = y + (ROW_SM - TSIZE) / 2
        const tb64 = thumbMap2[`${prefix}_${item._id}`]
        if (tb64) {
          im(tb64, TX, TY, TSIZE, TSIZE)
          D(200, 200, 215); LW(0.1); doc.rect(TX, TY, TSIZE, TSIZE, 'S')
        } else {
          F(...catClr); doc.roundedRect(TX, TY, TSIZE, TSIZE, 1, 1, 'F')
          FT('bold'); FS(5.5); TC(255, 255, 255)
          doc.text((item.name[0] || '?').toUpperCase(), TX + TSIZE / 2, TY + TSIZE / 2 + 1.8, { align: 'center' })
        }

        // Name
        FT('normal'); FS(6.2); TC(25, 25, 45)
        doc.text(doc.splitTextToSize(item.name, 60)[0], ML + 12, y + 5)

        // Date
        FT('normal'); FS(5.8); TC(110, 110, 130)
        doc.text(fmtDate(bestDate(item)), ML + 92, y + 5)

        // Role
        const roleStr = roleGetter(item)
        const rolClr  = ROLE_CLR[roleStr] || [100, 100, 130]
        FT('bold'); FS(5.5); TC(...rolClr)
        doc.text(roleStr, ML + 130, y + 5)

        // Status dot
        const sc4 = STATUS_CLR[item.status] || STATUS_CLR.past
        F(sc4[0], sc4[1], sc4[2]); doc.circle(ML + 162, y + 3.5, 1.4, 'F')

        D(...HDIVIDER); LW(0.1); doc.line(ML + 3, y + ROW_SM, ML + CW, y + ROW_SM)
        y += ROW_SM
      })
      y += 3
    }

    const getEvRole3 = ev => { const m = (ev.members || []).find(m => matchUid(m.user, u._id)); return m?.eventRole || 'photographer' }
    const getCpRole3 = c  => { const v = (c.volunteers || []).find(v => matchUid(v.user, u._id)); return v?.role || 'volunteer' }
    const getAcRole3 = a  => { const v = (a.volunteers || []).find(v => matchUid(v.user, u._id)); return v?.role || 'volunteer' }

    drawBulkCat(myEv, 'EVENTS PARTICIPATED',       getEvRole3, CAT_CLR[0], 'ev')
    drawBulkCat(myCo, 'COMPETITIONS PARTICIPATED', getCpRole3, CAT_CLR[1], 'co')
    drawBulkCat(myAc, 'ACTIVITIES PARTICIPATED',   getAcRole3, CAT_CLR[2], 'ac')

    // Member separator
    D(210, 210, 222); LW(0.15); doc.line(ML, y + 2, ML + CW, y + 2)
    y += 4
  }

  // ── FOOTER + page logo on every page ──────────────────────────────────────
  const total2 = doc.getNumberOfPages()
  for (let p = 1; p <= total2; p++) {
    doc.setPage(p)
    if (p > 1) drawPageLogo()  // not on cover
    drawFooter(p, total2)
  }

  doc.save(`IEM_PhotoClub_Members_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
  onProgress?.(null)
}

// ── role display helper ────────────────────────────────────────────────────────
function rlbl(role) {
  return { core:'Core', coordinator:'Coordinator', photographer:'Photographer', volunteer:'Volunteer' }[role] || (role || '—')
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE ITEM CSV
// members = [{ user: fullUserObj, role: string }]
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadSingleItemCSV({ item, itemType, members }) {
  const XLSX = await loadXLSX()
  const typeName = { event:'Event', competition:'Competition', activity:'Activity' }[itemType] || itemType
  const today    = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const safe     = (item.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')

  const fill = rgb => ({ patternType: 'solid', fgColor: { rgb }, bgColor: { rgb: 'FFFFFF' } })
  const fB   = (rgb, sz = 10) => ({ bold: true,  sz, name: 'Calibri', color: { rgb } })
  const fN   = (rgb, sz = 10) => ({ bold: false, sz, name: 'Calibri', color: { rgb } })
  const aC   = (w = false) => ({ horizontal: 'center', vertical: 'center', wrapText: w })
  const aL   = (w = false) => ({ horizontal: 'left',   vertical: 'center', wrapText: w })
  const cs   = (f, fo, a) => ({ fill: f, font: fo, alignment: a })

  const TC = {
    event:       { bg: '2563EB', light: 'EFF6FF', mid: '1E40AF', dark: '1E3A8A' },
    competition: { bg: 'D97706', light: 'FFFBEB', mid: '92400E', dark: '78350F' },
    activity:    { bg: '059669', light: 'ECFDF5', mid: '064E3B', dark: '064E3B' },
  }[itemType] || { bg: '374151', light: 'F9FAFB', mid: '374151', dark: '1F2937' }

  const ROLE_BG  = { core: 'FEF3C7', coordinator: 'DBEAFE', photographer: 'D1FAE5', volunteer: 'F3F4F6' }
  const ROLE_HEX = { core: 'D97706', coordinator: '2563EB', photographer: '059669', volunteer: '6B7280' }

  const NCOLS = 9
  const aoa = [], sty = []
  const push = (vals, styles) => { aoa.push(vals); sty.push(styles) }
  const pad  = n => Array(n).fill('')
  const padS = (n, s) => Array(n).fill(s)
  const emptyRow = () => push(pad(NCOLS), padS(NCOLS, {}))

  // Title bar
  push(
    [`IEM Photography Club  ·  ${typeName} Report`, ...pad(NCOLS - 1)],
    [cs(fill(TC.dark), fB('FFFFFF', 13), aL()), ...padS(NCOLS - 1, cs(fill(TC.dark), fN('FFFFFF'), aL()))]
  )
  push(
    ['Generated', today, 'Session', currentSession(), ...pad(NCOLS - 4)],
    [cs(fill('1E0D38'), fB('AA99CC', 9), aL()), cs(fill('1E0D38'), fN('CCBBEE', 9), aL()),
     cs(fill('1E0D38'), fB('AA99CC', 9), aL()), cs(fill('1E0D38'), fN('DDCCFF', 9), aL()),
     ...padS(NCOLS - 4, cs(fill('1E0D38'), fN('CCBBEE'), aL()))]
  )
  emptyRow()

  // Item details
  push(
    [`${typeName.toUpperCase()} DETAILS`, ...pad(NCOLS - 1)],
    [cs(fill(TC.bg), fB('FFFFFF', 10), aL()), ...padS(NCOLS - 1, cs(fill(TC.bg), fN('FFFFFF'), aL()))]
  )
  push(
    ['Field', 'Value', ...pad(NCOLS - 2)],
    [cs(fill('374151'), fB('F9FAFB', 9), aL()), cs(fill('374151'), fB('F9FAFB', 9), aL()), ...padS(NCOLS - 2, cs(fill('374151'), fN('F9FAFB'), aL()))]
  )
  const detailFields = [['Name', item.name || '']]
  if (item.startDate && item.endDate) {
    detailFields.push(['Start Date', fmtDate(item.startDate)], ['End Date', fmtDate(item.endDate)])
  } else {
    detailFields.push(['Date', fmtDate(bestDate(item))])
  }
  detailFields.push(['Status', item.status || '—'], ['Venue', item.venue || item.details?.venue || '—'], ['Description', item.description || ''])
  detailFields.forEach(([f, v], i) => {
    const bg = i % 2 ? 'F5F3FB' : 'FFFFFF'
    push(
      [f, v, ...pad(NCOLS - 2)],
      [cs(fill(bg), fB('374151', 9), aL()), cs(fill(bg), fN('6B7280', 9), aL(true)), ...padS(NCOLS - 2, cs(fill(bg), fN('9CA3AF'), aL()))]
    )
  })
  emptyRow()

  // Participant summary
  const coords = members.filter(m => m.role === 'coordinator').length
  const cores  = members.filter(m => m.role === 'core').length
  const photos = members.filter(m => m.role === 'photographer').length
  const vols   = members.filter(m => !['coordinator','core','photographer'].includes(m.role)).length
  push(
    ['PARTICIPANT SUMMARY', ...pad(NCOLS - 1)],
    [cs(fill('374151'), fB('F9FAFB', 10), aL()), ...padS(NCOLS - 1, cs(fill('374151'), fN('F9FAFB'), aL()))]
  )
  push(
    ['Role', 'Count', ...pad(NCOLS - 2)],
    [cs(fill('4B5563'), fB('F9FAFB', 9), aL()), cs(fill('4B5563'), fB('F9FAFB', 9), aC()), ...padS(NCOLS - 2, cs(fill('4B5563'), fN('F9FAFB'), aL()))]
  )
  ;[
    { label: 'Total Participants',  count: members.length, bg: TC.light, hex: TC.mid },
    ...(coords ? [{ label: 'Coordinators',       count: coords, bg: 'DBEAFE', hex: '2563EB' }] : []),
    ...(cores  ? [{ label: 'Core Members',        count: cores,  bg: 'FEF3C7', hex: 'D97706' }] : []),
    ...(photos ? [{ label: 'Photographers',       count: photos, bg: 'D1FAE5', hex: '059669' }] : []),
    ...(vols   ? [{ label: 'Volunteers / Others', count: vols,   bg: 'F3F4F6', hex: '6B7280' }] : []),
  ].forEach(({ label, count, bg, hex }) => push(
    [label, count, ...pad(NCOLS - 2)],
    [cs(fill(bg), fB(hex, 10), aL()), cs(fill(bg), fB(hex, 13), aC()), ...padS(NCOLS - 2, cs(fill(bg), fN(hex), aL()))]
  ))
  emptyRow()

  // Participant list
  push(
    ['PARTICIPANT LIST', `${members.length} members`, ...pad(NCOLS - 2)],
    [cs(fill(TC.bg), fB('FFFFFF', 10), aL()), cs(fill(TC.bg), fN('FFFFFF', 9), aL()), ...padS(NCOLS - 2, cs(fill(TC.bg), fN('FFFFFF'), aL()))]
  )
  push(
    ['#', 'Name', 'Email', 'Department', 'Academic Year', 'Enrollment No.', 'Roll No.', 'Role', 'Instagram'],
    Array(NCOLS).fill(cs(fill('374151'), fB('F9FAFB', 9), aC(true)))
  )
  for (const [i, m] of members.entries()) {
    const u    = m.user
    const yr   = u?.startYear ? (computeAcademicYear(u.startYear, u.endYear).label || '') : ''
    const dept = u?.department === 'OTHER' ? (u.departmentOther || 'Other') : (u?.department || '')
    const rbg  = ROLE_BG[m.role]  || (i % 2 ? 'F5F3FB' : 'FFFFFF')
    const rhex = ROLE_HEX[m.role] || '374151'
    const bg   = i % 2 ? 'F5F3FB' : 'FFFFFF'
    push(
      [i + 1, u?.name || '', u?.email || '', dept, yr, u?.enrollmentNumber || '', u?.rollNumber || '', rlbl(m.role), u?.instagramHandle ? `@${u.instagramHandle}` : ''],
      [
        cs(fill(bg),  fN('9CA3AF', 9),  aC()),
        cs(fill(rbg), fB(rhex,    10),  aL()),
        cs(fill(bg),  fN('6B7280',  8), aL()),
        cs(fill(bg),  fN('374151',  9), aC()),
        cs(fill(bg),  fN('374151',  9), aC()),
        cs(fill(bg),  { bold: false, sz: 9, name: 'Courier New', color: { rgb: '6B7280' } }, aC()),
        cs(fill(bg),  { bold: false, sz: 9, name: 'Courier New', color: { rgb: '6B7280' } }, aC()),
        cs(fill(rbg), fB(rhex,      9), aC()),
        cs(fill(bg),  fN('6B7280',  9), aL()),
      ]
    )
  }

  // Assemble workbook
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  aoa.forEach((row, ri) => row.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
    if (ws[ref] && sty[ri]?.[ci]) ws[ref].s = sty[ri][ci]
  }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }]
  ws['!cols']   = [{ wch: 4 }, { wch: 24 }, { wch: 30 }, { wch: 12 }, { wch: 11 }, { wch: 17 }, { wch: 10 }, { wch: 14 }, { wch: 18 }]
  ws['!rows']   = [{ hpt: 22 }, { hpt: 13 }, { hpt: 6 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${typeName} Report`)
  dlXLSX(wb, `${safe}_${typeName}_Report.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE ITEM PDF  — professional compact tabular register
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadSingleItemPDF({ item, itemType, members, onProgress }) {
  const [jsPDF, XLSX] = await Promise.all([loadJsPDF(), loadXLSX()])
  onProgress?.('Loading images…')

  const typeName = { event:'Event', competition:'Competition', activity:'Activity' }[itemType] || itemType
  const itemLogoUrl = item.logoUrl || item.bannerUrl || null

  const [clubLogoB64, itemLogoB64Raw] = await Promise.all([
    loadImg(`${window.location.origin}/IEM_20260416_215615_0000.png`),
    loadImg(itemLogoUrl),
  ])
  const itemLogoB64 = itemLogoB64Raw ? await cropAndRound(itemLogoB64Raw, 38, 38, 0.06) : null

  const photoMap = {}
  const BATCH = 5
  for (let i = 0; i < members.length; i += BATCH) {
    await Promise.all(members.slice(i, i + BATCH).map(async m => {
      const u = m.user
      if (u?.profilePhoto) {
        const b64 = await loadImg(u.profilePhoto)
        if (b64) photoMap[String(u._id)] = await cropAndRound(b64, 10, 10, 0.18)
      }
    }))
    onProgress?.(`Loading photos… ${Math.min(i + BATCH, members.length)} / ${members.length}`)
  }

  onProgress?.('Building PDF…')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, ML = 16, CW = 178
  const FOOTER_Y = H - 15
  const PAGE_TOP  = 18

  const F   = (...rgb) => doc.setFillColor(...rgb)
  const D   = (...rgb) => doc.setDrawColor(...rgb)
  const TC  = (...rgb) => doc.setTextColor(...rgb)
  const FT  = style    => doc.setFont('helvetica', style || 'normal')
  const FS  = size     => doc.setFontSize(size)
  const LW  = w        => doc.setLineWidth(w)
  const im  = (b64, x, y, w, h) => doc.addImage(b64, imgFmt(b64), x, y, w, h, '', 'FAST')

  // ── Footer helper ──────────────────────────────────────────────────────────
  const drawFooter = (p, total) => {
    doc.setPage(p)
    F(...INK); doc.rect(0, H - 14, W, 14, 'F')
    F(...C.red); doc.rect(0, H - 14, W, 0.8, 'F')
    FT('normal'); FS(6); TC(145, 130, 130)
    const footerText = `IEM Photography Club  ·  ${typeName} Report  ·  ${doc.splitTextToSize(item.name || '', 80)[0]}`
    doc.text(footerText, ML, H - 8)
    TC(100, 88, 88)
    doc.text('Auto-generated report. For official use, contact club administration.', ML, H - 4)
    FT('bold'); FS(6.5); TC(165, 150, 150)
    doc.text(`${p} / ${total}`, W - ML, H - 6, { align: 'right' })
  }

  // ── Page logo helper ───────────────────────────────────────────────────────
  const drawPageLogo = () => {
    if (!clubLogoB64) return
    const LLX = W - ML - 18, LLY = 5, LLS = 16
    im(clubLogoB64, LLX, LLY, LLS, LLS)
    D(...C.red); LW(0.4); doc.circle(LLX + LLS / 2, LLY + LLS / 2, LLS / 2, 'S')
  }

  let y = 0

  // ═════════════════════════════════════════════════════════════════════════
  // HEADER  (0 → 44mm, dark INK)
  // ═════════════════════════════════════════════════════════════════════════
  F(...INK); doc.rect(0, 0, W, 58, 'F')
  // Depth ellipses
  F(22, 10, 44); doc.ellipse(ML + 20, 29, 32, 24, 'F')
  F(8,   4, 28); doc.ellipse(W - 28, 18, 26, 20, 'F')
  // Red top bar
  F(...C.red); doc.rect(0, 0, W, 3, 'F')

  // Item logo: 38×38mm at (ML+2, 9)
  const ILX = ML + 2, ILY = 9, ILS = 38
  if (itemLogoB64) {
    im(itemLogoB64, ILX, ILY, ILS, ILS)
    D(...C.red); LW(0.6); doc.roundedRect(ILX, ILY, ILS, ILS, 2, 2, 'D')
  } else {
    F(...C.redDim); doc.roundedRect(ILX, ILY, ILS, ILS, 2.5, 2.5, 'F')
    FT('bold'); FS(16); TC(255, 255, 255)
    doc.text((item.name?.[0] || '?').toUpperCase(), ILX + ILS / 2, ILY + ILS / 2 + 6, { align: 'center' })
  }

  // Text column — safe width stays clear of the drawPageLogo area at top-right
  const TX = ML + 46
  const textW = W - ML - 22 - TX
  FT('normal'); FS(8); TC(210, 145, 145)
  doc.text(`${typeName.toUpperCase()} REPORT  ·  Session ${currentSession()}`, TX, ILY + 7)

  FT('bold'); FS(20); TC(255, 255, 255)
  doc.text(doc.splitTextToSize(item.name || '', textW)[0], TX, ILY + 17)

  FT('normal'); FS(9); TC(175, 158, 175)
  const dateStr = item.startDate && item.endDate
    ? `${fmtDate(item.startDate)}  –  ${fmtDate(item.endDate)}`
    : fmtDate(bestDate(item))
  doc.text(dateStr, TX, ILY + 27)

  // Status pill (7pt, 6.5mm tall)
  const sc = STATUS_CLR[item.status] || STATUS_CLR.past
  FT('bold'); FS(7)
  const slbl = (item.status || 'unknown').toUpperCase()
  const sw = doc.getTextWidth(slbl) + 10
  F(...sc); doc.roundedRect(TX, ILY + 31, sw, 6.5, 2, 2, 'F')
  TC(255, 255, 255); doc.text(slbl, TX + 5, ILY + 35)

  const venueStr = item.venue || item.details?.venue || ''
  if (venueStr) {
    const venueX = TX + sw + 6
    const venueW = (W - ML - 22) - venueX
    if (venueW > 10) {
      FT('normal'); FS(8); TC(155, 140, 155)
      doc.text(doc.splitTextToSize(venueStr, venueW)[0], venueX, ILY + 36)
    }
  }

  if (item.description) {
    FT('normal'); FS(7); TC(115, 105, 120)
    doc.text(doc.splitTextToSize(item.description, textW)[0], TX, ILY + 46)
  }

  // Red bottom accent line
  F(...C.red); doc.rect(0, 58, W, 2.5, 'F')

  y = 65

  // ═════════════════════════════════════════════════════════════════════════
  // STATS BAR  (y=50, 14mm tall, white bg)
  // Single horizontal bar divided into 4 sections
  // ═════════════════════════════════════════════════════════════════════════
  const coords  = members.filter(m => m.role === 'coordinator').length
  const cores   = members.filter(m => m.role === 'core').length
  const photos  = members.filter(m => m.role === 'photographer').length
  const vols    = members.filter(m => !['coordinator', 'core', 'photographer'].includes(m.role)).length
  const totMem  = members.length

  F(255, 255, 255); doc.rect(ML, y, CW, 18, 'F')
  D(...HDIVIDER); LW(0.15); doc.rect(ML, y, CW, 18, 'D')

  const lastStat = itemType === 'event'
    ? { label: 'Photographers', val: photos, clr: [5, 150, 105] }
    : { label: 'Volunteers',    val: vols,   clr: [5, 150, 105] }
  const statSects = [
    { label: 'Total',        val: totMem, clr: [220,  38,  38] },
    { label: 'Coordinators', val: coords, clr: [ 37,  99, 235] },
    { label: 'Core Members', val: cores,  clr: [217, 119,   6] },
    lastStat,
  ]
  const secW = CW / 4

  statSects.forEach((s, i) => {
    const sx = ML + i * secW
    const [r, g, b] = s.clr
    // Colored circle accent — vertically centered in 18mm box
    F(r, g, b); doc.circle(sx + 7, y + 6, 2.5, 'F')
    // Number
    FT('bold'); FS(14); TC(r, g, b)
    doc.text(String(s.val), sx + 13, y + 8)
    // Label
    FT('normal'); FS(7); TC(...C.gray)
    doc.text(s.label, sx + 13, y + 13.5)
    // Vertical divider (not after last)
    if (i < 3) {
      D(220, 220, 228); LW(0.2); doc.line(sx + secW, y + 2, sx + secW, y + 16)
    }
  })

  y += 20

  // ═════════════════════════════════════════════════════════════════════════
  // MEMBER TABLE
  // ═════════════════════════════════════════════════════════════════════════
  const ROW_H   = 13
  // Column positions (from ML)
  const COL_NUM    = ML           // 8mm → ML+8
  const COL_PHOTO  = ML + 8       // 12mm → ML+20
  const COL_NAME   = ML + 20      // 62mm → ML+82
  const COL_DEPT   = ML + 82      // 28mm → ML+110
  const COL_YEAR   = ML + 110     // 18mm → ML+128
  const COL_ENROLL = ML + 128     // 30mm → ML+158
  const COL_ROLE   = ML + 158     // rest → ML+CW

  // Draw table header
  const drawTableHeader = (headerY) => {
    F(...INK2); doc.rect(ML, headerY, CW, 10, 'F')
    FT('bold'); FS(7); TC(200, 190, 210)
    doc.text('#',             COL_NUM + 6,    headerY + 7, { align: 'right' })
    doc.text('PHOTO',         COL_PHOTO + 2,  headerY + 7)
    doc.text('NAME / EMAIL',  COL_NAME,       headerY + 7)
    doc.text('DEPARTMENT',    COL_DEPT,       headerY + 7)
    doc.text('YEAR',          COL_YEAR,       headerY + 7)
    doc.text('ENROLLMENT NO.',COL_ENROLL,     headerY + 7)
    doc.text('ROLE',          COL_ROLE,       headerY + 7)
    return headerY + 11
  }

  y = drawTableHeader(y)

  for (let idx = 0; idx < members.length; idx++) {
    if (y + ROW_H > FOOTER_Y) {
      doc.addPage()
      y = PAGE_TOP
      y = drawTableHeader(y)
    }

    const m = members[idx]
    const u = m.user
    const rclr = ROLE_CLR[m.role] || ROLE_CLR.photographer

    // Alternating row bg
    if (idx % 2 === 0) {
      F(255, 255, 255); doc.rect(ML, y, CW, ROW_H, 'F')
    } else {
      F(...PAPER); doc.rect(ML, y, CW, ROW_H, 'F')
    }

    // Left accent bar 2mm by role color
    F(...rclr); doc.rect(ML, y, 2, ROW_H, 'F')

    // Row number
    FT('normal'); FS(6); TC(140, 140, 155)
    doc.text(String(idx + 1), COL_NUM + 6, y + 6.5, { align: 'right' })

    // Profile photo 10×10mm square with rounded corners
    const PS = 10, PX = COL_PHOTO + 1, PY = y + (ROW_H - PS) / 2
    const pb64 = photoMap[String(u?._id)]
    if (pb64) {
      im(pb64, PX, PY, PS, PS)
    } else {
      F(...rclr); doc.roundedRect(PX, PY, PS, PS, 2, 2, 'F')
      FT('bold'); FS(5); TC(255, 255, 255)
      doc.text((u?.name?.[0] || '?').toUpperCase(), PX + PS / 2, PY + PS / 2 + 1.8, { align: 'center' })
    }
    D(...rclr); LW(0.3); doc.roundedRect(PX, PY, PS, PS, 2, 2, 'S')

    // Name + email
    FT('bold'); FS(8); TC(25, 25, 45)
    doc.text(doc.splitTextToSize(u?.name || '—', COL_DEPT - COL_NAME - 3)[0], COL_NAME, y + 5.5)
    FT('normal'); FS(6.5); TC(120, 120, 140)
    doc.text(doc.splitTextToSize(u?.email || '', COL_DEPT - COL_NAME - 3)[0], COL_NAME, y + 10)

    // Dept
    const dept = u?.department === 'OTHER' ? (u.departmentOther || 'Other') : (u?.department || '—')
    FT('normal'); FS(7); TC(90, 90, 110)
    doc.text(doc.splitTextToSize(dept, COL_YEAR - COL_DEPT - 2)[0], COL_DEPT, y + 7.5)

    // Year
    const yrObj = u?.startYear ? computeAcademicYear(u.startYear, u.endYear) : null
    FT('normal'); FS(7); TC(90, 90, 110)
    doc.text(yrObj?.label || '—', COL_YEAR, y + 7.5)

    // Enrollment
    FT('normal'); FS(7); TC(90, 90, 110)
    doc.text(u?.enrollmentNumber || '—', COL_ENROLL, y + 7.5)

    // Role badge: right-aligned pill, 5.5mm tall
    const rLabel = rlbl(m.role)
    FT('bold'); FS(6)
    const rbw = doc.getTextWidth(rLabel) + 6
    const rbX = ML + CW - rbw - 2
    F(...rclr); doc.roundedRect(rbX, y + (ROW_H - 5.5) / 2, rbw, 5.5, 1.5, 1.5, 'F')
    TC(255, 255, 255); doc.text(rLabel, rbX + rbw / 2, y + ROW_H / 2 + 0.75, { align: 'center' })

    // Row separator
    D(...HDIVIDER); LW(0.1); doc.line(ML, y + ROW_H, ML + CW, y + ROW_H)
    y += ROW_H
  }

  // ── FOOTER + page logo on every page ──────────────────────────────────────
  const total2 = doc.getNumberOfPages()
  for (let p = 1; p <= total2; p++) {
    doc.setPage(p)
    drawPageLogo()
    drawFooter(p, total2)
  }

  const safe = (item.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')
  doc.save(`${safe}_${typeName}_Report.pdf`)
  onProgress?.(null)
}

// ══════════════════════════════════════════════════════════════════════════════
// ALL ITEMS CSV  — one row per participation
// items = [{ item: eventObj|compObj|actObj, members: [{user, role}] }]
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadAllItemsCSV({ items, itemType }) {
  const XLSX = await loadXLSX()
  items = items.filter(({ item }) => isCurrentSession(item))
  const typeName = { event:'Event', competition:'Competition', activity:'Activity' }[itemType] || itemType
  const today    = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const dateStr  = new Date().toISOString().slice(0, 10)
  const totalParticipations = items.reduce((s, it) => s + it.members.length, 0)

  const fill = rgb => ({ patternType: 'solid', fgColor: { rgb }, bgColor: { rgb: 'FFFFFF' } })
  const fB   = (rgb, sz = 10) => ({ bold: true,  sz, name: 'Calibri', color: { rgb } })
  const fN   = (rgb, sz = 10) => ({ bold: false, sz, name: 'Calibri', color: { rgb } })
  const aC   = (w = false) => ({ horizontal: 'center', vertical: 'center', wrapText: w })
  const aL   = (w = false) => ({ horizontal: 'left',   vertical: 'center', wrapText: w })
  const cs   = (f, fo, a) => ({ fill: f, font: fo, alignment: a })

  const TC = {
    event:       { bg: '2563EB', light: 'EFF6FF', mid: '1E40AF', dark: '1E3A8A' },
    competition: { bg: 'D97706', light: 'FFFBEB', mid: '92400E', dark: '78350F' },
    activity:    { bg: '059669', light: 'ECFDF5', mid: '064E3B', dark: '064E3B' },
  }[itemType] || { bg: '374151', light: 'F9FAFB', mid: '374151', dark: '1F2937' }

  const ROLE_BG  = { core: 'FEF3C7', coordinator: 'DBEAFE', photographer: 'D1FAE5' }
  const ROLE_HEX = { core: 'D97706', coordinator: '2563EB', photographer: '059669' }
  const STAT_BG  = { ongoing: 'D1FAE5', active: 'D1FAE5', upcoming: 'FEF3C7', past: 'F3F4F6', draft: 'F3F4F6' }
  const STAT_HEX = { ongoing: '064E3B', active: '064E3B', upcoming: '92400E', past: '6B7280', draft: '9CA3AF' }

  const NCOLS = 12
  const aoa = [], sty = []
  const push = (vals, styles) => { aoa.push(vals); sty.push(styles) }
  const pad  = n => Array(n).fill('')
  const padS = (n, s) => Array(n).fill(s)
  const emptyRow = () => push(pad(NCOLS), padS(NCOLS, {}))

  // Title bar
  push(
    [`IEM Photography Club  ·  ${typeName}s Activity Report`, ...pad(NCOLS - 1)],
    [cs(fill(TC.dark), fB('FFFFFF', 13), aL()), ...padS(NCOLS - 1, cs(fill(TC.dark), fN('FFFFFF'), aL()))]
  )
  push(
    ['Generated', today, 'Session', currentSession(), `Total ${typeName}s`, items.length, 'Total Participations', totalParticipations, ...pad(NCOLS - 8)],
    [
      cs(fill('1E0D38'), fB('AA99CC', 9), aL()), cs(fill('1E0D38'), fN('CCBBEE', 9), aL()),
      cs(fill('1E0D38'), fB('AA99CC', 9), aL()), cs(fill('1E0D38'), fN('DDCCFF', 9), aL()),
      cs(fill('1E0D38'), fB('BBDDFF', 9), aL()), cs(fill('1E0D38'), fB('FFFFFF', 13), aC()),
      cs(fill('1E0D38'), fB('BBFFDD', 9), aL()), cs(fill('1E0D38'), fB('FFFFFF', 13), aC()),
      ...padS(NCOLS - 8, cs(fill('1E0D38'), fN('CCBBEE'), aL())),
    ]
  )
  emptyRow()

  // Summary table
  push(
    [`${typeName.toUpperCase()} SUMMARY`, ...pad(NCOLS - 1)],
    [cs(fill(TC.bg), fB('FFFFFF', 10), aL()), ...padS(NCOLS - 1, cs(fill(TC.bg), fN('FFFFFF'), aL()))]
  )
  push(
    ['#', `${typeName} Name`, 'Date', 'Status', 'Venue', 'Total', 'Coords', 'Core',
     itemType === 'event' ? 'Photographers' : 'Photo',
     itemType === 'event' ? 'Others' : 'Volunteers', '', ''],
    [...Array(10).fill(cs(fill('374151'), fB('F9FAFB', 9), aC(true))), ...padS(2, cs(fill('374151'), fN('F9FAFB'), aL()))]
  )
  items.forEach(({ item, members }, i) => {
    const coords  = members.filter(m => m.role === 'coordinator').length
    const cores   = members.filter(m => m.role === 'core').length
    const photos  = members.filter(m => m.role === 'photographer').length
    const vols    = members.length - coords - cores - photos
    const status  = item.status || ''
    const bg      = i % 2 ? 'F5F3FB' : 'FFFFFF'
    const sbg     = STAT_BG[status]  || bg
    const sfg     = STAT_HEX[status] || '374151'
    push(
      [i + 1, item.name || '', fmtDate(bestDate(item)), status, item.venue || item.details?.venue || '', members.length, coords || '', cores || '', photos || '', vols || '', '', ''],
      [
        cs(fill(bg),       fN('9CA3AF', 9),  aC()),
        cs(fill(TC.light), fB(TC.mid,   10), aL()),
        cs(fill(bg),       fN('6B7280',  9), aC()),
        cs(fill(sbg),      fB(sfg,       9), aC()),
        cs(fill(bg),       fN('6B7280',  9), aL()),
        cs(fill(bg),       fB(TC.mid,   12), aC()),
        cs(fill('DBEAFE'), coords  ? fB('2563EB', 9) : fN('D1D5DB', 9), aC()),
        cs(fill('FEF3C7'), cores   ? fB('D97706', 9) : fN('D1D5DB', 9), aC()),
        cs(fill('D1FAE5'), photos  ? fB('059669', 9) : fN('D1D5DB', 9), aC()),
        cs(fill('F3F4F6'), vols > 0 ? fB('6B7280', 9) : fN('D1D5DB', 9), aC()),
        cs(fill(bg), fN('9CA3AF'), aL()), cs(fill(bg), fN('9CA3AF'), aL()),
      ]
    )
  })
  emptyRow()

  // Detailed participation list
  push(
    ['DETAILED PARTICIPATION LIST', ...pad(NCOLS - 1)],
    [cs(fill(TC.bg), fB('FFFFFF', 10), aL()), ...padS(NCOLS - 1, cs(fill(TC.bg), fN('FFFFFF'), aL()))]
  )
  push(
    ['#', `${typeName} Name`, 'Date', 'Status', 'Venue', 'Member Name', 'Email', 'Department', 'Academic Year', 'Enrollment No.', 'Roll No.', 'Role'],
    Array(NCOLS).fill(cs(fill('374151'), fB('F9FAFB', 9), aC(true)))
  )
  let rowNum = 1
  for (const { item, members } of items) {
    const dateFmt = fmtDate(bestDate(item))
    const status  = item.status || ''
    const venue   = item.venue || item.details?.venue || ''
    const sbg     = STAT_BG[status]  || 'FFFFFF'
    const sfg     = STAT_HEX[status] || '374151'
    for (const m of members) {
      const u    = m.user
      const yr   = u?.startYear ? (computeAcademicYear(u.startYear, u.endYear).label || '') : ''
      const dept = u?.department === 'OTHER' ? (u.departmentOther || 'Other') : (u?.department || '')
      const rbg  = ROLE_BG[m.role]  || (rowNum % 2 ? 'F5F3FB' : 'FFFFFF')
      const rhex = ROLE_HEX[m.role] || '374151'
      const bg   = rowNum % 2 ? 'F5F3FB' : 'FFFFFF'
      push(
        [rowNum++, item.name || '', dateFmt, status, venue, u?.name || '', u?.email || '', dept, yr, u?.enrollmentNumber || '', u?.rollNumber || '', rlbl(m.role)],
        [
          cs(fill(bg),       fN('9CA3AF', 9),  aC()),
          cs(fill(TC.light), fB(TC.mid,   10), aL()),
          cs(fill(bg),       fN('6B7280',  9), aC()),
          cs(fill(sbg),      fB(sfg,       9), aC()),
          cs(fill(bg),       fN('6B7280',  9), aL()),
          cs(fill(rbg),      fB(rhex,     10), aL()),
          cs(fill(bg),       fN('6B7280',  8), aL()),
          cs(fill(bg),       fN('374151',  9), aC()),
          cs(fill(bg),       fN('374151',  9), aC()),
          cs(fill(bg),       { bold: false, sz: 9, name: 'Courier New', color: { rgb: '6B7280' } }, aC()),
          cs(fill(bg),       { bold: false, sz: 9, name: 'Courier New', color: { rgb: '6B7280' } }, aC()),
          cs(fill(rbg),      fB(rhex,      9), aC()),
        ]
      )
    }
  }

  // Assemble workbook
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  aoa.forEach((row, ri) => row.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
    if (ws[ref] && sty[ri]?.[ci]) ws[ref].s = sty[ri][ci]
  }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } }]
  ws['!cols']   = [{ wch: 4 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 11 }, { wch: 16 }, { wch: 10 }, { wch: 14 }]
  ws['!rows']   = [{ hpt: 22 }, { hpt: 16 }, { hpt: 6 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${typeName}s Report`)
  dlXLSX(wb, `IEM_PhotoClub_${typeName}s_Report_${dateStr}.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════════════
// ALL ITEMS PDF  — cover page + per-item sections with compact member rows
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadAllItemsPDF({ items, itemType, onProgress }) {
  const [jsPDF, XLSX] = await Promise.all([loadJsPDF(), loadXLSX()])
  items = items.filter(({ item }) => isCurrentSession(item))
  const typeName = { event:'Event', competition:'Competition', activity:'Activity' }[itemType] || itemType

  onProgress?.('Loading club logo…')
  const clubLogoB64 = await loadImg(`${window.location.origin}/IEM_20260416_215615_0000.png`)

  // Load item logos
  const itemLogoMap = {}
  await Promise.all(items.map(async ({ item }) => {
    const url = item.logoUrl || item.bannerUrl
    if (url) {
      const b64 = await loadImg(url)
      if (b64) itemLogoMap[item._id] = await cropAndRound(b64, 14, 14, 0.1)
    }
  }))

  // Load member photos in batches
  const photoMap = {}
  const allMembers = items.flatMap(it => it.members)
  const BATCH = 6
  for (let i = 0; i < allMembers.length; i += BATCH) {
    await Promise.all(allMembers.slice(i, i + BATCH).map(async m => {
      const u = m.user
      if (u?._id && u?.profilePhoto) {
        const b64 = await loadImg(u.profilePhoto)
        if (b64) photoMap[String(u._id)] = await cropAndRound(b64, 9, 9, 0.15, 180)
      }
    }))
    onProgress?.(`Loading photos… ${Math.min(i + BATCH, allMembers.length)} / ${allMembers.length}`)
  }

  onProgress?.('Building PDF…')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, ML = 16, CW = 178
  const FOOTER_Y = H - 15
  const PAGE_TOP  = 18

  const F   = (...rgb) => doc.setFillColor(...rgb)
  const D   = (...rgb) => doc.setDrawColor(...rgb)
  const TC  = (...rgb) => doc.setTextColor(...rgb)
  const FT  = style    => doc.setFont('helvetica', style || 'normal')
  const FS  = size     => doc.setFontSize(size)
  const LW  = w        => doc.setLineWidth(w)
  const im  = (b64, x, y, w, h) => doc.addImage(b64, imgFmt(b64), x, y, w, h, '', 'FAST')

  // ── Footer helper ──────────────────────────────────────────────────────────
  const drawFooter = (p, total) => {
    doc.setPage(p)
    F(...INK); doc.rect(0, H - 14, W, 14, 'F')
    F(...C.red); doc.rect(0, H - 14, W, 0.8, 'F')
    FT('normal'); FS(6); TC(145, 130, 130)
    doc.text(`IEM Photography Club  ·  ${typeName}s Activity Report`, ML, H - 8)
    TC(100, 88, 88)
    doc.text('Auto-generated report. For official use, contact club administration.', ML, H - 4)
    FT('bold'); FS(6.5); TC(165, 150, 150)
    doc.text(`${p} / ${total}`, W - ML, H - 6, { align: 'right' })
  }

  // ── Page logo helper ───────────────────────────────────────────────────────
  const drawPageLogo = () => {
    if (!clubLogoB64) return
    const LLX = W - ML - 16, LLY = 4, LLS = 14
    im(clubLogoB64, LLX, LLY, LLS, LLS)
    D(...C.red); LW(0.35); doc.rect(LLX, LLY, LLS, LLS, 'S')
  }

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  F(...INK); doc.rect(0, 0, W, H, 'F')
  F(24, 12, 48); doc.ellipse(W / 2 - 45, 88, 58, 46, 'F')
  F(8,   4, 28); doc.ellipse(W / 2 + 58, 52, 42, 32, 'F')
  F(...C.red); doc.rect(0, 0, W, 2.5, 'F')

  const CX = W / 2
  if (clubLogoB64) {
    im(clubLogoB64, CX - 24, 36, 48, 48)
    D(...C.red); LW(0.9); doc.circle(CX, 60, 25, 'S')
  } else {
    F(...C.red); doc.circle(CX, 60, 24, 'F')
    FT('bold'); FS(14); TC(255, 255, 255); doc.text('IPC', CX, 65, { align: 'center' })
  }

  FT('bold'); FS(8.5); TC(180, 140, 140)
  doc.text('IEM PHOTOGRAPHY CLUB', CX, 96, { align: 'center' })
  FT('bold'); FS(22); TC(255, 255, 255)
  doc.text(`${typeName}s Activity Report`, CX, 112, { align: 'center' })
  F(...C.red); doc.rect(CX - 38, 116, 76, 1.5, 'F')
  FT('normal'); FS(7.5); TC(145, 125, 125)
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    CX, 125, { align: 'center' }
  )
  FT('bold'); FS(7); TC(200, 145, 145)
  doc.text(`Session: ${currentSession()}`, CX, 133, { align: 'center' })

  // Cover stats — 2 boxes full-width in a row
  const totalParticipations = items.reduce((s, it) => s + it.members.length, 0)
  const coverStats = [
    { label: `Total ${typeName}s`,   val: items.length,        clr: [220,  38,  38] },
    { label: 'Total Participations', val: totalParticipations, clr: [ 37,  99, 235] },
  ]
  const CSW = (CW - 6) / 2
  coverStats.forEach((s, i) => {
    const sx = ML + i * (CSW + 6), sy = 140
    const [r, g, b] = s.clr
    F(r, g, b); doc.roundedRect(sx, sy, CSW, 38, 3, 3, 'F')
    F(Math.round(r * 0.55), Math.round(g * 0.55), Math.round(b * 0.55))
    doc.rect(sx, sy, CSW, 2, 'F')
    FT('bold'); FS(26); TC(255, 255, 255)
    doc.text(String(s.val), sx + CSW / 2, sy + 24, { align: 'center' })
    FT('normal'); FS(6.5); TC(255, 240, 240)
    doc.text(s.label, sx + CSW / 2, sy + 32, { align: 'center' })
  })

  // ── PER-ITEM PAGES ─────────────────────────────────────────────────────────
  doc.addPage()
  let y = PAGE_TOP
  let needsTableHeader = true

  const ITEM_H  = 26
  const ROW_SM  = 11
  const PHOTO_W = 9

  // Table header columns for all-items view
  const TH_PHOTO  = ML + 2
  const TH_NAME   = ML + 16
  const TH_DEPT   = ML + 69
  const TH_YEAR   = ML + 97
  const TH_ENROLL = ML + 118
  const TH_ROLE   = ML + 149

  const drawAllTableHeader = (hy) => {
    F(...INK2); doc.rect(ML, hy, CW, 9, 'F')
    FT('bold'); FS(7); TC(200, 190, 210)
    doc.text('PHOTO',        TH_PHOTO + 1, hy + 6.5)
    doc.text('NAME',         TH_NAME,      hy + 6.5)
    doc.text('DEPT',         TH_DEPT,      hy + 6.5)
    doc.text('YEAR',         TH_YEAR,      hy + 6.5)
    doc.text('ENROLLMENT',   TH_ENROLL,    hy + 6.5)
    doc.text('ROLE',         TH_ROLE,      hy + 6.5)
    return hy + 10
  }

  const ensureSpace = needed => {
    if (y + needed > FOOTER_Y) {
      doc.addPage()
      y = PAGE_TOP
      needsTableHeader = true
    }
  }

  for (const { item, members: mems } of items) {
    // Ensure item header fits
    ensureSpace(ITEM_H + 8)

    // If we just jumped to a new page and need table header, draw it first
    if (needsTableHeader) {
      y = drawAllTableHeader(y)
      needsTableHeader = false
    }

    // Item header block (26mm tall)
    F(22, 12, 35); doc.rect(ML, y, CW, ITEM_H, 'F')
    F(...C.red); doc.rect(ML, y, 2.5, ITEM_H, 'F')

    // Item logo 18×18 — center-cropped square
    const ilogoX = ML + 4, ilogoY = y + 4, ilogoS = 18
    const iB64 = itemLogoMap[item._id]
    if (iB64) {
      im(iB64, ilogoX, ilogoY, ilogoS, ilogoS)
      D(...C.red); LW(0.3); doc.roundedRect(ilogoX, ilogoY, ilogoS, ilogoS, 1.5, 1.5, 'D')
    } else {
      F(...C.redDim); doc.roundedRect(ilogoX, ilogoY, ilogoS, ilogoS, 2, 2, 'F')
      FT('bold'); FS(9); TC(255, 255, 255)
      doc.text((item.name?.[0] || '?').toUpperCase(), ilogoX + ilogoS / 2, ilogoY + ilogoS / 2 + 3, { align: 'center' })
    }

    // Item name + date + status
    const iTX = ML + 27
    FT('bold'); FS(12); TC(255, 255, 255)
    doc.text(doc.splitTextToSize(item.name || '', CW - 62)[0], iTX, y + 11)
    FT('normal'); FS(8); TC(170, 155, 170)
    doc.text(fmtDate(bestDate(item)), iTX, y + 18)

    // Status pill
    const isc = STATUS_CLR[item.status] || STATUS_CLR.past
    FT('bold'); FS(6.5)
    const islbl = (item.status || 'unknown').toUpperCase()
    const isw = doc.getTextWidth(islbl) + 8
    F(...isc); doc.roundedRect(iTX + 44, y + 14, isw, 6, 1.5, 1.5, 'F')
    TC(255, 255, 255); doc.text(islbl, iTX + 48, y + 17.8)

    // Member count right-aligned
    FT('bold'); FS(13); TC(255, 255, 255)
    doc.text(String(mems.length), ML + CW - 5, y + 12, { align: 'right' })
    FT('normal'); FS(7); TC(160, 145, 160)
    doc.text('members', ML + CW - 5, y + 19, { align: 'right' })

    y += ITEM_H + 2

    // Member compact rows (7mm each)
    for (let idx = 0; idx < mems.length; idx++) {
      if (y + ROW_SM > FOOTER_Y) {
        doc.addPage()
        y = PAGE_TOP
        y = drawAllTableHeader(y)
        needsTableHeader = false
      }

      const m = mems[idx]
      const u = m.user
      const rclr = ROLE_CLR[m.role] || ROLE_CLR.photographer

      // Alternating row bg
      if (idx % 2 === 0) {
        F(...PAPER); doc.rect(ML + 2, y, CW - 2, ROW_SM, 'F')
      } else {
        F(255, 255, 255); doc.rect(ML + 2, y, CW - 2, ROW_SM, 'F')
      }

      // Left accent 1.5mm by role
      F(...rclr); doc.rect(ML + 2, y, 1.5, ROW_SM, 'F')

      // Profile photo — 9×9mm square with rounded corners, center-cropped
      const PX = TH_PHOTO + 2, PY = y + (ROW_SM - PHOTO_W) / 2
      const pb64 = photoMap[String(u?._id)]
      if (pb64) {
        im(pb64, PX, PY, PHOTO_W, PHOTO_W)
      } else {
        F(...rclr); doc.roundedRect(PX, PY, PHOTO_W, PHOTO_W, 1.5, 1.5, 'F')
        FT('bold'); FS(5); TC(255, 255, 255)
        doc.text((u?.name?.[0] || '?').toUpperCase(), PX + PHOTO_W / 2, PY + PHOTO_W / 2 + 1.8, { align: 'center' })
      }
      D(...rclr); LW(0.25); doc.roundedRect(PX, PY, PHOTO_W, PHOTO_W, 1.5, 1.5, 'S')

      // Name
      FT('bold'); FS(7.5); TC(25, 25, 45)
      doc.text(doc.splitTextToSize(u?.name || '—', TH_DEPT - TH_NAME - 3)[0], TH_NAME, y + 6.5)

      // Dept
      const dept = u?.department === 'OTHER' ? (u.departmentOther || 'Other') : (u?.department || '—')
      FT('normal'); FS(6.5); TC(110, 110, 130)
      doc.text(doc.splitTextToSize(dept, TH_YEAR - TH_DEPT - 2)[0], TH_DEPT, y + 6.5)

      // Year
      const yrObj = u?.startYear ? computeAcademicYear(u.startYear, u.endYear) : null
      FT('normal'); FS(6.5); TC(110, 110, 130)
      doc.text(yrObj?.label || '—', TH_YEAR, y + 6.5)

      // Enrollment
      FT('normal'); FS(6.5); TC(110, 110, 130)
      doc.text(u?.enrollmentNumber || '—', TH_ENROLL, y + 6.5)

      // Role badge — 5mm tall, text properly centered
      const rLabel = rlbl(m.role)
      FT('bold'); FS(6)
      const rbw = doc.getTextWidth(rLabel) + 6
      const rbX = ML + CW - rbw - 3
      F(...rclr); doc.roundedRect(rbX, y + (ROW_SM - 5) / 2, rbw, 5, 1.2, 1.2, 'F')
      TC(255, 255, 255); doc.text(rLabel, rbX + rbw / 2, y + ROW_SM / 2 + 0.75, { align: 'center' })

      D(...HDIVIDER); LW(0.1); doc.line(ML + 2, y + ROW_SM, ML + CW, y + ROW_SM)
      y += ROW_SM
    }

    // Item separator
    D(210, 210, 222); LW(0.15); doc.line(ML, y + 4, ML + CW, y + 4)
    y += 12

    // After item, next item will need table header check on new page
    needsTableHeader = false
  }

  // ── FOOTER + page logo on every page ──────────────────────────────────────
  const total2 = doc.getNumberOfPages()
  for (let p = 1; p <= total2; p++) {
    doc.setPage(p)
    if (p > 1) drawPageLogo()  // not on cover
    drawFooter(p, total2)
  }

  const date = new Date().toISOString().slice(0, 10)
  doc.save(`IEM_PhotoClub_${typeName}s_Report_${date}.pdf`)
  onProgress?.(null)
}
