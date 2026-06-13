import { useState, useEffect, useRef, useCallback } from 'react'
import { userGalleryApi, settingsApi, uploadFileToS3 } from '../api/api.js'
import { LiquidLoader } from './ProgressiveImage.jsx'
import ProgressiveImage from './ProgressiveImage.jsx'
import { useAuth } from '../App.jsx'

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  const photo = photos[index]
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      onClick={onClose}>

      {/* Close */}
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.12)' }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Image */}
      <div className="relative max-w-4xl max-h-screen w-full px-12 py-6" onClick={e => e.stopPropagation()}>
        <img src={photo?.url} alt={photo?.caption || ''}
          className="w-full max-h-[80vh] object-contain rounded-xl" />
        {photo?.caption && (
          <p className="mt-3 text-center font-inter text-sm text-gray-300">{photo.caption}</p>
        )}
        <p className="mt-1.5 text-center font-inter text-[10px] text-gray-600">
          {index + 1} / {photos.length}
        </p>
      </div>

      {/* Prev / Next */}
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); onPrev() }}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onNext() }}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
    </div>
  )
}

// ── My Gallery Tab ────────────────────────────────────────────────────────────
export default function MyGalleryTab({ user, L }) {
  const { setUser } = useAuth()

  const [photos,         setPhotos]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [uploadError,    setUploadError]    = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverUrl,       setCoverUrl]       = useState(user?.coverPhoto || null)
  const [lightboxIndex,  setLightboxIndex]  = useState(null)
  const [dragIndex,      setDragIndex]      = useState(null)
  const [dragOverIndex,  setDragOverIndex]  = useState(null)
  const [deleteConfirm,  setDeleteConfirm]  = useState(null)
  const [galleryEnabled, setGalleryEnabled] = useState(true)
  const [maxPhotos,      setMaxPhotos]      = useState(0)   // 0 = unlimited

  // Cover drag-to-reposition
  const coverRef        = useRef(null)
  const isDraggingRef   = useRef(false)
  const dragStartY      = useRef(0)
  const dragStartPos    = useRef(50)
  const pendingSave     = useRef(null)
  const [coverPosition, setCoverPosition]   = useState(parseFloat(user?.coverPhotoPosition) || 50)
  const [isDragging,    setIsDragging]      = useState(false)
  const [coverHover,    setCoverHover]      = useState(false)

  const fileInputRef     = useRef(null)
  const coverInputRef    = useRef(null)

  // Load gallery + settings on mount
  useEffect(() => {
    Promise.all([
      userGalleryApi.getMyGallery(),
      settingsApi.getGallerySettings(),
    ]).then(([d, gs]) => {
      setPhotos((d.gallery || []).sort((a, b) => a.order - b.order))
      if (d.coverPhoto) setCoverUrl(d.coverPhoto)
      if (d.coverPhotoPosition) setCoverPosition(parseFloat(d.coverPhotoPosition) || 50)
      setGalleryEnabled(gs.gallery?.enabled !== false)
      setMaxPhotos(gs.gallery?.maxPhotos ?? 0)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Keyboard shortcuts for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = e => {
      if (e.key === 'ArrowLeft')  setLightboxIndex(i => (i > 0 ? i - 1 : photos.length - 1))
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i < photos.length - 1 ? i + 1 : 0))
      if (e.key === 'Escape')     setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, photos.length])

  // Cover drag-to-reposition
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
    try { await userGalleryApi.setCoverPos(`${Math.round(pos)}%`) } catch (_) {}
  }, [])

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

  // Multi-file upload: sequential to avoid server overload
  const handleFiles = async (files) => {
    setUploadError('')
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return

    // Enforce max photos limit
    const remaining = maxPhotos > 0 ? maxPhotos - photos.length : Infinity
    if (remaining <= 0) {
      setUploadError(`Upload limit reached. You can have at most ${maxPhotos} photo${maxPhotos !== 1 ? 's' : ''}.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    let batch = arr
    if (maxPhotos > 0 && arr.length > remaining) {
      setUploadError(`You selected ${arr.length} photo${arr.length !== 1 ? 's' : ''}, but only ${remaining} slot${remaining !== 1 ? 's' : ''} remaining (limit: ${maxPhotos}). Uploading first ${remaining}.`)
      batch = arr.slice(0, remaining)
    }

    setUploading(true)
    setUploadProgress({ current: 0, total: batch.length })
    const uploaded = []
    for (let i = 0; i < batch.length; i++) {
      try {
        const result = await uploadFileToS3(batch[i], 'gallery')
        uploaded.push({ url: result.publicUrl, s3Key: result.key, mobileUrl: result.mobileUrl, mobileKey: result.mobileKey })
      } catch {}
      setUploadProgress({ current: i + 1, total: batch.length })
    }
    if (uploaded.length) {
      try {
        const d = await userGalleryApi.addPhotos({ photos: uploaded })
        setPhotos((d.gallery || []).sort((a, b) => a.order - b.order))
      } catch {}
    }
    setUploading(false)
    setUploadProgress({ current: 0, total: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Cover photo upload
  const handleCoverFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setCoverUploading(true)
    try {
      const result = await uploadFileToS3(file, 'gallery')
      setCoverUrl(result.publicUrl)
      await userGalleryApi.setCoverPhoto({ coverPhoto: result.publicUrl, coverPhotoS3Key: result.key })
      setUser(u => ({ ...u, coverPhoto: result.publicUrl, coverPhotoS3Key: result.key }))
    } catch {}
    setCoverUploading(false)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  // Drag-to-reorder handlers
  const onDragStart = (i) => setDragIndex(i)
  const onDragOver  = (e, i) => { e.preventDefault(); setDragOverIndex(i) }
  const onDrop      = async (targetIdx) => {
    if (dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null); setDragOverIndex(null); return
    }
    const reordered = [...photos]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIdx, 0, moved)
    setPhotos(reordered)
    setDragIndex(null)
    setDragOverIndex(null)
    try { await userGalleryApi.reorder(reordered.map(p => p._id)) } catch {}
  }
  const onDragEnd = () => { setDragIndex(null); setDragOverIndex(null) }

  // Delete a photo
  const confirmDelete = async (photoId) => {
    try {
      await userGalleryApi.deletePhoto(photoId)
      setPhotos(ps => ps.filter(p => p._id !== photoId))
      if (lightboxIndex !== null) {
        const newLen = photos.length - 1
        if (newLen === 0) setLightboxIndex(null)
        else setLightboxIndex(i => Math.min(i, newLen - 1))
      }
    } catch {}
    setDeleteConfirm(null)
  }

  // ── Derived limit state ───────────────────────────────────────────────────
  const atLimit       = maxPhotos > 0 && photos.length >= maxPhotos
  const remainingSlots = maxPhotos > 0 ? Math.max(0, maxPhotos - photos.length) : null
  const sep = L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'

  // ── Gallery disabled ─────────────────────────────────────────────────────
  if (!loading && !galleryEnabled) {
    return (
      <div className="py-20 text-center max-w-sm mx-auto">
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none"
          stroke={L?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.08)'} strokeWidth={1.2}
          className="mx-auto mb-4">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-500'}`}>
          My Gallery is currently disabled by the admin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7 max-w-3xl">

      {/* ── Cover Photo ── */}
      <section>
        <p className={`font-inter text-[10px] uppercase tracking-[0.22em] mb-3 ${L?'text-gray-500':'text-gray-500'}`}>
          Cover Photo
        </p>
        <div
          ref={coverRef}
          className="relative rounded-2xl overflow-hidden select-none"
          style={{
            height: 168,
            background: coverUrl
              ? '#000'
              : L ? 'linear-gradient(135deg,#dce1ec,#c8d0e0)' : 'linear-gradient(135deg,#0d0d1c,#06060e)',
            cursor: coverUrl && !coverUploading ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onMouseDown={e => coverUrl && !coverUploading && startDrag(e.clientY)}
          onTouchStart={e => coverUrl && !coverUploading && startDrag(e.touches[0].clientY)}
          onMouseEnter={() => setCoverHover(true)}
          onMouseLeave={() => setCoverHover(false)}>

          {coverUrl && !coverUploading && (
            <img src={coverUrl} alt="Cover" draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `center ${coverPosition}%` }} />
          )}
          {coverUploading && (
            <div className="absolute inset-0">
              <LiquidLoader progress={55} label="Uploading…" />
            </div>
          )}

          {/* Drag hint */}
          {coverUrl && !coverUploading && (coverHover || isDragging) && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
              <span className="font-inter text-[10px] font-semibold text-white px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', letterSpacing: '0.08em' }}>
                {isDragging ? 'Repositioning…' : 'Drag to reposition'}
              </span>
            </div>
          )}

          {/* Overlay gradient + buttons */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 55%)' }} />
          <div className="absolute bottom-3 left-3" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {coverUrl ? 'Change Cover' : 'Add Cover Photo'}
            </button>
          </div>
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleCoverFile(e.target.files?.[0])} />
      </section>

      {/* ── Upload Area ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`font-inter text-[10px] uppercase tracking-[0.22em] ${L?'text-gray-500':'text-gray-500'}`}>
              My Photos{photos.length > 0 ? ` · ${photos.length}` : ''}
              {maxPhotos > 0 && <span className={`ml-2 ${atLimit?'text-red-400':'text-gray-600'}`}>/ {maxPhotos}</span>}
            </p>
            {maxPhotos > 0 && !atLimit && (
              <p className={`font-inter text-[9px] mt-0.5 ${L?'text-gray-400':'text-gray-600'}`}>
                {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
          <button
            onClick={() => !atLimit && fileInputRef.current?.click()}
            disabled={uploading || atLimit}
            title={atLimit ? `Limit reached (${maxPhotos} photos max)` : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(220,38,38,0.85)', boxShadow: '0 2px 8px rgba(220,38,38,0.28)' }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Photos
          </button>
        </div>

        {/* Upload error / limit message */}
        {uploadError && (
          <div className="mb-3 px-3 py-2.5 rounded-xl font-inter text-xs text-amber-400"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            {uploadError}
          </div>
        )}

        {/* Limit reached banner */}
        {atLimit && (
          <div className="mb-3 px-3 py-2.5 rounded-xl font-inter text-xs text-red-400"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
            You have reached the maximum of {maxPhotos} photos. Delete some to upload more.
          </div>
        )}

        {/* Drop zone — hidden when at limit */}
        {!atLimit && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="relative rounded-2xl border-2 border-dashed flex items-center justify-center py-6 transition-all cursor-pointer select-none"
            style={{ borderColor: L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.09)', minHeight: 80 }}>
            {uploading ? (
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-inter text-xs text-gray-500">
                  Uploading {uploadProgress.current} / {uploadProgress.total}…
                </span>
              </div>
            ) : (
              <div className="text-center pointer-events-none">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
                  stroke={L ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'} strokeWidth={1.5}
                  className="mx-auto mb-1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className={`font-inter text-xs ${L?'text-gray-400':'text-gray-500'}`}>Drop photos or click to browse</p>
                <p className={`font-inter text-[10px] mt-0.5 ${L?'text-gray-400':'text-gray-600'}`}>
                  Select multiple at once · JPEG / PNG / WebP
                  {maxPhotos > 0 && remainingSlots !== null && ` · Up to ${remainingSlots} more`}
                </p>
              </div>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </section>

      {/* ── Gallery Grid ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse"
              style={{ aspectRatio: '1', background: L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="py-14 text-center">
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={L?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.08)'} strokeWidth={1.2} className="mx-auto mb-3">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
            No photos yet — add some to build your gallery.
          </p>
        </div>
      ) : (
        <section>
          <p className={`font-inter text-[9px] uppercase tracking-[0.2em] mb-3 ${L?'text-gray-400':'text-gray-600'}`}>
            Drag to reorder · Click to view
          </p>
          <div className="columns-2 sm:columns-3 gap-3">
            {photos.map((photo, i) => (
              <div
                key={photo._id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={() => onDrop(i)}
                onDragEnd={onDragEnd}
                className="break-inside-avoid mb-3 relative group rounded-xl overflow-hidden cursor-pointer"
                style={{
                  outline: dragOverIndex === i && dragIndex !== i ? '2px solid #dc2626' : 'none',
                  opacity: dragIndex === i ? 0.45 : 1,
                  transition: 'opacity 0.15s, outline 0.1s',
                }}
                onClick={() => setLightboxIndex(i)}>

                <ProgressiveImage
                  src={photo.url} mobileSrc={photo.mobileUrl}
                  alt={photo.caption || ''}
                  className="w-full h-auto block"
                  masonry />

                {/* Hover overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: 'rgba(0,0,0,0.22)' }} />

                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(photo._id) }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                  style={{ background: 'rgba(0,0,0,0.72)' }}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                {/* Drag handle */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                  style={{ background: 'rgba(0,0,0,0.72)', cursor: 'grab' }}>
                  <svg width={10} height={10} viewBox="0 0 12 12" fill="white" aria-hidden>
                    <circle cx="4" cy="3" r="1"/><circle cx="8" cy="3" r="1"/>
                    <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
                    <circle cx="4" cy="9" r="1"/><circle cx="8" cy="9" r="1"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setDeleteConfirm(null)}>
          <div
            className="rounded-2xl p-6 max-w-xs w-full"
            style={{
              background:  L ? '#fff' : '#15151c',
              border:      L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
              boxShadow:   L ? '8px 8px 24px rgba(163,177,200,0.38), -5px -5px 14px rgba(255,255,255,0.82)' : '0 16px 48px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}>
            <p className={`font-inter text-sm font-semibold mb-1 ${L?'text-gray-900':'text-white'}`}>Delete photo?</p>
            <p className={`font-inter text-xs mb-5 ${L?'text-gray-500':'text-gray-400'}`}>This photo will be removed from your gallery and cannot be recovered.</p>
            <div className="flex gap-2">
              <button onClick={() => confirmDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl font-inter text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors active:scale-95">
                Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-inter text-sm transition-colors active:scale-95"
                style={{ border: `1px solid ${sep}`, color: L?'#6b7280':'#9ca3af' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i > 0 ? i - 1 : photos.length - 1))}
          onNext={() => setLightboxIndex(i => (i < photos.length - 1 ? i + 1 : 0))}
        />
      )}
    </div>
  )
}
