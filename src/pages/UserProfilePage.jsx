import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { membersApi, userGalleryApi } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import ProgressiveImage from '../components/ProgressiveImage.jsx'
import PageLayout from '../components/PageLayout.jsx'
import { SkeletonMasonryGrid } from '../components/Skeleton.jsx'

const ROLE_META = {
  admin:        { label: 'Admin',        color: '#dc2626' },
  core:         { label: 'Core Member',  color: '#d97706' },
  coordinator:  { label: 'Coordinator',  color: '#2563eb' },
  photographer: { label: 'Photographer', color: '#059669' },
}

function academicYearLabel(startYear, endYear) {
  if (!startYear) return null
  const now = new Date()
  const sessionBase = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  if (endYear && endYear <= sessionBase) return 'Alumni'
  const elapsed = Math.max(1, sessionBase - startYear + 1)
  const suffixes = ['st','nd','rd']
  const suf = elapsed <= 3 ? suffixes[elapsed - 1] : 'th'
  return `${elapsed}${suf} Year`
}

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
export default function UserProfilePage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { theme }    = useTheme()
  const { user: authUser } = useAuth()
  const L            = theme === 'light'
  const isAdmin      = authUser && ['admin', 'core'].includes(authUser.role)

  const [profile,       setProfile]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const [deletingCover, setDeletingCover] = useState(false)

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
    setLoading(true); setError(null); setProfile(null)
    membersApi.get(id)
      .then(d => {
        setProfile(d.user)
        setCoverPosition(parseFloat(d.user?.coverPhotoPosition) || 50)
      })
      .catch(e => setError(e.message || 'Member not found.'))
      .finally(() => setLoading(false))
  }, [id])

  // isOwner: logged-in user viewing their own profile
  const isOwner       = authUser && profile && String(authUser._id || authUser.id) === String(profile._id)
  const canReposition = (isOwner || isAdmin) && !!profile?.coverPhoto

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
    try {
      if (isOwner)       await userGalleryApi.setCoverPos(`${Math.round(pos)}%`)
      else if (isAdmin)  await membersApi.adminSetCoverPos(id, `${Math.round(pos)}%`)
    } catch (_) { /* non-critical */ }
  }, [isOwner, isAdmin, id])

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

  const handleDeletePhoto = async (photoId) => {
    setDeletingPhoto(photoId)
    try {
      await membersApi.adminDeletePhoto(id, photoId)
      setProfile(p => ({ ...p, gallery: p.gallery.filter(ph => ph._id !== photoId) }))
    } catch (e) { alert(e.message) }
    finally { setDeletingPhoto(null) }
  }

  const handleDeleteCover = async () => {
    if (!confirm('Remove this member\'s cover photo?')) return
    setDeletingCover(true)
    try {
      await membersApi.adminDeleteCover(id)
      setProfile(p => ({ ...p, coverPhoto: null }))
    } catch (e) { alert(e.message) }
    finally { setDeletingCover(false) }
  }

  // Keyboard lightbox nav
  useEffect(() => {
    if (lightboxIndex === null) return
    const gallery = profile?.gallery || []
    const onKey = e => {
      if (e.key === 'ArrowLeft')  setLightboxIndex(i => (i > 0 ? i - 1 : gallery.length - 1))
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i < gallery.length - 1 ? i + 1 : 0))
      if (e.key === 'Escape')     setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, profile?.gallery?.length])

  if (loading) {
    return (
      <div className={`min-h-screen ${L ? 'bg-[#e8ecf3]' : 'bg-[#06060a]'}`}>
        {/* Cover skeleton */}
        <div className="skeleton-shimmer w-full" style={{ height: 'clamp(340px,40vw,500px)' }} />
        {/* Profile card — overlaps cover */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8" style={{ marginTop: -150 }}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
            <div className="skeleton-shimmer rounded-full shrink-0 z-10" style={{ width: 80, height: 80 }} />
            <div className="flex-1 sm:pb-2 space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer rounded-lg" style={{ width: '38%', height: 28 }} />
                <div className="skeleton-shimmer rounded-full" style={{ width: 78, height: 18 }} />
              </div>
              <div className="flex flex-wrap gap-3">
                {[96, 64, 110].map((w, i) => <div key={i} className="skeleton-shimmer rounded" style={{ width: w, height: 13 }} />)}
              </div>
              <div className="skeleton-shimmer rounded" style={{ width: '58%', height: 12 }} />
            </div>
          </div>
          <div className="mt-5 mb-4 skeleton-shimmer" style={{ height: 1 }} />
          <SkeletonMasonryGrid n={6} />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={L?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.08)'} strokeWidth={1.2} className="mb-1">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
          </svg>
          <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-500'}`}>{error || 'Member not found.'}</p>
          <button onClick={() => navigate('/members')}
            className="font-inter text-xs text-red-400 hover:text-red-300 transition-colors">
            ← Back to Members
          </button>
        </div>
      </PageLayout>
    )
  }

  const role     = ROLE_META[profile.role] || ROLE_META.photographer
  const initials = profile.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const dept     = profile.department === 'OTHER' ? 'Other' : profile.department
  const yrLabel  = academicYearLabel(profile.startYear, profile.endYear)
  const gallery  = (profile.gallery || []).sort((a, b) => a.order - b.order)

  // Cover fallback gradient
  const coverFallback = L
    ? 'linear-gradient(145deg,#dce1ec 0%,#bcc8dc 100%)'
    : 'linear-gradient(145deg,#0d0d1c 0%,#060610 100%)'

  return (
    <>
      <div className={`min-h-screen ${L ? 'bg-[#e8ecf3]' : 'bg-[#06060a]'}`}>

        {/* ── Back button (floating) ── */}
        <div className="fixed top-4 left-4 z-50">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-xs font-semibold backdrop-blur-md text-white transition-all active:scale-95"
            style={{ background: 'rgba(0,0,0,0.58)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
        </div>

        {/* ── Cover photo ── */}
        <div
          ref={coverRef}
          className="relative w-full overflow-hidden select-none"
          style={{
            height: 'clamp(340px,40vw,500px)',
            background: coverFallback,
            cursor: canReposition ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onMouseDown={e => canReposition && startDrag(e.clientY)}
          onTouchStart={e => canReposition && startDrag(e.touches[0].clientY)}
          onMouseEnter={() => setCoverHover(true)}
          onMouseLeave={() => setCoverHover(false)}>

          {profile.coverPhoto && (
            <img src={profile.coverPhoto} alt="Cover"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `center ${coverPosition}%` }} />
          )}

          {/* Drag hint */}
          {canReposition && profile.coverPhoto && (coverHover || isDragging) && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
              <span className="font-inter text-[10px] font-semibold text-white px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', letterSpacing: '0.08em' }}>
                {isDragging ? 'Repositioning…' : 'Hold to reposition'}
              </span>
            </div>
          )}

          {/* Bottom-fade to page bg */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: '65%', background: L ? 'linear-gradient(to top,#e8ecf3 30%,transparent)' : 'linear-gradient(to top,#06060a 30%,transparent)' }} />
          {/* Admin: delete cover */}
          {isAdmin && profile.coverPhoto && (
            <button onClick={handleDeleteCover} disabled={deletingCover}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-inter text-xs font-medium text-white backdrop-blur-md transition-all disabled:opacity-50"
              style={{ background: 'rgba(220,38,38,0.75)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              {deletingCover ? '…' : 'Remove Cover'}
            </button>
          )}
        </div>

        {/* ── Profile card (overlaps cover) ── */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8" style={{ marginTop: -150 }}>

          {/* Profile photo + name row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">

            {/* Profile photo — square with animated border beam */}
            <div className="relative shrink-0 z-10">
              <div
                className="profile-photo-beam w-20 h-20 sm:w-28 sm:h-28"
                style={{
                  background: L ? '#dce1ec' : '#151520',
                  boxShadow:  L
                    ? '6px 6px 18px rgba(163,177,200,0.5), -4px -4px 10px rgba(255,255,255,0.9)'
                    : '0 8px 28px rgba(0,0,0,0.6)',
                }}>
                <div className="profile-photo-inner">
                  {profile.profilePhoto
                    ? <img src={profile.profilePhoto} alt={profile.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-clash font-black"
                        style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', color: L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' }}>
                        {initials}
                      </div>}
                </div>
              </div>
              {/* Role indicator dot */}
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full"
                style={{ background: role.color, border: `2px solid ${L ? '#e8ecf3' : '#06060a'}` }} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className={`font-clash font-bold leading-tight ${L ? 'text-gray-900' : 'text-white'}`}
                  style={{ fontSize: 'clamp(1.2rem,3.2vw,1.85rem)' }}>
                  {profile.name}
                </h1>
                <span className="font-inter text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}30` }}>
                  {role.label}
                </span>
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {dept && (
                  <span className={`font-inter text-xs flex items-center gap-1.5 ${L?'text-gray-600':'text-gray-400'}`}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                    {dept}
                  </span>
                )}
                {yrLabel && (
                  <span className={`font-inter text-xs ${L?'text-gray-500':'text-gray-500'}`}>{yrLabel}</span>
                )}
                {profile.instagramHandle && (
                  <a
                    href={`https://instagram.com/${profile.instagramHandle.replace('@','')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-inter text-xs flex items-center gap-1.5 text-pink-400 hover:text-pink-300 transition-colors">
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="2" width="20" height="20" rx="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
                    </svg>
                    {profile.instagramHandle}
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`}
                    className={`font-inter text-xs flex items-center gap-1.5 transition-colors ${L?'text-gray-500 hover:text-gray-700':'text-gray-400 hover:text-gray-200'}`}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
                    {profile.email}
                  </a>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className={`font-inter text-xs mt-2 leading-relaxed max-w-lg ${L?'text-gray-600':'text-gray-400'}`}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* ── Separator ── */}
          <div className="mt-5 mb-4 h-px" style={{ background: L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)' }} />

          {/* ── Gallery section ── */}
          {gallery.length > 0 ? (
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
                  stroke={L?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.25)'} strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <span className={`font-inter text-[10px] uppercase tracking-[0.22em] ${L?'text-gray-500':'text-gray-500'}`}>
                  Gallery
                </span>
                <span className={`font-inter text-[10px] ${L?'text-gray-400':'text-gray-600'}`}>
                  · {gallery.length} photo{gallery.length !== 1 ? 's' : ''}
                </span>
                <div className="flex-1 h-px" style={{ background: L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Masonry grid */}
              <div className="columns-2 sm:columns-3 gap-3">
                {gallery.map((photo, i) => (
                  <div
                    key={photo._id || i}
                    className="break-inside-avoid mb-3 rounded-xl overflow-hidden cursor-pointer group relative"
                    onClick={() => !isAdmin && setLightboxIndex(i)}>
                    <ProgressiveImage
                      src={photo.url} alt={photo.caption || ''}
                      className="w-full h-auto block"
                      masonry />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ background: 'rgba(0,0,0,0.2)' }} />
                    {isAdmin ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeletePhoto(photo._id) }}
                        disabled={deletingPhoto === photo._id}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        style={{ background: 'rgba(220,38,38,0.85)' }}>
                        {deletingPhoto === photo._id
                          ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>}
                      </button>
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
            </section>
          ) : (
            <div className="py-10 text-center mb-10">
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none"
                stroke={L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.07)'} strokeWidth={1.2}
                className="mx-auto mb-3">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>This user is yet to upload any photos.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
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
