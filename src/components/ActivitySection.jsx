import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const CFG = {
  ongoing:  { label:'Ongoing',  bar:'via-emerald-500', accent:'#34d399', glow:'rgba(16,185,129,0.16)',  dot:'bg-emerald-400', badge:'bg-emerald-900/80 text-emerald-300 border-emerald-700/50', badgeL:'bg-emerald-100 text-emerald-700 border-emerald-400/50' },
  upcoming: { label:'Upcoming', bar:'via-violet-500',  accent:'#a78bfa', glow:'rgba(139,92,246,0.14)', dot:'bg-violet-400',  badge:'bg-violet-900/80 text-violet-300 border-violet-700/50',    badgeL:'bg-violet-100 text-violet-700 border-violet-400/50'   },
  past:     { label:'Ended',    bar:'via-gray-500',    accent:'#9ca3af', glow:'rgba(107,114,128,0.10)',dot:'bg-gray-500',    badge:'bg-gray-800/80 text-gray-400 border-gray-600/50',           badgeL:'bg-gray-200 text-gray-600 border-gray-400/50'         },
}
const sc  = (s) => CFG[s] || CFG.upcoming
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : ''

// ── Gallery slot — cycles photos at its own pace ──────────────────────────────
function GallerySlot({ photos, startIdx, interval }) {
  const n = photos.length
  const [idx, setIdx] = useState(n > 0 ? startIdx % n : 0)
  const [vis, setVis] = useState(true)

  useEffect(() => {
    if (n < 2) return
    const t = setInterval(() => {
      setVis(false)
      setTimeout(() => { setIdx(i => (i + 1) % n); setVis(true) }, 300)
    }, interval)
    return () => clearInterval(t)
  }, [n, interval])

  if (!n) return (
    <div className="w-full h-full flex items-center justify-center rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)' }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.5} className="text-gray-700">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
  )

  return (
    <div className="w-full h-full relative overflow-hidden rounded-lg">
      <img src={photos[idx].imageUrl} alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: vis ? 1 : 0, transition: 'opacity 300ms ease' }} />
    </div>
  )
}

// ── 3-column activity card ────────────────────────────────────────────────────
function ActivityCard({ act, L }) {
  const c      = sc(act.status)
  const photos = (act.gallery || []).filter(g => g.imageUrl)
  const bg     = L ? '#f0f0f4' : '#0a0812'

  return (
    <Link to={`/activities/${act._id}`} className="group block">
      <div className="relative rounded-2xl overflow-hidden transition-transform duration-300 group-hover:-translate-y-1"
        style={{
          border:    `1px solid ${c.accent}28`,
          boxShadow: `0 4px 28px ${c.glow}, 0 2px 10px rgba(0,0,0,0.35)`,
        }}>

        {/* Top accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent ${c.bar} to-transparent z-20`} />

        {/* ── MOBILE LAYOUT (< 640px) ──────────────────────────────────────── */}
        <div className="sm:hidden px-3.5 pt-3.5 pb-3" style={{ background: bg }}>

          {/* Header: square logo + name/status/meta */}
          <div className="flex items-start gap-3">
            {/* Square logo — 64×64 with accent glow */}
            <div className="w-[64px] h-[64px] shrink-0 rounded-xl overflow-hidden"
              style={{
                border:    `1px solid ${c.accent}35`,
                boxShadow: `0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px ${c.accent}18`,
              }}>
              {act.bannerUrl
                ? <img src={act.bannerUrl} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${c.accent}40, rgba(10,8,18,0.9))` }}>
                    <span className="font-clash font-black text-2xl" style={{ color: c.accent }}>
                      {act.name[0]}
                    </span>
                  </div>}
            </div>

            {/* Name + status badges + venue/date */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {CFG[act.status] && (
                  <span className={`font-inter font-bold uppercase tracking-wider rounded-full border text-[8px] px-1.5 py-0.5 ${L ? c.badgeL : c.badge}`}>
                    {c.label}
                  </span>
                )}
                {act.status === 'ongoing' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                )}
                {act.showNewBadge && (
                  <span className="font-inter text-[8px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase font-bold animate-pulse">NEW</span>
                )}
              </div>
              <p className={`font-inter font-bold text-[14px] leading-snug truncate ${L ? 'text-gray-900' : 'text-white'}`}>
                {act.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {act.venue     && <span className="font-inter text-[10px] text-gray-500">📍 {act.venue}</span>}
                {act.eventDate && <span className="font-inter text-[10px] text-gray-500">📅 {fmt(act.eventDate)}</span>}
              </div>
            </div>
          </div>

          {/* Subject — prominently shown, accent colored */}
          {act.subject && (
            <p className="font-inter font-semibold text-[13px] mt-2.5 leading-snug" style={{ color: c.accent }}>
              {act.subject}
            </p>
          )}

          {/* Description — scrollable when text overflows */}
          {act.description && (
            <div className="mt-1.5 max-h-[96px] overflow-y-auto pr-0.5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
              <p className={`font-inter text-[11.5px] leading-relaxed ${L ? 'text-gray-600' : 'text-gray-400'}`}>
                {act.description}
              </p>
            </div>
          )}

          {/* Divider + 2-photo 1×2 grid */}
          {photos.length > 0 && (
            <>
              <div className={`mt-2.5 mb-2 h-px ${L ? 'bg-black/6' : 'bg-white/8'}`} />
              <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden" style={{ height: 118 }}>
                <GallerySlot photos={photos} startIdx={0}                               interval={3500} />
                <GallerySlot photos={photos} startIdx={Math.floor(photos.length * 0.5)} interval={4100} />
              </div>
            </>
          )}

          {/* Bottom row */}
          <div className="flex items-center mt-2">
            {act.status !== 'past' && act.formPublished && act.googleFormUrl && (
              <span className="font-inter text-[10px] text-violet-400">📋 Register</span>
            )}
            <span className={`ml-auto font-inter text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-300 ${L ? 'text-gray-400' : 'text-gray-500'}`}>
              View details →
            </span>
          </div>
        </div>

        {/* ── DESKTOP LAYOUT (≥ 640px) ─────────────────────────────────────── */}
        <div className="hidden sm:flex act-card-body" style={{ background: bg }}>

          {/* ─ Division 1: Banner photo ─ */}
          <div className="act-photo-div">
            {act.bannerUrl
              ? <img src={act.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              : <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#0d0720,#0a0a1e)' }}>
                  <span className="font-clash font-black"
                    style={{ fontSize: 'clamp(50px,8vw,90px)', color: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}>
                    {act.name[0]}
                  </span>
                </div>}
            <div className="act-photo-fade-r absolute inset-y-0 right-0 w-10 z-10"
              style={{ background: `linear-gradient(to right, transparent, ${bg})` }} />
          </div>

          {/* ─ Division 2: Activity info ─ */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 px-5 py-4 z-10 overflow-hidden">
            <div className="flex-1 min-h-0 act-info-scroll pr-0.5 mb-2.5">
              <div className="flex items-center gap-2 mb-2">
                {CFG[act.status] && (
                  <span className={`font-inter font-bold uppercase tracking-wider rounded-full border text-[9px] px-2 py-0.5 ${L ? c.badgeL : c.badge}`}>
                    {c.label}
                  </span>
                )}
                {act.status === 'ongoing' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                )}
                {act.showNewBadge && (
                  <span className="font-inter text-[9px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase font-bold animate-pulse">
                    NEW
                  </span>
                )}
              </div>
              <p className={`font-inter font-bold leading-tight mb-1 ${L ? 'text-gray-900' : 'text-white'}`}
                style={{ fontSize: 'clamp(15px,1.7vw,21px)' }}>
                {act.name}
              </p>
              {act.subject && (
                <p className="font-inter font-semibold text-[13px] mb-2" style={{ color: c.accent }}>
                  {act.subject}
                </p>
              )}
              {act.description && (
                <p className={`act-desc font-inter text-[12px] leading-relaxed ${L ? 'text-gray-500' : 'text-gray-400'}`}>
                  {act.description}
                </p>
              )}
            </div>
            <div className={`flex-shrink-0 flex items-center gap-3 flex-wrap pt-2 border-t ${L ? 'border-black/6' : 'border-white/6'}`}>
              {act.venue     && <span className="font-inter text-[10px] text-gray-500">📍 {act.venue}</span>}
              {act.eventDate && <span className="font-inter text-[10px] text-gray-500">📅 {fmt(act.eventDate)}</span>}
              {act.status !== 'past' && act.formPublished && act.googleFormUrl && (
                <span className="font-inter text-[10px] text-violet-400">📋 Register</span>
              )}
              <span className={`ml-auto font-inter text-[11px] opacity-0 group-hover:opacity-100 transition-all duration-300 ${L ? 'text-gray-400' : 'text-gray-500'}`}>
                View →
              </span>
            </div>
          </div>

          {/* ─ Division 3: 2×2 cycling gallery ─ */}
          <div className="act-gallery-div">
            <div className="absolute inset-y-0 left-0 w-6 z-10 pointer-events-none"
              style={{ background: `linear-gradient(to right, ${bg}, transparent)` }} />
            <div className="absolute inset-0 grid grid-cols-2 gap-1.5 p-3">
              <GallerySlot photos={photos} startIdx={0}                                interval={3200} />
              <GallerySlot photos={photos} startIdx={Math.floor(photos.length * 0.25)} interval={2700} />
              <GallerySlot photos={photos} startIdx={Math.floor(photos.length * 0.5)}  interval={3800} />
              <GallerySlot photos={photos} startIdx={Math.floor(photos.length * 0.75)} interval={2400} />
            </div>
            {photos.length > 0 && (
              <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full px-1.5 py-0.5"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
                <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <rect x="3" y="3" width="13" height="13" rx="2"/>
                  <path d="M8 21h13a2 2 0 0 0 2-2V8"/>
                </svg>
                <span className="font-inter text-[8px] font-bold text-white">{photos.length}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </Link>
  )
}

// ── Carousel — slides between activities, drag/swipe supported ────────────────
export function ActivityCarousel({ activities, L }) {
  const visible = activities
  const n       = visible.length
  const [idx,      setIdx]      = useState(0)
  const [phase,    setPhase]    = useState('idle')
  const [dir,      setDir]      = useState(1)
  const [enterKey, setEnterKey] = useState(0)
  const dragRef = useRef({ x: 0, on: false })

  const go = (next) => {
    if (n <= 1) return
    const d = next >= idx ? 1 : -1
    setDir(d)
    setPhase('exit')
    setTimeout(() => {
      setIdx(((next % n) + n) % n)
      setEnterKey(k => k + 1)
      setPhase('enter')
      setTimeout(() => setPhase('idle'), 380)
    }, 210)
  }

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(() => go(idx + 1), 9000)
    return () => clearInterval(t)
  }, [idx, n])

  const onStart = (e) => { dragRef.current = { x: e.clientX ?? e.touches?.[0]?.clientX ?? 0, on: true } }
  const onEnd   = (e) => {
    if (!dragRef.current.on) return
    dragRef.current.on = false
    const ex = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0
    if (Math.abs(dragRef.current.x - ex) < 40) return
    go(dragRef.current.x - ex > 0 ? idx + 1 : idx - 1)
  }

  if (n === 0) return (
    <div className={`flex flex-col items-center justify-center py-16 gap-3 opacity-40 rounded-2xl border ${L ? 'border-black/6' : 'border-white/6'}`}>
      <p className="text-3xl">📸</p>
      <p className={`font-inter text-sm ${L ? 'text-gray-500' : 'text-gray-600'}`}>No activities yet</p>
    </div>
  )

  const act = visible[idx]

  const slideStyle = phase === 'exit'
    ? { transform: `translateX(${dir * -52}px)`, opacity: 0, transition: 'transform 0.21s ease-in,opacity 0.21s ease-in' }
    : phase === 'enter'
      ? { animation: `${dir > 0 ? 'slideInFromRight' : 'slideInFromLeft'} 0.38s cubic-bezier(0.22,1,0.36,1) both` }
      : {}

  return (
    <div className="flex flex-col gap-3 select-none"
      onMouseDown={onStart} onMouseUp={onEnd} onMouseLeave={onEnd}
      onTouchStart={onStart} onTouchEnd={onEnd}>

      {/* Card — height driven by the card itself */}
      <div className="overflow-hidden">
        <div key={enterKey} className="w-full" style={slideStyle}>
          <ActivityCard act={act} L={L} />
        </div>
      </div>

      {/* Dots + arrows */}
      {n > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => go(idx - 1)}
            className="act-neo-ghost w-7 h-7 rounded-full flex items-center justify-center text-white/60"
            style={{ fontSize: '16px' }}>
            <span className="relative z-[2]">‹</span>
          </button>

          <div className="flex items-center gap-1.5">
            {visible.map((_, i) => (
              <button key={i} onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === idx
                    ? `h-1.5 w-6 ${sc(visible[i].status).dot}`
                    : 'h-1.5 w-1.5 bg-white/20 hover:bg-white/40'
                }`} />
            ))}
          </div>

          <button onClick={() => go(idx + 1)}
            className="act-neo-ghost w-7 h-7 rounded-full flex items-center justify-center text-white/60"
            style={{ fontSize: '16px' }}>
            <span className="relative z-[2]">›</span>
          </button>
        </div>
      )}

      {n > 1 && (
        <p className="text-center font-inter text-[9px] text-gray-600 -mt-1">{idx + 1} of {n}</p>
      )}
    </div>
  )
}
