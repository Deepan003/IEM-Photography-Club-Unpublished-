import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageLayout         from '../components/PageLayout.jsx'
import GlassButton        from '../components/GlassButton.jsx'
import DriveLinkBanner    from '../components/DriveLinkBanner.jsx'
import ProgressiveImage   from '../components/ProgressiveImage.jsx'
import { activitiesApi, uploadFileToS3, settingsApi } from '../api/api.js'
import ContextAnnouncementStudio from '../components/announcement/ContextAnnouncementStudio.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useTheme, useAuth } from '../App.jsx'
import { useData }        from '../hooks/useData.js'
import { isCurrentSession, getItemSession, getPrimaryItemDate, currentSession } from '../utils/yearCalc.js'
import { SkeletonCardGrid } from '../components/Skeleton.jsx'

const statusCfg = {
  ongoing:  { label:'Ongoing',  badge:'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',   glow:'rgba(16,185,129,0.14)',  stripe:'via-emerald-500' },
  upcoming: { label:'Upcoming', badge:'bg-violet-900/60 text-violet-300 border-violet-700/50',     glow:'rgba(139,92,246,0.12)',  stripe:'via-violet-500'  },
  past:     { label:'Ended',    badge:'bg-gray-800/60 text-gray-400 border-gray-700/40',           glow:'rgba(107,114,128,0.07)', stripe:'via-gray-600'    },
}
const SC  = (s) => statusCfg[s] || statusCfg.past
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : ''

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

// ── Lightbox ─────────────────────────────────────────────────────────────────
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

// ── Activity Gallery Tab ──────────────────────────────────────────────────────
function ActGalleryTab({ act, canUpload, canReorder, isPrivileged, onGalleryToggle, L }) {
  const [photos, setPhotos]       = useState([...(act.gallery||[])].sort((a,b)=>(a.order||0)-(b.order||0)))
  const [lightbox, setLightbox]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [files, setFiles]         = useState([])
  const [previews, setPreviews]   = useState([])
  const [msg, setMsg]             = useState('')
  const [dragIdx, setDragIdx]     = useState(null)
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
        const r = await uploadFileToS3(files[i], 'activities')
        const d = await activitiesApi.addGalleryPhoto(act._id, { imageUrl: r.publicUrl, s3Key: r.key, mobileUrl: r.mobileUrl, mobileKey: r.mobileKey })
        const newPhoto = d.activity?.gallery?.slice(-1)[0]
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

  const saveOrder = async () => {
    setSavingOrder(true)
    try {
      await activitiesApi.reorderGallery(act._id, photos.map(p => p._id))
      setOrderChanged(false)
    } catch { setMsg('Failed to save order.') }
    finally { setSavingOrder(false) }
  }

  const deletePhoto = async (id) => {
    await activitiesApi.deleteGalleryPhoto(act._id, id).catch(() => {})
    setPhotos(p => p.filter(x => x._id !== id))
  }

  const [galleryVal, setGalleryVal] = useState(act.showInGallery === undefined ? null : act.showInGallery)

  return (
    <div className="space-y-5">
      <DriveLinkBanner link={act.driveLink} L={L}
        label="For the entire activity's photos, visit the Google Drive" />

      {/* Gallery visibility toggle — admin/core only */}
      {isPrivileged && (
        <div className={`auth-glass rounded-xl border p-3 ${L?'border-black/8':'border-white/8'}`}>
          <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-2">Show in Public Gallery</p>
          <div className="flex gap-2">
            {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
              const active = val === null ? galleryVal === null : galleryVal === val
              return (
                <button key={lbl} onClick={async () => { await onGalleryToggle?.(val); setGalleryVal(val) }}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs font-bold border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center">✕</button>
                  </div>
                ))}
                <label className={'aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer ' + (L?'border-black/12':'border-white/10')}>
                  <span className="font-inter text-xs text-gray-500">+ Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const more=Array.from(e.target.files); setFiles(f=>[...f,...more]); setPreviews(p=>[...p,...more.map(f=>URL.createObjectURL(f))]) }} />
                </label>
              </div>
            ) : (
              <label className={'block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ' + (L?'border-black/12 hover:border-violet-600/30':'border-white/10 hover:border-violet-600/30')}>
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
                <GlassButton variant="red" disabled={savingOrder} onClick={saveOrder}
                  className="font-inter text-xs" style={{ borderRadius:8, minHeight:28, padding:'0 12px' }}>
                  {savingOrder ? 'Saving...' : 'Save Order'}
                </GlassButton>
              )}
            </div>
          )}
          <div className="[column-count:2] sm:[column-count:4] [column-gap:3px] w-full">
            {photos.map((p, i) => (
              <div key={p._id}
                className={'relative overflow-hidden cursor-pointer ' + (canReorder ? 'cursor-grab active:cursor-grabbing ' : '') + (dragIdx === i ? 'opacity-40 ring-2 ring-violet-500' : '')}
                style={{ breakInside:'avoid', marginBottom:3 }}
                draggable={!!canReorder}
                onDragStart={() => canReorder && handleDragStart(i)}
                onDragOver={e => canReorder && handleDragOver(e, i)}
                onDragEnd={() => canReorder && handleDragEnd()}
                onClick={() => !dragIdx && setLightbox(p)}>
                <ProgressiveImage masonry src={p.imageUrl} mobileSrc={p.mobileUrl} className="w-full block"
                  style={{ display:'block', height:'auto', transition:'transform 500ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform='scale(1)'} />
                {canUpload && (
                  <button onClick={e => { e.stopPropagation(); setDeletePhotoConfirm(p._id) }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs items-center justify-center hidden group-hover:flex hover:flex">✕</button>
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

// ── Activity Announcements Tab ────────────────────────────────────────────────
// ActAnnouncementsTab replaced by ContextAnnouncementStudio

// ── Activity Detail Page ──────────────────────────────────────────────────────
function ActivityDetailPage({ id }) {
  const { theme } = useTheme()
  const { user  } = useAuth()
  const [act,         setAct]       = useState(null)
  const [coreMembers, setCoreMembers] = useState([])
  const [loading,     setLoading]   = useState(true)
  const [activeTab,   setTab]       = useState('details')
  const [heroIn,      setHeroIn]    = useState(false)
  const L = theme === 'light'

  useEffect(() => {
    activitiesApi.get(id)
      .then(d => { setAct(d.activity); setCoreMembers(d.coreMembers || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
    const t = setTimeout(() => setHeroIn(true), 200)
    return () => clearTimeout(t)
  }, [id])

  useEffect(() => {
    if (activeTab === 'announcements' && act?._id) {
      activitiesApi.get(id).then(d => setAct(d.activity)).catch(() => {})
    }
  }, [activeTab, id])

  if (loading) return (
    <PageLayout title={null}>
      <div className={`min-h-screen ${L ? 'bg-gray-50' : 'bg-[#060608]'}`}>
        <div className="relative overflow-hidden" style={{ minHeight:'clamp(100px,18vw,190px)', background:'#060814' }}>
          <div className="px-4 sm:px-8 pt-4 pb-4 max-w-5xl mx-auto flex items-start gap-3 sm:gap-4">
            <div className="skeleton-shimmer rounded-xl shrink-0" style={{ width:'clamp(64px,9vw,80px)', height:'clamp(64px,9vw,80px)' }} />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton-shimmer rounded-full" style={{ width:60, height:18 }} />
              <div className="skeleton-shimmer rounded-lg" style={{ width:'55%', height:26 }} />
              <div className="skeleton-shimmer rounded" style={{ width:'35%', height:13 }} />
            </div>
          </div>
        </div>
        <div className={`border-b ${L ? 'border-black/5 bg-white' : 'border-white/5 bg-[#060608]'}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 flex gap-6 py-3.5">
            {[58, 48, 62].map((w, i) => <div key={i} className="skeleton-shimmer rounded" style={{ width:w, height:13 }} />)}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-4">
          <div className="skeleton-shimmer rounded-2xl" style={{ height:180 }} />
          <div className="skeleton-shimmer rounded-2xl" style={{ height:110 }} />
        </div>
      </div>
    </PageLayout>
  )
  if (!act) return (
    <PageLayout><div className="min-h-screen flex items-center justify-center">
      <p className="font-inter text-sm text-gray-400">Activity not found.</p>
    </div></PageLayout>
  )

  const cfg = SC(act.status)

  const clubRole     = user?.role || null
  const isPrivileged = ['admin','core'].includes(clubRole)
  const excludedIds  = new Set((act.excludedCores||[]).map(u => typeof u==='object' ? u._id?.toString() : u?.toString()))
  const isImplicitCore = clubRole === 'core' && !excludedIds.has(user?._id?.toString())
  const volEntry       = act.volunteers?.find(v => {
    const uid = typeof v.user==='object' ? v.user?._id : v.user
    return uid?.toString() === user?._id?.toString()
  })
  const isEnrolledExplicit = !!volEntry
  const isEnrolled   = isEnrolledExplicit || isImplicitCore || isPrivileged
  const volRole      = isImplicitCore ? 'coordinator' : (volEntry?.role || null)
  const isActCoord   = volRole === 'coordinator'

  const canUploadGallery    = isPrivileged || (isActCoord && act.coordCanManageGallery !== false)
  const canReorderGallery   = canUploadGallery
  const canAnnounce         = isPrivileged || (isActCoord && act.coordCanAnnounce !== false)
  // Announcements tab is for admin/core + coordinators only, not regular members
  const canSeeAnnouncements = isPrivileged || (isActCoord && act.coordCanAnnounce !== false)
  // Show gallery to all enrolled members when enabled, not only coordinators
  const showGallery = act.gallery?.length > 0 || canUploadGallery || isEnrolled
  const allDisplayMembers   = [...(act.volunteers || []), ...coreMembers]
  const formUrl = (url) => url && !/^https?:\/\//i.test(url) ? 'https://' + url : url

  const actEventDateList = act.eventDates?.length ? act.eventDates : (act.eventDate ? [act.eventDate] : [])
  const infoRows = [
    ['Status',      cfg.label],
    act.venue       && ['Venue',      act.venue],
    ...actEventDateList.map((d, i) => d && [actEventDateList.length === 1 ? 'Event Date' : i === 0 ? 'Event Date' : `Day ${i + 1}`, fmt(d)]),
    act.startDate   && ['Starts',     fmt(act.startDate)],
    act.endDate     && ['Ends',       fmt(act.endDate)],
    ...(act.customDates||[]).filter(cd=>cd.date).map(cd => [cd.title, fmt(cd.date)]),
  ].filter(Boolean)

  const TABS = [
    { id:'details',       label:'Details' },
    ...(isEnrolled ? [{ id:'volunteers', label:`Team (${allDisplayMembers.length})` }] : []),
    ...(showGallery ? [{ id:'gallery', label:'Gallery' }] : []),
    ...(canSeeAnnouncements ? [{ id:'announcements', label:'Announcements' }] : []),
  ]

  return (
    <PageLayout title={null}>
      <div className={'min-h-screen ' + (L?'bg-gray-50':'bg-[#060608]')}>

        {/* Hero */}
        <section className="relative overflow-hidden" style={{ minHeight:'clamp(100px,18vw,190px)' }}>
          <div className="absolute inset-0 bg-[#060814]">
            {act.bannerUrl && <img src={act.bannerUrl} alt="" className="w-full h-full object-cover opacity-20" style={{ filter:'blur(10px)', transform:'scale(1.15)' }} />}
            <div className="absolute inset-0" style={{ background:'linear-gradient(160deg,rgba(0,0,0,0.3) 0%,rgba(0,0,0,0.92) 100%)' }} />
            <div className={'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ' + cfg.stripe + ' to-transparent'} />
          </div>
          <div className="relative z-10 px-4 sm:px-8 pt-3 sm:pt-4 pb-3 sm:pb-4 max-w-5xl mx-auto"
            style={{ opacity:heroIn?1:0, transform:heroIn?'none':'translateY(8px)', transition:'opacity 0.4s ease 0.1s,transform 0.45s ease 0.1s' }}>
            <div className="flex items-start gap-2.5 sm:gap-4">
              {act.bannerUrl && (
                <div className="relative shrink-0 self-center rounded-md sm:rounded-xl overflow-hidden border border-white/20 shadow-lg" style={{ width:'clamp(64px,9vw,80px)', height:'clamp(64px,9vw,80px)' }}>
                  <ProgressiveImage src={act.bannerUrl} alt={act.name} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {statusCfg[act.status] && <span className={'font-inter text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider backdrop-blur-sm ' + cfg.badge}>{cfg.label}</span>}
                  {act.showNewBadge && <span className="font-inter text-[8px] px-2 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">NEW</span>}
                </div>
                <h1 className="font-clash text-lg sm:text-3xl font-bold text-white leading-tight drop-shadow-lg">{act.name}</h1>
                {act.subject && <p className="font-inter text-[11px] sm:text-sm text-violet-300/80 mt-0.5 sm:mt-1 font-medium">{act.subject}</p>}
                <div className="flex flex-wrap gap-x-2.5 mt-0.5 sm:mt-1">
                  {act.venue     && <p className="font-inter text-[12px] sm:text-sm text-white/60 font-medium">📍 {act.venue}</p>}
                  {actEventDateList[0] && <p className="font-inter text-[12px] sm:text-sm text-white/55 font-medium">📅 {fmt(actEventDateList[0])}</p>}
                </div>
              </div>
              {act.status !== 'past' && act.formPublished && act.googleFormUrl && (
                <a href={formUrl(act.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                  className="act-neo-violet shrink-0 self-start font-inter text-[11px] sm:text-xs font-bold px-3 sm:px-3.5 py-1.5 rounded-full text-white">
                  <span className="relative z-[2]">Register</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* User identity bar */}
        {user && (
          <div className={'border-b px-4 sm:px-8 py-2.5 ' + (L?'bg-white border-black/5':'bg-[#080810] border-white/5')}>
            <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800 border border-white/15 shrink-0">
                {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center font-clash text-[9px] font-black text-white/50">{user.name?.[0]}</span>}
              </div>
              <span className={'font-inter text-xs font-medium ' + (L?'text-gray-700':'text-gray-300')}>{user.name}</span>
              <span className={'font-inter text-[10px] ' + (L?'text-gray-400':'text-gray-600')}>·</span>
              {isEnrolled ? (
                <span className={'font-inter text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ' + (volRole==='coordinator'?'text-violet-400':'text-emerald-400')}>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                  {volRole==='coordinator' ? 'Coordinator' : isImplicitCore ? 'Core (Coordinator)' : 'Volunteer'}
                </span>
              ) : (
                <span className="font-inter text-[10px] text-gray-500 uppercase tracking-wider">Not Enrolled</span>
              )}
              {act.status !== 'past' && act.formPublished && act.googleFormUrl && (
                <a href={formUrl(act.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                  className="act-neo-violet ml-auto sm:hidden font-inter text-[10px] font-bold px-3 py-1 rounded-full text-white">
                  <span className="relative z-[2]">Register</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className={'sticky top-14 z-40 border-b ' + (L?'bg-white/90 border-black/5':'bg-[#060608]/90 border-white/5')} style={{ backdropFilter:'blur(14px)' }}>
          <div className="max-w-5xl mx-auto px-1 sm:px-8 flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex-shrink-0 px-3 sm:px-5 py-2.5 sm:py-3 font-inter text-[10px] sm:text-xs font-medium uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ' + (
                  activeTab === t.id
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent ' + (L?'text-gray-500 hover:text-gray-800':'text-gray-500 hover:text-white')
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-5xl mx-auto px-3 sm:px-8 py-2 sm:py-4 space-y-2.5 sm:space-y-4">

          {/* DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-2.5 sm:space-y-4">

              {act.activityBannerUrl && (
                <div className="relative rounded-xl sm:rounded-2xl overflow-hidden" style={{ boxShadow:`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)` }}>
                  <img src={act.activityBannerUrl} alt={act.name} className="w-full block" style={{ objectFit:'cover', maxHeight:'clamp(160px,40vw,360px)', width:'100%' }} />
                </div>
              )}

              {act.subject && (
                <ShineCard L={L} className="p-3 sm:p-4">
                  <p className={'font-inter text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] mb-1 sm:mb-1.5 ' + (L?'text-gray-400':'text-violet-400/70')}>Subject</p>
                  <p className={'font-inter text-sm sm:text-base font-semibold ' + (L?'text-gray-800':'text-white')}>{act.subject}</p>
                </ShineCard>
              )}

              {act.description && (
                <ShineCard L={L} className="p-3 sm:p-4">
                  <p className={'font-inter text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] mb-1 sm:mb-1.5 ' + (L?'text-gray-400':'text-gray-500')}>About</p>
                  <p className={'font-inter text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ' + (L?'text-gray-600':'text-gray-300')}>{act.description}</p>
                </ShineCard>
              )}

              {infoRows.length > 0 && (
                <div>
                  <p className={'font-inter text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] mb-2 sm:mb-2.5 ' + (L?'text-gray-500':'text-gray-400')}>Activity Info</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {infoRows.map(([k,v]) => (
                      <ShineCard key={k} L={L} className="p-2.5 sm:p-3.5">
                        <p className={'font-inter text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider mb-1 sm:mb-1.5 ' + (L?'text-gray-400':'text-gray-500')}>{k}</p>
                        <p className={'font-inter text-sm sm:text-base font-bold leading-tight ' + (L?'text-gray-900':'text-white')}>{v}</p>
                      </ShineCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Google Form CTA — only shown if googleFormUrl exists */}
              {act.googleFormUrl && act.status !== 'past' && (
                act.formPublished
                  ? <a href={formUrl(act.googleFormUrl)} target="_blank" rel="noopener noreferrer"
                      className="act-neo-violet flex items-center justify-center w-full font-inter text-sm font-bold py-3 sm:py-3.5 rounded-xl text-white">
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                        <div style={{ position:'absolute', top:0, bottom:0, width:'35%', background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 50%,transparent 100%)', animation:'shineSweep 3s ease-in-out infinite' }} />
                      </div>
                      <span className="relative z-[2]">Register via Google Form</span>
                    </a>
                  : <div className="act-neo-ghost flex items-center justify-center w-full font-inter text-sm py-3.5 rounded-xl text-gray-500">
                      <span className="relative z-[2]">Registration Form — Coming Soon</span>
                    </div>
              )}

              {act.links?.length > 0 && (
                <div>
                  <p className={'font-inter text-xs font-semibold uppercase tracking-[0.15em] mb-3 ' + (L?'text-gray-500':'text-gray-400')}>Links &amp; Resources</p>
                  <div className="flex flex-wrap gap-2">
                    {act.links.map(lnk => (
                      <a key={lnk._id} href={lnk.url.startsWith('http') ? lnk.url : 'https://'+lnk.url} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-inter text-sm font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                          lnk.type === 'resource'
                            ? 'bg-blue-900/20 text-blue-400 border-blue-700/40 hover:bg-blue-900/35'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                        }`}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        {lnk.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Status control — admin/core only */}
              {isPrivileged && (
                <div className={`auth-glass rounded-xl border p-3 space-y-2 ${L?'border-black/8':'border-white/8'}`}>
                  <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={async () => {
                      await activitiesApi.setStatus(act._id, false, '').catch(() => {})
                      setAct(a => ({ ...a, manualStatus: false }))
                    }} className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${!act.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                      Auto
                    </button>
                    {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                      <button key={lbl} onClick={async () => {
                        await activitiesApi.setStatus(act._id, true, val).catch(() => {})
                        setAct(a => ({ ...a, manualStatus: true, status: val }))
                      }} className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${act.manualStatus && act.status === val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Link to="/activities" className={'font-inter text-sm inline-flex items-center gap-1.5 transition-colors ' + (L?'text-gray-500 hover:text-gray-900':'text-gray-500 hover:text-white')}>
                ← Back to Activities
              </Link>
            </div>
          )}

          {/* TEAM */}
          {activeTab === 'volunteers' && (
            <div>
              <p className="font-inter text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-4">
                Activity Team — {allDisplayMembers.length} members
              </p>
              {!allDisplayMembers.length ? (
                <div className={'py-12 text-center auth-glass rounded-2xl border ' + (L?'border-black/7':'border-white/7')}>
                  <p className={'font-inter text-sm ' + (L?'text-gray-400':'text-gray-600')}>No team members yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                  {allDisplayMembers.map((v, i) => {
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
                          <p className={'font-inter text-[9px] mt-0.5 font-medium uppercase tracking-wider ' + (v.role==='coordinator'?'text-violet-400':'text-emerald-500')}>{v.role}</p>
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
            <ActGalleryTab act={act} canUpload={canUploadGallery} canReorder={canReorderGallery} isPrivileged={isPrivileged} L={L}
              onGalleryToggle={async (val) => {
                await activitiesApi.setGalleryVisibility(id, val).catch(() => {})
                setAct(a => ({ ...a, showInGallery: val }))
              }} />
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <ContextAnnouncementStudio
              contextType="activity"
              contextId={act._id}
              canAnnounce={canAnnounce}
              isPrivileged={isPrivileged}
              coordCanAnnounce={act.coordCanAnnounce}
              onCoordToggle={isPrivileged ? async val => {
                await activitiesApi.setCoordPerms(id, { coordCanAnnounce: val }).catch(() => {})
                setAct(a => ({ ...a, coordCanAnnounce: val }))
              } : undefined}
              L={L}
            />
          )}
        </div>
      </div>
    </PageLayout>
  )
}

// ── Activity card for explore page ────────────────────────────────────────────
function ActivityCard({ act, L, delay = 0, userRole = null }) {
  const enrolled = !!userRole
  const cfg = SC(act.status)
  const accent = { active:'#34d399', upcoming:'#a78bfa', past:'#9ca3af', draft:'#6b7280' }[act.status] || '#9ca3af'
  const beamDuration = { ongoing:'2.6s', upcoming:'3.2s', past:'3.8s' }[act.status] || '3s'
  return (
    <div className="relative rounded-[14px] p-[1.5px] overflow-hidden"
      style={{ boxShadow:`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)`, animation:`wipeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`, transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.4s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-6px) scale(1.022)'; e.currentTarget.style.boxShadow=`0 14px 44px ${cfg.glow},0 6px 18px rgba(0,0,0,0.55)` }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 4px 24px ${cfg.glow},0 2px 8px rgba(0,0,0,0.4)` }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:`linear-gradient(90deg,transparent 0%,${accent} 35%,rgba(255,255,255,0.9) 50%,${accent} 65%,transparent 100%)`, width:'28%', animation:`accentShine ${beamDuration} ease-in-out infinite` }} />
    <Link to={`/activities/${act._id}`}
      className="group relative rounded-[12px] overflow-hidden flex flex-col"
      style={{ background: L ? 'rgba(242,242,246,0.98)' : 'rgba(13,13,17,0.98)' }}>
      <div className="absolute inset-0 pointer-events-none z-10 rounded-[12px]"
        style={{ background:`linear-gradient(135deg,rgba(255,255,255,${L?'0.18':'0.05'}) 0%,transparent 45%)` }} />
      <div className={`h-[1.5px] w-full bg-gradient-to-r from-transparent ${cfg.stripe} to-transparent shrink-0 relative z-10`} />
      <div className="relative overflow-hidden shrink-0" style={{ height:'clamp(72px,15vw,175px)' }}>
        {act.bannerUrl
          ? <ProgressiveImage src={act.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.07]" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#0d0720,#0a0a1e)' }}>
              <span className="font-clash font-black" style={{ fontSize:'clamp(60px,8vw,100px)', color: L ? 'rgba(163,177,200,0.22)' : 'rgba(255,255,255,0.05)' }}>{act.name[0]}</span>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {act.showNewBadge && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">NEW</span>}
          {statusCfg[act.status] && <span className={`font-inter text-[8px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold backdrop-blur-sm ${cfg.badge}`}>{cfg.label}</span>}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 z-10">
          <p className="font-inter text-sm font-bold text-white leading-tight drop-shadow-md">{act.name}</p>
          {act.subject && <p className="font-inter text-[9px] text-white/55 mt-0.5 truncate">{act.subject}</p>}
        </div>
      </div>
      <div className={`flex-1 px-3 py-2.5 sm:py-2 space-y-1 sm:space-y-0.5 relative z-10`}>
        {act.venue    && <p className={`font-inter text-xs flex items-center gap-1.5 ${L?'text-gray-600':'text-gray-400'}`}>📍 {act.venue}</p>}
        {(act.eventDates?.[0] || act.eventDate) && act.status !== 'past' && <p className={`font-inter text-xs flex items-center gap-1.5 ${L?'text-gray-600':'text-gray-400'}`}>📅 {fmt(act.eventDates?.[0] || act.eventDate)}</p>}
        {act.status !== 'past' && act.formPublished && act.googleFormUrl && (
          <p className="font-inter text-xs text-violet-400">📋 Registration open</p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          {userRole ? (
            <span className={`font-inter text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${userRole==='coordinator'?'text-violet-400':'text-emerald-400'}`}>
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

function PastActivityCard({ act, L, delay = 0 }) {
  return (
    <Link to={`/activities/${act._id}`}
      className="group relative rounded-xl overflow-hidden cursor-pointer"
      style={{
        filter:'grayscale(20%) brightness(0.82)',
        boxShadow: L ? '3px 3px 10px rgba(0,0,0,0.10),-3px -3px 8px rgba(255,255,255,0.85)' : '3px 3px 10px rgba(0,0,0,0.85),-1px -1px 3px rgba(255,255,255,0.04)',
        background: L ? 'rgba(242,242,246,0.98)' : 'rgba(10,10,14,0.98)',
        animation:`wipeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
        transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), filter 0.35s ease',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-6px) scale(1.022)'; e.currentTarget.style.filter='grayscale(0%) brightness(0.96)' }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.filter='grayscale(20%) brightness(0.82)' }}>
      <div className="relative overflow-hidden" style={{ height:'clamp(90px,13vw,160px)' }}>
        {act.bannerUrl
          ? <ProgressiveImage src={act.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-600" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#111,#1a1a2e)' }}>
              <span className="font-clash text-6xl font-black" style={{ color: L ? 'rgba(163,177,200,0.18)' : 'rgba(255,255,255,0.06)' }}>{act.name[0]}</span>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
        <span className="absolute top-3 left-3 font-inter text-[9px] px-2 py-0.5 rounded-full bg-gray-800/80 text-gray-400 border border-gray-700/50 uppercase tracking-wider backdrop-blur-sm">Ended</span>
        <div className="absolute bottom-3 left-4">
          <p className="font-inter text-sm font-bold text-white leading-tight">{act.name}</p>
          {act.subject && <p className="font-inter text-[10px] text-gray-400 mt-0.5">{act.subject}</p>}
        </div>
      </div>
    </Link>
  )
}

// ── Session divider ───────────────────────────────────────────────────────────
function ActSessionDivider({ session, count, L }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
      <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
        {session} · {count} activit{count !== 1 ? 'ies' : 'y'}
      </span>
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
    </div>
  )
}

// ── Explore page ──────────────────────────────────────────────────────────────
const FILTERS = ['all','ongoing','upcoming','past']

export default function ActivitiesPage() {
  const { theme } = useTheme()
  const L = theme === 'light'
  const { id: actId } = useParams()
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const { data, loading } = useData(() => activitiesApi.list(), 5000)
  const { user } = useAuth()
  const { data: sectData } = useData(() => settingsApi.getSections(), 5000)
  const isAdminOrCore = user && ['admin','core'].includes(user.role)
  const showPast = isAdminOrCore || (sectData?.sections?.['show-past-activities'] !== false)

  if (actId) return <ActivityDetailPage id={actId} />

  const getUserRole = (a) => {
    if (!user || !user._id) return null
    if (user.role === 'core') return 'coordinator'
    if (!Array.isArray(a.volunteers)) return null
    const uid = user._id?.toString()
    const v = a.volunteers.find(v => {
      try {
        const vid = typeof v.user === 'object' ? v.user?._id?.toString() : v.user?.toString()
        return vid && uid && vid === uid
      } catch { return false }
    })
    return v?.role || null
  }

  const sorted = (arr) => [...arr].sort((a, b) => {
    const aE = getUserRole(a) ? 0 : 1
    const bE = getUserRole(b) ? 0 : 1
    if (aE !== bE) return aE - bE
    const aD = new Date(a.eventDates?.[0] || a.eventDate || a.startDate || a.createdAt)
    const bD = new Date(b.eventDates?.[0] || b.eventDate || b.startDate || b.createdAt)
    return aD - bD || new Date(b.createdAt) - new Date(a.createdAt)
  })

  const isPrivileged = user && ['admin','core'].includes(user.role)
  const rawAll       = sorted(data?.activities || [])
  // Drafts only visible to admin/core on the explore page
  const allActs      = isPrivileged ? rawAll : rawAll.filter(a => a.status !== 'draft')
  const curSession     = currentSession()
  const currentItems   = allActs.filter(a => isCurrentSession(a))
  const pastItems      = allActs.filter(a => !isCurrentSession(a))
  const pastBySession  = pastItems.reduce((acc, a) => {
    const s = getItemSession(getPrimaryItemDate(a)) || 'Older'
    ;(acc[s] = acc[s] || []).push(a)
    return acc
  }, {})
  const pastSessions   = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions    = [curSession, ...pastSessions]
  const sessionItems   = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession  = sessionFilter !== curSession
  const ongoing  = sorted(sessionItems.filter(a=>a.status==='ongoing'))
  const upcoming = sorted(sessionItems.filter(a=>a.status==='upcoming'))
  const past     = sorted(sessionItems.filter(a=>a.status==='past'))
  const live     = [...ongoing,...upcoming]
  const displayed = filter==='all'?sessionItems : filter==='ongoing'?ongoing : filter==='upcoming'?upcoming : past
  const fc = {all:sessionItems.length,ongoing:ongoing.length,upcoming:upcoming.length,past:past.length}

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen transition-colors ${L?'bg-gray-50':'bg-[#060608]'}`}>

        {/* Header */}
        <div className={`border-b px-5 sm:px-8 pt-4 sm:pt-5 pb-2 sm:pb-6 ${L?'bg-white border-black/5':'bg-[#08080c] border-white/5'}`}>
          <div className="max-w-6xl mx-auto text-center">
            <h1 className={`pl-heading-in font-inter font-bold leading-none ${L?'text-gray-900':'text-white'}`}
              style={{ fontSize:'clamp(1.75rem,5.5vw,3.6rem)' }}>
              Activities
            </h1>
            <p className={`pl-subtitle-in font-inter text-xs sm:text-sm mt-1 sm:mt-5 ${L?'text-gray-400':'text-gray-500'}`}>
              Every event. Every story. Captured through our lens.
            </p>
            {active.length > 0 && (
              <div className="mt-1.5 sm:mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-700/40 bg-emerald-900/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-inter text-[9px] font-bold uppercase tracking-wider text-emerald-400">{active.length} Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-1.5 sm:py-3 space-y-2 sm:space-y-4">

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

          {/* Filter tabs */}
          <div className={`flex gap-0.5 p-1 rounded-lg w-fit ${L?'bg-black/5':'bg-white/5'}`}
            style={{ boxShadow:L?'inset 2px 2px 4px rgba(0,0,0,0.05),inset -2px -2px 4px rgba(255,255,255,0.7)':'inset 2px 2px 4px rgba(0,0,0,0.85),inset -1px -1px 2px rgba(255,255,255,0.03)' }}>
            {FILTERS.map(f => {
              const isActive = filter === f
              return (
                <button key={f} onClick={()=>setFilter(f)}
                  className={`px-2.5 py-1 rounded-md font-inter text-[10px] font-semibold capitalize ${
                    isActive
                      ? 'act-neo-violet text-white'
                      : `act-neo-ghost ${L?'text-gray-600':'text-gray-400'}`
                  }`}>
                  <span className="relative z-[2]">{f}{fc[f]>0 && <span className="ml-1 opacity-60" style={{ fontSize:8 }}>{fc[f]}</span>}</span>
                </button>
              )
            })}
          </div>

          {loading && <SkeletonCardGrid n={6} ratio="16/9" className="pl-section-in" />}

          {!loading && isPastSession && (
            <div className="mb-4">
              <ActSessionDivider session={sessionFilter} count={sessionItems.length} L={L} />
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div className={`py-16 text-center rounded-2xl border ${L?'border-black/6 bg-white/40':'border-white/6 bg-white/[0.02]'}`}>
              <p className="text-4xl mb-3">📸</p>
              <p className={`font-inter text-base font-semibold mb-1 ${L?'text-gray-700':'text-gray-300'}`}>
                No {filter === 'all' ? '' : filter} activities {isPastSession ? `in ${sessionFilter}` : 'yet'}
              </p>
              <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-600'}`}>Check back soon!</p>
            </div>
          )}

          {filter === 'all' && !loading && (
            <div className="pl-section-in space-y-2 sm:space-y-4">
              {live.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className={`font-inter text-[9px] uppercase tracking-widest ${L?'text-gray-500':'text-gray-600'}`}>
                      {active.length>0?'Active & Upcoming':'Upcoming'}
                    </p>
                    {active.length>0 && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">LIVE</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {live.map((a,i)=><ActivityCard key={a._id} act={a} L={L} delay={i*70} userRole={getUserRole(a)}/>)}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <p className={`font-inter text-[9px] uppercase tracking-widest mb-2.5 ${L?'text-gray-500':'text-gray-600'}`}>Past Activities</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {past.map((a,i)=><PastActivityCard key={a._id} act={a} L={L} delay={i*70}/>)}
                  </div>
                </section>
              )}
            </div>
          )}

          {filter !== 'all' && !loading && displayed.length > 0 && (
            <div className="pl-section-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayed.map((a,i) => filter==='past'
                ? <PastActivityCard key={a._id} act={a} L={L} delay={i*70}/>
                : <ActivityCard key={a._id} act={a} L={L} delay={i*70} userRole={getUserRole(a)}/>
              )}
            </div>
          )}

        </div>
      </div>
    </PageLayout>
  )
}
