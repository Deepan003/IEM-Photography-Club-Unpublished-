import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, Navigate }  from 'react-router-dom'
import PageLayout            from '../components/PageLayout.jsx'
import GlassButton           from '../components/GlassButton.jsx'
import ImageUpload           from '../components/ImageUpload.jsx'
import ProgressiveImage      from '../components/ProgressiveImage.jsx'
import { eventsApi, galleryApi, uploadFileToS3 } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import { computeAcademicYear } from '../utils/yearCalc.js'
import ContextAnnouncementStudio from '../components/announcement/ContextAnnouncementStudio.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

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

// ── Neomorphic shine card ─────────────────────────────────────────────────────
function ShineCard({ children, className = '', style = {}, L }) {
  const [pos, setPos] = useState({ x:50, y:50, on:false })
  const rafRef = useRef(null)
  const neo = L
    ? { background:'rgba(238,238,242,0.96)', boxShadow:'2px 2px 7px rgba(0,0,0,0.09),-2px -2px 7px rgba(255,255,255,0.72),inset 0 1px 0 rgba(255,255,255,0.65)' }
    : { background:'rgba(11,11,15,0.97)',    boxShadow:'2px 2px 8px rgba(0,0,0,0.85),-1px -1px 2px rgba(255,255,255,0.02),inset 0 1px 0 rgba(255,255,255,0.03)' }
  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${L?'border-black/[0.07]':'border-white/[0.06]'} ${className}`}
      style={{ ...neo, ...style }}
      onMouseMove={e => {
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
      <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
        <div style={{ position:'absolute', top:0, bottom:0, width:'38%', background:`linear-gradient(90deg,transparent 0%,rgba(255,255,255,${L?'0.16':'0.055'}) 50%,transparent 100%)`, animation:'shineSweep 4.2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-200 rounded-xl"
        style={{ opacity:pos.on?1:0, background:`radial-gradient(circle 80px at ${pos.x}% ${pos.y}%,rgba(255,255,255,${L?'0.16':'0.07'}),transparent 70%)` }} />
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background:`linear-gradient(135deg,rgba(255,255,255,${L?'0.10':'0.035'}) 0%,transparent 48%)` }} />
      {children}
    </div>
  )
}

// ── Gallery tab content ───────────────────────────────────────────────────────
function GalleryTab({ event, photos, setPhotos, canUpload, canReorder, isPrivileged, onGalleryToggle, L }) {
  const [lightbox,          setLightbox]          = useState(null)
  const [uploading,         setUploading]         = useState(false)
  const [files,             setFiles]             = useState([])
  const [previews,          setPreviews]          = useState([])
  const [msg,               setMsg]               = useState('')
  const [deletePhotoConfirm,setDeletePhotoConfirm]= useState(null)

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files)
    if (!picked.length) return
    setFiles(picked)
    setPreviews(picked.map(f => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removeFile = (i) => {
    setFiles(f => f.filter((_,j) => j !== i))
    setPreviews(p => p.filter((_,j) => j !== i))
  }

  const uploadPhotos = async (e) => {
    e.preventDefault()
    if (!files.length) return
    setUploading(true); setMsg('')
    let uploaded = 0
    try {
      for (const file of files) {
        const { key, publicUrl } = await uploadFileToS3(file, 'event-gallery')
        const { photo } = await galleryApi.addPhoto({
          imageUrl: publicUrl, s3Key: key,
          event: event._id, type: 'event',
        })
        setPhotos(p => [photo, ...p])
        uploaded++
      }
      setFiles([]); setPreviews([])
      setMsg(`✓ ${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded!`)
    } catch (err) { setMsg(err.message) }
    finally { setUploading(false) }
  }

  const [dragIdx,       setDragIdx]       = useState(null)
  const [orderChanged,  setOrderChanged]  = useState(false)
  const [savingOrder,   setSavingOrder]   = useState(false)
  const [orderSavedMsg, setOrderSavedMsg] = useState('')

  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const reordered = [...photos]
    const [moved]   = reordered.splice(dragIdx, 1)
    reordered.splice(i, 0, moved)
    setPhotos(reordered)
    setDragIdx(i)
    setOrderChanged(true)
  }
  const handleDragEnd = () => setDragIdx(null)

  const savePhotoOrder = async () => {
    setSavingOrder(true)
    try {
      await galleryApi.reorderPhotos(photos.map(p => p._id), event._id)
      setOrderChanged(false)
      setOrderSavedMsg('✓ Order saved')
      setTimeout(() => setOrderSavedMsg(''), 2500)
    } catch (e) { setMsg('Failed to save order.') }
    finally { setSavingOrder(false) }
  }

  const deletePhoto = async (id) => {
    await galleryApi.deletePhoto(id).catch(() => {})
    setPhotos(p => p.filter(x => x._id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Show in Gallery toggle — admin/core only */}
      {isPrivileged && (
        <div className={`flex items-center justify-between py-2.5 px-4 auth-glass rounded-xl border ${L?'border-black/8':'border-white/8'}`}>
          <div>
            <p className={`font-inter text-xs font-semibold ${L?'text-gray-800':'text-gray-200'}`}>Show in Public Gallery</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">Auto = visible when event is past or ongoing</p>
          </div>
          <div className="flex gap-1.5">
            {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
              const active = val === null ? (event.showInGallery === null || event.showInGallery === undefined) : event.showInGallery === val
              return (
                <button key={lbl} onClick={() => onGalleryToggle?.(val)}
                  className={`px-3 py-1 rounded-lg font-inter text-[10px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : `text-gray-500 border-white/10 hover:text-white`}`}>
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* Upload form — coordinators/core/admin only */}
      {canUpload && (
        <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'}`}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Upload Photos</p>
          <form onSubmit={uploadPhotos} className="space-y-3">
            {/* Preview grid if files selected */}
            {previews.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center">✕</button>
                  </div>
                ))}
                {/* Add more */}
                <label className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer ${L?'border-black/12 hover:border-red-600/30':'border-white/10 hover:border-red-600/30'}`}>
                  <span className="font-inter text-xs text-gray-500">+ Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                    const more = Array.from(e.target.files)
                    setFiles(f => [...f, ...more])
                    setPreviews(p => [...p, ...more.map(f => URL.createObjectURL(f))])
                  }} />
                </label>
              </div>
            ) : (
              <label className={`block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ${L?'border-black/12 hover:border-red-600/30':'border-white/10 hover:border-red-600/30'}`}>
                <div className={`flex flex-col items-center justify-center py-8 ${L?'text-gray-400':'text-gray-600'}`}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-2 text-gray-500"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <p className="font-inter text-sm">Choose photos (multiple)</p>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              </label>
            )}
            {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
            <GlassButton type="submit" variant="red" disabled={uploading || !files.length}
              className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'42px' }}>
              {uploading ? `Uploading…` : `Upload ${files.length > 0 ? `${files.length} Photo${files.length>1?'s':''}` : 'Photos'}`}
            </GlassButton>
          </form>
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className={`py-12 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className="font-inter text-sm text-gray-500">No gallery photos yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
        {(canUpload || canReorder) && photos.length > 1 && canReorder && (
          <div className="flex items-center justify-between gap-3">
            <p className="font-inter text-[10px] text-gray-500">Drag to reorder</p>
            <div className="flex items-center gap-2">
              {orderSavedMsg && <span className="font-inter text-[10px] text-green-400">{orderSavedMsg}</span>}
              {orderChanged && !orderSavedMsg && (
                <GlassButton variant="red" disabled={savingOrder} onClick={savePhotoOrder}
                  className="font-inter text-xs" style={{ borderRadius:8, minHeight:28, padding:'0 12px' }}>
                  {savingOrder ? 'Saving…' : 'Save Order'}
                </GlassButton>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {photos.map((p, i) => (
            <div key={p._id}
              className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIdx === i ? 'opacity-40 ring-2 ring-red-500' : ''}`}
              draggable={!!canReorder}
              onDragStart={() => canReorder && handleDragStart(i)}
              onDragOver={e  => canReorder && handleDragOver(e, i)}
              onDragEnd={()  => canReorder && handleDragEnd()}
              onClick={() => !dragIdx && setLightbox(p)}>
              <ProgressiveImage src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
              {canUpload && (
                <button
                  onClick={e => { e.stopPropagation(); setDeletePhotoConfirm(p._id) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs items-center justify-center hidden group-hover:flex transition-all">
                  ✕
                </button>
              )}
              {p.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-inter text-[10px] text-white truncate">{p.caption}</p>
                </div>
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

// AnnouncementsTab is now handled by ContextAnnouncementStudio

// ── Main component ────────────────────────────────────────────────────────────
export default function EventDetailPage() {
  const { id }              = useParams()
  const { theme }           = useTheme()
  const { user }            = useAuth()
  const [event,       setEvent]      = useState(null)
  const [coreMembers, setCoreMembers]= useState([])
  const [photos,      setPhotos]     = useState([])
  const [loading,     setLoading]    = useState(true)
  const [activeTab,   setActiveTab]  = useState('details')
  const [logoIn,      setLogoIn]     = useState(false)
  const L = theme === 'light'

  useEffect(() => {
    let alive = true
    const load = (silent) => Promise.all([
      eventsApi.get(id),
      galleryApi.getPhotos({ type:'event', event: id }),
    ]).then(([ev, gal]) => {
      if (!alive) return
      setEvent(ev.event)
      setCoreMembers(ev.coreMembers || [])
      setPhotos(gal.photos || []) // keep server order (sorted by order field)
    }).catch(silent ? () => {} : console.error).finally(() => { if (!silent && alive) setLoading(false) })

    load(false)
    const poll = setInterval(() => load(true), 12000)
    const t1 = setTimeout(() => setLogoIn(true), 200)
    return () => { alive = false; clearInterval(poll); clearTimeout(t1) }
  }, [id])

  if (loading) return (
    <PageLayout><div className="min-h-screen flex items-center justify-center">
      <p className="font-inter text-sm text-gray-500 animate-pulse">Loading event…</p>
    </div></PageLayout>
  )
  if (!event) return (
    <PageLayout><div className="min-h-screen flex items-center justify-center">
      <p className="font-inter text-sm text-gray-400">Event not found.</p>
    </div></PageLayout>
  )

  // ── Access control ────────────────────────────────────────────────────────────
  // This is the PUBLIC event detail page (explore/website view).
  // Management controls are ONLY in the admin/coordinator dashboard.
  const memberEntry = event.members?.find(m => {
    const uid = typeof m.user === 'object' ? m.user?._id : m.user
    return uid?.toString() === user?._id?.toString()
  })
  const isEnrolledExplicit = !!memberEntry
  const clubRole      = user?.role || null
  const isPrivileged  = ['admin','core'].includes(clubRole)
  // Cores are implicit members of every event — treat them as enrolled
  const isEnrolled    = isEnrolledExplicit || clubRole === 'core'
  const eventRole     = memberEntry?.eventRole || (clubRole === 'core' ? 'core' : null)
  const isEventCoord  = eventRole === 'coordinator'
  const isCoordinator = isEventCoord || isPrivileged
  const canView       = isEnrolled || event.isOpenToAll || isPrivileged

  const canUploadGallery  = isPrivileged || (isEventCoord && event.coordCanUpload !== false)
  const canReorderGallery = isPrivileged || (isEventCoord && event.coordCanReorder !== false)
  const canAnnounce       = isPrivileged || (isEventCoord && event.coordCanAnnounce !== false)

  const galleryEnabled = event.showInGallery !== false
  // Show gallery to all enrolled members when admin has enabled it, not only coordinators
  const showGallery    = galleryEnabled && (photos.length > 0 || canUploadGallery || isEnrolled)
  // Announcements tab is for admin/core + coordinators only, not regular photographers
  const canSeeAnnouncements = isPrivileged || (isEventCoord && event.coordCanAnnounce !== false)

  if (!canView) return (
    <PageLayout>
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="text-5xl">🔒</div>
        <p className={`font-inter text-sm max-w-xs ${L?'text-gray-600':'text-gray-400'}`}>
          This event is only visible to enrolled members.
        </p>
        <Link to="/events" className="font-inter text-xs text-red-400 hover:text-red-300 transition-colors">← Back to Events</Link>
      </div>
    </PageLayout>
  )

  const fmt = d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const eventDateList = event.eventDates?.length ? event.eventDates : (event.eventDate ? [event.eventDate] : [])
  const dateRows = [
    event.startDate && ['Start Date', fmt(event.startDate)],
    event.endDate   && ['End Date',   fmt(event.endDate)],
    ...eventDateList.map((d, i) => d && [eventDateList.length === 1 ? 'Event Date' : i === 0 ? 'Event Date' : `Day ${i + 1}`, fmt(d)]),
    ...(event.customDates||[]).map(cd => cd.date && [cd.title, fmt(cd.date)]),
  ].filter(Boolean)
  const infoRows = [
    event.status  && ['Status', event.status],
    event.venue   && ['Venue',  event.venue],
    ...dateRows,
  ].filter(Boolean)
  const heroDate = eventDateList[0] || event.startDate || (event.dates||[])[0]

  const allDisplayMembers = [...(event.members || []), ...coreMembers]
  // Tabs — Members visible to enrolled + privileged; Announcements read-only for enrolled
  const TABS = [
    { id:'details', label:'Details' },
    ...(isEnrolled || isPrivileged ? [{ id:'members', label:`Members (${allDisplayMembers.length})` }] : []),
    ...(showGallery ? [{ id:'gallery', label:'Gallery' }] : []),
    ...(canSeeAnnouncements ? [{ id:'announcements', label:'Announcements' }] : []),
  ]

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen transition-colors ${L?'bg-gray-50':'bg-[#050505]'}`}>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-black">
            {event.logoUrl && <img src={event.logoUrl} alt="" className="w-full h-full object-cover opacity-25" style={{ filter:'blur(3px)' }} />}
            <div className="absolute inset-0" style={{ background:'linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,rgba(0,0,0,0.75) 100%)' }} />
          </div>
          {/* Content — compact flex row on sm+, stacked on mobile */}
          <div className="relative z-10 px-5 sm:px-8 py-5 sm:py-7 max-w-5xl mx-auto"
            style={{ opacity: logoIn?1:0, transform: logoIn?'translateY(0)':'translateY(16px)', transition:'opacity 0.5s ease 0.2s, transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s' }}>
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Logo */}
              {event.logoUrl && (
                <div className="shrink-0 rounded-xl overflow-hidden shadow-xl border border-white/10"
                  style={{ width:'clamp(52px,9vw,80px)', height:'clamp(52px,9vw,80px)' }}>
                  <img src={event.logoUrl} alt={event.name} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Info — takes all remaining space */}
              <div className="flex-1 min-w-0">
                {event.status && <p className="font-inter text-[10px] uppercase tracking-[0.25em] text-red-400 font-semibold mb-1">{event.status}</p>}
                <h1 className="font-inter text-lg sm:text-2xl font-semibold text-white leading-tight mb-1.5">{event.name}</h1>
                <div className="flex flex-col gap-0.5">
                  {heroDate && <p className="font-inter text-[11px] text-white/60">{fmt(heroDate)}</p>}
                  {event.venue && <p className="font-inter text-[11px] text-white/50">📍 {event.venue}</p>}
                </div>
              </div>
              {/* Enrolled badge — always on the RIGHT */}
              {user && (
                <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter text-[10px] font-bold uppercase tracking-wider border ${
                  isEnrolled ? 'bg-emerald-900/70 text-emerald-300 border-emerald-600/50' : 'bg-black/50 text-gray-400 border-white/20'
                }`} style={{ backdropFilter:'blur(8px)' }}>
                  {isEnrolled
                    ? <><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>Enrolled</>
                    : 'Not Enrolled'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Tab navigation ── */}
        <div className={`sticky top-14 z-40 border-b ${L?'bg-white/90 border-black/5':'bg-[#050505]/90 border-white/5'}`} style={{ backdropFilter:'blur(12px)' }}>
          <div className="max-w-5xl mx-auto px-2 sm:px-8 flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 font-inter text-[10px] sm:text-xs font-medium uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-red-500 text-red-400'
                    : `border-transparent ${L?'text-gray-500 hover:text-gray-800':'text-gray-500 hover:text-white'}`
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

          {/* DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-2.5 sm:space-y-4">

              {/* Description */}
              {event.description && (
                <ShineCard L={L} className="p-3 sm:p-4">
                  <p className={'font-inter text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] mb-1 sm:mb-1.5 ' + (L?'text-gray-400':'text-gray-500')}>About</p>
                  <p className={'font-inter text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ' + (L?'text-gray-600':'text-gray-300')}>{event.description}</p>
                </ShineCard>
              )}

              {/* Info tiles grid */}
              {infoRows.length > 0 && (
                <div>
                  <p className={'font-inter text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] mb-2 sm:mb-2.5 ' + (L?'text-gray-500':'text-gray-400')}>Event Info</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {infoRows.map(([k,v]) => (
                      <ShineCard key={k} L={L} className="p-2.5 sm:p-3.5">
                        <p className={'font-inter text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider mb-1 sm:mb-1.5 ' + (L?'text-gray-400':'text-gray-500')}>{k}</p>
                        <p className={'font-inter text-sm sm:text-base font-bold leading-tight capitalize ' + (L?'text-gray-900':'text-white')}>{v}</p>
                      </ShineCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Drive link */}
              {event.driveLink && (
                <a href={event.driveLink} target="_blank" rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-sm font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-lg ${L?'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100':'bg-blue-900/20 text-blue-400 border-blue-700/40 hover:bg-blue-900/35'}`}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  View Google Drive Folder
                </a>
              )}

              <Link to="/events" className={'font-inter text-sm inline-flex items-center gap-1.5 transition-colors ' + (L?'text-gray-500 hover:text-gray-900':'text-gray-500 hover:text-white')}>
                ← Back to Events
              </Link>
            </div>
          )}

          {/* MEMBERS */}
          {activeTab === 'members' && (
            <div>
              <p className="font-inter text-[11px] uppercase tracking-[0.3em] text-gray-500 mb-4">
                {allDisplayMembers.length} Members
              </p>
              {!allDisplayMembers.length ? (
                <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No members yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {allDisplayMembers.map((m, i) => {
                    const u = typeof m.user === 'object' ? m.user : null
                    if (!u) return null
                    const initials = u.name?.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
                    const yr = computeAcademicYear(u.startYear, u.endYear)
                    return (
                      <div key={i} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border text-center ${L?'border-black/7 bg-white/50':'border-white/7 bg-white/3'}`}>
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-gray-800 flex items-center justify-center">
                          {u.profilePhoto
                            ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="font-clash text-sm font-black text-white/40">{initials}</span>}
                        </div>
                        <div>
                          <p className={`font-inter text-xs font-semibold ${L?'text-gray-800':'text-gray-200'}`}>{u.name}</p>
                          <p className={`font-inter text-[10px] mt-0.5 ${m.eventRole==='coordinator'?'text-blue-400':m.eventRole==='core'?'text-red-400':'text-gray-500'}`}>
                            {m.eventRole}
                          </p>
                          {u.department && <p className={`font-inter text-[9px] ${L?'text-gray-400':'text-gray-600'}`}>{u.department}</p>}
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
            <GalleryTab
              event={event} photos={photos} setPhotos={setPhotos}
              canUpload={canUploadGallery} canReorder={canReorderGallery}
              isPrivileged={isPrivileged}
              onGalleryToggle={async (val) => {
                await eventsApi.setGalleryOrder(id, { showInGallery: val }).catch(() => {})
                setEvent(ev => ({ ...ev, showInGallery: val }))
              }}
              L={L}
            />
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <ContextAnnouncementStudio
              contextType="event"
              contextId={id}
              canAnnounce={canAnnounce}
              isPrivileged={isPrivileged}
              coordCanAnnounce={event.coordCanAnnounce}
              onCoordToggle={isPrivileged ? async val => {
                await eventsApi.setCoordPerms(id, { coordCanAnnounce: val }).catch(() => {})
                setEvent(ev => ({ ...ev, coordCanAnnounce: val }))
              } : undefined}
              L={L}
            />
          )}
        </div>
      </div>
    </PageLayout>
  )
}
