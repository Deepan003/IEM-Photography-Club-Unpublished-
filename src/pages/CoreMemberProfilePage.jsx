import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { coreApi, uploadFileToS3 } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import ProgressiveImage from '../components/ProgressiveImage.jsx'
import { SkeletonMasonryGrid } from '../components/Skeleton.jsx'

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  const photo  = photos[index]
  const touchX = useRef(null)

  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const handleTouchEnd   = (e) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) { dx > 0 ? onPrev() : onNext() }
    touchX.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[600] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.11)' }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Image wrapper — swipe-enabled */}
      <div className="relative max-w-5xl max-h-screen w-full px-4 sm:px-14 py-6"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        <img src={photo?.url} alt={photo?.caption || ''}
          className="w-full max-h-[68vh] sm:max-h-[82vh] object-contain rounded-2xl" />
        {photo?.caption && (
          <p className="mt-3 text-center font-inter text-sm text-gray-300 leading-relaxed">{photo.caption}</p>
        )}
        <p className="mt-1 text-center font-inter text-[10px] text-gray-600">{index + 1} / {photos.length}</p>

        {/* Mobile-only nav row — below the photo */}
        {photos.length > 1 && (
          <div className="flex sm:hidden justify-center gap-8 mt-5">
            <button onClick={e => { e.stopPropagation(); onPrev() }}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.13)' }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); onNext() }}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.13)' }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>

      {/* Desktop-only side nav */}
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); onPrev() }}
            className="hidden sm:flex absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onNext() }}
            className="hidden sm:flex absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CoreMemberProfilePage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { theme } = useTheme()
  const { user: authUser } = useAuth()
  const L         = theme === 'light'
  const isAdmin   = authUser && ['admin', 'core'].includes(authUser.role)

  const [member,        setMember]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const [deletingCover, setDeletingCover] = useState(false)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [coverUploading,   setCoverUploading]   = useState(false)
  const galleryFileRef = useRef(null)
  const coverFileRef   = useRef(null)
  const dragIndexRef   = useRef(null)
  const [dragOver,     setDragOver]   = useState(null)
  const [reordering,   setReordering] = useState(false)

  // Cover drag-to-reposition
  const coverRef      = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartY    = useRef(0)
  const dragStartPos  = useRef(50)
  const pendingSave   = useRef(null)
  const [coverPosition, setCoverPosition] = useState(50)
  const [isDragging,    setIsDragging]    = useState(false)
  const [coverHover,    setCoverHover]    = useState(false)

  useEffect(() => {
    setLoading(true); setError(null)
    coreApi.get(id)
      .then(d => {
        setMember(d.member)
        setCoverPosition(parseFloat(d.member?.coverPhotoPosition) || 50)
      })
      .catch(e => setError(e.message || 'Not found.'))
      .finally(() => setLoading(false))
  }, [id])

  // Silent background refresh every 30s — skips if user is uploading or reordering
  useEffect(() => {
    const poll = setInterval(() => {
      if (!galleryUploading && !coverUploading && !reordering && dragIndexRef.current === null) {
        coreApi.get(id).then(d => setMember(d.member)).catch(() => {})
      }
    }, 30000)
    return () => clearInterval(poll)
  }, [id]) // eslint-disable-line

  const canReposition = isAdmin && !!member?.coverPhoto

  const startDrag = useCallback((clientY) => {
    isDraggingRef.current = true
    setIsDragging(true)
    dragStartY.current   = clientY
    dragStartPos.current = coverPosition
  }, [coverPosition])

  const moveDrag = useCallback((clientY) => {
    if (!isDraggingRef.current || !coverRef.current) return
    const h      = coverRef.current.offsetHeight || 1
    const delta  = ((dragStartY.current - clientY) / h) * 100
    const newPos = Math.max(0, Math.min(100, dragStartPos.current + delta))
    setCoverPosition(newPos)
    pendingSave.current = newPos
  }, [])

  const endDrag = useCallback(async () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    const pos = pendingSave.current
    if (pos === null) return
    pendingSave.current = null
    try { await coreApi.setCoverPos(id, `${Math.round(pos)}%`) } catch (_) { /* non-critical */ }
  }, [id])

  useEffect(() => {
    const onMove = (e) => moveDrag(e.clientY ?? e.touches?.[0]?.clientY)
    const onUp   = ()  => endDrag()
    const onTM   = (e) => moveDrag(e.touches[0].clientY)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onTM, { passive: true })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onTM)
      window.removeEventListener('touchend',  onUp)
    }
  }, [moveDrag, endDrag])

  useEffect(() => {
    if (lightboxIndex === null || !member) return
    const gallery = member.gallery || []
    const onKey = e => {
      if (e.key === 'ArrowLeft')  setLightboxIndex(i => (i > 0 ? i - 1 : gallery.length - 1))
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i < gallery.length - 1 ? i + 1 : 0))
      if (e.key === 'Escape')     setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, member?.gallery?.length])

  const handleDeletePhoto = async (photoId) => {
    setDeletingPhoto(photoId)
    try {
      await coreApi.deleteGalleryPhoto(id, photoId)
      setMember(m => ({ ...m, gallery: m.gallery.filter(p => p._id !== photoId) }))
    } catch (e) { alert(e.message) }
    finally { setDeletingPhoto(null) }
  }

  const handleDeleteCover = async () => {
    if (!confirm('Remove cover photo?')) return
    setDeletingCover(true)
    try {
      await coreApi.deleteCover(id)
      setMember(m => ({ ...m, coverPhoto: null, coverPhotoS3Key: null }))
    } catch (e) { alert(e.message) }
    finally { setDeletingCover(false) }
  }

  const handleUploadGallery = async (files) => {
    setGalleryUploading(true)
    try {
      const results = []
      for (const file of Array.from(files)) {
        const r = await uploadFileToS3(file, 'core-gallery')
        results.push({ url: r.publicUrl, s3Key: r.key, mobileUrl: r.mobileUrl, mobileKey: r.mobileKey })
      }
      const d = await coreApi.addGalleryPhotos(id, { photos: results })
      setMember(m => ({ ...m, gallery: d.gallery || [] }))
    } catch (e) { alert(e.message) }
    finally { setGalleryUploading(false); if (galleryFileRef.current) galleryFileRef.current.value = '' }
  }

  const handleUploadCover = async (file) => {
    setCoverUploading(true)
    try {
      const r = await uploadFileToS3(file, 'core-covers')
      await coreApi.setCover(id, { coverPhoto: r.publicUrl, coverPhotoS3Key: r.key })
      setMember(m => ({ ...m, coverPhoto: r.publicUrl, coverPhotoS3Key: r.key }))
    } catch (e) { alert(e.message) }
    finally { setCoverUploading(false); if (coverFileRef.current) coverFileRef.current.value = '' }
  }

  const handleGalleryDrop = async (gallery, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const reordered = [...gallery]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setMember(m => ({ ...m, gallery: reordered.map((p, i) => ({ ...p, order: i })) }))
    setReordering(true)
    try { await coreApi.reorderGallery(id, reordered.map(p => p._id)) } catch (_) {}
    finally { setReordering(false) }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${L ? 'bg-[#e8ecf3]' : 'bg-[#06060a]'}`}>
        {/* Cover skeleton */}
        <div className="skeleton-shimmer w-full h-[270px] sm:h-[400px]" />
        {/* Profile card — overlaps cover */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 -mt-[165px] sm:-mt-[200px]">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
            <div className="skeleton-shimmer rounded-full shrink-0 z-10" style={{ width: 80, height: 80 }} />
            <div className="flex-1 sm:pb-2 space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer rounded-lg" style={{ width: '40%', height: 28 }} />
                <div className="skeleton-shimmer rounded-full" style={{ width: 72, height: 18 }} />
              </div>
              <div className="flex flex-wrap gap-3">
                {[90, 60, 100].map((w, i) => <div key={i} className="skeleton-shimmer rounded" style={{ width: w, height: 13 }} />)}
              </div>
              <div className="skeleton-shimmer rounded" style={{ width: '55%', height: 12 }} />
            </div>
          </div>
          <div className="mt-5 mb-4 skeleton-shimmer" style={{ height: 1 }} />
          <SkeletonMasonryGrid n={6} />
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${L ? 'bg-[#e8ecf3]' : 'bg-[#06060a]'}`}>
        <p className={`font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-500'}`}>{error || 'Member not found.'}</p>
        <button onClick={() => navigate('/core')}
          className="font-inter text-xs text-red-400 hover:text-red-300 transition-colors">
          ← Back to Core Committee
        </button>
      </div>
    )
  }

  const initials  = member.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const gallery   = (member.gallery || []).sort((a, b) => a.order - b.order)

  // Alumni check: members whose year has ended are passout
  const isCurrent = (yearStr) => {
    const endYear = parseInt((yearStr || '').split('-')[0]) + 1
    const now = new Date(), yr = now.getFullYear(), mo = now.getMonth() + 1
    return endYear > yr || (endYear === yr && mo < 6)
  }
  const displayDesig = isCurrent(member.year) ? (member.designation || 'Core') : 'Alumni'
  const coverFallback = L
    ? 'linear-gradient(145deg,#dce1ec 0%,#bcc8dc 100%)'
    : 'linear-gradient(145deg,#0d0d1c 0%,#060610 100%)'

  return (
    <>
      <div className={`min-h-screen ${L ? 'bg-[#e8ecf3]' : 'bg-[#06060a]'}`}>

        {/* Back button */}
        <div className="fixed top-4 left-4 z-50">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-xs font-semibold backdrop-blur-md text-white transition-all active:scale-95"
            style={{ background: 'rgba(0,0,0,0.58)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
        </div>

        {/* Cover photo */}
        <div
          ref={coverRef}
          className="relative w-full overflow-hidden select-none h-[270px] sm:h-[400px]"
          style={{
            background: coverFallback,
            cursor: canReposition ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onMouseDown={e => canReposition && startDrag(e.clientY)}
          onTouchStart={e => canReposition && startDrag(e.touches[0].clientY)}
          onMouseEnter={() => setCoverHover(true)}
          onMouseLeave={() => setCoverHover(false)}>
          {member.coverPhoto && (
            <img src={member.coverPhoto} alt="Cover"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `center ${coverPosition}%` }} />
          )}
          {canReposition && member.coverPhoto && (coverHover || isDragging) && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
              <span className="font-inter text-[10px] font-semibold text-white px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', letterSpacing: '0.08em' }}>
                {isDragging ? 'Repositioning…' : 'Hold to reposition'}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '65%', background: L ? 'linear-gradient(to top,#e8ecf3 30%,transparent)' : 'linear-gradient(to top,#06060a 30%,transparent)' }} />

          {/* Admin cover controls */}
          {isAdmin && (
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              {member.coverPhoto && (
                <button onClick={handleDeleteCover} disabled={deletingCover}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-inter text-xs font-medium text-white backdrop-blur-md transition-all disabled:opacity-50"
                  style={{ background: 'rgba(220,38,38,0.75)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  {deletingCover ? '…' : 'Remove Cover'}
                </button>
              )}
              <button onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-inter text-xs font-medium text-white backdrop-blur-md transition-all disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                {coverUploading ? 'Uploading…' : member.coverPhoto ? 'Change Cover' : 'Set Cover'}
              </button>
              <input ref={coverFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files[0]) handleUploadCover(e.target.files[0]) }} />
            </div>
          )}
        </div>

        {/* Profile card */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 -mt-[165px] sm:-mt-[200px]">

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">

            {/* Profile photo — square with animated border beam */}
            <div className="relative shrink-0 z-10">
              <div
                className="profile-photo-beam w-28 h-28 sm:w-36 sm:h-36"
                style={{
                  background: L ? '#dce1ec' : '#151520',
                  boxShadow:  L
                    ? '6px 6px 18px rgba(163,177,200,0.5), -4px -4px 10px rgba(255,255,255,0.9)'
                    : '0 8px 28px rgba(0,0,0,0.6)',
                }}>
                <div className="profile-photo-inner">
                  {member.photoUrl
                    ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-clash font-black"
                        style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', color: L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' }}>
                        {initials}
                      </div>}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full"
                style={{ background: '#dc2626', border: `2px solid ${L ? '#e8ecf3' : '#06060a'}` }} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className={`font-clash font-bold leading-tight ${L ? 'text-gray-900' : 'text-white'}`}
                  style={{ fontSize: 'clamp(1.2rem,3.2vw,1.85rem)' }}>
                  {member.name}
                </h1>
                <span className="font-inter text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(220,38,38,0.14)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.28)' }}>
                  {displayDesig}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className={`font-inter text-xs flex items-center gap-1.5 ${L ? 'text-gray-600' : 'text-gray-400'}`}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {member.year}
                </span>
                {member.stream && (
                  <span className={`font-inter text-xs flex items-center gap-1.5 ${L ? 'text-gray-500' : 'text-gray-500'}`}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M3 12h1M20 12h1M12 3v1M12 20v1M5.6 5.6l.7.7M17.7 17.7l.7.7M17.7 6.3l-.7.7M6.3 17.7l-.7.7"/></svg>
                    {member.stream}
                  </span>
                )}
                {member.linkedUser?.email && (
                  <a href={`mailto:${member.linkedUser.email}`}
                    className={`font-inter text-xs flex items-center gap-1.5 transition-colors ${L?'text-gray-500 hover:text-gray-700':'text-gray-400 hover:text-gray-200'}`}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
                    {member.linkedUser.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="mt-5 sm:mt-3 mb-4 h-px" style={{ background: L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)' }} />

          {/* Gallery section */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
                stroke={L ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)'} strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className={`font-inter text-[10px] uppercase tracking-[0.22em] ${L ? 'text-gray-500' : 'text-gray-500'}`}>Gallery</span>
              {gallery.length > 0 && (
                <span className={`font-inter text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                  · {gallery.length} photo{gallery.length !== 1 ? 's' : ''}
                </span>
              )}
              <div className="flex-1 h-px" style={{ background: L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)' }} />
              {isAdmin && (
                <>
                  <button
                    onClick={() => galleryFileRef.current?.click()}
                    disabled={galleryUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    style={{ background: 'rgba(220,38,38,0.85)', boxShadow: '0 2px 8px rgba(220,38,38,0.28)' }}>
                    {galleryUploading
                      ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                    {galleryUploading ? 'Uploading…' : 'Add Photos'}
                  </button>
                  <input ref={galleryFileRef} type="file" multiple accept="image/*" className="hidden"
                    onChange={e => handleUploadGallery(e.target.files)} />
                </>
              )}
            </div>

            {gallery.length > 0 ? (
              <>
                {isAdmin && gallery.length > 1 && (
                  <p className="font-inter text-[10px] text-gray-600 mb-3 flex items-center gap-1.5">
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                    Drag photos to reorder{reordering ? ' · Saving…' : ''}
                  </p>
                )}
                <div className={isAdmin ? 'grid grid-cols-2 sm:grid-cols-3 gap-0.5' : 'columns-2 sm:columns-3 gap-0.5'}>
                  {gallery.map((photo, i) => (
                    <div
                      key={photo._id || i}
                      className={`${isAdmin ? '' : 'break-inside-avoid mb-0.5 '}overflow-hidden group relative transition-all duration-200${
                        isAdmin ? ' cursor-grab active:cursor-grabbing' : ' cursor-pointer'
                      }${dragOver === i && dragIndexRef.current !== i ? ' ring-2 ring-red-500 scale-[0.97]' : ''}`}
                      style={isAdmin ? { height: 'clamp(120px,16vw,180px)' } : undefined}
                      draggable={isAdmin}
                      onDragStart={() => { dragIndexRef.current = i }}
                      onDragEnter={isAdmin ? () => setDragOver(i) : undefined}
                      onDragOver={isAdmin ? e => e.preventDefault() : undefined}
                      onDragLeave={isAdmin ? () => setDragOver(null) : undefined}
                      onDrop={isAdmin ? (e) => {
                        e.preventDefault()
                        const from = dragIndexRef.current
                        dragIndexRef.current = null
                        setDragOver(null)
                        if (from !== null) handleGalleryDrop(gallery, from, i)
                      } : undefined}
                      onDragEnd={() => { dragIndexRef.current = null; setDragOver(null) }}
                      onClick={() => !isAdmin && setLightboxIndex(i)}>
                      <ProgressiveImage
                        src={photo.url} mobileSrc={photo.mobileUrl}
                        alt={photo.caption || ''}
                        className={isAdmin ? 'absolute inset-0 w-full h-full object-cover pointer-events-none' : 'w-full h-auto block'}
                        masonry={!isAdmin} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ background: 'rgba(0,0,0,0.25)' }} />
                      {isAdmin ? (
                        <>
                          {/* Drag handle — top-left */}
                          <div className="absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{ background: 'rgba(0,0,0,0.55)' }}>
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                          </div>
                          {/* Delete — top-right */}
                          <button
                            onClick={e => { e.stopPropagation(); handleDeletePhoto(photo._id) }}
                            disabled={deletingPhoto === photo._id}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110 disabled:opacity-50"
                            style={{ background: 'rgba(220,38,38,0.9)' }}>
                            {deletingPhoto === photo._id
                              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>}
                          </button>
                        </>
                      ) : (
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: 'rgba(0,0,0,0.65)' }}
                          onClick={() => setLightboxIndex(i)}>
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none"
                  stroke={L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.07)'} strokeWidth={1.2}
                  className="mx-auto mb-3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className={`font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isAdmin ? 'No photos yet. Click "Add Photos" to upload.' : 'This user is yet to upload any photos.'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i > 0 ? i - 1 : gallery.length - 1))}
          onNext={() => setLightboxIndex(i => (i < gallery.length - 1 ? i + 1 : 0))}
        />
      )}
    </>
  )
}
