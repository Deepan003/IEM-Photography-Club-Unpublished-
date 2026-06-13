import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { heroThemesApi, settingsApi } from '../../api/api.js'
import { useToast } from './../../components/Toast.jsx'

// ── colour helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return h.match(/.{2}/g)?.map(v => parseInt(v, 16)) ?? [0, 0, 0]
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}
function parseRgba(str) {
  const m = String(str || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/)
  if (m) return { hex: rgbToHex(+m[1], +m[2], +m[3]), alpha: m[4] !== undefined ? Math.round(parseFloat(m[4]) * 100) : 100 }
  return { hex: '#000000', alpha: 40 }
}
function buildRgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${(alpha / 100).toFixed(2)})`
}

const DEFAULT_FORM = {
  name: '', pcVideoUrl: '', mobileVideoUrl: '', useSingleVideo: false,
  blur: 2.5, blurAuto: true, darkness: 0.46, darknessAuto: true, saturation: 0, saturationAuto: true,
  brightness: 44, brightnessAuto: true, warmth: 0, warmthAuto: true,
  navbarBg: 'rgba(0,0,0,0.40)', navbarBgAuto: true,
  navbarTextColor: '#ffffff', heroTextColor: '#d0d0d0', heroTextColorAuto: true,
  tagline: '', introMode: 'immediate', introDelay: 3,
  afterPlayMode: 'loop', afterPlayBlur: 8,
}

// ── DOM transition helpers ────────────────────────────────────────────────────
// Use body class + injected CSS so styles survive React re-renders
const STUDIO_CSS = `
  /* Transitions always ready */
  #admin-main      { transition: margin-left 0.46s cubic-bezier(0.22,1,0.36,1) !important; }
  #admin-tab-title { transition: transform 0.46s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease !important; }
  /* studio-active state */
  body.studio-active aside           { transform: translateX(-110%) !important; transition-duration: 0.46s !important; transition-timing-function: cubic-bezier(0.22,1,0.36,1) !important; }
  body.studio-active #admin-main     { margin-left: 0 !important; }
  body.studio-active #admin-tab-title{ transform: translateY(-18px) !important; opacity: 0 !important; pointer-events: none !important; }
`

function domEnterStudio() {
  // Inject CSS once
  if (!document.getElementById('__studio-mode-css')) {
    const s = document.createElement('style')
    s.id = '__studio-mode-css'
    s.textContent = STUDIO_CSS
    document.head.appendChild(s)
  }
  document.body.classList.add('studio-active')
}

function domExitStudio() {
  document.body.classList.remove('studio-active')
}


// ── Tiny helpers used only inside StudioHeroPreview ──────────────────────────
const _SunSvg = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const _HamSvg = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const _GBtn = ({ children, sz = 36, r = 12 }) => (
  <div style={{ width:sz, height:sz, borderRadius:r, flexShrink:0,
    background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)',
    border:'1px solid rgba(255,255,255,0.10)', borderTopColor:'rgba(255,255,255,0.26)',
    boxShadow:'0 4px 10px rgba(0,0,0,0.22),0 10px 32px rgba(0,0,0,0.16)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'rgba(209,213,219,0.8)',
  }}>{children}</div>
)

// ── Hero preview (studio) — mirrors MainPage.jsx hero section exactly ─────────
// BASE_W/H = real viewport dims. Scales down via CSS transform.
function StudioHeroPreview({ form, pcBlobUrl, mobBlobUrl, aspect, previewKey, expanded, forceW }) {
  const isP      = aspect === 'portrait'
  const BASE_W   = isP ? 390  : 1280
  const BASE_H   = isP ? 844  : 720
  // Non-expanded portrait width (94) is sized so its height matches the 16:9 box (~202px)
  const TARGET_W = forceW != null ? forceW : expanded ? (isP ? 380 : 860) : (isP ? 94 : 360)
  const scale    = TARGET_W / BASE_W
  const TARGET_H = Math.round(BASE_H * scale)

  // Only use blob: URLs (local uploads); for saved S3 URLs always read from form state directly
  const pcSrc  = pcBlobUrl?.startsWith('blob:')  ? pcBlobUrl  : (form.pcVideoUrl  || '')
  const mobSrc = mobBlobUrl?.startsWith('blob:') ? mobBlobUrl : (form.mobileVideoUrl || pcSrc)
  const videoUrl = isP ? (form.useSingleVideo ? pcSrc : (mobSrc || pcSrc)) : pcSrc

  // Mirror how MainPage.jsx derives theme values (blurAuto/darknessAuto defaults)
  const blur      = form.blurAuto     ? (isP ? 3    : 2.5)  : form.blur
  const darkness  = form.darknessAuto ? (isP ? 0.50 : 0.46) : form.darkness
  const heroColor = form.heroTextColorAuto ? null : form.heroTextColor
  const navBg     = form.navbarBgAuto ? null : form.navbarBg  // null = transparent like real navbar
  // Mirror saturation: auto → full grayscale (matches real page default)
  const satAuto   = form.saturationAuto ?? true
  const grayscale = satAuto ? '1.00' : ((100 - (form.saturation ?? 0)) / 100).toFixed(2)
  const brightAuto = form.brightnessAuto ?? true
  const cssBright  = brightAuto ? (isP ? 0.48 : 0.44) : ((form.brightness ?? 44) / 100)
  const W          = (form.warmthAuto ?? true) ? 0 : ((form.warmth ?? 0) / 100)
  const warmthFrag = W <= 0 ? '' : `sepia(${(W*0.65).toFixed(2)}) hue-rotate(${(-W*18).toFixed(1)}deg) `
  // Exact filters from MainPage.jsx — matches themeGrayscale/themeBrightness/themeWarmth
  const videoFilter = isP
    ? `grayscale(${grayscale}) ${warmthFrag}brightness(${cssBright.toFixed(2)}) contrast(1.2)`
    : `grayscale(${grayscale}) ${warmthFrag}brightness(${cssBright.toFixed(2)}) contrast(1.18)`

  // Nav items — same list as Navbar.jsx ALL_SECTION_LINKS
  const NAV_ITEMS = ['Postcards','Event Gallery','Club Gallery','Members','Core','Competitions','Activities','Magazines','Join Us']

  // Font sizes: clamp(4.2rem,8.6vw,8rem) at 1280px → 110px; clamp(3.2rem,6.6vw,6rem) → 84px
  // Portrait: clamp at 390px viewport
  // Both spans use lineHeight:1.05 (matches real page — h1 has 0.96 but spans override to 1.05)
  const titleLine1 = { sz: isP ? 52 : 110, ls: '-0.01em', lh: 1.05, mt: 0 }
  const titleLine2 = { sz: isP ? 40 : 84,  ls: isP ? '0.14em' : '0.16em', lh: 1.05, mt: isP ? 4 : 5 }
  // Correct font stacks matching index.css definitions
  const CLASH = "'ClashDisplay','Oswald',sans-serif"
  const VOYAGER = "'MADEVoyager','Inter',system-ui,-apple-system,sans-serif"

  const gradText = {
    backgroundImage:'linear-gradient(90deg,#d0d0d0 0%,#a0a0a0 12%,#cccccc 26%,#aeaeae 40%,#e0e0e0 54%,#a0a0a0 68%,#cecece 82%,#aeaeae 96%,#d0d0d0 100%)',
    backgroundSize:'300% 100%', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent',
  }
  const solidText = heroColor ? { color:heroColor, WebkitTextFillColor:heroColor } : gradText

  return (
    <div style={{ width:TARGET_W, height:TARGET_H, overflow:'hidden', borderRadius:10,
      boxShadow:'0 8px 40px rgba(0,0,0,0.55)', border:'1px solid rgba(120,120,120,0.22)', flexShrink:0 }}>
      <div style={{ width:BASE_W, height:BASE_H, transformOrigin:'top left', transform:`scale(${scale})`,
        position:'relative', overflow:'hidden', background:'#000' }}>

        {/* ── Video (or fallback gradient) ───────────────────────────── */}
        {videoUrl
          ? <video key={`v${videoUrl}${previewKey}`} autoPlay muted loop playsInline
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:videoFilter }}>
              <source src={videoUrl}/>
            </video>
          : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#0e0e18,#06060c,#111118)' }}/>
        }

        {/* ── Frosted glass layer — matches MainPage line 2189–2193 ── */}
        <div style={{ position:'absolute', inset:0, background:`rgba(3,3,10,${darkness})`, backdropFilter:`blur(${blur}px)` }}/>

        {/* ── Top vignette — desktop 130px rgba(0,0,0,0.78); mobile rgba(0,0,0,0.88) ── */}
        <div style={{ position:'absolute', top:0, left:0, right:0, pointerEvents:'none', zIndex:2, height:130,
          background: isP
            ? 'linear-gradient(to bottom,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.3) 60%,transparent 100%)'
            : 'linear-gradient(to bottom,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.32) 65%,transparent 100%)',
        }}/>

        {/* ── Bottom fade — desktop 260px, mobile 200px ── */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, pointerEvents:'none',
          height: isP ? 200 : 260,
          background:'linear-gradient(to top,rgba(5,5,8,0.98) 0%,rgba(5,5,8,0.5) 55%,transparent 100%)',
        }}/>

        {/* ── Diagonal glass shine ── */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`linear-gradient(128deg,rgba(255,255,255,${isP?0.08:0.07}) 0%,transparent 38%,transparent 62%,rgba(255,255,255,${isP?0.04:0.035}) 100%)`,
        }}/>

        {/* ── Top-edge glint ── */}
        <div style={{ position:'absolute', top:0, left:0, right:0, pointerEvents:'none', height:1,
          background:`linear-gradient(90deg,transparent 5%,rgba(255,255,255,${isP?0.35:0.28}) 28%,rgba(255,255,255,${isP?0.55:0.50}) 50%,rgba(255,255,255,${isP?0.35:0.28}) 72%,transparent 95%)`,
        }}/>

        {/* ── MOBILE navbar — mirrors Navbar.jsx mobile layout (sm:hidden) ── */}
        {isP && (
          <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10,
            padding:'16px 16px', display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Logo — w-11 h-11 */}
              <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                border:'1px solid rgba(96,107,128,0.4)', background:'#000',
                boxShadow:'0 0 20px rgba(0,0,0,0.8)' }}>
                <img src="/IEM_20260416_215615_0000.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
              {/* Theme toggle */}
              <_GBtn sz={34} r={10}><_SunSvg/></_GBtn>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Hamburger */}
              <_GBtn sz={34} r={10}><_HamSvg/></_GBtn>
              {/* Avatar */}
              <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden',
                border:'1px solid rgba(255,255,255,0.20)', background:'#1a1a2e' }}>
                <img src="/IEM_20260416_215615_0000.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
            </div>
          </div>
        )}

        {/* ── DESKTOP navbar — mirrors Navbar.jsx desktop layout (hidden sm:flex, justify-center) ── */}
        {!isP && (
          <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'24px 32px',
            background: navBg || 'transparent',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              {/* Logo — mirrors the new Navbar.jsx desktop logo (w-10 h-10, mr-1) */}
              <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                border:'1px solid rgba(96,107,128,0.35)', background:'#000',
                boxShadow:'0 0 18px rgba(0,0,0,0.75)', marginRight:4 }}>
                <img src="/IEM_20260416_215615_0000.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
              {/* Nav links — text-sm font-medium px-3.5 py-2 rounded-xl text-gray-400 */}
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {NAV_ITEMS.map(l => (
                  <span key={l} style={{ color:'rgba(156,163,175,1)', fontSize:14, fontFamily:VOYAGER,
                    fontWeight:500, padding:'8px 14px', borderRadius:12, letterSpacing:'0.055em', whiteSpace:'nowrap' }}>{l}</span>
                ))}
              </div>
              {/* Theme toggle — GlassButton 36×36 rounded-10 */}
              <_GBtn sz={36} r={10}><_SunSvg/></_GBtn>
              {/* Admin shortcut — text-red-400, text-[11px] uppercase tracking-wider */}
              <div style={{ height:34, padding:'0 12px', borderRadius:9, flexShrink:0,
                background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)',
                border:'1px solid rgba(255,255,255,0.10)', borderTopColor:'rgba(255,255,255,0.26)',
                display:'flex', alignItems:'center', gap:4,
                color:'rgb(248,113,113)', fontSize:11, fontFamily:VOYAGER,
                fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
              }}>⚙ Admin</div>
              {/* Avatar — w-8 h-8 */}
              <div style={{ width:32, height:32, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                border:'1px solid rgba(255,255,255,0.20)', background:'#1a1a2e' }}>
                <img src="/IEM_20260416_215615_0000.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
            </div>
          </div>
        )}

        {/* ── Hero text — mirrors MainPage lines 2222–2310 ─────────── */}
        <div style={{ position:'absolute', inset:0, zIndex:10,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          textAlign:'center', paddingLeft:32, paddingRight:32,
          paddingTop: isP ? 76 : Math.round(BASE_H * 0.07),  // 7vh matches MainPage paddingTop:'7vh'
        }}>
          {/* "Welcome to" — font-inter text-gray-300/60 text-[0.72rem] tracking-[0.30em] */}
          <p style={{ color:'rgba(209,213,219,0.60)', fontSize: isP ? 10 : 11.5,
            letterSpacing:'0.30em', fontFamily:VOYAGER, textTransform:'uppercase',
            margin:`0 0 ${isP?14:20}px` }}>Welcome to</p>

          {/* Club name — two separate spans with different sizes, matching real page h1 */}
          <div>
            {[titleLine1, titleLine2].map(({ sz, ls, lh, mt }, i) => (
              <span key={i} style={{ display:'block', fontSize:sz, lineHeight:lh, textAlign:'center',
                fontFamily:CLASH, fontWeight:900, textTransform:'uppercase',
                letterSpacing:ls, marginTop:mt, ...solidText }}>
                {i === 0 ? 'IEM PHOTOGRAPHY' : 'CLUB'}
              </span>
            ))}
          </div>

          {/* Divider — 64px, margin 22px auto (matches MainPage) */}
          <div style={{ width: isP?50:64, height:1, background:'rgba(255,255,255,0.18)', margin: isP?'16px auto':'22px auto' }}/>

          {/* Subtitle — shown first, matches 0.62rem text-gray-300/65 tracking-[0.24em] */}
          <p style={{ color:'rgba(209,213,219,0.65)', fontSize: isP ? 9 : 9.9,
            letterSpacing:'0.24em', fontFamily:VOYAGER, textTransform:'uppercase' }}>
            The Official Page of IEM Photography Club
          </p>

          {/* Tagline — shown below subtitle, matches 0.92rem bold text-white/85 mt-4 */}
          {form.tagline && (
            <p style={{ color:'rgba(255,255,255,0.85)', fontSize: isP ? 11 : 14.7,
              letterSpacing:'0.20em', fontFamily:VOYAGER, textTransform:'uppercase',
              fontWeight:700, marginTop: isP ? 10 : 16 }}>{form.tagline}</p>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Card thumbnail ────────────────────────────────────────────────────────────
function CardThumbnail({ preset }) {
  // Card is a small preview — lighten darkness/brightness vs. the real hero so the video is actually visible
  const blur       = preset.blurAuto     ? 2.5  : (preset.blur     || 2.5)
  const darkness   = (preset.darknessAuto ? 0.46 : (preset.darkness || 0.46)) * 0.5
  const heroColor  = preset.heroTextColorAuto ? null : preset.heroTextColor
  const satAuto    = preset.saturationAuto ?? true
  const grayscale  = satAuto ? '1.00' : ((100 - (preset.saturation ?? 0)) / 100).toFixed(2)
  const cssBright  = ((preset.brightnessAuto ?? true) ? 0.72 : Math.max((preset.brightness ?? 44) / 100, 0.6)).toFixed(2)
  const W          = (preset.warmthAuto ?? true) ? 0 : (preset.warmth ?? 0) / 100
  const warmthFrag = W <= 0 ? '' : `sepia(${(W*0.65).toFixed(2)}) hue-rotate(${(-W*18).toFixed(1)}deg) `
  const videoFilt  = `grayscale(${grayscale}) ${warmthFrag}brightness(${cssBright}) contrast(1.18)`
  const gradText   = { backgroundImage:'linear-gradient(90deg,#d0d0d0 0%,#a0a0a0 12%,#cccccc 26%,#aeaeae 40%,#e0e0e0 54%,#a0a0a0 68%,#cecece 82%,#aeaeae 96%,#d0d0d0 100%)', backgroundSize:'300% 100%', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }
  const titleSt    = heroColor ? { color:heroColor, WebkitTextFillColor:heroColor } : gradText

  return (
    <div style={{ position:'relative', width:'100%', overflow:'hidden', aspectRatio:'16/9' }}>
      {preset.pcVideoUrl
        ? <video key={preset.pcVideoUrl} autoPlay muted loop playsInline preload="auto"
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:videoFilt }}>
            <source src={preset.pcVideoUrl} type="video/mp4"/>
          </video>
        : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#0e0e18 0%,#06060c 50%,#111118 100%)' }}/>
      }
      <div style={{ position:'absolute', inset:0, background:`rgba(3,3,10,${darkness})`, backdropFilter:`blur(${Math.min(blur,1.5)}px)` }}/>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'30%', background:'linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 100%)' }}/>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'34%', background:'linear-gradient(to top,rgba(5,5,8,0.82) 0%,transparent 100%)' }}/>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:3, gap:1 }}>
        <p style={{ fontSize:'clamp(0.44rem,2.5vw,0.68rem)', letterSpacing:'-0.01em', fontFamily:"'ClashDisplay','Oswald',sans-serif", fontWeight:900, textTransform:'uppercase', lineHeight:1, margin:0, ...titleSt }}>IEM PHOTOGRAPHY</p>
        <p style={{ fontSize:'clamp(0.34rem,1.95vw,0.52rem)', letterSpacing:'0.16em', fontFamily:"'ClashDisplay','Oswald',sans-serif", fontWeight:900, textTransform:'uppercase', lineHeight:1, margin:0, ...titleSt }}>CLUB</p>
      </div>
      {preset.isActive && <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(220,38,38,0.14) 0%,transparent 55%)', pointerEvents:'none' }}/>}
    </div>
  )
}

// ── Compact video row ─────────────────────────────────────────────────────────
function VideoRow({ label, currentUrl, onFile, L }) {
  const ref    = useRef()
  const loaded = !!currentUrl
  const name   = !currentUrl
    ? 'No video selected'
    : currentUrl.startsWith('blob:')
      ? 'Local file (unsaved)'
      : currentUrl.split('/').pop()
  const bdr = L ? '#e2e8f0' : 'rgba(255,255,255,0.08)'
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div style={{ width:54, height:34, borderRadius:6, overflow:'hidden', flexShrink:0, background: L ? '#f1f5f9' : '#080810', border:`1px solid ${bdr}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {loaded
          ? <video src={currentUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted playsInline/>
          : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="text-gray-500"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-inter text-[9px] font-black uppercase tracking-wider mb-0.5 ${L ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
        <p className={`font-inter text-[11px] truncate ${loaded ? (L ? 'text-gray-700' : 'text-gray-300') : (L ? 'text-gray-400' : 'text-gray-600')}`}>{name}</p>
      </div>
      <button onClick={() => ref.current?.click()} style={{ border:`1px solid ${bdr}` }}
        className={`flex-shrink-0 font-inter text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${L ? 'bg-white text-gray-600 hover:bg-gray-50' : 'bg-white/6 text-gray-400 hover:bg-white/10'}`}>
        {loaded ? 'Change' : 'Upload'}
      </button>
      <input ref={ref} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}/>
    </div>
  )
}

function AutoRow({ label, auto, onToggle, L, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-inter font-semibold uppercase tracking-wider ${L ? 'text-gray-500' : 'text-gray-500'}`}>{label}</span>
        <button type="button" onClick={() => onToggle(!auto)}
          className={`flex items-center gap-1.5 font-inter text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all
            ${auto ? 'bg-red-500/15 text-red-400 border border-red-500/20' : L ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-white/5 text-gray-500 border border-white/8'}`}>
          <span className={`w-2 h-2 rounded-full ${auto ? 'bg-red-400' : L ? 'bg-gray-400' : 'bg-gray-600'}`}/>
          Auto
        </button>
      </div>
      {!auto && children}
    </div>
  )
}
const SL = ({ c, L }) => <p className={`font-inter text-[10px] font-black uppercase tracking-[0.16em] pt-1 ${L ? 'text-gray-400' : 'text-gray-600'}`}>{c}</p>
const Hr = ({ L })    => <div className={`border-t ${L ? 'border-gray-200/70' : 'border-white/6'}`}/>

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function HeroThemesTab({ L }) {
  const { toast }       = useToast()
  const [presets,       setPresets]      = useState([])
  const [loading,       setLoading]      = useState(true)
  // phase: null (cards) | 'exiting' (cards animate out) | 'active' (studio)
  const [phase,         setPhase]        = useState(null)
  const [editingId,     setEditingId]    = useState(null)
  const [form,          setForm]         = useState(DEFAULT_FORM)
  const [origForm,      setOrigForm]     = useState(DEFAULT_FORM)
  const [pcFile,        setPcFile]       = useState(null)
  const [mobileFile,    setMobileFile]   = useState(null)
  const [pcBlobUrl,     setPcBlobUrl]    = useState('')
  const [mobBlobUrl,    setMobBlobUrl]   = useState('')
  const [aspect,        setAspect]       = useState('landscape')
  const [previewKey,    setPreviewKey]   = useState(0)
  const [saving,        setSaving]       = useState(false)
  const [uploading,     setUploading]    = useState(false)
  const [error,         setError]        = useState('')
  const [delId,         setDelId]        = useState(null)
  const [exitConfirm,   setExitConfirm]  = useState(false)
  const [fabOpen,       setFabOpen]      = useState(false)
  const [editTitleId,   setEditTitleId]  = useState(null)
  const [editTitleVal,  setEditTitleVal] = useState('')
  const [savedTitleId,  setSavedTitleId] = useState(null)
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [navBgHex,      setNavBgHex]     = useState('#000000')
  const [navBgAlpha,    setNavBgAlpha]   = useState(40)
  const [isMobile,      setIsMobile]     = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
  const [vp,            setVp]           = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 }))
  const [pvPortraitW,   setPvPortraitW]  = useState(300)   // PC docked 9:16 width, fitted to visible height
  const previewAreaRef = useRef(null)
  const phaseTimer = useRef(null)

  // Fit the PC docked 9:16 preview into whatever vertical space is actually visible
  useEffect(() => {
    if (isMobile || aspect !== 'portrait' || phase !== 'active') return
    const fit = () => {
      const el = previewAreaRef.current
      if (!el) return
      const top   = el.getBoundingClientRect().top
      const availH = window.innerHeight - top - 20         // 20px breathing room at the bottom
      const w = Math.round(availH * 390 / 844)             // portrait base ratio 390×844
      setPvPortraitW(Math.max(180, Math.min(360, w)))
    }
    const raf = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(raf)
  }, [isMobile, aspect, phase, vp])

  useEffect(() => {
    const onResize = () => { setIsMobile(window.innerWidth < 1024); setVp({ w: window.innerWidth, h: window.innerHeight }) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Mobile fullscreen: device-back / Esc closes the overlay (restores the studio window)
  useEffect(() => {
    if (!previewExpanded || !isMobile) return
    window.history.pushState({ studioFs: true }, '')
    const onPop = () => setPreviewExpanded(false)
    const onKey = e => { if (e.key === 'Escape') setPreviewExpanded(false) }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [previewExpanded, isMobile])

  const DRAFT_KEY  = editingId ? `hero-draft-${editingId}` : 'hero-draft-new'
  const hasChanges = JSON.stringify(form) !== JSON.stringify(origForm) || !!pcFile || !!mobileFile

  useEffect(() => {
    if (!form.navbarBgAuto) upd('navbarBg', buildRgba(navBgHex, navBgAlpha))
  }, [navBgHex, navBgAlpha]) // eslint-disable-line

  const [heroViewMode, setHeroViewMode] = useState(() => {
    try { return localStorage.getItem('desktopHeroMode') || 'classic' } catch { return 'classic' }
  })

  const handleHeroViewChange = async (val) => {
    setHeroViewMode(val)
    try { localStorage.setItem('desktopHeroMode', val) } catch {}
    try { await settingsApi.patch('desktopHeroMode', val) } catch (e) { console.error(e) }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [{ themes }, contentData] = await Promise.all([heroThemesApi.list(), settingsApi.getContent()])
      setPresets(themes)
      const savedMode = contentData?.content?.desktopHeroMode
      if (savedMode) { setHeroViewMode(savedMode); try { localStorage.setItem('desktopHeroMode', savedMode) } catch {} }
    }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => () => {
    if (pcBlobUrl?.startsWith('blob:'))  URL.revokeObjectURL(pcBlobUrl)
    if (mobBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(mobBlobUrl)
    clearTimeout(phaseTimer.current)
  }, []) // eslint-disable-line

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const clearBlobs = useCallback(() => {
    if (pcBlobUrl?.startsWith('blob:'))  URL.revokeObjectURL(pcBlobUrl)
    if (mobBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(mobBlobUrl)
    setPcFile(null); setMobileFile(null); setPcBlobUrl(''); setMobBlobUrl('')
  }, [pcBlobUrl, mobBlobUrl])

  const handlePcFile = f => {
    if (!f?.type.startsWith('video/')) return
    if (pcBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(pcBlobUrl)
    setPcFile(f); const u = URL.createObjectURL(f); setPcBlobUrl(u)
    if (form.useSingleVideo) { if (mobBlobUrl?.startsWith('blob:') && mobBlobUrl !== pcBlobUrl) URL.revokeObjectURL(mobBlobUrl); setMobBlobUrl(u) }
  }
  const handleMobFile = f => {
    if (!f?.type.startsWith('video/')) return
    if (mobBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(mobBlobUrl)
    setMobileFile(f); setMobBlobUrl(URL.createObjectURL(f))
  }
  const toggleSingle = val => {
    upd('useSingleVideo', val)
    if (val) { if (mobBlobUrl?.startsWith('blob:') && mobBlobUrl !== pcBlobUrl) URL.revokeObjectURL(mobBlobUrl); setMobBlobUrl(pcBlobUrl) }
  }

  const prepareForm = (preset) => {
    if (preset === 'new') {
      setEditingId(null)
      try {
        const rawDraft = JSON.parse(localStorage.getItem('hero-draft-new') || 'null')
        // eslint-disable-next-line no-unused-vars
        const { isActive: _a, isDefault: _d, ...cleanDraft } = rawDraft || {}
        const f = rawDraft ? cleanDraft : DEFAULT_FORM
        setForm(f); setOrigForm(DEFAULT_FORM)
        const { hex, alpha } = parseRgba(f.navbarBg); setNavBgHex(hex); setNavBgAlpha(alpha)
        setPcBlobUrl(f.pcVideoUrl || ''); setMobBlobUrl(f.useSingleVideo ? (f.pcVideoUrl||'') : (f.mobileVideoUrl||''))
      } catch { setForm(DEFAULT_FORM); setOrigForm(DEFAULT_FORM) }
    } else {
      setEditingId(preset._id)
      const f = {
        name: preset.name, pcVideoUrl: preset.pcVideoUrl||'', mobileVideoUrl: preset.mobileVideoUrl||'',
        useSingleVideo: preset.useSingleVideo||false,
        blur: preset.blur??2.5, blurAuto: preset.blurAuto??true,
        darkness: preset.darkness??0.46, darknessAuto: preset.darknessAuto??true,
        navbarBg: preset.navbarBg||'rgba(0,0,0,0.40)', navbarBgAuto: preset.navbarBgAuto??true,
        navbarTextColor: preset.navbarTextColor||'#ffffff',
        heroTextColor: preset.heroTextColor||'#d0d0d0', heroTextColorAuto: preset.heroTextColorAuto??true,
        tagline: preset.tagline||'', introMode: preset.introMode||'immediate', introDelay: preset.introDelay??3,
        afterPlayMode: preset.afterPlayMode||'loop', afterPlayBlur: preset.afterPlayBlur??8,
        saturation: preset.saturation??0, saturationAuto: preset.saturationAuto??true,
        brightness: preset.brightness??44, brightnessAuto: preset.brightnessAuto??true,
        warmth: preset.warmth??0, warmthAuto: preset.warmthAuto??true,
      }
      try {
        const rawDraft = JSON.parse(localStorage.getItem(`hero-draft-${preset._id}`) || 'null')
        // eslint-disable-next-line no-unused-vars
        const { isActive: _a, isDefault: _d, ...cleanDraft } = rawDraft || {}
        const uf = rawDraft ? { ...f, ...cleanDraft } : f
        setForm(uf); setOrigForm(f)
        const { hex, alpha } = parseRgba(uf.navbarBg); setNavBgHex(hex); setNavBgAlpha(alpha)
        setPcBlobUrl(uf.pcVideoUrl||''); setMobBlobUrl(uf.useSingleVideo ? (uf.pcVideoUrl||'') : (uf.mobileVideoUrl||''))
      } catch {
        setForm(f); setOrigForm(f)
        const { hex, alpha } = parseRgba(f.navbarBg); setNavBgHex(hex); setNavBgAlpha(alpha)
        setPcBlobUrl(f.pcVideoUrl||''); setMobBlobUrl(f.useSingleVideo ? (f.pcVideoUrl||'') : (f.mobileVideoUrl||''))
      }
    }
    setError(''); setPreviewKey(k => k+1)
  }

  const enterStudio = useCallback((preset) => {
    clearBlobs()
    prepareForm(preset)
    setPhase('exiting')
    clearTimeout(phaseTimer.current)
    phaseTimer.current = setTimeout(() => setPhase('active'), 360)
  }, [clearBlobs]) // eslint-disable-line

  const exitStudio = useCallback(() => {
    setExitConfirm(false)
    clearBlobs()
    setPhase(null)
  }, [clearBlobs])

  const activatePreset = async (id) => {
    try {
      await heroThemesApi.activate(id)
      await load()
      toast({ type: 'success', message: 'Theme activated! Changes are now live on the home page.' })
    } catch (e) { toast({ type: 'error', message: e.message }) }
  }

  const save = async (asActivate = false) => {
    if (!form.name.trim()) { setError('Preset name is required'); return }
    setSaving(true); setError('')
    try {
      let pcUrl = form.pcVideoUrl, mobUrl = form.mobileVideoUrl
      if (pcFile)  { setUploading(true); pcUrl  = (await heroThemesApi.uploadVideo(pcFile)).publicUrl }
      if (!form.useSingleVideo && mobileFile) { mobUrl = (await heroThemesApi.uploadVideo(mobileFile)).publicUrl }
      setUploading(false)
      const payload = { ...form, pcVideoUrl: pcUrl, mobileVideoUrl: form.useSingleVideo ? '' : mobUrl }
      let saved
      if (editingId) saved = (await heroThemesApi.update(editingId, payload)).theme
      else           saved = (await heroThemesApi.create(payload)).theme
      if (asActivate) await heroThemesApi.activate(saved._id)
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      toast({ type: 'success', message: asActivate ? 'Theme saved and activated!' : 'Theme saved.' })
      await load(); exitStudio()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setUploading(false) }
  }

  const saveDraft = () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch {}
    toast({ type: 'success', message: 'Draft saved.' })
    setExitConfirm(false); clearBlobs(); exitStudio()
  }
  const saveDraftQuiet = () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch {}
    toast({ type: 'success', message: 'Draft saved.' })
  }
  const discard = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    setExitConfirm(false); clearBlobs(); exitStudio()
  }
  const handleBack = () => { if (hasChanges) setExitConfirm(true); else exitStudio() }

  const confirmDel = async () => {
    try { await heroThemesApi.delete(delId); await load(); toast({ type: 'success', message: 'Preset deleted.' }) }
    catch (e) { toast({ type: 'error', message: e.message }) }
    setDelId(null)
  }

  const saveTitle = async () => {
    const name = editTitleVal.trim()
    if (!name) return
    upd('name', name)
    setEditTitleId(false)
    if (editingId) {
      try {
        await heroThemesApi.update(editingId, { name })
        setOrigForm(o => ({ ...o, name }))
        setPresets(ps => ps.map(p => p._id === editingId ? { ...p, name } : p))
      } catch (e) { toast({ type: 'error', message: e.message }) }
    }
    setSavedTitleId(true)
    setTimeout(() => setSavedTitleId(false), 1800)
  }

  const ic = (x='') => `w-full font-inter text-sm px-3 py-2 rounded-xl border outline-none focus:border-red-500/50 transition-colors ${L ? 'bg-white border-gray-200 text-gray-800 placeholder-gray-400' : 'bg-white/5 border-white/10 text-gray-200 placeholder-gray-600'} ${x}`

  const bdr = L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'
  const bg  = L ? '#edf0f7' : '#07070e'
  const panelBg = L ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,18,0.8)'

  // ── STUDIO VIEW ──────────────────────────────────────────────────────────
  if (phase === 'active') {
    return (
      <>
        <style>{`
          @keyframes studioIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          .studio-in { animation: studioIn 0.38s ease both; }
        `}</style>

        {/* We use -mx to break out of the tab content's px-8 padding so studio fills full width */}
        <div className="studio-in -mx-3 sm:-mx-5 lg:-mx-8 -mt-4 -mb-8"
          style={{ background:bg, minHeight:'calc(100vh - 60px)' }}>

          {/* Top bar */}
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'0 20px', height:54, flexShrink:0,
            background: L ? 'rgba(255,255,255,0.7)' : 'rgba(5,5,13,0.85)',
            backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
            borderBottom:`1px solid ${bdr}`,
          }}>
            <button onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'"Inter",sans-serif', fontSize:12, fontWeight:600, color: L ? '#475569' : '#94a3b8', background:'none', border:`1px solid ${bdr}`, cursor:'pointer', padding:'5px 10px', borderRadius:8 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              Exit Studio
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              {editTitleId ? (
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <input
                    value={editTitleVal}
                    autoFocus
                    onChange={e => setEditTitleVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditTitleId(false) }}
                    style={{ flex:'0 1 320px', minWidth:0, fontFamily:'"Clash Display",sans-serif', fontWeight:700, fontSize:19,
                      color: L ? '#1e293b' : '#f0f0f8', background: L ? '#fff' : 'rgba(255,255,255,0.06)',
                      border:`1px solid ${L ? '#e2e8f0' : 'rgba(255,255,255,0.18)'}`, borderRadius:8, padding:'4px 10px', outline:'none' }}
                  />
                  <button onClick={saveTitle} title="Save"
                    style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'"Inter",sans-serif', fontSize:12, fontWeight:600, padding:'6px 11px', borderRadius:8, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e', cursor:'pointer' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Save
                  </button>
                  <button onClick={() => setEditTitleId(false)} title="Cancel"
                    style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'"Inter",sans-serif', fontSize:12, fontWeight:600, padding:'6px 11px', borderRadius:8, background:'transparent', border:`1px solid ${bdr}`, color: L ? '#64748b' : '#94a3b8', cursor:'pointer' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontFamily:'"Clash Display",sans-serif', fontWeight:700, fontSize:19, color: L ? '#1e293b' : '#f0f0f8', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
                    {form.name || (editingId ? 'Editing Preset' : 'New Preset')}
                  </p>
                  <button onClick={() => { setEditTitleId(true); setEditTitleVal(form.name) }} title="Rename"
                    style={{ flexShrink:0, display:'flex', padding:5, borderRadius:7, background:'transparent', border:`1px solid ${bdr}`, color: L ? '#64748b' : '#94a3b8', cursor:'pointer' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {savedTitleId && (
                    <span style={{ flexShrink:0, display:'flex', alignItems:'center', gap:4, fontFamily:'"Inter",sans-serif', fontSize:11, fontWeight:600, color:'#22c55e' }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Saved
                    </span>
                  )}
                  {hasChanges && !savedTitleId && <span style={{ fontFamily:'"Inter",sans-serif', fontSize:9, color:'#94a3b8', flexShrink:0 }}>Unsaved changes</span>}
                </div>
              )}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={saveDraftQuiet} style={{ fontFamily:'"Inter",sans-serif', fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:8, background:'transparent', border:`1px solid ${bdr}`, color: L ? '#64748b' : '#64748b', cursor:'pointer' }}>
                Save Draft
              </button>
              <button onClick={() => save(false)} disabled={saving} style={{ fontFamily:'"Inter",sans-serif', fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:8, background:'transparent', border:`1px solid ${bdr}`, color: L ? '#475569' : '#94a3b8', cursor:'pointer' }}>
                {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => save(true)} disabled={saving} style={{ fontFamily:'"Inter",sans-serif', fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:8, background:'#dc2626', border:'none', color:'#fff', cursor:'pointer' }}>
                Save & Activate
              </button>
            </div>
          </div>

          {/* Studio body: OPTIONS fill the major area | small PREVIEW docked top-right.
              Desktop = fixed-height row with independent scroll panes.
              Mobile  = natural page scroll (no inner fixed height) so options stay reachable. */}
          <div className="flex flex-col lg:flex-row h-[calc(100vh-114px)] overflow-hidden" style={{ gap:0 }}>

            {/* ── OPTIONS AREA — fills the major space, 2 columns on desktop ──
                Both mobile & desktop: own scroll pane (flex-1 + min-h-0 + overflow-y-auto),
                so the preview stays pinned/in-view while only the options scroll. */}
            <div style={{ background: panelBg }}
              className="order-2 lg:order-1 flex-1 min-h-0 lg:h-full overflow-y-auto">
              <div style={{ padding:'12px 22px 40px' }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-3 max-w-[820px]">

                  {/* ───── COLUMN A ───── */}
                  <div className="space-y-3">
                    {/* Name */}
                    <div>
                      <SL c="Preset Name" L={L}/>
                      <input className={ic('mt-1.5')} placeholder="e.g. Diwali Special" value={form.name} onChange={e => upd('name', e.target.value)}/>
                    </div>

                    <Hr L={L}/><SL c="Videos" L={L}/>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.useSingleVideo ? 'bg-red-500' : L ? 'bg-gray-200' : 'bg-white/10'}`} onClick={() => toggleSingle(!form.useSingleVideo)}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.useSingleVideo ? 'translate-x-4' : ''}`}/>
                      </span>
                      <span className={`font-inter text-xs ${L ? 'text-gray-600' : 'text-gray-400'}`}>One video for PC + Mobile</span>
                    </label>
                    <VideoRow label={form.useSingleVideo ? 'Video (PC & Mobile)' : 'PC Video (16:9)'} currentUrl={pcBlobUrl} onFile={handlePcFile} L={L}/>
                    {!form.useSingleVideo && <VideoRow label="Mobile Video (9:16)" currentUrl={mobBlobUrl} onFile={handleMobFile} L={L}/>}

                    <Hr L={L}/><SL c="Visual" L={L}/>
                    <AutoRow label="Blur" auto={form.blurAuto} onToggle={v => upd('blurAuto', v)} L={L}>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input type="range" min={0} max={20} step={0.5} value={form.blur} onChange={e => upd('blur', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                        <span className={`font-inter text-xs w-10 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.blur}px</span>
                      </div>
                    </AutoRow>
                    <AutoRow label="Darkness" auto={form.darknessAuto} onToggle={v => upd('darknessAuto', v)} L={L}>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input type="range" min={0} max={1} step={0.02} value={form.darkness} onChange={e => upd('darkness', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                        <span className={`font-inter text-xs w-10 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{Math.round(form.darkness*100)}%</span>
                      </div>
                    </AutoRow>
                    <AutoRow label="Video Saturation" auto={form.saturationAuto ?? true} onToggle={v => upd('saturationAuto', v)} L={L}>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>B&W</span>
                        <input type="range" min={0} max={100} step={1} value={form.saturation ?? 0} onChange={e => upd('saturation', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>Color</span>
                        <span className={`font-inter text-xs w-8 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.saturation ?? 0}%</span>
                      </div>
                    </AutoRow>
                    <AutoRow label="Brightness" auto={form.brightnessAuto ?? true} onToggle={v => upd('brightnessAuto', v)} L={L}>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>Dark</span>
                        <input type="range" min={10} max={150} step={1} value={form.brightness ?? 44} onChange={e => upd('brightness', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>Bright</span>
                        <span className={`font-inter text-xs w-8 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.brightness ?? 44}%</span>
                      </div>
                    </AutoRow>
                    <AutoRow label="Warmth" auto={form.warmthAuto ?? true} onToggle={v => upd('warmthAuto', v)} L={L}>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>Cool</span>
                        <input type="range" min={0} max={100} step={1} value={form.warmth ?? 0} onChange={e => upd('warmth', +e.target.value)} className="flex-1 accent-amber-500 h-1.5"/>
                        <span className={`font-inter text-[9px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>Warm</span>
                        <span className={`font-inter text-xs w-8 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.warmth ?? 0}%</span>
                      </div>
                    </AutoRow>
                  </div>

                  {/* ───── COLUMN B ───── */}
                  <div className="space-y-3">
                    <SL c="Colors" L={L}/>
                    <AutoRow label="Navbar Background" auto={form.navbarBgAuto} onToggle={v => upd('navbarBgAuto', v)} L={L}>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input type="color" value={navBgHex} onChange={e => setNavBgHex(e.target.value)} className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer p-0.5 bg-transparent flex-shrink-0"/>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className={`font-inter text-[10px] ${L ? 'text-gray-500' : 'text-gray-500'}`}>Opacity</span>
                            <span className={`font-inter text-[10px] ${L ? 'text-gray-500' : 'text-gray-500'}`}>{navBgAlpha}%</span>
                          </div>
                          <input type="range" min={0} max={100} value={navBgAlpha} onChange={e => setNavBgAlpha(+e.target.value)} className="w-full accent-red-500 h-1.5"/>
                        </div>
                        <div className="w-9 h-9 rounded-lg border border-white/10" style={{ background: buildRgba(navBgHex, navBgAlpha), flexShrink:0 }}/>
                      </div>
                    </AutoRow>
                    <div>
                      <SL c="Hero Title Color" L={L}/>
                      <p className={`font-inter text-[10px] mb-1.5 ${L ? 'text-gray-400' : 'text-gray-600'}`}>Default is the animated silver gradient</p>
                      <AutoRow label="" auto={form.heroTextColorAuto} onToggle={v => upd('heroTextColorAuto', v)} L={L}>
                        <div className="flex items-center gap-2.5 mt-1">
                          <input type="color" value={form.heroTextColor} onChange={e => upd('heroTextColor', e.target.value)} className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer p-0.5 bg-transparent"/>
                          <span className={`font-inter text-xs ${L ? 'text-gray-500' : 'text-gray-500'}`}>{form.heroTextColor}</span>
                        </div>
                      </AutoRow>
                    </div>

                    <Hr L={L}/><SL c="Tagline" L={L}/>
                    <input className={ic('mt-1.5')} placeholder='e.g. "Celebrate the Season"' value={form.tagline} onChange={e => upd('tagline', e.target.value)}/>

                    <Hr L={L}/><SL c="Intro Mode" L={L}/>
                    <div className="space-y-2 mt-1.5">
                      {[['immediate','Immediate','Text appears instantly'],['timed','Timed','Text appears after a set delay'],['after-first-play','After First Play','Text appears after video completes first loop']].map(([v,l,d]) => (
                        <label key={v} className="flex items-start gap-2.5 cursor-pointer">
                          <input type="radio" name="im" value={v} checked={form.introMode===v} onChange={() => upd('introMode', v)} className="mt-0.5 accent-red-500 flex-shrink-0"/>
                          <div>
                            <span className={`font-inter text-sm font-medium ${L ? 'text-gray-700' : 'text-gray-300'}`}>{l}</span>
                            <p className={`font-inter text-xs ${L ? 'text-gray-400' : 'text-gray-600'}`}>{d}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {form.introMode === 'timed' && (
                      <div>
                        <SL c="Delay (seconds)" L={L}/>
                        <div className="flex items-center gap-3 mt-1.5">
                          <input type="range" min={1} max={30} step={0.5} value={form.introDelay} onChange={e => upd('introDelay', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                          <span className={`font-inter text-xs w-8 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.introDelay}s</span>
                        </div>
                      </div>
                    )}
                    {(form.introMode==='after-first-play'||form.introMode==='timed') && (
                      <>
                        <Hr L={L}/><SL c="After-Play Mode" L={L}/>
                        <div className="space-y-2 mt-1.5">
                          {[['loop','Loop','Video loops cleanly'],['blur-loop','Blur Loop','Loop with a soft blur overlay']].map(([v,l,d]) => (
                            <label key={v} className="flex items-start gap-2.5 cursor-pointer">
                              <input type="radio" name="ap" value={v} checked={form.afterPlayMode===v} onChange={() => upd('afterPlayMode', v)} className="mt-0.5 accent-red-500 flex-shrink-0"/>
                              <div>
                                <span className={`font-inter text-sm font-medium ${L ? 'text-gray-700' : 'text-gray-300'}`}>{l}</span>
                                <p className={`font-inter text-xs ${L ? 'text-gray-400' : 'text-gray-600'}`}>{d}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                        {form.afterPlayMode==='blur-loop' && (
                          <div>
                            <SL c="After-play blur" L={L}/>
                            <div className="flex items-center gap-3 mt-1.5">
                              <input type="range" min={2} max={20} step={1} value={form.afterPlayBlur} onChange={e => upd('afterPlayBlur', +e.target.value)} className="flex-1 accent-red-500 h-1.5"/>
                              <span className={`font-inter text-xs w-8 text-right tabular-nums ${L ? 'text-gray-600' : 'text-gray-400'}`}>{form.afterPlayBlur}px</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {error && <p className="font-inter text-sm text-red-400 pt-1">{error}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* ── PREVIEW — compact box docked right, with expand option ── */}
            <div style={{ display:'flex', flexDirection:'column', flexShrink:0, borderLeft:`1px solid ${bdr}`, background: L ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)', alignSelf:'flex-start' }}
              className="order-1 lg:order-2 w-full lg:w-[400px]">

              {/* Preview toolbar */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${bdr}`, flexShrink:0 }}>
                <span style={{ fontFamily:'"Inter",sans-serif', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.16em', color: L ? '#94a3b8' : '#475569' }}>Preview</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:`1px solid ${bdr}` }}>
                    {[['landscape','16:9'],['portrait','9:16']].map(([v,l]) => (
                      <button key={v} onClick={() => setAspect(v)} style={{ fontFamily:'"Inter",sans-serif', fontSize:10, fontWeight:600, padding:'4px 9px', background: aspect===v ? '#dc2626' : 'transparent', color: aspect===v ? '#fff' : '#64748b', border:'none', cursor:'pointer' }}>{l}</button>
                    ))}
                  </div>
                  <button onClick={() => setPreviewKey(k => k+1)} title="Reload" style={{ padding:5, borderRadius:7, background:'transparent', border:`1px solid ${bdr}`, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                  {/* Expand button */}
                  <button onClick={() => setPreviewExpanded(true)} title="Expand preview" style={{ padding:5, borderRadius:7, background:'transparent', border:`1px solid ${bdr}`, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  </button>
                </div>
              </div>

              {/* Preview area — PC portrait fitted to visible height; mobile + landscape unchanged */}
              <div ref={previewAreaRef} style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px 14px' }}>
                <StudioHeroPreview form={form} pcBlobUrl={pcBlobUrl} mobBlobUrl={mobBlobUrl} aspect={aspect} previewKey={previewKey}
                  forceW={!isMobile && aspect === 'portrait' ? pvPortraitW : undefined}/>
              </div>
            </div>

            {/* ── EXPANDED PREVIEW OVERLAY (desktop) ── */}
            {previewExpanded && !isMobile && (
              <div style={{ position:'fixed', inset:0, zIndex:9999, background: L ? '#edf0f7' : '#07070e', display:'flex', flexDirection:'column' }}>
                {/* Expanded toolbar */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 20px', height:52, flexShrink:0, borderBottom:`1px solid ${bdr}`, background: L ? 'rgba(255,255,255,0.7)' : 'rgba(5,5,13,0.9)', backdropFilter:'blur(16px)' }}>
                  <button onClick={() => setPreviewExpanded(false)} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'"Inter",sans-serif', fontSize:12, fontWeight:600, color: L ? '#475569' : '#94a3b8', background:'none', border:`1px solid ${bdr}`, cursor:'pointer', padding:'5px 10px', borderRadius:8 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>
                  <span style={{ fontFamily:'"Inter",sans-serif', fontSize:12, fontWeight:700, color: L ? '#1e293b' : '#f0f0f8', flex:1 }}>
                    {form.name || 'Preview'} — Full Preview
                  </span>
                  <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:`1px solid ${bdr}` }}>
                    {[['landscape','16:9'],['portrait','9:16']].map(([v,l]) => (
                      <button key={v} onClick={() => setAspect(v)} style={{ fontFamily:'"Inter",sans-serif', fontSize:10, fontWeight:600, padding:'5px 12px', background: aspect===v ? '#dc2626' : 'transparent', color: aspect===v ? '#fff' : '#64748b', border:'none', cursor:'pointer' }}>{l}</button>
                    ))}
                  </div>
                  <button onClick={() => setPreviewKey(k => k+1)} style={{ padding:6, borderRadius:7, background:'transparent', border:`1px solid ${bdr}`, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                </div>
                {/* Expanded preview area */}
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:32, overflow:'auto' }}>
                  <StudioHeroPreview form={form} pcBlobUrl={pcBlobUrl} mobBlobUrl={mobBlobUrl} aspect={aspect} previewKey={previewKey} expanded/>
                </div>
              </div>
            )}

            {/* ── MOBILE FULLSCREEN OVERLAY ──
                16:9 → CSS-rotated stage so it fills the screen in landscape.
                9:16 → fills the screen normally.
                Floating glass back button + aspect toggle in both. */}
            {previewExpanded && isMobile && (() => {
              const FloatBack = (
                <button onClick={() => setPreviewExpanded(false)} aria-label="Back"
                  style={{ width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(0,0,0,0.45)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                    border:'1px solid rgba(255,255,255,0.28)', color:'#fff', cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )
              const AspectPills = (
                <div style={{ display:'flex', borderRadius:9, overflow:'hidden', border:'1px solid rgba(255,255,255,0.28)', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
                  {[['landscape','16:9'],['portrait','9:16']].map(([v,l]) => (
                    <button key={v} onClick={() => setAspect(v)} style={{ fontFamily:'"Inter",sans-serif', fontSize:11, fontWeight:600, padding:'6px 12px', background: aspect===v ? '#dc2626' : 'transparent', color: aspect===v ? '#fff' : 'rgba(255,255,255,0.7)', border:'none', cursor:'pointer' }}>{l}</button>
                  ))}
                </div>
              )

              if (isP) {
                const w = Math.min(vp.w, Math.round(vp.h * 390 / 844))
                return (
                  <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#000', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    <StudioHeroPreview form={form} pcBlobUrl={pcBlobUrl} mobBlobUrl={mobBlobUrl} aspect={aspect} previewKey={previewKey} forceW={w}/>
                    <div style={{ position:'fixed', top:14, left:14, zIndex:5 }}>{FloatBack}</div>
                    <div style={{ position:'fixed', top:16, right:14, zIndex:5 }}>{AspectPills}</div>
                  </div>
                )
              }

              // Landscape: rotated stage sized (vp.h × vp.w) so it covers the portrait screen when rotated 90°.
              const Wp = Math.min(vp.h, Math.round(vp.w * 1280 / 720))
              return (
                <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#000', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:'50%', left:'50%', width:vp.h, height:vp.w,
                    transform:'translate(-50%,-50%) rotate(90deg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <StudioHeroPreview form={form} pcBlobUrl={pcBlobUrl} mobBlobUrl={mobBlobUrl} aspect={aspect} previewKey={previewKey} forceW={Wp}/>
                    {/* Controls live inside the rotated stage so they read upright when the phone is held landscape */}
                    <div style={{ position:'absolute', top:14, left:14, zIndex:5 }}>{FloatBack}</div>
                    <div style={{ position:'absolute', top:16, right:14, zIndex:5 }}>{AspectPills}</div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Exit confirm modal */}
        {exitConfirm && (
          <div style={{ position:'fixed', inset:0, zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)' }}>
            <div style={{ borderRadius:20, border:`1px solid ${bdr}`, padding:24, maxWidth:340, width:'100%', background: L ? '#fff' : '#0e0e14', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
              <h4 style={{ fontFamily:'"Clash Display",sans-serif', fontWeight:700, fontSize:16, color: L ? '#1e293b' : '#f0f0f8', margin:'0 0 5px' }}>Exit Studio Mode?</h4>
              <p style={{ fontFamily:'"Inter",sans-serif', fontSize:13, color:'#64748b', margin:'0 0 18px' }}>You have unsaved changes.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button onClick={() => { setExitConfirm(false); save(false) }} style={{ width:'100%', padding:'10px', borderRadius:12, background:'#dc2626', border:'none', color:'#fff', fontFamily:'"Inter",sans-serif', fontSize:13, fontWeight:600, cursor:'pointer' }}>Save & Exit</button>
                <button onClick={saveDraft} style={{ width:'100%', padding:'10px', borderRadius:12, background: L ? '#f1f5f9' : 'rgba(255,255,255,0.08)', border:'none', color: L ? '#475569' : '#cbd5e1', fontFamily:'"Inter",sans-serif', fontSize:13, fontWeight:500, cursor:'pointer' }}>Save as Draft</button>
                <button onClick={discard} style={{ width:'100%', padding:'10px', borderRadius:12, background:'transparent', border:'none', color:'#f87171', fontFamily:'"Inter",sans-serif', fontSize:13, cursor:'pointer' }}>Discard Changes</button>
                <button onClick={() => setExitConfirm(false)} style={{ width:'100%', padding:'7px', borderRadius:12, background:'transparent', border:'none', color:'#64748b', fontFamily:'"Inter",sans-serif', fontSize:11, cursor:'pointer' }}>Stay in Studio</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: CARDS VIEW (phase null or 'exiting')
  return (
    <>
      <style>{`
        @keyframes cardsOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-18px)} }
        .cards-exiting { animation: cardsOut 0.35s ease forwards; pointer-events:none; }
      `}</style>

      <div className={`max-w-6xl relative ${phase === 'exiting' ? 'cards-exiting' : ''}`}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${L ? 'bg-gray-100' : 'bg-white/8'}`}
            style={{ boxShadow: L ? '4px 4px 10px rgba(163,177,200,0.4),-2px -2px 6px rgba(255,255,255,0.8)' : undefined }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="text-red-500">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div>
            <h3 className={`font-clash text-lg font-bold ${L ? 'text-gray-800' : 'text-gray-100'}`}>Hero Themes</h3>
            <p className={`font-inter text-xs ${L ? 'text-gray-500' : 'text-gray-500'}`}>Click a card to open Studio Mode and edit the hero preset.</p>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {[1,2,3].map(i => <div key={i} className={`rounded-xl overflow-hidden animate-pulse`} style={{ aspectRatio:'4/3', background: L ? '#eef1f7' : '#0e0e1c', boxShadow: L ? '7px 7px 18px rgba(150,165,195,0.38),-4px -4px 12px rgba(255,255,255,0.88)' : '-3px -3px 7px rgba(255,255,255,0.055),5px 5px 16px rgba(0,0,0,0.75)' }}/>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 pb-8">
            {presets.map(p => (
              <div key={p._id}
                className={`rounded-xl overflow-hidden transition-all group ${!p.isDefault ? 'hover:-translate-y-px cursor-pointer' : ''}`}
                style={{
                  background: L ? '#eef1f7' : '#0e0e1c',
                  boxShadow: L
                    ? p.isActive
                      ? '7px 7px 18px rgba(150,165,195,0.42),-4px -4px 12px rgba(255,255,255,0.92),0 0 0 1.5px rgba(220,38,38,0.18)'
                      : '7px 7px 18px rgba(150,165,195,0.38),-4px -4px 12px rgba(255,255,255,0.88)'
                    : p.isActive
                      ? '-3px -3px 7px rgba(255,255,255,0.055),5px 5px 16px rgba(0,0,0,0.75),0 0 22px rgba(220,38,38,0.13)'
                      : '-3px -3px 7px rgba(255,255,255,0.055),5px 5px 16px rgba(0,0,0,0.75)',
                }}
                onClick={() => !p.isDefault && enterStudio(p)}>

                {/* Thumbnail */}
                <div className="relative overflow-hidden">
                  <CardThumbnail preset={p}/>
                </div>

                {/* Card info */}
                <div className="p-2 sm:p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className={`font-inter text-sm font-semibold flex-1 truncate ${L ? 'text-gray-800' : 'text-gray-100'}`}>{p.name}</p>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {p.isDefault && <span className="font-inter text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">Default</span>}
                      {p.isActive  && <span className="font-inter text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">Active</span>}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    {/* Default-only: hero view mode dropdown */}
                    {p.isDefault && (
                      <div className="flex items-center gap-2 mr-auto">
                        <span className={`font-inter text-[10px] uppercase tracking-wider ${L ? 'text-gray-500' : 'text-gray-500'}`}>Default View</span>
                        <div className="relative">
                          <select
                            value={heroViewMode}
                            onChange={e => handleHeroViewChange(e.target.value)}
                            className="font-inter text-[11px] font-semibold appearance-none pl-2.5 pr-6 py-1 rounded-lg outline-none cursor-pointer transition-colors"
                            style={{
                              background: L ? '#f1f5f9' : 'rgba(255,255,255,0.07)',
                              border: `1px solid ${L ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`,
                              color: L ? '#475569' : '#94a3b8',
                            }}>
                            <option value="classic">Classic</option>
                            <option value="video">Video</option>
                          </select>
                          <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ color: L ? '#94a3b8' : '#64748b' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {!p.isActive && (
                      <button onClick={() => activatePreset(p._id)}
                        className="flex items-center gap-1.5 font-inter text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Activate
                      </button>
                    )}
                    {!p.isDefault && (
                      <button onClick={() => enterStudio(p)}
                        className="flex items-center gap-1.5 font-inter text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="m3 7 4.5-2.5"/></svg>
                        Open Studio
                      </button>
                    )}
                    {!p.isDefault && !p.isActive && (
                      <button onClick={() => setDelId(p._id)}
                        className="font-inter text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors ml-auto">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating + button — portaled to body so position:fixed always works */}
        {createPortal(
          <div style={{
            position: 'fixed',
            bottom: 24,
            ...(isMobile ? { left: 20 } : { right: 24 }),
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexDirection: isMobile ? 'row' : 'row-reverse',
          }}>
            <button onClick={() => setFabOpen(o => !o)}
              aria-label={fabOpen ? 'Close' : 'Add theme'}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg,rgba(222,38,38,0.97),rgba(168,16,16,1))',
                color: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: '0 4px 24px rgba(220,38,38,0.45),0 2px 8px rgba(0,0,0,0.4)',
                transition: 'transform 0.15s ease',
              }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                style={{ transform: fabOpen ? 'rotate(45deg)' : 'none', transition:'transform 0.25s ease' }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            {/* Create Theme pill */}
            <button onClick={() => { enterStudio('new'); setFabOpen(false) }}
              style={{
                height: 46, borderRadius: 99,
                background: 'linear-gradient(135deg,rgba(222,38,38,0.97),rgba(168,16,16,1))',
                color: 'white', border: 'none', cursor: 'pointer',
                fontFamily: 'MADEVoyager, Inter, sans-serif', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
                maxWidth: fabOpen ? 180 : 0,
                opacity: fabOpen ? 1 : 0,
                paddingLeft: fabOpen ? 20 : 0,
                paddingRight: fabOpen ? 22 : 0,
                pointerEvents: fabOpen ? 'auto' : 'none',
                boxShadow: fabOpen ? '0 4px 22px rgba(220,38,38,0.42),0 2px 8px rgba(0,0,0,0.4)' : 'none',
                transition: 'max-width 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease, padding 0.28s ease',
              }}>
              Create Theme
            </button>
          </div>,
          document.body
        )}

        {/* Delete confirm */}
        {delId && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`rounded-2xl border p-6 max-w-sm w-full shadow-2xl ${L ? 'bg-white border-gray-200' : 'bg-[#0e0e14] border-white/10'}`}>
              <h4 className={`font-clash text-base font-bold mb-2 ${L ? 'text-gray-800' : 'text-gray-100'}`}>Delete preset?</h4>
              <p className={`font-inter text-sm mb-5 ${L ? 'text-gray-500' : 'text-gray-400'}`}>This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={confirmDel} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-inter text-sm font-semibold hover:bg-red-500 transition-colors">Delete</button>
                <button onClick={() => setDelId(null)} className={`px-5 py-2.5 rounded-xl font-inter text-sm font-medium ${L ? 'bg-gray-100 text-gray-700' : 'bg-white/8 text-gray-300'}`}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
