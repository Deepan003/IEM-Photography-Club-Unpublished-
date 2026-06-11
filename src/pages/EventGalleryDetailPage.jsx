import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link }  from 'react-router-dom'
import PageLayout            from '../components/PageLayout.jsx'
import DriveLinkBanner       from '../components/DriveLinkBanner.jsx'
import ProgressiveImage      from '../components/ProgressiveImage.jsx'
import { galleryApi, eventsApi } from '../api/api.js'
import { useTheme }          from '../App.jsx'

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }) {
  const [idx,     setIdx]     = useState(startIdx)
  const [entered, setEntered] = useState(false)
  const touchX = useRef(null)

  useEffect(() => { requestAnimationFrame(() => setEntered(true)) }, [])
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + photos.length) % photos.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [photos.length, onClose])

  const p    = photos[idx]
  const attr = p?.photographer

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{
        background: entered ? 'rgba(2,2,4,0.94)' : 'rgba(2,2,4,0)',
        backdropFilter: entered ? 'blur(20px)' : 'blur(0)',
        WebkitBackdropFilter: entered ? 'blur(20px)' : 'blur(0)',
        transition: 'background 280ms ease, backdrop-filter 280ms ease',
      }}
      onClick={onClose}>
      <div className="relative w-full max-w-3xl"
        style={{
          opacity:   entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(24px)',
          transition: 'opacity 360ms cubic-bezier(0.22,1,0.36,1), transform 360ms cubic-bezier(0.22,1,0.36,1)',
        }}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - (touchX.current ?? 0)
          if (Math.abs(dx) > 45) setIdx(i => dx < 0 ? (i+1)%photos.length : (i-1+photos.length)%photos.length)
          touchX.current = null
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3 px-1">
          {attr ? (
            <div className="flex items-center gap-2 flex-1">
              {attr.userId?.profilePhoto
                ? <img src={attr.userId.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 font-inter font-bold text-xs">{(attr.name||'?')[0]}</div>}
              <p className="font-inter text-sm font-medium text-white/80">{attr.name}</p>
            </div>
          ) : <div className="flex-1" />}
          <span className="font-inter text-[10px] text-white/35 tabular-nums">{idx + 1} / {photos.length}</span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
            style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(6px)' }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Photo frame */}
        <div style={{ background:'#fff', padding:5, borderRadius:16, boxShadow:'0 30px 80px rgba(0,0,0,0.7)' }}>
          <div className="relative overflow-hidden" style={{ maxHeight:'70vh', borderRadius:0 }}>
            <img src={p?.imageUrl} alt="" key={idx}
              className="w-full object-contain block"
              style={{ maxHeight:'70vh', animation:'quickZoom 280ms ease both' }} />
            {photos.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setIdx(i => (i-1+photos.length)%photos.length) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); setIdx(i => (i+1)%photos.length) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dots */}
        {photos.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3.5">
            {photos.slice(0,15).map((_,i) => (
              <button key={i} onClick={() => setIdx(i)}
                className="rounded-full transition-all duration-300"
                style={{ height:4, width:i===idx?18:4, background:i===idx?'#dc2626':'rgba(255,255,255,0.25)' }} />
            ))}
            {photos.length > 15 && <span className="font-inter text-[9px] text-white/30 ml-1">+{photos.length-15}</span>}
          </div>
        )}
        {p?.caption && <p className="font-inter text-sm text-white/55 text-center mt-2.5 italic px-4">"{p.caption}"</p>}
      </div>
    </div>
  )
}

// ── Photo card with neomorphic design + hover shine ───────────────────────────
function PhotoCard({ photo, L, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative overflow-hidden cursor-pointer"
      style={{
        breakInside: 'avoid',
        marginBottom: 6,
        boxShadow: hovered
          ? L ? '-2px -2px 6px rgba(255,255,255,0.9), 4px 4px 12px rgba(0,0,0,0.14), 0 0 0 1.5px rgba(220,38,38,0.3)'
              : '-2px -2px 6px rgba(255,255,255,0.04), 5px 5px 14px rgba(0,0,0,0.97), 0 0 0 1px rgba(220,38,38,0.28)'
          : 'none',
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'all 350ms cubic-bezier(0.22,1,0.36,1)',
        animation: `quickZoom 450ms cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}>

      <div style={{ position:'relative' }}>
        {/* Natural ratio image — liquid loader while fetching */}
        <ProgressiveImage
          masonry
          src={photo.imageUrl}
          className="w-full block"
          style={{ height:'auto', display:'block', transform: hovered ? 'scale(1.03)' : 'scale(1)', transition: 'transform 450ms ease' }}
        />

        {/* Subtle dark overlay always */}
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.08)', pointerEvents:'none' }} />

        {/* Shine on hover */}
        {hovered && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.07) 50%,transparent 70%)', animation:'glassShimmer 0.65s ease-out forwards' }} />
          </div>
        )}

        {/* View icon */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity: hovered?1:0, transition:'opacity 280ms ease', pointerEvents:'none' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background:'rgba(220,38,38,0.82)', backdropFilter:'blur(6px)', boxShadow:'0 4px 16px rgba(220,38,38,0.35)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        </div>

        {/* Frosted glass info panel — slides up on hover, disappears on leave */}
        {(photo.photographer?.name || photo.caption) && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            transform: hovered ? 'translateY(0)' : 'translateY(100%)',
            opacity: hovered ? 1 : 0,
            transition: 'transform 340ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease',
            pointerEvents:'none',
          }}>
            <div style={{
              padding:'18px 10px 8px',
              background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.6) 60%,transparent 100%)',
              backdropFilter:'blur(10px)',
              WebkitBackdropFilter:'blur(10px)',
            }}>
              {photo.photographer?.name && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  {photo.photographer.userId?.profilePhoto && (
                    <img src={photo.photographer.userId.profilePhoto} alt="" style={{ width:16, height:16, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  )}
                  <p className="font-inter font-semibold text-white" style={{ fontSize:10, lineHeight:1 }}>📷 {photo.photographer.name}</p>
                </div>
              )}
              {photo.caption && (
                <p className="font-inter text-white/65" style={{ fontSize:9, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {photo.caption}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info dot indicator when not hovered */}
        {(photo.photographer?.name || photo.caption) && !hovered && (
          <div style={{ position:'absolute', top:6, right:6, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Immersive hero section ────────────────────────────────────────────────────
function EventHero({ event, photos, L }) {
  // Use first photo as blurred background for immersive feel
  const bgPhoto = photos[0]?.imageUrl || null
  const [descExpanded, setDescExpanded] = useState(false)

  const dateStr = (event?.dates || [])
    .map(d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }))
    .join(' · ')

  return (
    <div className="relative overflow-hidden rounded-3xl mb-8" style={{ minHeight: 260 }}>
      {/* Blurred background photo */}
      {bgPhoto ? (
        <>
          <img src={bgPhoto} alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter:'blur(18px) brightness(0.35)', transform:'scale(1.15)' }} />
          <div className="absolute inset-0" style={{ background:'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%)' }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background:'linear-gradient(135deg, #080812 0%, #12122a 50%, #0a0a18 100%)' }} />
      )}

      {/* Edge shine animation */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 40%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.15) 60%,transparent 100%)', animation:'borderSweep 8s ease-in-out 1s infinite' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background:'linear-gradient(90deg,transparent 0%,rgba(220,38,38,0.1) 40%,rgba(220,38,38,0.25) 50%,rgba(220,38,38,0.1) 60%,transparent 100%)', animation:'borderSweep 11s ease-in-out 3s infinite' }} />

      {/* Content */}
      <div className="relative z-10 p-7 sm:p-10">

        {/* Status + photo count */}
        <div className="flex items-center gap-2 mb-4">
          {event?.status && (
            <span className={`font-inter text-[9px] uppercase tracking-[0.22em] px-2.5 py-1 rounded-full font-semibold ${{
              ongoing:'bg-green-900/70 text-green-300 border border-green-800/50',
              past:   'bg-gray-800/70 text-gray-400 border border-gray-700/50',
            }[event.status] || ''}`}>
              {event.status}
            </span>
          )}
          <span className="font-inter text-[9px] text-white/40 uppercase tracking-[0.18em]">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Event name */}
        <h1 className="font-inter font-black text-white leading-tight mb-5"
          style={{ fontSize:'clamp(1.8rem, 5vw, 3.2rem)', letterSpacing:'-0.02em', textShadow:'0 2px 20px rgba(0,0,0,0.5)' }}>
          {event?.name}
        </h1>

        {/* Details strip */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4">
          {dateStr && (
            <div className="flex items-center gap-1.5">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span className="font-inter text-[11px] text-white/55">{dateStr}</span>
            </div>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1.5">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="font-inter text-[11px] text-white/55">{event.venue}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {event?.description && (
          <div>
            <p className="font-inter text-sm text-white/60 leading-relaxed"
              style={{ display: descExpanded ? 'block' : '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {event.description}
            </p>
            {event.description.length > 120 && (
              <button onClick={() => setDescExpanded(v => !v)}
                className="font-inter text-[10px] text-red-400/70 hover:text-red-400 transition-colors mt-1">
                {descExpanded ? 'Show less' : 'Read more →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EventGalleryDetailPage() {
  const { id }    = useParams()
  const { theme } = useTheme()
  const L = theme === 'light'

  const [event,   setEvent]   = useState(null)
  const [photos,  setPhotos]  = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox,setLightbox]= useState(null)

  useEffect(() => {
    let alive = true
    const load = (silent) => Promise.all([
      eventsApi.get(id),
      galleryApi.getPhotos({ type:'event', event: id, limit: 200 }),
    ]).then(([evD, phD]) => {
      if (!alive) return
      setEvent(evD.event)
      setPhotos(phD.photos)
    }).catch(silent ? () => {} : console.error)
    .finally(() => { if (!silent && alive) setLoading(false) })

    load(false)
    const poll = setInterval(() => load(true), 12000)
    return () => { alive = false; clearInterval(poll) }
  }, [id])

  return (
    <div className={`min-h-screen transition-colors duration-300 ${L ? 'bg-gray-50' : 'bg-[#050505]'}`}
      style={{ paddingTop: 68 }}>

      {/* Navbar — matches PageLayout height (68px) */}
      <div className={`fixed top-0 left-0 w-full z-[100] flex items-center border-b backdrop-blur-md transition-colors`}
        style={{ height:68, background: L?'rgba(255,255,255,0.8)':'rgba(5,5,5,0.85)', borderColor: L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto px-5 w-full flex items-center gap-3">
          <Link to="/events-gallery"
            className={`flex items-center gap-2 font-inter text-[14px] font-medium transition-colors px-3 py-2 rounded-xl ${L?'text-gray-500 hover:text-gray-800 hover:bg-black/4':'text-gray-500 hover:text-white hover:bg-white/6'}`}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
            Events Gallery
          </Link>
          <div className={`flex-1 h-px ${L?'bg-black/6':'bg-white/5'}`} />
          <span className={`font-inter text-[14px] font-medium truncate max-w-xs ${L?'text-gray-500':'text-gray-400'}`}>{event?.name}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">

        {/* Immersive hero */}
        {(event || !loading) && (
          <EventHero event={event} photos={photos} L={L} />
        )}

        <DriveLinkBanner link={event?.driveLink} L={L}
          label="For the entire event's photos, visit the Google Drive" />

        {/* Photo grid */}
        {loading ? (
          <div style={{ columns:'3 auto', columnGap:6 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ marginBottom:6, height: 140+i*20, background: L?'#e0e0e4':'#111114' }} />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className={`py-24 text-center auth-glass rounded-3xl border ${L?'border-black/7':'border-white/7'}`}>
            <p className="text-4xl mb-3">📷</p>
            <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>No photos uploaded for this event yet.</p>
          </div>
        ) : (
          <>
            {/* Gallery header */}
            <div className="flex items-center justify-between mb-4">
              <p className={`font-inter text-xs uppercase tracking-[0.2em] font-semibold ${L?'text-gray-400':'text-gray-600'}`}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''} · click to view
              </p>
              <div className={`h-px flex-1 mx-4 ${L?'bg-black/6':'bg-white/6'}`} />
            </div>

            {/* Neomorphic grid */}
            {/* Masonry columns — natural photo aspect ratios */}
            <div style={{ columns:'3 auto', columnGap:6, width:'100%' }}>
              {photos.map((p, i) => (
                <PhotoCard key={p._id} photo={p} L={L} delay={Math.min(i * 30, 400)} onClick={() => setLightbox(i)} />
              ))}
            </div>
          </>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox photos={photos} startIdx={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
