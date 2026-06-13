import { useState, useEffect, useRef } from 'react'
import PageLayout        from '../components/PageLayout.jsx'
import GlassButton       from '../components/GlassButton.jsx'
import { postcardsApi, settingsApi } from '../api/api.js'
import { useData }       from '../hooks/useData.js'
import { SkeletonPhotoGrid } from '../components/Skeleton.jsx'
import ProgressiveImage from '../components/ProgressiveImage.jsx'
import { useTheme, useAuth } from '../App.jsx'

function getImages(p) {
  if (p.images?.length) return p.images.map(img => (typeof img === 'string' ? img : img.url))
  if (p.imageUrl) return [p.imageUrl]
  return []
}

// ── Multi-photo count badge (prominent pill on photo corner) ──────────────────
function PhotoCountBadge({ count }) {
  if (count <= 1) return null
  return (
    <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full"
      style={{ background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.2)', padding:'3px 8px 3px 6px' }}>
      {/* Stack-of-squares icon */}
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="13" height="13" rx="2"/>
        <path d="M8 21h13a2 2 0 0 0 2-2V8"/>
      </svg>
      <span className="font-inter text-[12px] font-bold text-white leading-none">{count}</span>
    </div>
  )
}

// ── Postcard card — neomorphic with white photo border ───────────────────────
function PostcardCard({ p, L, onClick }) {
  const imgs = getImages(p)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (imgs.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 3000)
    return () => clearInterval(t)
  }, [imgs.length])

  const cardStyle = L
    ? { background:'#e8e8ec', boxShadow:'-3px -3px 8px rgba(255,255,255,0.9), 4px 4px 10px rgba(0,0,0,0.09)' }
    : { background:'#131315', boxShadow:'-3px -3px 8px rgba(255,255,255,0.02), 5px 5px 16px rgba(0,0,0,0.9)' }

  return (
    <div onClick={() => onClick(p)} className={`rounded-2xl overflow-hidden cursor-pointer ${L?'postcard-neo-light':'postcard-neo-dark'}`}
      style={cardStyle}>

      {/* Header — avatar + full name + section */}
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        {p.photographer?.profilePhoto
          ? <img src={p.photographer.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          : <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center font-inter text-[9px] font-bold text-red-400 shrink-0">
              {(p.photographer?.name||'U')[0].toUpperCase()}
            </div>
        }
        <div className="min-w-0 flex-1">
          <p className={`font-inter text-[11px] font-bold truncate leading-tight ${L?'text-gray-900':'text-white'}`}>{p.photographer?.name||'Unknown'}</p>
          <p className="font-inter text-[8px] text-red-500 font-semibold uppercase tracking-[0.1em] truncate leading-tight">{p.section?.name || 'General'}</p>
        </div>
      </div>

      {/* Photo with white border + prominent count badge */}
      <div className="px-2 pb-1">
        <div className="overflow-hidden" style={{ background:'#fff', padding:'3px', borderRadius:0 }}>
          <div className="relative overflow-hidden" style={{ paddingBottom:'125%', borderRadius:0 }}>
            <div className="absolute inset-0 bg-gray-900">
              {imgs.map((url, i) => (
                <div key={i} className="absolute inset-0" style={{ opacity: i===idx ? 1 : 0, transition:'opacity 700ms ease' }}>
                  <ProgressiveImage src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <PhotoCountBadge count={imgs.length} />
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="px-2.5 py-1.5" style={{ minHeight:26 }}>
        {p.caption && <p className={`font-inter text-[10px] truncate ${L?'text-gray-600':'text-gray-400'}`}>{p.caption}</p>}
      </div>
    </div>
  )
}

// ── Lightbox — navigate between postcards AND photos within each postcard ──────
// Arrows for photos are OUTSIDE the white frame.
// Arrows for postcards are on the far left/right of the overlay.
// Swipe left/right = navigate between postcards on mobile.
function Lightbox({ postcards, startIdx, onClose }) {
  const [pcIdx,    setPcIdx]    = useState(startIdx)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [entered,  setEntered]  = useState(false)
  const touchStartX = useRef(null)

  const p    = postcards[pcIdx]
  const imgs = getImages(p)
  const total = postcards.length

  // Reset photo when postcard changes
  useEffect(() => { setPhotoIdx(0) }, [pcIdx])

  // Spring-in on mount
  useEffect(() => { requestAnimationFrame(() => setEntered(true)) }, [])

  // Keyboard: ← → = navigate postcards, Esc = close
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setPcIdx(i => (i - 1 + total) % total)
      if (e.key === 'ArrowRight') setPcIdx(i => (i + 1) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onClose])

  // Swipe left/right = navigate between POSTCARDS
  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = e => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 45) {
      setPcIdx(i => dx < 0 ? (i + 1) % total : (i - 1 + total) % total)
    }
    touchStartX.current = null
  }

  const prevPhoto    = () => setPhotoIdx(i => (i - 1 + imgs.length) % imgs.length)
  const nextPhoto    = () => setPhotoIdx(i => (i + 1) % imgs.length)

  // Minimal arrow button shared style
  const arrowBtn = (label, onClick, extra = '') => (
    <button onClick={onClick}
      className={`flex items-center justify-center rounded-full shrink-0 transition-all duration-150 hover:scale-110 active:scale-95 ${extra}`}
      style={{ width:36, height:36, background:'rgba(255,255,255,0.08)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.12)' }}>
      {label}
    </button>
  )

  const ChevL = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
  const ChevR = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{
        background: entered ? 'rgba(0,0,0,0.76)' : 'rgba(0,0,0,0)',
        backdropFilter: entered ? 'blur(18px) saturate(1.2)' : 'blur(0px)',
        WebkitBackdropFilter: entered ? 'blur(18px) saturate(1.2)' : 'blur(0px)',
        transition: 'background 280ms ease, backdrop-filter 280ms ease',
      }}
      onClick={onClose}>

      {/* ── Postcard prev/next — far sides of overlay ── */}
      {total > 1 && (
        <button onClick={e => { e.stopPropagation(); setPcIdx(i => (i - 1 + total) % total) }}
          className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
          style={{ width:28, height:28, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.15)' }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      {total > 1 && (
        <button onClick={e => { e.stopPropagation(); setPcIdx(i => (i + 1) % total) }}
          className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
          style={{ width:28, height:28, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.15)' }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}

      {/* ── Card ── */}
      <div className="relative w-full px-8 sm:px-12 max-w-xs sm:max-w-md"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        <div style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(24px)',
          filter: entered ? 'blur(0)' : 'blur(6px)',
          transition: 'opacity 340ms cubic-bezier(0.34,1.1,0.64,1), transform 340ms cubic-bezier(0.34,1.1,0.64,1), filter 240ms ease',
        }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-2.5 px-0.5">
            {p.photographer?.profilePhoto
              ? <img src={p.photographer.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover border border-white/20" />
              : <div className="w-9 h-9 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 font-bold text-sm font-inter">
                  {(p.photographer?.name||'U')[0].toUpperCase()}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-inter text-sm font-semibold text-white truncate">{p.photographer?.name}</p>
              <p className="font-inter text-[10px] text-red-400 uppercase tracking-[0.1em]">{p.section?.name || 'General'}</p>
            </div>
            {/* Postcard counter */}
            {total > 1 && (
              <span className="font-inter text-[10px] text-white/40 shrink-0">{pcIdx + 1}/{total}</span>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
              style={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(6px)' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Photo frame — 4:5 ratio via padding-bottom; min() caps height at 58vh so it never overflows */}
          <div style={{ background:'#fff', padding:'5px', borderRadius:0, boxShadow:'0 20px 60px rgba(0,0,0,0.55)' }}>
            <div className="relative overflow-hidden" style={{ paddingBottom:'min(125%, 58vh)', borderRadius:0 }}>
              <div className="absolute inset-0 bg-gray-900">
                {imgs.map((url, i) => (
                  <img key={`${pcIdx}-${i}`} src={url} alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ opacity: i===photoIdx ? 1 : 0, transition:'opacity 380ms ease' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Photo navigation row — arrows OUTSIDE the frame */}
          {imgs.length > 1 ? (
            <div className="flex items-center gap-3 mt-2.5 px-0.5">
              {arrowBtn(ChevL, prevPhoto)}
              <div className="flex-1 flex justify-center gap-1.5">
                {imgs.map((_, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)}
                    className="rounded-full transition-all duration-300"
                    style={{ height:4, width: i===photoIdx ? 18 : 4, background: i===photoIdx ? '#dc2626' : 'rgba(255,255,255,0.3)' }} />
                ))}
              </div>
              {arrowBtn(ChevR, nextPhoto)}
            </div>
          ) : <div className="mt-2" />}

          {/* Caption */}
          {p.caption && (
            <p className="font-inter text-sm text-white/70 text-center mt-2 italic px-2">"{p.caption}"</p>
          )}

          {/* Postcard dots strip */}
          {total > 1 && (
            <div className="flex justify-center gap-1 mt-3">
              {Array.from({ length: Math.min(total, 9) }).map((_, i) => (
                <button key={i} onClick={() => setPcIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{ height:3, width: i===pcIdx ? 14 : 3, background: i===pcIdx ? '#fff' : 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PC_SUBTITLE_DEFAULT = "Through our lens, we don't just capture moments — we craft stories. Every frame is a window into a world seen only the way a photographer can see it."

export default function PostcardsPage() {
  const { theme } = useTheme()
  const { user }  = useAuth()
  const [selected,    setSelected]    = useState(null)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const L = theme === 'light'
  const isAdminOrCore = user && ['admin','core'].includes(user.role)

  const { data: sectData,    loading: loadS } = useData(() => postcardsApi.getSections(), 5000)
  const { data: cardData,    loading: loadP } = useData(() => postcardsApi.list(),        5000)
  const { data: contentData }                 = useData(() => settingsApi.getContent(),   30000)

  const content = contentData?.content || {}
  const [subtitleLocal,   setSubtitleLocal]   = useState(null)
  const [subtitleEditing, setSubtitleEditing] = useState(false)
  const [subtitleDraft,   setSubtitleDraft]   = useState('')
  const [subtitleSaving,  setSubtitleSaving]  = useState(false)

  const resolvedSubtitle = subtitleLocal ?? content['subtitle-postcards'] ?? PC_SUBTITLE_DEFAULT

  const saveSubtitle = async () => {
    setSubtitleSaving(true)
    try {
      await settingsApi.patch('subtitle-postcards', subtitleDraft)
      setSubtitleLocal(subtitleDraft)
      setSubtitleEditing(false)
    } catch {} finally { setSubtitleSaving(false) }
  }

  const sections  = sectData?.sections  || []
  const postcards = cardData?.postcards || []
  const loading   = loadS || loadP
  const generalCount = postcards.filter(p => !p.section?._id && !p.section).length
  const filtered  = selected === null
    ? postcards
    : selected === 'general'
      ? postcards.filter(p => !p.section?._id && !p.section)
      : postcards.filter(p => p.section?._id === selected)

  return (
    <PageLayout title="Postcards" subtitle={resolvedSubtitle} loading={loading}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-10">

        {/* Subtitle edit controls — admin/core only */}
        {isAdminOrCore && !subtitleEditing && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => { setSubtitleDraft(resolvedSubtitle); setSubtitleEditing(true) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${L?'text-gray-500 border-black/10 hover:text-gray-800':'text-gray-500 border-white/10 hover:text-white'}`}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit subtitle
            </button>
          </div>
        )}
        {isAdminOrCore && subtitleEditing && (
          <div className="max-w-xl mx-auto mb-6 space-y-2 p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
            <p className={`font-inter text-[10px] uppercase tracking-widest mb-1 ${L?'text-gray-400':'text-gray-500'}`}>Edit subtitle</p>
            <textarea
              rows={2}
              value={subtitleDraft}
              onChange={e => setSubtitleDraft(e.target.value)}
              className="glass-input w-full text-sm resize-none"
              style={{ borderRadius:'10px' }}
            />
            <div className="flex gap-2">
              <button onClick={saveSubtitle} disabled={subtitleSaving}
                className="flex-1 py-2 rounded-xl font-inter text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60">
                {subtitleSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setSubtitleEditing(false)}
                className={`px-4 py-2 rounded-xl font-inter text-sm border transition-colors ${L?'text-gray-600 border-black/10':'text-gray-400 border-white/10'}`}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Section filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <GlassButton variant={selected === null ? 'red' : 'default'}
            onClick={() => setSelected(null)}
            className="px-4 font-inter text-xs" style={{ borderRadius:'20px', minHeight:'34px' }}>
            All ({postcards.length})
          </GlassButton>
          <GlassButton variant={selected === 'general' ? 'red' : 'default'}
            onClick={() => setSelected('general')}
            className="px-4 font-inter text-xs" style={{ borderRadius:'20px', minHeight:'34px' }}>
            General ({generalCount})
          </GlassButton>
          {sections.map(s => (
            <GlassButton key={s._id} variant={selected === s._id ? 'red' : 'default'}
              onClick={() => setSelected(s._id)}
              className="px-4 font-inter text-xs" style={{ borderRadius:'20px', minHeight:'34px' }}>
              {s.name}
            </GlassButton>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <SkeletonPhotoGrid n={8} ratio="4/5" />
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className={`font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>No postcards yet in this section.</p>
          </div>
        ) : (
          <div className="pl-section-in grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((p, i) => (
              <PostcardCard key={p._id} p={p} L={L} onClick={() => setLightboxIdx(i)} />
            ))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && filtered.length > 0 && (
        <Lightbox
          postcards={filtered}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </PageLayout>
  )
}
