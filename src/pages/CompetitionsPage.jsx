import { useState, useEffect, useRef } from 'react'
import { Link, useParams }   from 'react-router-dom'
import PageLayout            from '../components/PageLayout.jsx'
import GlassButton           from '../components/GlassButton.jsx'
import ImageUpload           from '../components/ImageUpload.jsx'
import DriveLinkBanner       from '../components/DriveLinkBanner.jsx'
import ProgressiveImage      from '../components/ProgressiveImage.jsx'
import { computeAcademicYear, isCurrentSession, getItemSession, getPrimaryItemDate, currentSession } from '../utils/yearCalc.js'
import { competitionsApi, uploadFileToS3, settingsApi } from '../api/api.js'
import { generateWinnersPDF } from '../utils/winnersPdf.js'
import { useTheme, useAuth } from '../App.jsx'
import { useData }           from '../hooks/useData.js'
import ContextAnnouncementStudio from '../components/announcement/ContextAnnouncementStudio.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { SkeletonCardGrid } from '../components/Skeleton.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusCfg = {
  ongoing:  { label:'Ongoing',  badge:'bg-green-900/60 text-green-300 border-green-700/50',   glow:'rgba(16,185,129,0.14)', stripe:'via-green-500' },
  upcoming: { label:'Upcoming', badge:'bg-yellow-900/60 text-yellow-300 border-yellow-700/50',glow:'rgba(234,179,8,0.12)',  stripe:'via-yellow-500' },
  past:     { label:'Ended',    badge:'bg-gray-800/60 text-gray-400 border-gray-700/40',      glow:'rgba(107,114,128,0.07)', stripe:'via-gray-600' },
}
const SC = (s) => statusCfg[s] || statusCfg.past
const themes = (c) => c?.details?.themes?.length ? c.details.themes : []

// ── Single theme pill with its own glass cover ────────────────────────────────
function ThemePill({ text, storageKey, L }) {
  const [revealed,  setRevealed]  = useState(() => { try { return localStorage.getItem(storageKey)==='1' } catch { return false } })
  const [animating, setAnimating] = useState(false)

  const reveal = () => {
    if (revealed || animating) return
    setAnimating(true)
    setTimeout(() => {
      setRevealed(true)
      try { localStorage.setItem(storageKey, '1') } catch {}
    }, 720)
  }

  return (
    <div className="relative inline-flex">
      {/* The actual tag — always in DOM */}
      <span
        className="font-inter text-sm px-4 py-1.5 rounded-xl bg-red-900/20 text-red-400 border border-red-800/35 font-semibold"
        style={{ visibility: revealed ? 'visible' : 'hidden',
                 animation: revealed ? 'themeReveal 0.4s cubic-bezier(0.22,1,0.36,1) both' : 'none' }}>
        {text}
      </span>

      {/* Glass cover — same exact size as the tag, overlaid absolutely */}
      {!revealed && (
        <div
          className="absolute inset-0 rounded-xl cursor-pointer select-none flex items-center justify-center gap-1.5 overflow-hidden"
          style={{
            background:           'rgba(255,255,255,0.08)',
            backdropFilter:       'blur(12px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
            border:               '1px solid rgba(255,255,255,0.16)',
            boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 12px rgba(0,0,0,0.35)',
            animation:            animating ? 'glassShatter 0.72s cubic-bezier(0.25,0.1,0.25,1) forwards' : 'none',
            pointerEvents:        animating ? 'none' : 'auto',
          }}
          onClick={reveal}
        >
          {/* Static gloss top-left */}
          <div className="absolute inset-0 pointer-events-none rounded-xl"
            style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%)' }} />
          {/* Lock icon */}
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="relative shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span className="relative font-inter text-[8px] font-bold uppercase tracking-[0.18em] text-white/50">Reveal</span>
        </div>
      )}
    </div>
  )
}

// ── Theme reveal — each theme has its own glass cover ────────────────────────
function ThemeReveal({ themes, compId, L }) {
  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((t, i) => (
        <ThemePill
          key={i}
          text={t}
          storageKey={`theme_${compId}_${i}`}
          L={L}
        />
      ))}
    </div>
  )
}

// ── Neomorphic card with dynamic shine ───────────────────────────────────────
function ShineCard({ children, className = '', style = {}, L }) {
  const [pos, setPos] = useState({ x:50, y:50, on:false })
  const rafRef = useRef(null)
  const neo = L
    ? { background:'rgba(238,238,242,0.96)', boxShadow:'2px 2px 7px rgba(0,0,0,0.09),-2px -2px 7px rgba(255,255,255,0.72),inset 0 1px 0 rgba(255,255,255,0.65)' }
    : { background:'rgba(11,11,15,0.97)',    boxShadow:'2px 2px 8px rgba(0,0,0,0.85),-1px -1px 2px rgba(255,255,255,0.02),inset 0 1px 0 rgba(255,255,255,0.03)' }
  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 cursor-default ${L?'border-black/[0.07]':'border-white/[0.06]'} ${className}`}
      style={{ ...neo, ...style }}
      onMouseMove={e => {
        // Throttle via rAF so we don't re-render > 60fps
        if (rafRef.current) return
        const cx=e.clientX, cy=e.clientY
        rafRef.current = requestAnimationFrame(() => {
          const r=e.currentTarget?.getBoundingClientRect()
          if (r) setPos({ x:((cx-r.left)/r.width)*100, y:((cy-r.top)/r.height)*100, on:true })
          rafRef.current = null
        })
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px) scale(1.012)' }}
      onMouseLeave={e => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current=null }
        setPos(p=>({...p,on:false})); e.currentTarget.style.transform=''
      }}>

      {/* Animated sweep */}
      <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
        <div style={{ position:'absolute', top:0, bottom:0, width:'38%', background:`linear-gradient(90deg,transparent 0%,rgba(255,255,255,${L?'0.16':'0.055'}) 50%,transparent 100%)`, animation:'shineSweep 4.2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      </div>
      {/* Hover radial */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-200 rounded-xl"
        style={{ opacity:pos.on?1:0, background:`radial-gradient(circle 80px at ${pos.x}% ${pos.y}%,rgba(255,255,255,${L?'0.16':'0.07'}),transparent 70%)` }} />
      {/* Top-left gloss */}
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background:`linear-gradient(135deg,rgba(255,255,255,${L?'0.10':'0.035'}) 0%,transparent 48%)` }} />
      {children}
    </div>
  )
}

// ── Gallery cycling ───────────────────────────────────────────────────────────
function GalleryCycle({ photos }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => setIdx(i => (i+1) % photos.length), 3000)
    return () => clearInterval(t)
  }, [photos.length])
  if (!photos.length) return null
  return (
    <div className="relative w-full h-full overflow-hidden">
      {photos.map((p,i) => (
        <div key={p._id||i} className={`absolute inset-0 transition-opacity duration-700 ${i===idx?'opacity-100':'opacity-0'}`}>
          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )
}

// ── Competition card ──────────────────────────────────────────────────────────
function CompCard({ comp, L, delay = 0, userRole = null }) {
  const enrolled = !!userRole
  const cfg = SC(comp.status)
  const th  = themes(comp)
  const accent = { active:'#34d399', upcoming:'#fbbf24', past:'#9ca3af', draft:'#6b7280' }[comp.status] || '#9ca3af'
  const beamDuration = { ongoing:'2.6s', upcoming:'3.2s', past:'3.8s' }[comp.status] || '3s'
  return (
    <div className="relative rounded-[14px] p-[1.5px] overflow-hidden"
      style={{ boxShadow:`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)`, animation:`wipeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`, transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.4s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px) scale(1.022)'; e.currentTarget.style.boxShadow=`0 14px 44px ${cfg.glow},0 6px 18px rgba(0,0,0,0.55)` }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)` }}>
      {/* Border beam — sweeps left to right */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:`linear-gradient(90deg,transparent 0%,${accent} 35%,rgba(255,255,255,0.9) 50%,${accent} 65%,transparent 100%)`, width:'28%', animation:`accentShine ${beamDuration} ease-in-out infinite` }} />
    <Link to={`/competitions/${comp._id}`}
      className="group relative rounded-[12px] overflow-hidden flex flex-col"
      style={{ background: L ? 'rgba(242,242,246,0.98)' : 'rgba(13,13,17,0.98)' }}>

      {/* Top-left gloss */}
      <div className="absolute inset-0 pointer-events-none z-10 rounded-[12px]"
        style={{ background:`linear-gradient(135deg,rgba(255,255,255,${L?'0.18':'0.05'}) 0%,transparent 45%)` }} />

      {/* Status accent line */}
      <div className={`h-[1.5px] w-full bg-gradient-to-r from-transparent ${cfg.stripe} to-transparent shrink-0 relative z-10`} />

      {/* Banner with name overlay */}
      <div className="relative overflow-hidden shrink-0" style={{ height:'clamp(130px,15vw,175px)' }}>
        {comp.bannerUrl
          ? <ProgressiveImage src={comp.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.07]" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background:'linear-gradient(135deg,#1a0010,#0a0a1e)' }}>
              <span className="font-clash font-black text-white/5" style={{ fontSize:'clamp(60px,8vw,100px)' }}>{comp.name[0]}</span>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" style={{ height:'40%' }} />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {comp.showNewBadge && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">NEW</span>}
          {statusCfg[comp.status] && <span className={`font-inter text-[8px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold backdrop-blur-sm ${cfg.badge}`}>{cfg.label}</span>}
          {comp.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />}
        </div>

        {/* Title + themes overlaid */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 z-10">
          <p className="font-inter text-sm font-bold text-white leading-tight drop-shadow-md">{comp.name}</p>
          {th.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {th.slice(0,2).map((t,i) => <span key={i} className="font-inter text-[9px] text-white/55">{t}{i < Math.min(th.length,2)-1 ? ' ·' : ''}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={`flex-1 px-3 py-2.5 space-y-1 relative z-10 ${L?'':'bg-transparent'}`}>
        {comp.details?.prize && <p className={`font-inter text-xs flex items-center gap-1.5 ${L?'text-gray-600':'text-gray-400'}`}>🏅 {comp.details.prize}</p>}
        {comp.endDate && comp.status !== 'past' && <p className={`font-inter text-xs flex items-center gap-1.5 ${L?'text-gray-600':'text-gray-400'}`}>⏰ Until {new Date(comp.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>}
        {comp.status === 'past' && comp.winners?.[0] && <p className="font-inter text-xs flex items-center gap-1.5 text-amber-400">🏆 {comp.winners[0].name}</p>}
        {comp.status !== 'past' && (
          comp.formPublished && comp.googleFormUrl
            ? <p className="font-inter text-xs text-green-400">📋 Form live — Submit now</p>
            : <p className={`font-inter text-xs ${L?'text-gray-400':'text-gray-600'}`}>📋 Form coming soon</p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          {userRole ? (
            <span className={`font-inter text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${userRole==='coordinator'?'text-red-400':'text-emerald-400'}`}>
              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
              {userRole === 'coordinator' ? 'Coordinator' : 'Volunteer'}
            </span>
          ) : <span />}
          <span className={`font-inter text-[11px] flex items-center gap-0.5 transition-all duration-200 group-hover:gap-1.5 ${L?'text-gray-400 group-hover:text-gray-700':'text-gray-600 group-hover:text-gray-300'}`}>
            View details <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </div>
    </Link>
    </div>
  )
}

// ── Past card — grayscale showcase ────────────────────────────────────────────
function PastCard({ comp, L, delay = 0 }) {
  const th = themes(comp)
  return (
    <Link to={`/competitions/${comp._id}`}
      className="group relative rounded-xl overflow-hidden cursor-pointer"
      style={{
        filter:'grayscale(20%) brightness(0.82)',
        boxShadow: L
          ? '3px 3px 10px rgba(0,0,0,0.10),-3px -3px 8px rgba(255,255,255,0.85),inset 0 1px 0 rgba(255,255,255,0.9)'
          : '3px 3px 10px rgba(0,0,0,0.85),-1px -1px 3px rgba(255,255,255,0.04),inset 0 1px 0 rgba(255,255,255,0.05)',
        background: L ? 'rgba(242,242,246,0.98)' : 'rgba(10,10,14,0.98)',
        animation:`wipeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
        transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease, filter 0.35s ease',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-6px) scale(1.022)'; e.currentTarget.style.filter='grayscale(0%) brightness(0.96)'; e.currentTarget.style.boxShadow=L?'6px 6px 16px rgba(0,0,0,0.13),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.95)':'5px 5px 16px rgba(0,0,0,0.95),-1px -1px 4px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.08)' }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.filter='grayscale(20%) brightness(0.82)'; e.currentTarget.style.boxShadow=L?'3px 3px 10px rgba(0,0,0,0.10),-3px -3px 8px rgba(255,255,255,0.85),inset 0 1px 0 rgba(255,255,255,0.9)':'3px 3px 10px rgba(0,0,0,0.85),-1px -1px 3px rgba(255,255,255,0.04),inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      {/* Top-left gloss */}
      <div className="absolute inset-0 pointer-events-none z-10 rounded-xl"
        style={{ background:`linear-gradient(135deg,rgba(255,255,255,${L?'0.15':'0.04'}) 0%,transparent 45%)` }} />
      <div className="relative overflow-hidden" style={{ height:'clamp(120px,13vw,160px)' }}>
        {comp.bannerUrl
          ? <ProgressiveImage src={comp.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-600" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#111,#1a1a2e)' }}>
              <span className="font-clash text-6xl font-black" style={{ color: L ? 'rgba(163,177,200,0.18)' : 'rgba(255,255,255,0.06)' }}>{comp.name[0]}</span>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
        <span className="absolute top-3 left-3 font-inter text-[9px] px-2 py-0.5 rounded-full bg-gray-800/80 text-gray-400 border border-gray-700/50 uppercase tracking-wider backdrop-blur-sm">Ended</span>
        <div className="absolute bottom-3 left-4">
          <p className="font-inter text-sm font-bold text-white leading-tight">{comp.name}</p>
          {th.length > 0 && <p className="font-inter text-[10px] text-gray-400 mt-0.5">{th.join(' · ')}</p>}
        </div>
      </div>
      {comp.winners?.length > 0 && (
        <div className="px-3 py-2 flex items-center gap-2 bg-black/70">
          <span className="text-sm shrink-0">🏆</span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {comp.winners.slice(0,3).map(w => (
              <div key={w._id} className="flex items-center gap-1.5 shrink-0">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                  {w.photoUrl ? <img src={w.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">🏆</div>}
                </div>
                <span className="font-inter text-[10px] text-gray-400 whitespace-nowrap">{w.name}</span>
                <span className="font-inter text-[9px] text-gray-600">·</span>
                <span className="font-inter text-[9px] text-amber-600/80 whitespace-nowrap">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Link>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photo, photos, onClose }) {
  const idx = photos.findIndex(p => p._id === photo._id)
  const [cur, setCur] = useState(idx >= 0 ? idx : 0)
  const [entered, setEntered] = useState(false)
  const touchX = useRef(null)

  useEffect(() => { requestAnimationFrame(() => setEntered(true)) }, [])
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  setCur(c => (c-1+photos.length)%photos.length)
      if (e.key === 'ArrowRight') setCur(c => (c+1)%photos.length)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [photos.length, onClose])

  const p = photos[cur]
  const attr = p?.photographer

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
      style={{
        background: entered ? 'rgba(2,2,4,0.94)' : 'rgba(2,2,4,0)',
        backdropFilter: entered ? 'blur(20px)' : 'blur(0)',
        WebkitBackdropFilter: entered ? 'blur(20px)' : 'blur(0)',
        transition: 'background 280ms ease, backdrop-filter 280ms ease',
      }}
      onClick={onClose}>
      <div className="relative w-full max-w-3xl"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(24px)',
          transition: 'opacity 360ms cubic-bezier(0.22,1,0.36,1), transform 360ms cubic-bezier(0.22,1,0.36,1)',
        }}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - (touchX.current ?? 0)
          if (Math.abs(dx) > 45) setCur(c => dx < 0 ? (c+1)%photos.length : (c-1+photos.length)%photos.length)
          touchX.current = null
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3 px-1">
          {attr ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {attr.userId?.profilePhoto
                ? <img src={attr.userId.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 font-inter font-bold text-xs shrink-0">{(attr.name||'?')[0]}</div>}
              <p className="font-inter text-sm font-medium text-white/80 truncate">{attr.name}</p>
            </div>
          ) : <div className="flex-1" />}
          <span className="font-inter text-[10px] text-white/35 tabular-nums">{cur + 1} / {photos.length}</span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
            style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(6px)' }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Image */}
        <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 30px 80px rgba(0,0,0,0.7)', background:'#111' }}>
          <img src={p?.imageUrl} alt="" key={cur}
            className="w-full object-contain block"
            style={{ maxHeight:'68vh', animation:'quickZoom 280ms ease both' }} />
        </div>

        {/* Caption */}
        {p?.caption && <p className="font-inter text-sm text-gray-400 mt-3 text-center px-2">{p.caption}</p>}

        {/* Navigation */}
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-8 mt-4">
            <button onClick={e => { e.stopPropagation(); setCur(c=>(c-1+photos.length)%photos.length) }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
              style={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(6px)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="font-inter text-xs text-white/30 tabular-nums">{cur+1} / {photos.length}</span>
            <button onClick={e => { e.stopPropagation(); setCur(c=>(c+1)%photos.length) }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
              style={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(6px)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Competition Gallery Tab ────────────────────────────────────────────────────
function CompGalleryTab({ comp, setComp, canUpload, canReorder, isPrivileged, L }) {
  const [photos, setPhotos]         = useState([...(comp.gallery||[])].sort((a,b)=>(a.order||0)-(b.order||0)))
  const [lightbox, setLightbox]     = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [files, setFiles]           = useState([])
  const [previews, setPreviews]     = useState([])
  const [msg, setMsg]               = useState('')
  const [dragIdx, setDragIdx]       = useState(null)
  const [orderChanged, setOrderChanged] = useState(false)
  const [savingOrder, setSavingOrder]   = useState(false)
  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState(null)

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files)
    if (!picked.length) return
    setFiles(picked); setPreviews(picked.map(f => URL.createObjectURL(f))); e.target.value = ''
  }

  const uploadPhotos = async (e) => {
    e.preventDefault()
    if (!files.length) return
    setUploading(true); setMsg(''); setUploadProgress({ current: 0, total: files.length })
    let uploaded = 0
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length })
        const r = await uploadFileToS3(files[i], 'competitions')
        const d = await competitionsApi.addGalleryPhoto(comp._id, { imageUrl: r.publicUrl, s3Key: r.key, mobileUrl: r.mobileUrl, mobileKey: r.mobileKey })
        const newPhoto = d.competition?.gallery?.slice(-1)[0]
        if (newPhoto) setPhotos(p => [...p, newPhoto])
        uploaded++
      }
      setFiles([]); setPreviews([])
      setMsg('Uploaded ' + uploaded + ' photo' + (uploaded>1?'s':'') + '!')
    } catch (err) { setMsg(err.message) }
    finally { setUploading(false); setUploadProgress({ current: 0, total: 0 }) }
  }

  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const reordered = [...photos]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(i, 0, moved)
    setPhotos(reordered); setDragIdx(i); setOrderChanged(true)
  }
  const handleDragEnd = () => setDragIdx(null)

  const savePhotoOrder = async () => {
    setSavingOrder(true)
    try {
      await competitionsApi.reorderGallery(comp._id, photos.map(p => p._id))
      setOrderChanged(false)
    } catch (e) { setMsg('Failed to save order.') }
    finally { setSavingOrder(false) }
  }

  const deletePhoto = async (id) => {
    await competitionsApi.deleteGalleryPhoto(comp._id, id).catch(() => {})
    setPhotos(p => p.filter(x => x._id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Show in Gallery toggle — admin/core only */}
      {isPrivileged && (
        <div className={`flex items-center justify-between py-2.5 px-4 auth-glass rounded-xl border ${L?'border-black/8':'border-white/8'}`}>
          <div>
            <p className={`font-inter text-xs font-semibold ${L?'text-gray-800':'text-gray-200'}`}>Show in Public Gallery</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">Auto = visible when competition is past or active</p>
          </div>
          <div className="flex gap-1.5">
            {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
              const active = val === null ? (comp.showInGallery === null || comp.showInGallery === undefined) : comp.showInGallery === val
              return (
                <button key={lbl} onClick={async () => {
                  await competitionsApi.setGalleryVisibility(comp._id, val).catch(() => {})
                  setComp(c => ({ ...c, showInGallery: val }))
                }}
                  className={`px-3 py-1 rounded-lg font-inter text-[10px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <DriveLinkBanner link={comp.driveLink} L={L}
        label="For the entire competition's photos, visit the Google Drive" />

      {canUpload && (
        <div className={'auth-glass rounded-2xl border p-4 ' + (L?'border-black/8':'border-white/8')}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Upload Photos</p>
          <form onSubmit={uploadPhotos} className="space-y-3">
            {previews.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setFiles(f=>f.filter((_,j)=>j!==i)); setPreviews(p=>p.filter((_,j)=>j!==i)) }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center">x</button>
                  </div>
                ))}
                <label className={'aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer ' + (L?'border-black/12':'border-white/10')}>
                  <span className="font-inter text-xs text-gray-500">+ Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const more=Array.from(e.target.files); setFiles(f=>[...f,...more]); setPreviews(p=>[...p,...more.map(f=>URL.createObjectURL(f))]) }} />
                </label>
              </div>
            ) : (
              <label className={'block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ' + (L?'border-black/12 hover:border-red-600/30':'border-white/10 hover:border-red-600/30')}>
                <div className={'flex flex-col items-center justify-center py-8 ' + (L?'text-gray-400':'text-gray-600')}>
                  <p className="font-inter text-sm">Choose photos (multiple)</p>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              </label>
            )}
            {msg && <p className={'font-inter text-xs ' + (msg.startsWith('Upload')?'text-green-400':'text-red-400')}>{msg}</p>}
            {uploading && (
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-inter text-xs text-gray-400">
                  Uploading {uploadProgress.current} of {uploadProgress.total}…
                </span>
                <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.total ? Math.round(uploadProgress.current / uploadProgress.total * 100) : 0}%` }} />
                </div>
              </div>
            )}
            <GlassButton type="submit" variant="red" disabled={uploading || !files.length}
              className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'42px' }}>
              {uploading ? 'Uploading...' : 'Upload ' + (files.length > 0 ? files.length + ' Photo' + (files.length>1?'s':'') : 'Photos')}
            </GlassButton>
          </form>
        </div>
      )}
      {photos.length === 0 ? (
        <div className={'py-12 text-center auth-glass rounded-2xl border ' + (L?'border-black/7':'border-white/7')}>
          <p className="font-inter text-sm text-gray-500">No gallery photos yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {canReorder && photos.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="font-inter text-[10px] text-gray-500">Drag to reorder</p>
              {orderChanged && (
                <GlassButton variant="red" disabled={savingOrder} onClick={savePhotoOrder}
                  className="font-inter text-xs" style={{ borderRadius:8, minHeight:28, padding:'0 12px' }}>
                  {savingOrder ? 'Saving...' : 'Save Order'}
                </GlassButton>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {photos.map((p, i) => (
              <div key={p._id}
                className={'group relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ' + (canReorder ? 'cursor-grab active:cursor-grabbing ' : '') + (dragIdx === i ? 'opacity-40 ring-2 ring-red-500' : '')}
                draggable={!!canReorder}
                onDragStart={() => canReorder && handleDragStart(i)}
                onDragOver={e => canReorder && handleDragOver(e, i)}
                onDragEnd={() => canReorder && handleDragEnd()}
                onClick={() => !dragIdx && setLightbox(p)}>
                <ProgressiveImage src={p.imageUrl} mobileSrc={p.mobileUrl} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                {canUpload && (
                  <button onClick={e => { e.stopPropagation(); setDeletePhotoConfirm(p._id) }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs items-center justify-center hidden group-hover:flex">x</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {lightbox && <Lightbox photo={lightbox} photos={photos} onClose={() => setLightbox(null)} />}
      <ConfirmDialog
        open={!!deletePhotoConfirm}
        title="Delete Photo?"
        message="This photo will be permanently deleted and cannot be recovered."
        confirmLabel="Yes, Delete"
        onConfirm={() => { deletePhoto(deletePhotoConfirm); setDeletePhotoConfirm(null) }}
        onCancel={() => setDeletePhotoConfirm(null)}
      />
    </div>
  )
}

// CompAnnouncementsTab replaced by ContextAnnouncementStudio

// ── Celebration overlay — fires once when winners tab opens ──────────────────
function CelebrationOverlay({ compId }) {
  const key = `celeb_${compId}`
  const [phase, setPhase] = useState('idle') // idle → show → done

  useEffect(() => {
    // Show every time winners tab opens
    setPhase('show')
    const t = setTimeout(() => setPhase('done'), 3800)
    return () => clearTimeout(t)
  }, [])

  if (phase !== 'show') return null

  return (
    <div className="fixed inset-0 z-[9995] pointer-events-none flex items-center justify-center overflow-hidden"
      style={{ animation:'celebFill 3.8s ease forwards, celebContract 3.8s ease forwards' }}>
      {/* Gradient fill */}
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(135deg,rgba(220,38,38,0.85) 0%,rgba(139,92,246,0.85) 35%,rgba(59,130,246,0.85) 65%,rgba(16,185,129,0.85) 100%)' }} />
      {/* Text */}
      <div className="relative z-10 text-center px-6" style={{ animation:'celebText 3.8s ease forwards' }}>
        <p className="font-clash text-2xl sm:text-4xl font-black text-white drop-shadow-2xl leading-tight">
          Congratulations to each and everyone
        </p>
        <p className="font-inter text-base sm:text-xl text-white/80 mt-2 font-medium">
          for participating
        </p>
      </div>
    </div>
  )
}

// ── Winners tab — celebrated podium view + manage ─────────────────────────────
function WinnersTab({ comp, setComp, canManage, L }) {
  const [newW,      setNewW]      = useState({ name:'', label:'1st Prize' })
  const [portrait,  setPortrait]  = useState(null)
  const [winningPic,setWinningPic]= useState(null)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState('')
  const [viewer,        setViewer]        = useState(null) // { w, idx }
  const [portraitViewer,setPortraitViewer]= useState(null) // winner with portrait photo
  const [uploadResetKey, setUploadResetKey] = useState(0) // force-remounts ImageUpload after add
  const [pdfBusy, setPdfBusy] = useState(false)

  const refresh = async () => { const d = await competitionsApi.get(comp._id); setComp(d.competition) }

  const add = async () => {
    if (!newW.name) return
    setBusy(true); setMsg('')
    try {
      await competitionsApi.addWinner(comp._id, { ...newW, photoUrl:portrait?.publicUrl, photoS3Key:portrait?.key, winningPhotoUrl:winningPic?.publicUrl, winningPhotoS3Key:winningPic?.key })
      setNewW({ name:'', label:'1st Prize' }); setPortrait(null); setWinningPic(null)
      setUploadResetKey(k => k + 1) // reset ImageUpload previews
      setMsg('Added!'); refresh()
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const downloadPDF = async () => {
    setPdfBusy(true)
    try { await generateWinnersPDF(comp) }
    catch (e) { console.error('PDF error:', e) }
    finally { setPdfBusy(false) }
  }

  const saveEdit = async () => {
    setBusy(true); setMsg('')
    try {
      const body = { name:editData.name, label:editData.label }
      if (editData._newPortrait) { body.photoUrl=editData._newPortrait.publicUrl; body.photoS3Key=editData._newPortrait.key }
      if (editData._newWinning)  { body.winningPhotoUrl=editData._newWinning.publicUrl; body.winningPhotoS3Key=editData._newWinning.key }
      await competitionsApi.updateWinner(comp._id, editId, body)
      setEditId(null); setEditData(null); refresh()
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const winners = comp.winners || []
  const MEDAL_CLR = ['#FFD700','#C0C0C0','#CD7F32'] // gold, silver, bronze
  const PODIUM_BG = [
    'linear-gradient(135deg,#92400e,#78350f)',
    'linear-gradient(135deg,#374151,#1f2937)',
    'linear-gradient(135deg,#7c4a00,#5a3500)',
  ]

  return (
    <div className="space-y-5">

      {/* Celebration animation — fires each time winners tab opens */}
      <CelebrationOverlay compId={comp._id} key={comp._id} />

      {winners.length === 0 && !canManage && (
        <div className={'py-12 text-center auth-glass rounded-2xl border ' + (L?'border-black/7':'border-white/7')}>
          <p className={'font-inter text-sm ' + (L?'text-gray-400':'text-gray-600')}>Winners will be announced soon.</p>
        </div>
      )}

      {/* ── Podium: mobile = 1st full then 2nd+3rd; desktop = 2nd|1st|3rd ── */}
      {winners.length > 0 && (
        <div className="space-y-3">
          {/* Mobile: 1st full-width on top */}
          <div className="sm:hidden">
            <WinnerCard w={winners[0]} i={0} medalClr={MEDAL_CLR[0]} podiumBg={PODIUM_BG[0]} canManage={canManage} featured mobile
              onView={() => setViewer({ w:winners[0], idx:0 })}
              onViewPortrait={() => winners[0].photoUrl && setPortraitViewer(winners[0])}
              onEdit={() => { setEditId(winners[0]._id); setEditData({ name:winners[0].name, label:winners[0].label, photoUrl:winners[0].photoUrl||'', winningPhotoUrl:winners[0].winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
              onDelete={async () => { await competitionsApi.deleteWinner(comp._id, winners[0]._id); refresh() }}
              editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={0} />
            {winners.length > 1 && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {winners.slice(1,3).map((w,i) => (
                  <WinnerCard key={w._id} w={w} i={i+1} medalClr={MEDAL_CLR[i+1]||'rgba(255,255,255,0.3)'} podiumBg={PODIUM_BG[i+1]||PODIUM_BG[2]} canManage={canManage} mobile
                    onView={() => setViewer({ w, idx:i+1 })}
                    onViewPortrait={() => w.photoUrl && setPortraitViewer(w)}
                    onEdit={() => { setEditId(w._id); setEditData({ name:w.name, label:w.label, photoUrl:w.photoUrl||'', winningPhotoUrl:w.winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
                    onDelete={async () => { await competitionsApi.deleteWinner(comp._id, w._id); refresh() }}
                    editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={(i+1)*100} />
                ))}
              </div>
            )}
          </div>

          {/* Desktop: classic podium 2nd|1st|3rd */}
          <div className="hidden sm:grid gap-4" style={{ gridTemplateColumns: winners.length === 1 ? '1fr' : winners.length === 2 ? '1fr 1fr' : '1fr 1.25fr 1fr', alignItems:'end' }}>
            {winners[1] && (
              <WinnerCard w={winners[1]} i={1} medalClr={MEDAL_CLR[1]} podiumBg={PODIUM_BG[1]} canManage={canManage}
                onView={() => setViewer({ w:winners[1], idx:1 })}
                onViewPortrait={() => winners[1].photoUrl && setPortraitViewer(winners[1])}
                onEdit={() => { setEditId(winners[1]._id); setEditData({ name:winners[1].name, label:winners[1].label, photoUrl:winners[1].photoUrl||'', winningPhotoUrl:winners[1].winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
                onDelete={async () => { await competitionsApi.deleteWinner(comp._id, winners[1]._id); refresh() }}
                editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={100} />
            )}
            <WinnerCard w={winners[0]} i={0} medalClr={MEDAL_CLR[0]} podiumBg={PODIUM_BG[0]} canManage={canManage} featured
              onView={() => setViewer({ w:winners[0], idx:0 })}
              onViewPortrait={() => winners[0].photoUrl && setPortraitViewer(winners[0])}
              onEdit={() => { setEditId(winners[0]._id); setEditData({ name:winners[0].name, label:winners[0].label, photoUrl:winners[0].photoUrl||'', winningPhotoUrl:winners[0].winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
              onDelete={async () => { await competitionsApi.deleteWinner(comp._id, winners[0]._id); refresh() }}
              editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={0} />
            {winners[2] && (
              <WinnerCard w={winners[2]} i={2} medalClr={MEDAL_CLR[2]} podiumBg={PODIUM_BG[2]} canManage={canManage}
                onView={() => setViewer({ w:winners[2], idx:2 })}
                onViewPortrait={() => winners[2].photoUrl && setPortraitViewer(winners[2])}
                onEdit={() => { setEditId(winners[2]._id); setEditData({ name:winners[2].name, label:winners[2].label, photoUrl:winners[2].photoUrl||'', winningPhotoUrl:winners[2].winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
                onDelete={async () => { await competitionsApi.deleteWinner(comp._id, winners[2]._id); refresh() }}
                editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={200} />
            )}
          </div>

          {/* 4th+ winners */}
          {winners.length > 3 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {winners.slice(3).map((w,i) => (
                <WinnerCard key={w._id} w={w} i={i+3} medalClr="rgba(255,255,255,0.25)" podiumBg="linear-gradient(135deg,#1f2937,#111827)" canManage={canManage}
                  onView={() => setViewer({ w, idx:i+3 })}
                  onViewPortrait={() => w.photoUrl && setPortraitViewer(w)}
                  onEdit={() => { setEditId(w._id); setEditData({ name:w.name, label:w.label, photoUrl:w.photoUrl||'', winningPhotoUrl:w.winningPhotoUrl||'', _newPortrait:null, _newWinning:null }) }}
                  onDelete={async () => { await competitionsApi.deleteWinner(comp._id, w._id); refresh() }}
                  editId={editId} editData={editData} setEditData={setEditData} saveEdit={saveEdit} cancelEdit={() => { setEditId(null); setEditData(null) }} busy={busy} L={L} delay={(i+3)*80} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Download Results button — visible whenever there are winners */}
      {winners.length > 0 && (
        <div className="flex justify-end">
          <button onClick={downloadPDF} disabled={pdfBusy}
            className={'flex items-center gap-2 px-4 py-2 rounded-xl font-inter text-xs font-semibold border transition-all ' + (pdfBusy ? 'opacity-50 cursor-not-allowed ' : '') + (L ? 'border-amber-600/40 text-amber-600 hover:bg-amber-50' : 'border-amber-600/40 text-amber-400 hover:bg-amber-900/20')}
            style={{ backdropFilter:'blur(8px)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {pdfBusy ? 'Generating PDF…' : 'Download Results'}
          </button>
        </div>
      )}

      {/* Add winner */}
      {canManage && (
        <ShineCard L={L} className="p-4 space-y-3">
          <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] ' + (L?'text-gray-500':'text-gray-400')}>Add Winner</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Name *</label>
              <input value={newW.name} onChange={e=>setNewW(w=>({...w,name:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="Winner name" /></div>
            <div><label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Prize Label</label>
              <input value={newW.label} onChange={e=>setNewW(w=>({...w,label:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="1st Prize" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Portrait</label>
              <ImageUpload key={`portrait-${uploadResetKey}`} folder="competitions" onUpload={r=>setPortrait(r)} label="Upload portrait" preview /></div>
            <div><label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Winning Photo</label>
              <ImageUpload key={`winning-${uploadResetKey}`} folder="competitions" onUpload={r=>setWinningPic(r)} label="Upload photo" preview /></div>
          </div>
          {msg && <p className={'font-inter text-xs ' + (msg==='Added!'?'text-green-400':'text-red-400')}>{msg}</p>}
          <GlassButton variant="red" disabled={busy||!newW.name} onClick={add} className="w-full font-inter text-xs" style={{ borderRadius:'10px', minHeight:'38px' }}>
            {busy ? 'Adding…' : 'Add Winner'}
          </GlassButton>
        </ShineCard>
      )}

      {/* ── Photo Viewer ── */}
      {viewer && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center"
          style={{ background:'rgba(0,0,0,0.92)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)' }}
          onClick={() => setViewer(null)}>
          <div className="relative max-w-4xl w-full mx-4 flex flex-col items-center" onClick={e=>e.stopPropagation()}>
            {/* Animated colored border frame */}
            <div className="relative p-[3px] rounded-2xl overflow-hidden w-full"
              style={{ animation:'winnerViewerBorder 3s linear infinite', border:'3px solid gold' }}>
              {/* Blurred bg version of image */}
              {viewer.w.winningPhotoUrl && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <img src={viewer.w.winningPhotoUrl} alt="" className="w-full h-full object-cover scale-110" style={{ filter:'blur(20px)', opacity:0.3 }} />
                </div>
              )}
              <img src={viewer.w.winningPhotoUrl||viewer.w.photoUrl||''} alt={viewer.w.name}
                className="relative w-full rounded-2xl"
                style={{ maxHeight:'72vh', objectFit:'contain', display:'block' }} />
            </div>

            {/* Photographer info below image */}
            <div className="flex items-center gap-3 mt-4 px-4 py-3 rounded-2xl"
              style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 flex items-center justify-center text-lg"
                style={{ borderColor: MEDAL_CLR[viewer.idx] || 'rgba(255,215,0,0.6)', background:PODIUM_BG[viewer.idx] || '#1f2937' }}>
                {viewer.w.photoUrl ? <img src={viewer.w.photoUrl} alt="" className="w-full h-full object-cover" /> : <span>{viewer.idx===0?'🥇':viewer.idx===1?'🥈':'🥉'}</span>}
              </div>
              <div>
                <p className="font-clash text-base font-bold text-white">{viewer.w.name}</p>
                <p className="font-inter text-xs mt-0.5" style={{ color: MEDAL_CLR[viewer.idx] || '#fbbf24' }}>{viewer.w.label}</p>
              </div>
            </div>

            {/* Nav arrows — on desktop: sides of image | on mobile: below info bar */}
            {winners.length > 1 && (
              <>
                {/* Desktop arrows */}
                <button onClick={() => setViewer(v => ({ w:winners[(v.idx-1+winners.length)%winners.length], idx:(v.idx-1+winners.length)%winners.length }))}
                  className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl items-center justify-center transition-all">‹</button>
                <button onClick={() => setViewer(v => ({ w:winners[(v.idx+1)%winners.length], idx:(v.idx+1)%winners.length }))}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl items-center justify-center transition-all">›</button>
                {/* Mobile arrows — below info, not overlapping photo */}
                <div className="flex sm:hidden gap-4 mt-3">
                  <button onClick={() => setViewer(v => ({ w:winners[(v.idx-1+winners.length)%winners.length], idx:(v.idx-1+winners.length)%winners.length }))}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-all">‹</button>
                  <span className="font-inter text-xs text-white/50 self-center">{viewer.idx+1} / {winners.length}</span>
                  <button onClick={() => setViewer(v => ({ w:winners[(v.idx+1)%winners.length], idx:(v.idx+1)%winners.length }))}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-all">›</button>
                </div>
              </>
            )}
            <button onClick={()=>setViewer(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/70 hover:text-white flex items-center justify-center text-sm transition-all">✕</button>
          </div>
        </div>
      )}

      {/* ── Portrait viewer ── */}
      {portraitViewer && (
        <div className="fixed inset-0 z-[402] flex items-center justify-center"
          style={{ background:'rgba(0,0,0,0.88)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)' }}
          onClick={() => setPortraitViewer(null)}>
          <div className="relative flex flex-col items-center gap-5 p-6" onClick={e=>e.stopPropagation()}>
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 shrink-0"
              style={{ borderColor: MEDAL_CLR[winners.indexOf(portraitViewer)] || '#FFD700', boxShadow:`0 0 60px ${MEDAL_CLR[winners.indexOf(portraitViewer)]||'#FFD700'}66, 0 0 120px ${MEDAL_CLR[winners.indexOf(portraitViewer)]||'#FFD700'}22`, animation:'siriGlow 4s linear infinite' }}>
              <img src={portraitViewer.photoUrl} alt={portraitViewer.name} className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <p className="font-clash text-2xl font-bold text-white">{portraitViewer.name}</p>
              <p className="font-inter text-sm mt-1 font-semibold" style={{ color: MEDAL_CLR[winners.indexOf(portraitViewer)] || '#FFD700' }}>{portraitViewer.label}</p>
            </div>
            <button onClick={()=>setPortraitViewer(null)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all text-sm">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Winner card sub-component
function WinnerCard({ w, i, medalClr, podiumBg, canManage, featured, mobile, onView, onViewPortrait, onEdit, onDelete, editId, editData, setEditData, saveEdit, cancelEdit, busy, L, delay }) {
  if (editId === w._id) {
    return (
      <ShineCard L={L} className="p-4 space-y-3">
        <p className="font-inter text-[10px] text-red-400 uppercase tracking-widest">Editing</p>
        <input value={editData.name} onChange={e=>setEditData(v=>({...v,name:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="Name" />
        <input value={editData.label} onChange={e=>setEditData(v=>({...v,label:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="Label" />
        <div className="flex gap-2">
          <GlassButton variant="red" disabled={busy||!editData.name} onClick={saveEdit} className="font-inter text-xs px-4" style={{ borderRadius:'8px', minHeight:'32px' }}>{busy?'Saving…':'Save'}</GlassButton>
          <GlassButton onClick={cancelEdit} className="font-inter text-xs px-4" style={{ borderRadius:'8px', minHeight:'32px' }}>Cancel</GlassButton>
        </div>
      </ShineCard>
    )
  }

  const cardH   = mobile ? (featured ? 200 : 160) : (featured ? 380 : 280)
  const portraitSz = mobile ? 30 : 40

  return (
    <div className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{
        height: cardH,
        animation: `winnerCardIn 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
        boxShadow: `0 0 0 2px ${medalClr}, 0 8px 32px rgba(0,0,0,0.5), 0 0 ${featured?50:25}px ${medalClr}44`,
        transition: 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform=`translateY(-${featured?8:5}px) scale(${featured?1.024:1.016})`; e.currentTarget.style.boxShadow=`0 0 0 2px ${medalClr}, 0 20px 60px rgba(0,0,0,0.7), 0 0 ${featured?90:50}px ${medalClr}66` }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 0 0 2px ${medalClr}, 0 8px 32px rgba(0,0,0,0.5), 0 0 ${featured?50:25}px ${medalClr}44` }}
      onClick={onView}>

      {/* Full-bleed image */}
      {w.winningPhotoUrl
        ? <img src={w.winningPhotoUrl} alt={w.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700" />
        : <div className="absolute inset-0" style={{ background:podiumBg }}>
            <div className="w-full h-full flex items-center justify-center">
              <span style={{ fontSize: featured ? 72 : 52 }}>{i===0?'🥇':i===1?'🥈':'🥉'}</span>
            </div>
          </div>
      }

      {/* Travelling shine */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div style={{ position:'absolute', top:0, bottom:0, width:'28%', background:`linear-gradient(90deg,transparent,${medalClr}18,rgba(255,255,255,0.1),${medalClr}18,transparent)`, animation:`winnerShine ${3.2+i*0.6}s ease-in-out infinite` }} />
      </div>

      {/* Vignette — strong at bottom for name readability */}
      <div className="absolute inset-0 z-10" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.35) 40%,transparent 70%)' }} />

      {/* Name + portrait overlaid at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-2.5 sm:px-3 py-2.5 flex items-center gap-2"
        onClick={e=>e.stopPropagation()}>
        {/* Portrait — clickable */}
        <button
          onClick={e => { e.stopPropagation(); onViewPortrait?.() }}
          className="shrink-0 rounded-full overflow-hidden border-2 flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110 active:scale-95"
          style={{ width:portraitSz, height:portraitSz, minWidth:portraitSz, borderColor:medalClr, background:podiumBg, boxShadow:`0 0 12px ${medalClr}99`, cursor:w.photoUrl?'pointer':'default' }}>
          {w.photoUrl ? <img src={w.photoUrl} alt="" className="w-full h-full object-cover" /> : <span style={{ fontSize:mobile?11:14 }}>{i===0?'🥇':i===1?'🥈':'🥉'}</span>}
        </button>
        <div className="flex-1 min-w-0 overflow-hidden" onClick={onView}>
          <p className={'font-clash font-black text-white leading-tight ' + (mobile?'text-xs':'text-sm sm:text-base')}
            style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</p>
          <p className={'font-inter font-bold ' + (mobile?'text-[8px]':'text-[10px]')} style={{ color:medalClr, marginTop:1 }}>{w.label}</p>
        </div>
        {featured && <span className="text-base sm:text-xl shrink-0">⭐</span>}
        {canManage && (
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e=>{e.stopPropagation();onEdit()}} className="font-inter text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded bg-black/70 border border-white/20 text-white/70 hover:text-white backdrop-blur-sm">Edit</button>
            <button onClick={e=>{e.stopPropagation();onDelete()}} className="font-inter text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded bg-red-900/70 border border-red-500/30 text-red-400/80 hover:text-red-300 backdrop-blur-sm">Del</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Competition detail page ───────────────────────────────────────────────────
function CompetitionDetailPage({ id }) {
  const { theme } = useTheme()
  const { user  } = useAuth()
  const [comp,        setComp]        = useState(null)
  const [coreMembers, setCoreMembers] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setTab]         = useState('details')
  const [heroIn,      setHeroIn]      = useState(false)
  const L = theme === 'light'

  useEffect(() => {
    competitionsApi.get(id)
      .then(d => { setComp(d.competition); setCoreMembers(d.coreMembers || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
    const t = setTimeout(() => setHeroIn(true), 200)
    return () => clearTimeout(t)
  }, [id])


  if (loading) return (
    <PageLayout title={null}>
      <div className={`min-h-screen ${L ? 'bg-gray-50' : 'bg-[#060608]'}`}>
        <div className="relative overflow-hidden" style={{ minHeight:'clamp(100px,18vw,190px)', background:'#060814' }}>
          <div className="px-4 sm:px-8 pt-4 pb-4 max-w-5xl mx-auto flex items-start gap-3 sm:gap-4">
            <div className="skeleton-shimmer rounded-xl shrink-0" style={{ width:'clamp(64px,9vw,80px)', height:'clamp(64px,9vw,80px)' }} />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton-shimmer rounded-full" style={{ width:64, height:18 }} />
              <div className="skeleton-shimmer rounded-lg" style={{ width:'58%', height:26 }} />
              <div className="skeleton-shimmer rounded" style={{ width:'38%', height:13 }} />
            </div>
          </div>
        </div>
        <div className={`border-b ${L ? 'border-black/5 bg-white' : 'border-white/5 bg-[#060608]'}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 flex gap-6 py-3.5">
            {[58, 48, 62, 70].map((w, i) => <div key={i} className="skeleton-shimmer rounded" style={{ width:w, height:13 }} />)}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-4">
          <div className="skeleton-shimmer rounded-2xl" style={{ height:200 }} />
          <div className="skeleton-shimmer rounded-2xl" style={{ height:120 }} />
        </div>
      </div>
    </PageLayout>
  )
  if (!comp) return (
    <PageLayout><div className="min-h-screen flex items-center justify-center">
      <p className="font-inter text-sm text-gray-400">Competition not found.</p>
    </div></PageLayout>
  )

  const cfg = SC(comp.status)

  // ── Access control ────────────────────────────────────────────────────────────
  const clubRole     = user?.role || null
  const isPrivileged = ['admin','core'].includes(clubRole)
  const excludedIds  = new Set((comp.excludedCores||[]).map(u => typeof u==='object' ? u._id?.toString() : u?.toString()))
  const isImplicitCore = clubRole === 'core' && !excludedIds.has(user?._id?.toString())
  const volEntry       = comp.volunteers?.find(v => {
    const uid = typeof v.user==='object' ? v.user?._id : v.user
    return uid?.toString() === user?._id?.toString()
  })
  const isEnrolled   = isImplicitCore || !!volEntry
  const volRole      = isImplicitCore ? 'coordinator' : (volEntry?.role || null)
  const isCoordinator= volRole === 'coordinator' || isPrivileged
  // Competition details are always public — only Team/Announcements/management tabs require enrollment

  // ── Coordinator permissions ───────────────────────────────────────────────────
  const canUploadGallery   = isPrivileged || (isCoordinator && comp.coordCanManageGallery !== false)
  const canReorderGallery  = canUploadGallery
  const canAnnounce        = isPrivileged || (isCoordinator && comp.coordCanAnnounce !== false)
  const canManageWinners   = isPrivileged || (isCoordinator && comp.coordCanManageWinners === true)
  // Announcements tab is for admin/core + coordinators only, not regular members
  const canSeeAnnouncements = isPrivileged || (volRole === 'coordinator' && comp.coordCanAnnounce !== false)
  const th  = comp.details?.themes || []
  const fmt     = (d) => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const formUrl = (url) => url && !/^https?:\/\//i.test(url) ? 'https://' + url : url

  const allTeamMembers = [...(comp.volunteers || []), ...coreMembers]

  const compEventDateList = comp.eventDates?.length ? comp.eventDates : (comp.eventDate ? [comp.eventDate] : [])
  const infoRows = [
    comp.status && ['Status', cfg.label],
    comp.details?.venue                         && ['Venue',              comp.details.venue],
    comp.prizeEnabled !== false && comp.details?.prize && ['Prize',       comp.details.prize],
    comp.startDate                              && ['Starts',             fmt(comp.startDate)],
    ...compEventDateList.map((d, i) => d && [compEventDateList.length === 1 ? 'Event Date' : i === 0 ? 'Event Date' : `Day ${i + 1}`, fmt(d)]),
    comp.submissionDeadline                     && ['Submit By',          fmt(comp.submissionDeadline)],
    comp.endDate                                && ['Reg. Ends',          fmt(comp.endDate)],
    comp.prizeDistributionDate                  && ['Prize Distribution', fmt(comp.prizeDistributionDate)],
    comp.resultDate                             && ['Results',            fmt(comp.resultDate)],
    ...(comp.customDates||[]).filter(cd=>cd.date).map(cd => [cd.title, fmt(cd.date)]),
  ].filter(Boolean)

  const TABS = [
    { id:'details',    label:'Details' },
    ...(isEnrolled || isPrivileged ? [{ id:'volunteers', label:`Team (${allTeamMembers.length})` }] : []),
    ...(comp.gallery?.length > 0 || canUploadGallery || isEnrolled ? [{ id:'gallery', label:'Gallery' }] : []),
    ...((comp.winners?.length > 0 || canManageWinners) && (!comp.hideWinnersTab || isPrivileged || canManageWinners) ? [{ id:'winners', label:'Winners' }] : []),
    ...(canSeeAnnouncements ? [{ id:'announcements', label:'Announcements' }] : []),
  ]

  return (
    <PageLayout title={null}>
      {/* Siri-style screen edge glow — only on winners tab */}
      {activeTab === 'winners' && (
        <div className="fixed inset-0 pointer-events-none z-[9998] rounded-none"
          style={{ animation:'siriScreenGlow 5s linear infinite' }} />
      )}
      <div className={'min-h-screen ' + (L?'bg-gray-50':'bg-[#060608]')}>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden" style={{ minHeight:'clamp(130px,18vw,190px)' }}>
          {/* Background: blurred logo */}
          <div className="absolute inset-0 bg-[#070710]">
            {comp.bannerUrl && <img src={comp.bannerUrl} alt="" className="w-full h-full object-cover opacity-20" style={{ filter:'blur(10px)', transform:'scale(1.15)' }} />}
            <div className="absolute inset-0" style={{ background:'linear-gradient(160deg,rgba(0,0,0,0.3) 0%,rgba(0,0,0,0.92) 100%)' }} />
            <div className={'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ' + cfg.stripe + ' to-transparent'} />
          </div>

          <div className="relative z-10 px-4 sm:px-8 pt-4 pb-4 max-w-5xl mx-auto"
            style={{ opacity:heroIn?1:0, transform:heroIn?'none':'translateY(8px)', transition:'opacity 0.4s ease 0.1s,transform 0.45s ease 0.1s' }}>

            {/* Row 1: Logo + Title */}
            <div className="flex items-start gap-3 sm:gap-4">
              {comp.bannerUrl && (
                <div className="relative shrink-0 rounded-xl overflow-hidden border border-white/20 shadow-lg" style={{ width:'clamp(44px,8vw,64px)', height:'clamp(44px,8vw,64px)' }}>
                  <ProgressiveImage src={comp.bannerUrl} alt={comp.name} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {/* Badges — own row, no overlap with title */}
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {statusCfg[comp.status] && <span className={'font-inter text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider backdrop-blur-sm ' + cfg.badge}>{cfg.label}</span>}
                  {comp.showNewBadge && <span className="font-inter text-[8px] px-2 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">NEW</span>}
                </div>
                <h1 className="font-clash text-xl sm:text-3xl font-bold text-white leading-tight drop-shadow-lg">{comp.name}</h1>
                <div className="flex flex-wrap gap-x-3 mt-1">
                  {/* On winners tab, show congratulations instead of venue */}
                  {activeTab === 'winners'
                    ? <p className="font-inter text-sm text-amber-400/90 font-semibold">Congratulations to all our winners and participants!</p>
                    : (<>
                        {comp.details?.venue && <p className="font-inter text-[11px] text-white/50">📍 {comp.details.venue}</p>}
                        {compEventDateList[0] && <p className="font-inter text-[11px] text-white/45">📅 {fmt(compEventDateList[0])}</p>}
                      </>)
                  }
                </div>
              </div>
              {/* Submit button */}
              {comp.status !== 'past' && comp.formPublished && comp.googleFormUrl && (
                <a href={formUrl(comp.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 self-start font-inter text-xs font-bold px-3.5 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-all hover:scale-[1.03]"
                  style={{ boxShadow:'0 3px 12px rgba(220,38,38,0.4)' }}>
                  Submit
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── User identity bar — enrollment + designation ── */}
        {user && (
          <div className={'border-b px-4 sm:px-8 py-2.5 ' + (L?'bg-white border-black/5':'bg-[#080810] border-white/5')}>
            <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
              {/* Avatar + name */}
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800 border border-white/15 shrink-0">
                {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center font-clash text-[9px] font-black text-white/50">{user.name?.[0]}</span>}
              </div>
              <span className={'font-inter text-xs font-medium ' + (L?'text-gray-700':'text-gray-300')}>{user.name}</span>
              <span className={'font-inter text-[10px] ' + (L?'text-gray-400':'text-gray-600')}>·</span>
              {isEnrolled ? (
                <span className={'font-inter text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ' + (volRole==='coordinator'?'text-red-400':'text-emerald-400')}>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                  {volRole==='coordinator' ? 'Coordinator' : isImplicitCore ? 'Core (Coordinator)' : 'Volunteer'}
                </span>
              ) : (
                <span className="font-inter text-[10px] text-gray-500 uppercase tracking-wider">Not Enrolled</span>
              )}
              {/* Submit on mobile */}
              {comp.status !== 'past' && comp.formPublished && comp.googleFormUrl && (
                <a href={formUrl(comp.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                  className="ml-auto sm:hidden font-inter text-[10px] font-bold px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-500 transition-colors"
                  style={{ boxShadow:'0 2px 10px rgba(220,38,38,0.3)' }}>
                  Submit
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className={'sticky top-14 z-40 border-b ' + (L?'bg-white/90 border-black/5':'bg-[#060608]/90 border-white/5')} style={{ backdropFilter:'blur(14px)' }}>
          <div className="max-w-5xl mx-auto px-1 sm:px-8 flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex-shrink-0 px-3 sm:px-5 py-2.5 sm:py-3 font-inter text-[10px] sm:text-xs font-medium uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ' + (
                  activeTab === t.id
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent ' + (L?'text-gray-500 hover:text-gray-800':'text-gray-500 hover:text-white')
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4">

          {/* DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">

              {/* Competition banner — natural aspect ratio + animated border */}
              {comp.competitionBannerUrl && (
                <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
                  style={{ boxShadow:`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)` }}>
                  {/* Border beam */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background:`linear-gradient(90deg,transparent 0%,${cfg.stripe.replace('via-','').replace('-500','')==='amber'?'#fbbf24':cfg.stripe.includes('green')?'#34d399':'#9ca3af'} 35%,rgba(255,255,255,0.9) 50%,${cfg.stripe.includes('green')?'#34d399':cfg.stripe.includes('amber')?'#fbbf24':'#9ca3af'} 65%,transparent 100%)`, width:'28%', animation:'accentShine 3s ease-in-out infinite' }} />
                  <img src={comp.competitionBannerUrl} alt={comp.name}
                    className="w-full rounded-2xl block"
                    style={{ objectFit:'contain', maxHeight:'clamp(200px,40vw,360px)', width:'100%' }} />
                </div>
              )}

              {/* Description */}
              {comp.description && (
                <ShineCard L={L} className="p-4">
                  <p className={'font-inter text-sm leading-relaxed ' + (L?'text-gray-600':'text-gray-300')}>{comp.description}</p>
                </ShineCard>
              )}

              {/* Themes — hidden under frosted glass, click to shatter reveal */}
              {th.length > 0 && (
                <div>
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-2.5 ' + (L?'text-gray-500':'text-gray-400')}>Themes</p>
                  <ThemeReveal themes={th} compId={comp._id} L={L} />
                </div>
              )}

              {/* Info tiles */}
              {infoRows.length > 0 && (
                <div>
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-2.5 ' + (L?'text-gray-500':'text-gray-400')}>Competition Info</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {infoRows.map(([k,v]) => (
                      <ShineCard key={k} L={L} className="p-3.5">
                        <p className={'font-inter text-[10px] font-semibold uppercase tracking-wider mb-1.5 ' + (L?'text-gray-400':'text-gray-500')}>{k}</p>
                        <p className={'font-inter text-sm sm:text-base font-bold leading-tight ' + (L?'text-gray-900':'text-white')}>{v}</p>
                      </ShineCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Status selector — admin/core only */}
              {isPrivileged && (
                <div className={`auth-glass rounded-xl border p-4 space-y-2 ${L?'border-black/8':'border-white/8'}`}>
                  <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={async () => {
                        await competitionsApi.setStatus(comp._id, false, '').catch(() => {})
                        setComp(c => ({ ...c, manualStatus: false }))
                      }}
                      className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${!comp.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                      Auto
                    </button>
                    {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                      <button key={lbl}
                        onClick={async () => {
                          await competitionsApi.setStatus(comp._id, true, val).catch(() => {})
                          setComp(c => ({ ...c, manualStatus: true, status: val }))
                        }}
                        className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${comp.manualStatus && comp.status === val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {!comp.manualStatus && <p className="font-inter text-[10px] text-gray-500">Auto — computed from dates. Current: <span className="capitalize text-gray-400">{comp.status || 'upcoming'}</span></p>}
                  {comp.manualStatus && comp.status === '' && <p className="font-inter text-[10px] text-yellow-500">No status badge shown on card</p>}
                  {comp.manualStatus && comp.status !== '' && <p className="font-inter text-[10px] text-gray-500">Manually set to <span className="capitalize text-gray-400">{comp.status}</span></p>}
                </div>
              )}

              {/* Google Form CTA */}
              {comp.status !== 'past' && (
                comp.formPublished && comp.googleFormUrl
                  ? <a href={formUrl(comp.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                      className="relative overflow-hidden flex items-center justify-center w-full font-inter text-sm font-bold py-3.5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0"
                      style={{
                        background:'linear-gradient(135deg,#c62828,#b71c1c)',
                        boxShadow:'3px 3px 10px rgba(0,0,0,0.7),-1px -1px 3px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.12),0 0 20px rgba(220,38,38,0.25)',
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow='3px 3px 14px rgba(0,0,0,0.8),-1px -1px 3px rgba(255,255,255,0.07),inset 0 1px 0 rgba(255,255,255,0.15),0 0 32px rgba(220,38,38,0.4)'}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow='3px 3px 10px rgba(0,0,0,0.7),-1px -1px 3px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.12),0 0 20px rgba(220,38,38,0.25)'}}>
                      {/* Animated sweep */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                        <div style={{ position:'absolute', top:0, bottom:0, width:'35%', background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 50%,transparent 100%)', animation:'shineSweep 3s ease-in-out infinite' }} />
                      </div>
                      {/* Top-left gloss */}
                      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%)' }} />
                      <span className="relative">Submit Your Entry via Google Form</span>
                    </a>
                  : <div className="flex items-center justify-center w-full font-inter text-sm py-3.5 rounded-xl"
                      style={{ background:'rgba(10,10,14,0.95)', boxShadow:'2px 2px 8px rgba(0,0,0,0.8),-1px -1px 2px rgba(255,255,255,0.03),inset 0 1px 0 rgba(255,255,255,0.03)', color:'#6b7280' }}>
                      Google Form — Coming Soon
                    </div>
              )}

              {/* Links — certificates, results, resources */}
              {comp.links?.length > 0 && (
                <div>
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-3 ' + (L?'text-gray-500':'text-gray-400')}>Links &amp; Resources</p>
                  <div className="flex flex-wrap gap-2">
                    {comp.links.map(lnk => {
                      const isCert = lnk.type === 'certificate'
                      const isRes  = lnk.type === 'resource'
                      return (
                        <a key={lnk._id} href={lnk.url.startsWith('http') ? lnk.url : 'https://'+lnk.url} target="_blank" rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-inter text-sm font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                            isCert  ? 'bg-amber-900/20 text-amber-400 border-amber-700/40 hover:bg-amber-900/35'
                            : isRes ? 'bg-blue-900/20 text-blue-400 border-blue-700/40 hover:bg-blue-900/35'
                            :         'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                          }`}>
                          {isCert
                            ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                            : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
                          {lnk.name}
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Rules */}
              {comp.details?.rules && (
                <ShineCard L={L} className="p-4">
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-2.5 ' + (L?'text-gray-400':'text-gray-400')}>Rules &amp; Guidelines</p>
                  <p className={'font-inter text-sm leading-relaxed whitespace-pre-wrap ' + (L?'text-gray-600':'text-gray-300')}>{comp.details.rules}</p>
                </ShineCard>
              )}

              {/* Judges */}
              {comp.judges?.length > 0 && (
                <div>
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-3 ' + (L?'text-gray-500':'text-gray-400')}>Judges</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {comp.judges.map(j => (
                      /* Golden animated border beam wrapper */
                      <div key={j._id} className="relative rounded-[14px] p-[1.5px] overflow-hidden"
                        style={{ boxShadow:'0 4px 20px rgba(217,160,0,0.18),0 2px 8px rgba(0,0,0,0.5)' }}>
                        {/* Golden border sweep */}
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background:'linear-gradient(90deg,transparent 0%,#d4a017 30%,#fde68a 50%,#d4a017 70%,transparent 100%)', width:'30%', animation:'accentShine 2.8s ease-in-out infinite' }} />
                        <ShineCard L={L} className="flex flex-col items-center gap-3 p-4 sm:p-5 text-center rounded-[12px]">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gray-800 border-2 border-amber-600/25 flex items-center justify-center shrink-0 shadow-lg"
                            style={{ boxShadow:'0 0 16px rgba(217,160,0,0.15)' }}>
                            {j.photoUrl ? <img src={j.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-clash text-3xl font-black text-white/30">{j.name[0]}</span>}
                          </div>
                          <div>
                            <p className={'font-inter text-base font-bold leading-tight ' + (L?'text-gray-900':'text-white')}>{j.name}</p>
                            {j.bio && <p className={'font-inter text-xs mt-1 ' + (L?'text-gray-500':'text-gray-500')}>{j.bio}</p>}
                          </div>
                        </ShineCard>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link to="/competitions" className={'font-inter text-sm inline-flex items-center gap-1.5 transition-colors ' + (L?'text-gray-500 hover:text-gray-900':'text-gray-500 hover:text-white')}>
                ← Back to Competitions
              </Link>
            </div>
          )}

          {/* TEAM / VOLUNTEERS */}
          {activeTab === 'volunteers' && (
            <div>
              <p className="font-inter text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-4">
                Competition Team — {allTeamMembers.length} members
              </p>
              {!allTeamMembers.length ? (
                <div className={'py-12 text-center auth-glass rounded-2xl border ' + (L?'border-black/7':'border-white/7')}>
                  <p className={'font-inter text-sm ' + (L?'text-gray-400':'text-gray-600')}>No team members yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                  {allTeamMembers.map((v, i) => {
                    const u = typeof v.user==='object' ? v.user : null
                    if (!u) return null
                    const initials = u.name?.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
                    return (
                      <div key={i} className={'flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl border text-center ' + (L?'border-black/7 bg-white/50':'border-white/7 bg-white/[0.03]')}>
                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-white/10 bg-gray-800 flex items-center justify-center">
                          {u.profilePhoto ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="font-clash text-sm font-black text-white/40">{initials}</span>}
                        </div>
                        <div className="min-w-0 w-full">
                          <p className={'font-inter text-xs font-semibold truncate ' + (L?'text-gray-800':'text-gray-200')}>{u.name}</p>
                          <p className={'font-inter text-[9px] mt-0.5 font-medium uppercase tracking-wider ' + (v.role==='coordinator'?'text-red-400':'text-gray-500')}>{v.role}</p>
                          {u.department && <p className={'font-inter text-[9px] ' + (L?'text-gray-400':'text-gray-600')}>{u.department}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* GALLERY */}
          {activeTab === 'gallery' && (
            <CompGalleryTab comp={comp} setComp={setComp} canUpload={canUploadGallery} canReorder={canReorderGallery} isPrivileged={isPrivileged} L={L} />
          )}

          {/* WINNERS */}
          {activeTab === 'winners' && (
            <WinnersTab comp={comp} setComp={setComp} canManage={canManageWinners} L={L} />
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <ContextAnnouncementStudio
              contextType="competition"
              contextId={comp._id}
              canAnnounce={canAnnounce}
              isPrivileged={isPrivileged}
              coordCanAnnounce={comp.coordCanAnnounce}
              onCoordToggle={isPrivileged ? async val => {
                await competitionsApi.setCoordPerms(comp._id, { coordCanAnnounce: val }).catch(() => {})
                setComp(c => ({ ...c, coordCanAnnounce: val }))
              } : undefined}
              L={L}
            />
          )}
        </div>
      </div>
    </PageLayout>
  )
}

// ── Session divider ───────────────────────────────────────────────────────────
function CompSessionDivider({ session, count, L }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
      <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
        {session} · {count} competition{count !== 1 ? 's' : ''}
      </span>
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const FILTERS = ['all','ongoing','upcoming','past']

export default function CompetitionsPage() {
  const { theme } = useTheme()
  const L = theme === 'light'
  const { id: compId } = useParams()
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const { data, loading } = useData(() => competitionsApi.list(), 5000)
  const { data: sectData } = useData(() => settingsApi.getSections(), 5000)
  const { user } = useAuth()
  const isAdminOrCore = user && ['admin','core'].includes(user.role)
  const showPast = isAdminOrCore || (sectData?.sections?.['show-past-competitions'] !== false)

  if (compId) {
    return <CompetitionDetailPage id={compId} />
  }

  // Enrollment check for explore page sorting + badge — robust null-safe
  const getUserRole = (c) => {
    if (!user || !user._id) return null
    if (user.role === 'core') return 'coordinator'
    if (!Array.isArray(c.volunteers)) return null
    const uid = user._id?.toString()
    const v = c.volunteers.find(v => {
      try {
        const vid = typeof v.user === 'object' ? v.user?._id?.toString() : v.user?.toString()
        return vid && uid && vid === uid
      } catch { return false }
    })
    return v?.role || null
  }

  // Sort: enrolled first → event date → creation date
  const sortWithEnrollment = (arr) => [...arr].sort((a, b) => {
    const aE = getUserRole(a) ? 0 : 1
    const bE = getUserRole(b) ? 0 : 1
    if (aE !== bE) return aE - bE
    const aD = new Date(a.eventDates?.[0] || a.eventDate || a.startDate || a.createdAt)
    const bD = new Date(b.eventDates?.[0] || b.eventDate || b.startDate || b.createdAt)
    if (aD - bD !== 0) return aD - bD
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const curSession     = currentSession()
  const allComps       = sortWithEnrollment(data?.competitions || [])
  const currentItems   = allComps.filter(c => isCurrentSession(c))
  const pastItems      = allComps.filter(c => !isCurrentSession(c))
  const pastBySession  = pastItems.reduce((acc, c) => {
    const s = getItemSession(getPrimaryItemDate(c)) || 'Older'
    ;(acc[s] = acc[s] || []).push(c)
    return acc
  }, {})
  const pastSessions   = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions    = [curSession, ...pastSessions]
  const sessionItems   = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession  = sessionFilter !== curSession
  const ongoing  = sortWithEnrollment(sessionItems.filter(c=>c.status==='ongoing'))
  const upcoming = sortWithEnrollment(sessionItems.filter(c=>c.status==='upcoming'))
  const past     = sortWithEnrollment(sessionItems.filter(c=>c.status==='past'))
  const live     = [...ongoing,...upcoming]
  const displayed = filter==='all'?sessionItems : filter==='ongoing'?ongoing : filter==='upcoming'?upcoming : past
  const fc = {all:sessionItems.length,ongoing:ongoing.length,upcoming:upcoming.length,past:past.length}

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen pt-[60px] transition-colors ${L?'bg-gray-50':'bg-[#060608]'}`}>

        {/* ── Header ── */}
        <div className={`border-b px-5 sm:px-8 pt-1 sm:pt-5 pb-3 sm:pb-6 ${L?'bg-white border-black/5':'bg-[#08080c] border-white/5'}`}>
          <div className="max-w-6xl mx-auto text-center">
            <h1 className={`pl-heading-in font-inter font-bold leading-none ${L?'text-gray-900':'text-white'}`}
              style={{ fontSize:'clamp(2.2rem,5.5vw,3.6rem)' }}>
              Competitions
            </h1>
            <p className={`pl-subtitle-in font-inter text-xs sm:text-sm mt-2 sm:mt-5 ${L?'text-gray-400':'text-gray-500'}`}>Showcase your craft. Compete. Win recognition.</p>
            {active.length > 0 && (
              <div className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-700/40 bg-green-900/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="font-inter text-[9px] font-bold uppercase tracking-wider text-green-400">{active.length} Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-2 sm:py-3 space-y-3 sm:space-y-4">

          {/* Session year selector */}
          {!loading && (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0)).length > 1 && (
            <div className="flex gap-2 mb-1 flex-wrap items-center">
              <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
              {(showPast ? allSessions : [curSession]).map(s => {
                const isAct = sessionFilter === s
                const isCur = s === curSession
                return (
                  <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                    className={`px-3 py-1.5 rounded-xl font-inter text-xs font-semibold border transition-all ${
                      isAct
                        ? 'bg-red-700 text-white border-red-700'
                        : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}>
                    {s}{isCur ? ' · Current' : ''}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Filter tabs ── */}
          <div className={`flex gap-0.5 p-1 rounded-lg w-fit ${L?'bg-black/5':'bg-white/5'}`}
            style={{ boxShadow:L?'inset 2px 2px 4px rgba(0,0,0,0.05),inset -2px -2px 4px rgba(255,255,255,0.7)':'inset 2px 2px 4px rgba(0,0,0,0.85),inset -1px -1px 2px rgba(255,255,255,0.03)' }}>
            {FILTERS.map(f => {
              const isActive = filter === f
              const color = {all:'bg-red-700',active:'bg-green-700',upcoming:'bg-yellow-700',past:'bg-gray-700'}[f]
              return (
                <button key={f} onClick={()=>setFilter(f)}
                  className={`px-2.5 py-1 rounded-md font-inter text-[10px] font-semibold capitalize transition-all duration-200 ${
                    isActive ? `${color} text-white` : `${L?'text-gray-500 hover:text-gray-800':'text-gray-500 hover:text-white'}`
                  }`}>
                  {f}
                  {fc[f]>0 && <span className="ml-1 opacity-60" style={{ fontSize:8 }}>{fc[f]}</span>}
                </button>
              )
            })}
          </div>

          {loading && <SkeletonCardGrid n={6} ratio="16/9" className="pl-section-in" />}

          {!loading && isPastSession && (
            <div className="mb-4">
              <CompSessionDivider session={sessionFilter} count={sessionItems.length} L={L} />
            </div>
          )}

          {/* Empty state */}
          {!loading && displayed.length === 0 && (
            <div className={`py-16 text-center rounded-2xl border ${L?'border-black/6 bg-white/40':'border-white/6 bg-white/[0.02]'}`}>
              <p className="text-4xl mb-3">🏆</p>
              <p className={`font-inter text-base font-semibold mb-1 ${L?'text-gray-700':'text-gray-300'}`}>
                No {filter === 'all' ? '' : filter} competitions {isPastSession ? `in ${sessionFilter}` : 'yet'}
              </p>
              <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-600'}`}>Check back soon!</p>
            </div>
          )}

          {/* All view: live + past sections */}
          {filter === 'all' && !loading && (
            <div className="pl-section-in space-y-3 sm:space-y-4">
              {live.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className={`font-inter text-[9px] uppercase tracking-widest ${L?'text-gray-500':'text-gray-600'}`}>
                      {active.length>0?'Active & Upcoming':'Upcoming'}
                    </p>
                    {active.length>0 && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">LIVE</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {live.map((c,i)=><CompCard key={c._id} comp={c} L={L} delay={i*70} userRole={getUserRole(c)}/>)}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <p className={`font-inter text-[9px] uppercase tracking-widest mb-2.5 ${L?'text-gray-500':'text-gray-600'}`}>Past Competitions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {past.map((c,i)=><PastCard key={c._id} comp={c} L={L} delay={i*70}/>)}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Filtered view */}
          {filter !== 'all' && !loading && displayed.length > 0 && (
            <div className="pl-section-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayed.map((c,i) => filter==='past'
                ? <PastCard key={c._id} comp={c} L={L} delay={i*70}/>
                : <CompCard key={c._id} comp={c} L={L} delay={i*70} userRole={getUserRole(c)}/>
              )}
            </div>
          )}

        </div>
      </div>
    </PageLayout>
  )
}
