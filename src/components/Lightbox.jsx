import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// photos: [{ url, caption?, photographer?: { name, photoUrl? } }]
// startIndex: which item to open first
// onClose: called when dismissed
export default function Lightbox({ photos, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const n       = photos.length
  const photo   = photos[Math.min(idx, n - 1)] ?? {}
  const touchX  = useRef(null)

  const prev = () => setIdx(i => (i > 0 ? i - 1 : n - 1))
  const next = () => setIdx(i => (i < n - 1 ? i + 1 : 0))

  // Scroll lock — prevents page scroll while open
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  // Keyboard: Escape, arrows
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [n, onClose]) // eslint-disable-line

  // Touch swipe
  const onTouchStart = e => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = e => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 48) { dx < 0 ? next() : prev() }
    touchX.current = null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.12)' }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Counter */}
      {n > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 font-inter text-[11px] text-white/50 select-none px-3 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          {idx + 1} / {n}
        </div>
      )}

      {/* Image + meta */}
      <div className="relative w-full max-w-4xl px-12 sm:px-16 py-14 sm:py-16 flex flex-col items-center"
        onClick={e => e.stopPropagation()}>
        <img
          src={photo.url} alt={photo.caption || ''}
          className="max-h-[74vh] w-auto max-w-full object-contain rounded-xl select-none"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          draggable={false}
        />
        {photo.photographer && (
          <div className="flex items-center gap-2 mt-4">
            {photo.photographer.photoUrl && (
              <img src={photo.photographer.photoUrl} alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0"
                style={{ boxShadow: '0 0 0 1.5px rgba(220,38,38,0.7)' }} />
            )}
            <p className="font-inter text-sm font-semibold text-white">{photo.photographer.name}</p>
          </div>
        )}
        {photo.caption && (
          <p className="font-inter text-sm text-gray-400 mt-2 text-center max-w-lg">{photo.caption}</p>
        )}
      </div>

      {/* Prev / Next */}
      {n > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); prev() }} aria-label="Previous"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); next() }} aria-label="Next"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.11)' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
    </div>,
    document.body
  )
}
