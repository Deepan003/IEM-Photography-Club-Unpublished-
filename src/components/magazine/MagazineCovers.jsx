import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTemplateById } from './templates.js'
import TemplatePage from './TemplatePage.jsx'

// Book proportions — A-magazine ratio (3:4)
const COVER_W  = 122
const COVER_H  = Math.round(COVER_W * 560 / 420)   // ≈ 163px
const SPINE_W  = 10
const PAGES_W  = 4
const BOOK_W   = SPINE_W + COVER_W + PAGES_W        // ≈ 136px
const PAGE_W   = 420
const PAGE_H   = 560
const SCALE    = COVER_W / PAGE_W

// ── Single book card ──────────────────────────────────────────────────────────
function BookCard({ magazines, startIdx, intervalMs }) {
  const nav = useNavigate()
  const n   = magazines.length

  const [idx,   setIdx]   = useState(() => startIdx % Math.max(n, 1))
  const [phase, setPhase] = useState('idle')   // 'idle' | 'exit' | 'enter-start' | 'enter'
  const [hov,   setHov]   = useState(false)
  const rafRef = useRef(null)

  useEffect(() => { if (n > 0) setIdx(startIdx % n) }, [n, startIdx])

  // Slide-out → swap index → slide-in animation
  const shuffle = () => {
    setPhase('exit')
    setTimeout(() => {
      setIdx(i => (i + 1) % n)
      setPhase('enter-start')
      // Two rAFs: let the DOM paint the enter-start position before transitioning
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase('enter')
          setTimeout(() => setPhase('idle'), 320)
        })
      })
    }, 220)
  }

  useEffect(() => {
    if (n <= 1) return   // nothing to cycle — only 1 magazine published
    const t = setInterval(shuffle, intervalMs)
    return () => { clearInterval(t); cancelAnimationFrame(rafRef.current) }
  }, [n, intervalMs])

  const mag = magazines[idx]
  if (!mag) return null
  const tpl = getTemplateById(mag.templateId)
  if (!tpl) return null

  const spineBg = tpl.colors?.bg?.startsWith('#0') || tpl.colors?.text === '#ffffff'
    ? '#111111' : '#1c1c1c'

  // Slide animation styles
  const slideStyle = {
    'idle':        { opacity: 1, transform: 'translateX(0)',      transition: 'opacity 0.32s ease, transform 0.32s ease' },
    'exit':        { opacity: 0, transform: 'translateX(-22px)',   transition: 'opacity 0.22s ease, transform 0.22s ease' },
    'enter-start': { opacity: 0, transform: 'translateX(22px)',    transition: 'none' },
    'enter':       { opacity: 1, transform: 'translateX(0)',       transition: 'opacity 0.32s ease, transform 0.32s ease' },
  }[phase]

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>

      {/* Book wrapper — 3D tilt on hover */}
      <div style={{ perspective: 700, cursor:'pointer' }}
        onClick={() => nav(`/magazines?open=${mag._id}`)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}>

        <div style={{
          width: BOOK_W, height: COVER_H, position: 'relative',
          transformStyle: 'preserve-3d',
          transform: hov ? 'translateY(-7px) rotateY(-6deg) rotateX(1deg)' : 'rotateY(0deg)',
          transition: 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)',
          filter: hov
            ? 'drop-shadow(6px 14px 18px rgba(0,0,0,0.72))'
            : 'drop-shadow(3px 6px 10px rgba(0,0,0,0.55))',
        }}>

          {/* Left spine */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: SPINE_W,
            background: `linear-gradient(to right, ${spineBg}, #333)`,
            boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.55), inset 1px 0 0 rgba(255,255,255,0.04)',
            zIndex: 3,
          }}/>

          {/* Cover page — slide animation applied here */}
          <div style={{
            position: 'absolute', left: SPINE_W, top: 0,
            width: COVER_W, height: COVER_H, overflow: 'hidden', zIndex: 2,
            boxShadow: 'inset 4px 0 8px rgba(0,0,0,0.35)',
          }}>
            <div style={{ width:'100%', height:'100%', ...slideStyle }}>
              <div style={{ transform:`scale(${SCALE})`, transformOrigin:'top left', width:PAGE_W, height:PAGE_H }}>
                <TemplatePage
                  template={tpl} layoutId={mag.pages?.[0]?.layoutId || tpl.pages[0] || 'cover'}
                  pageData={mag.pages?.[0]} editMode={false} showSamples={false}
                  width={PAGE_W} height={PAGE_H}/>
              </div>
            </div>

            {/* Hover overlay */}
            <div style={{
              position:'absolute', inset:0,
              background:'rgba(0,0,0,0.42)',
              opacity: hov ? 1 : 0,
              transition:'opacity 0.22s ease',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'#fff' }}>View</span>
            </div>

            {/* Gloss sheen */}
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(130deg, rgba(255,255,255,0.07) 0%, transparent 45%)',
            }}/>
          </div>

          {/* Right page-edge lines */}
          <div style={{
            position:'absolute', right:0, top:2, bottom:2, width:PAGES_W, zIndex:1,
            background:'repeating-linear-gradient(to bottom,#c8c8c8,#c8c8c8 1px,#e4e4e4 1px,#e4e4e4 3px)',
          }}/>

          {/* Bottom page-edge lines */}
          <div style={{
            position:'absolute', left:SPINE_W, right:PAGES_W, bottom:-3, height:4, zIndex:0, opacity:0.7,
            background:'repeating-linear-gradient(to right,#c8c8c8,#c8c8c8 1px,#e4e4e4 1px,#e4e4e4 3px)',
          }}/>
        </div>
      </div>

      {/* Label: magazine name + by author */}
      <div style={{ marginTop:8, paddingLeft:SPINE_W, width:BOOK_W - SPINE_W }}>
        <p style={{
          fontFamily:'inherit', fontSize:11, fontWeight:600,
          color:'#e0e0e0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          letterSpacing:'0.01em',
        }}>
          {mag.name || tpl.name}
        </p>
        {mag.user?.name && (
          <p style={{
            fontFamily:'inherit', fontSize:10, fontWeight:400,
            color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            marginTop:2, fontStyle:'italic',
          }}>
            By {mag.user.name}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main: 2 rows × 8 cols PC · 2 cols × 4 rows mobile ────────────────────────
export default function MagazineCovers({ magazines, L }) {
  if (!magazines.length) return null

  const PC_SLOTS = 16   // 8 × 2
  const MB_SLOTS = 4    // 2 × 2

  // Each card shuffles independently every 6–7 s (staggered so they never all flip together)
  const intervals = [6200,6800,7100,6500,7300,6600,7400,6300, 6900,7200,6400,7000,6700,7500,6100,7600]

  const startOf = (i, total) =>
    magazines.length > 1 ? Math.floor((i * magazines.length) / total) : 0

  return (
    <>
      {/* PC grid: 8 columns, 2 rows */}
      <div className="hidden sm:block overflow-x-auto pb-2" style={{ scrollbarWidth:'none' }}>
        <div style={{ display:'grid', gap:'26px 14px', gridTemplateColumns:`repeat(8, ${BOOK_W}px)`, width:'max-content' }}>
          {Array.from({ length: PC_SLOTS }, (_, i) => (
            <BookCard
              key={i}
              magazines={magazines}
              startIdx={startOf(i, PC_SLOTS)}
              intervalMs={intervals[i] || 6500}/>
          ))}
        </div>
      </div>

      {/* Mobile grid: 2 columns */}
      <div className="grid sm:hidden" style={{ gap:'20px 14px', gridTemplateColumns:'repeat(2, 1fr)' }}>
        {Array.from({ length: Math.min(MB_SLOTS, magazines.length * 2) }, (_, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'center' }}>
            <BookCard
              magazines={magazines}
              startIdx={startOf(i, MB_SLOTS)}
              intervalMs={intervals[i] || 6500}/>
          </div>
        ))}
      </div>
    </>
  )
}
