import { useState, useEffect, useRef, useCallback } from 'react'
import { getTemplateById } from './templates.js'
import TemplatePage from './TemplatePage.jsx'

const PAGE_W = 420
const PAGE_H = 560

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('mag-kf')) {
  const s = document.createElement('style')
  s.id = 'mag-kf'
  s.textContent = `
    @keyframes magFwdIn { from { opacity:0; transform:translateX(40px) } to { opacity:1; transform:translateX(0) } }
    @keyframes magBwdIn { from { opacity:0; transform:translateX(-40px) } to { opacity:1; transform:translateX(0) } }
    .mag-slide-fwd { animation: magFwdIn 0.28s cubic-bezier(0.22,1,0.36,1) both }
    .mag-slide-bwd { animation: magBwdIn 0.28s cubic-bezier(0.22,1,0.36,1) both }
  `
  document.head.appendChild(s)
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const cb = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', cb)
    return () => window.removeEventListener('resize', cb)
  }, [])
  return vp
}

export default function MagazineViewer({ magazine, onClose, isPublicView = false }) {
  const { w: vw, h: vh } = useViewport()
  const isMobile = vw < 640

  const [currentPage, setCurrentPage] = useState(0)
  const [viewMode,    setViewMode]    = useState('1page')
  const [animKey,     setAnimKey]     = useState(0)
  const [copied,      setCopied]      = useState(false)
  const dirRef     = useRef(1)
  const cooldown   = useRef(false)
  const touchRef   = useRef(null)

  const shareUrl = magazine?.status === 'published'
    ? `${window.location.origin}/magazine/${magazine._id}`
    : null

  const copyLink = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const tpl   = getTemplateById(magazine?.templateId)
  const pages = magazine?.pages || []

  // Spread works on all screen sizes — mobile just shows smaller pages side by side
  const show2 = viewMode === '2page' && pages.length > 1
  const step  = show2 ? 2 : 1

  // Compute scale from current viewport
  const scale = (() => {
    const pH = vh - (isMobile ? 210 : 160)
    const pW = show2
      ? (vw - (isMobile ? 48 : 120)) / 2    // two pages — 24px padding each side on mobile
      : isMobile ? vw - 48 : Math.min(vw - 100, 640)  // single — 24px each side on mobile
    return Math.max(Math.min(pW / PAGE_W, pH / PAGE_H, 1.4), 0.2)
  })()

  const pw = Math.round(PAGE_W * scale)
  const ph = Math.round(PAGE_H * scale)

  const canPrev = currentPage > 0
  const canNext = currentPage + step < pages.length

  // Navigate with cooldown + animation key
  const go = useCallback((next) => {
    if (cooldown.current) return
    const t = Math.max(0, Math.min(next, pages.length - 1))
    if (t === currentPage) return
    dirRef.current = t > currentPage ? 1 : -1
    cooldown.current = true
    setCurrentPage(t)
    setAnimKey(k => k + 1)
    setTimeout(() => { cooldown.current = false }, 310)
  }, [currentPage, pages.length])

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (['ArrowRight','ArrowDown'].includes(e.key)) { e.preventDefault(); go(currentPage + step) }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key))   { e.preventDefault(); go(currentPage - step) }
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go, currentPage, step, onClose])

  // Touch swipe
  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e) => {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    touchRef.current = null
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return
    dx < 0 ? go(currentPage + step) : go(currentPage - step)
  }

  const slideClass = `mag-slide-${dirRef.current > 0 ? 'fwd' : 'bwd'}`

  if (!tpl || !pages.length) return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background:'rgba(0,0,0,0.96)' }}>
      <div className="text-center space-y-3">
        <p className="font-inter text-gray-400">Magazine not available.</p>
        <button onClick={onClose} className="font-inter text-sm text-red-400 hover:text-red-300">← Close</button>
      </div>
    </div>
  )

  // Arrow button inline
  const Arr = ({ prev }) => {
    const disabled = prev ? !canPrev : !canNext
    return (
      <button onClick={() => prev ? go(currentPage - step) : go(currentPage + step)}
        disabled={disabled}
        className="w-11 h-11 rounded-full flex items-center justify-center text-2xl transition-all hover:bg-white/10 active:scale-90 shrink-0"
        style={{ border:'1px solid rgba(255,255,255,0.12)', color: disabled ? 'rgba(255,255,255,0.14)' : '#fff' }}>
        {prev ? '‹' : '›'}
      </button>
    )
  }

  // Dot indicators inline
  const dots = (
    <div className="flex gap-1.5 flex-wrap justify-center" style={{ maxWidth: pw * (show2 ? 2 : 1) + 20 }}>
      {pages.map((_, i) => {
        const active = i === currentPage || (show2 && i === currentPage + 1)
        return (
          <button key={i} onClick={() => go(i)}
            className="rounded-full transition-all duration-200"
            style={{ width: active ? 16 : 5, height: 5, background: active ? '#dc2626' : 'rgba(255,255,255,0.2)' }}/>
        )
      })}
    </div>
  )

  // Pages block — key changes trigger CSS animation
  const pagesBlock = (
    <div key={animKey} className={slideClass}
      style={{ display:'flex', gap: 10, touchAction:'pan-y' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div style={{ boxShadow:'0 8px 40px rgba(0,0,0,0.65)' }}>
        <TemplatePage template={tpl} layoutId={pages[currentPage]?.layoutId}
          pageData={pages[currentPage]} editMode={false} showSamples={false}
          width={pw} height={ph}/>
      </div>
      {show2 && currentPage + 1 < pages.length && (
        <div style={{ boxShadow:'0 8px 40px rgba(0,0,0,0.65)' }}>
          <TemplatePage template={tpl} layoutId={pages[currentPage+1]?.layoutId}
            pageData={pages[currentPage+1]} editMode={false} showSamples={false}
            width={pw} height={ph}/>
        </div>
      )}
    </div>
  )

  const counter = show2
    ? `${currentPage+1}–${Math.min(currentPage+2, pages.length)} / ${pages.length}`
    : `${currentPage+1} / ${pages.length}`

  return (
    <div className="fixed inset-0 z-[500] flex flex-col" style={{ background:'#050505' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 sm:px-6 shrink-0"
        style={{ height: isMobile ? 52 : 60, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>

        {/* Back / Close */}
        {!isPublicView && (
          <button onClick={onClose}
            className="flex items-center gap-1.5 font-inter text-sm font-medium text-gray-500 hover:text-white transition-colors shrink-0">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {!isMobile && 'Back'}
          </button>
        )}

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="font-inter font-bold text-white truncate" style={{ fontSize: isMobile ? 12 : 14 }}>
            {magazine?.name || tpl.name}
          </p>
          {magazine?.user?.name && !isMobile && (
            <p className="font-inter text-gray-600 text-[11px]">by {magazine.user.name}</p>
          )}
        </div>

        {/* Single / Spread toggle */}
        <div className="flex shrink-0" style={{ border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, overflow:'hidden' }}>
          {['1page','2page'].map(m => (
            <button key={m}
              onClick={() => { setViewMode(m); if (currentPage%2!==0 && m==='2page') setCurrentPage(currentPage-1); setAnimKey(k=>k+1) }}
              style={{
                fontFamily:'system-ui,sans-serif', fontSize: isMobile ? 10 : 11, fontWeight:600,
                padding: isMobile ? '5px 9px' : '5px 12px',
                background: viewMode===m ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode===m ? '#fff' : 'rgba(255,255,255,0.4)',
                border:'none', cursor:'pointer', transition:'all 0.15s',
              }}>
              {m==='1page' ? 'Single' : 'Spread'}
            </button>
          ))}
        </div>

        {/* Share link button — only for published magazines */}
        {shareUrl && (
          <button onClick={copyLink}
            title={`Copy shareable link: ${shareUrl}`}
            style={{
              display:'flex', alignItems:'center', gap: isMobile ? 0 : 5,
              fontFamily:'system-ui,sans-serif', fontSize: isMobile ? 10 : 11, fontWeight:600,
              padding: isMobile ? '6px 8px' : '5px 12px', borderRadius:8, cursor:'pointer',
              border:`1px solid ${copied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`,
              background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
              color: copied ? '#4ade80' : 'rgba(255,255,255,0.6)',
              transition:'all 0.2s', flexShrink:0,
            }}>
            {copied ? (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            )}
            {!isMobile && (copied ? ' Copied!' : ' Share')}
          </button>
        )}
      </div>

      {/* ── DESKTOP: arrows flank the pages ── */}
      {!isMobile && (
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden gap-4 px-4">
          <div className="flex items-center gap-5">
            <Arr prev />
            {pagesBlock}
            <Arr />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {dots}
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.22)', fontFamily:'inherit' }}>
              {counter} · <span style={{ opacity:0.55 }}>← → or swipe</span>
            </p>
          </div>
        </div>
      )}

      {/* ── MOBILE: page centred, arrows + dots below ── */}
      {isMobile && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page — takes all available space */}
          <div className="flex-1 flex items-center justify-center px-4 py-3">
            {pagesBlock}
          </div>

          {/* Controls pinned to bottom */}
          <div className="flex flex-col items-center gap-3 pb-5 pt-1 shrink-0">
            {dots}
            <div className="flex items-center gap-8">
              <Arr prev />
              <span style={{ fontFamily:'inherit', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                {counter}
              </span>
              <Arr />
            </div>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.2)', fontFamily:'inherit' }}>
              Swipe left or right to navigate
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
