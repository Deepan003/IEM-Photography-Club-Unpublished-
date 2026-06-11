import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../App.jsx'
import { PHOTO_FACTS_DATA } from '../data/photoFacts.js'

const FACTS = PHOTO_FACTS_DATA

// ── Photography fact placeholder ───────────────────────────────────────────────
export function PhotoFactCard({ L, compact = false }) {
  const [idx,     setIdx]     = useState(() => Math.floor(Math.random() * FACTS.length))
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIdx(i => (i + 1) % FACTS.length); setVisible(true) }, 380)
    }, 9000)
    return () => clearInterval(t)
  }, [])
  const fact   = FACTS[idx]
  const cardBg = L ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.025)'
  const shad   = L
    ? 'inset 2px 2px 5px rgba(0,0,0,0.05),inset -2px -2px 5px rgba(255,255,255,0.7)'
    : 'inset 2px 2px 5px rgba(255,255,255,0.02),inset -2px -2px 5px rgba(0,0,0,0.6)'
  return (
    <div className={`relative rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center h-full border ${L?'border-black/6':'border-white/6'} ${compact?'p-3':'p-5 sm:p-6'}`}
      style={{ background:cardBg, backdropFilter:'blur(12px)', boxShadow:shad }}>
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage:'radial-gradient(circle at 50% 30%,#dc2626,transparent 65%)' }} />
      <p className={`relative font-inter leading-relaxed mx-auto transition-all duration-450 ${L?'text-gray-600':'text-gray-400'} ${compact?'text-[10px] max-w-[190px]':'text-xs sm:text-sm max-w-[230px]'}`}
        style={{ opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(8px)' }}>
        {fact.f}
      </p>
      <p className={`absolute bottom-2 font-inter text-[7px] uppercase tracking-[0.2em] ${L?'text-gray-400':'text-gray-600'}`}>
        Photography fact
      </p>
    </div>
  )
}

// ── Status config ──────────────────────────────────────────────────────────────
const CFG = {
  ongoing:  { label:'Ongoing',  bar:'via-green-500', accent:'#34d399', glow:'rgba(16,185,129,0.16)', dot:'bg-green-400',  badgeCls:'bg-green-900/80 text-green-300 border-green-700/50',  badgeClsL:'bg-green-100 text-green-700 border-green-400/50'   },
  upcoming: { label:'Upcoming', bar:'via-amber-500', accent:'#fbbf24', glow:'rgba(234,179,8,0.14)',  dot:'bg-amber-400',  badgeCls:'bg-amber-900/80 text-amber-300 border-amber-700/50',  badgeClsL:'bg-amber-100 text-amber-700 border-amber-400/50'   },
  past:     { label:'Ended',    bar:'via-gray-500',  accent:'#9ca3af', glow:'rgba(107,114,128,0.10)',dot:'bg-gray-500',   badgeCls:'bg-gray-800/80 text-gray-400 border-gray-600/50',     badgeClsL:'bg-gray-200 text-gray-600 border-gray-400/50'      },
}

// ── Single competition card ────────────────────────────────────────────────────
function CompCard({ s, L, compact = false }) {
  const { theme } = useTheme()
  const isLight   = L ?? (theme === 'light')
  const c2 = CFG[s.type] || CFG.upcoming  // fallback to upcoming if type unknown
  const t2 = s.comp?.details?.themes?.length ? s.comp.details.themes : []
  if (!s.comp) return <PhotoFactCard L={L} compact={compact} />
  const beamDuration = { ongoing:'2.6s', upcoming:'3.2s', past:'3.8s' }[s.type] || '3s'
  return (
    <div className="relative rounded-[18px] p-[1.5px] h-full overflow-hidden"
      style={{ boxShadow:'0 6px 28px '+c2.glow+',0 2px 10px rgba(0,0,0,0.45)', transition:'transform 0.38s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.38s ease' }}
      onMouseEnter={e=>{ e.currentTarget.style.transform=compact?'scale(1.01)':'translateY(-6px) scale(1.018)'; e.currentTarget.style.boxShadow='0 18px 52px '+c2.glow+',0 8px 24px rgba(0,0,0,0.6)' }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 6px 28px '+c2.glow+',0 2px 10px rgba(0,0,0,0.45)' }}>
      {/* Sweeping border beam — travels left to right */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:`linear-gradient(90deg,transparent 0%,${c2.accent} 35%,rgba(255,255,255,0.95) 50%,${c2.accent} 65%,transparent 100%)`, width:'30%', animation:`accentShine ${beamDuration} ease-in-out infinite` }} />
    <Link to={'/competitions/' + s.comp._id}
      className="group relative rounded-2xl overflow-hidden block h-full"
      style={{ background: isLight ? '#dce1ec' : '#0d0d0d' }}>

      {s.comp.bannerUrl
        ? <img src={s.comp.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
        : <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: isLight ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#1a0010,#0a0a1e)' }}>
            <span className={`font-clash font-black ${isLight ? 'text-black/5' : 'text-white/5'}`} style={{ fontSize:compact?'clamp(36px,9vw,60px)':'clamp(70px,10vw,140px)' }}>{s.comp.name[0]}</span>
          </div>}

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" style={{ height:'50%' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
      <div className={'absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent ' + c2.bar + ' to-transparent z-10'} />

      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
        <span className={`font-inter font-bold uppercase tracking-wider backdrop-blur-sm rounded-full border ${isLight ? c2.badgeClsL : c2.badgeCls} ${compact?'text-[7px] px-1.5 py-0.5':'text-[8px] px-2 py-0.5'}`}>
          {c2.label}
        </span>
        {s.type === 'ongoing' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-10 ${compact?'px-2.5 pb-2 pt-4':'px-4 pb-4 pt-8'}`}>
        <p className={`font-inter font-bold leading-tight drop-shadow-md ${compact?'text-[11px] mb-0.5 truncate':'text-sm sm:text-base mb-1.5'}`}
          style={{ color: isLight ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,1)' }}>{s.comp.name}</p>
        {!compact && t2.length > 0 && <p className="font-inter text-[10px] mb-1" style={{ color:c2.accent }}>{t2[0]}</p>}
        <p className={`font-inter truncate ${compact?'text-[9px]':'text-[10px]'}`}
          style={{ color: isLight ? 'rgba(71,85,105,0.70)' : 'rgba(255,255,255,0.50)' }}>
          {s.type === 'past' && s.comp.winners?.[0]
            ? s.comp.winners[0].name
            : s.comp.endDate && s.type !== 'past'
              ? 'Until ' + new Date(s.comp.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
              : ''}
        </p>
        {!compact && (
          <div className="mt-1.5 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <span className="font-inter text-[11px]" style={{ color: isLight ? 'rgba(71,85,105,0.65)' : 'rgba(255,255,255,0.55)' }}>View details &#8250;</span>
          </div>
        )}
      </div>
    </Link>
    </div>
  )
}

// ── Independent per-slot carousel ─────────────────────────────────────────────
function SlotCarousel({ comps, type, L, compact = false, autoMs = 8000 }) {
  const n                 = comps.length
  const [idx,   setIdx]   = useState(0)
  const [phase, setPhase] = useState('idle')   // 'idle' | 'exit' | 'enter'
  const [dir,   setDir]   = useState(1)        // 1 = forward (→), -1 = backward (←)
  const [enterKey, setEnterKey] = useState(0)  // forces CSS animation restart
  const dragRef = useRef({ x:0, y:0, on:false })

  const go = (next) => {
    if (n <= 1) return
    const d = next >= idx ? 1 : -1
    setDir(d)
    setPhase('exit')
    setTimeout(() => {
      setIdx(((next % n) + n) % n)
      setEnterKey(k => k + 1)
      setPhase('enter')
      setTimeout(() => setPhase('idle'), 320)
    }, 190)
  }

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(() => go(idx + 1), autoMs)
    return () => clearInterval(t)
  }, [idx, n, autoMs])

  const onStart = (e) => {
    dragRef.current = { x: e.clientX ?? e.touches?.[0]?.clientX ?? 0, y: e.clientY ?? e.touches?.[0]?.clientY ?? 0, on:true }
  }
  const onEnd = (e) => {
    if (!dragRef.current.on) return
    dragRef.current.on = false
    const ex = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0
    const ey = e.clientY ?? e.changedTouches?.[0]?.clientY ?? 0
    const dx = dragRef.current.x - ex
    const dy = Math.abs(dragRef.current.y - ey)
    if (dy > Math.abs(dx) || Math.abs(dx) < 36) return
    go(dx > 0 ? idx + 1 : idx - 1)
  }

  const s = { comp: n > 0 ? comps[idx] : null, type }

  // Exit: slide out in the direction of travel; Enter: slide in from opposite side
  const slideStyle = phase === 'exit'
    ? { transform:`translateX(${dir * -48}px)`, opacity:0, transition:'transform 0.19s ease-in,opacity 0.19s ease-in' }
    : phase === 'enter'
      ? { animation:`${dir > 0 ? 'slideInFromRight' : 'slideInFromLeft'} 0.32s cubic-bezier(0.22,1,0.36,1) both` }
      : {}

  return (
    <div className="flex flex-col h-full select-none"
      onMouseDown={onStart} onMouseUp={onEnd} onMouseLeave={onEnd}
      onTouchStart={onStart} onTouchEnd={onEnd}>

      {/* Card with slide animation */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div key={enterKey} className="w-full h-full" style={slideStyle}>
          <CompCard s={s} L={L} compact={compact} />
        </div>
      </div>

      {/* Per-slot dots */}
      {n > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-1.5">
          {comps.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              className={`rounded-full transition-all duration-300 ${
                i === idx
                  ? `h-1 w-4 ${CFG[type].dot}`
                  : 'h-1 w-1 bg-white/25 hover:bg-white/40'
              }`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export function CompetitionSlots({ competitions, L }) {
  const ongoing  = competitions.filter(c => c.status === 'ongoing')
  const upcoming = competitions.filter(c => c.status === 'upcoming')
  const past     = [...competitions].filter(c => c.status === 'past')
                     .sort((a,b) => new Date(b.endDate||0) - new Date(a.endDate||0))

  const slots = [
    { comps: ongoing,  type: 'ongoing',  autoMs: 8000  },
    { comps: upcoming, type: 'upcoming', autoMs: 10000 },
    { comps: past,     type: 'past',     autoMs: 12000 },
  ]

  return (
    <div>
      {/* PC: 3 independent columns */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4" style={{ height:'clamp(260px,28vw,390px)' }}>
        {slots.map((sl, i) => (
          <SlotCarousel key={i} comps={sl.comps} type={sl.type} L={L} autoMs={sl.autoMs} />
        ))}
      </div>

      {/* Mobile: 3 independent stacked rows */}
      <div className="sm:hidden flex flex-col gap-2" style={{ height:'clamp(360px,76vw,440px)' }}>
        {slots.map((sl, i) => (
          <div key={i} className="flex-1 min-h-0">
            <SlotCarousel comps={sl.comps} type={sl.type} L={L} compact autoMs={sl.autoMs} />
          </div>
        ))}
      </div>
    </div>
  )
}
