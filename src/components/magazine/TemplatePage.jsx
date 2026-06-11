import { useRef, useState, useEffect, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_TEXTS } from './templates.js'

// ShowSamples: true = template browser (show sample photos), false = published view (blank)
const ShowSamplesCtx = createContext(true)
// ImageAdjustCtx: crop/delete/replace callbacks provided by MagazineTab
const ImageAdjustCtx = createContext({ onAdjust: null, onDelete: null, onReplaceFile: null })

// ── ControlBall — neomorphic floating panel via portal ───────────────────────
const NEO_BG    = '#0e0e13'
const NEO_CARD  = `8px 8px 20px rgba(0,0,0,0.65), -2px -2px 6px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)`
const NEO_BTN   = `2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.04)`
const NEO_PRESS = `inset 2px 2px 5px rgba(0,0,0,0.55), inset -1px -1px 3px rgba(255,255,255,0.03)`

function ControlBall({ pos, onPan, onZoom, onRot, onReplace, onDelete, onDone }) {
  // ALL hooks must be declared before any conditional return (Rules of Hooks)
  const holdRef      = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const sheetDragY   = useRef(null)
  const sheetStartH  = useRef(null)
  const [sheetFull, setSheetFull] = useState(true)

  if (!pos) return null

  const mob = typeof window !== 'undefined' && window.innerWidth < 640
  // Mobile renders as a bottom sheet — desktop as floating panel
  const BSZ = mob ? 44 : 28
  const W   = 116  // desktop panel width only

  const startHold = (fn) => { fn(); holdRef.current = setInterval(fn, 25) }
  const stopHold  = () => { clearInterval(holdRef.current); holdRef.current = null }

  const btnBase = {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:BSZ, height:BSZ, borderRadius: mob ? 12 : 7,
    border:'1px solid rgba(255,255,255,0.08)',
    cursor:'pointer', color:'rgba(255,255,255,0.85)', background:'rgba(255,255,255,0.08)',
    boxShadow: NEO_BTN, userSelect:'none', touchAction:'none', flexShrink:0,
    transition:'box-shadow 0.12s, background 0.12s',
  }

  // Hold-to-repeat (pan, zoom) — fires on press then every 62ms
  const HBtn = ({ icon, fn, title }) => {
    const ref = useRef(null)
    const press = () => { if(ref.current){ref.current.style.boxShadow=NEO_PRESS;ref.current.style.background='rgba(255,255,255,0.14)'};startHold(fn) }
    const release = () => { stopHold();if(ref.current){ref.current.style.boxShadow=NEO_BTN;ref.current.style.background='rgba(255,255,255,0.07)'} }
    return (
      <button ref={ref} title={title}
        onMouseDown={e=>{e.preventDefault();e.stopPropagation();press()}}
        onMouseUp={release} onMouseLeave={release}
        onTouchStart={e=>{e.preventDefault();e.stopPropagation();press()}}
        onTouchEnd={release} onClick={e=>e.stopPropagation()}
        style={btnBase}>{icon}</button>
    )
  }

  // Single-click only (rotate, replace, delete — should NOT repeat)
  const CBtn = ({ icon, fn, title, style: s = {} }) => {
    const ref = useRef(null)
    return (
      <button ref={ref} title={title}
        onClick={e=>{e.preventDefault();e.stopPropagation();fn()}}
        onMouseEnter={e=>{if(ref.current)ref.current.style.background='rgba(255,255,255,0.14)'}}
        onMouseLeave={e=>{if(ref.current)ref.current.style.background=s.background||'rgba(255,255,255,0.07)'}}
        style={{...btnBase,...s}}>{icon}</button>
    )
  }

  // SVG helpers — larger icons on mobile for readability
  const IC = mob ? 15 : 11
  const Arr = ({d}) => <svg width={IC} height={IC} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>

  const RC = mob ? 17 : 13
  const RotCCW = () => <svg width={RC} height={RC} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
  const RotCW  = () => <svg width={RC} height={RC} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>

  const Sep = () => <div style={{ width:'100%', height:1, background:'rgba(255,255,255,0.08)', margin:'1px 0' }}/>
  const Lbl = ({t}) => <span style={{ flex:1, textAlign:'center', fontSize:8, color:'rgba(255,255,255,0.25)', letterSpacing:'0.1em', textTransform:'uppercase' }}>{t}</span>

  const PAN = 1.5

  // ── Mobile bottom sheet — compact 2-row design, draggable to collapse ──────────
  if (mob) {

    const PEEK_H = 64    // collapsed: just handle + Done visible
    const FULL_H = 210   // expanded: all controls

    const onHandleDown = (e) => {
      e.stopPropagation()
      const clientY = e.touches?.[0]?.clientY ?? e.clientY
      sheetDragY.current  = clientY
      sheetStartH.current = sheetFull ? FULL_H : PEEK_H
    }
    const onHandleMove = (e) => {
      if (sheetDragY.current === null) return
      e.preventDefault()
      const clientY = e.touches?.[0]?.clientY ?? e.clientY
      const dy = sheetDragY.current - clientY   // positive = dragging up
      if (dy > 30)       setSheetFull(true)
      else if (dy < -30) setSheetFull(false)
    }
    const onHandleUp = () => { sheetDragY.current = null }

    const sheet = (
      <div onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
        style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:99999,
          background: NEO_BG,
          backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)',
          borderTop:'1px solid rgba(255,255,255,0.12)',
          borderRadius:'16px 16px 0 0',
          boxShadow:'0 -6px 28px rgba(0,0,0,0.65)',
          height: sheetFull ? FULL_H : PEEK_H,
          overflow:'hidden',
          transition:'height 0.25s cubic-bezier(0.32,0.72,0,1)',
          fontFamily:'system-ui,-apple-system,sans-serif',
          userSelect:'none',
        }}>

        {/* ── Drag handle — swipe up to expand, down to collapse ── */}
        <div
          onTouchStart={onHandleDown} onTouchMove={onHandleMove} onTouchEnd={onHandleUp}
          onMouseDown={onHandleDown}  onMouseMove={onHandleMove}  onMouseUp={onHandleUp}
          onClick={e=>{e.stopPropagation(); setSheetFull(f=>!f)}}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                   padding:'10px 16px 0', cursor:'ns-resize', touchAction:'none' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.22)' }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
            <span style={{ fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase',
                           color:'rgba(255,255,255,0.3)', fontWeight:600 }}>
              {sheetFull ? 'Edit Photo' : 'Edit Photo — swipe up'}
            </span>
            <button onClick={e=>{e.stopPropagation();onDone()}}
              style={{ padding:'5px 14px', background:'#1d4ed8', border:'1px solid rgba(96,165,250,0.4)',
                       borderRadius:8, color:'#fff', fontSize:12, fontWeight:700,
                       cursor:'pointer', boxShadow:'0 2px 10px rgba(29,78,216,0.4)' }}>
              ✓ Done
            </button>
          </div>
        </div>

        {/* ── Controls (only visible when expanded) ── */}
        <div style={{ padding:'8px 12px 16px', display:'flex', flexDirection:'column', gap:8 }}>

          {/* Row 1: Crop | D-pad | Rotate */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>

            {/* Crop */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Crop</span>
              <div style={{ display:'flex', gap:6 }}>
                <HBtn icon={<span style={{fontSize:18,fontWeight:300}}>−</span>} fn={()=>onZoom(0.985)} title="Zoom out"/>
                <HBtn icon={<span style={{fontSize:18,fontWeight:300}}>+</span>} fn={()=>onZoom(1.015)} title="Zoom in"/>
              </div>
            </div>

            {/* D-pad — compact 3×3 */}
            <div style={{ display:'grid', gridTemplateColumns:`${BSZ}px ${BSZ}px ${BSZ}px`,
                          gridTemplateRows:`${BSZ}px ${BSZ}px ${BSZ}px`, gap:4 }}>
              <div/><HBtn icon={<Arr d="M5.5 8L5.5 3M5.5 3L3 5.5M5.5 3L8 5.5"/>} fn={()=>onPan(-PAN,'y')} title="Up"/><div/>
              <HBtn icon={<Arr d="M8 5.5L3 5.5M3 5.5L5.5 3M3 5.5L5.5 8"/>} fn={()=>onPan(-PAN,'x')} title="Left"/>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:8, color:'rgba(255,255,255,0.2)' }}>·</div>
              <HBtn icon={<Arr d="M3 5.5L8 5.5M8 5.5L5.5 3M8 5.5L5.5 8"/>} fn={()=>onPan(PAN,'x')} title="Right"/>
              <div/><HBtn icon={<Arr d="M5.5 3L5.5 8M5.5 8L3 5.5M5.5 8L8 5.5"/>} fn={()=>onPan(PAN,'y')} title="Down"/><div/>
            </div>

            {/* Rotate */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Rotate</span>
              <div style={{ display:'flex', gap:6 }}>
                <CBtn icon={<RotCCW/>} fn={()=>onRot(-90)} title="CCW"/>
                <CBtn icon={<RotCW/>}  fn={()=>onRot(90)}  title="CW"/>
              </div>
            </div>
          </div>

          {/* Row 2: Replace + Delete */}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={e=>{e.stopPropagation();onReplace()}}
              style={{ flex:1, padding:'9px 0', borderRadius:9, border:'1px solid rgba(96,165,250,0.3)',
                       background:'rgba(29,78,216,0.2)', color:'rgba(147,197,253,1)',
                       fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Replace
            </button>
            <button onClick={e=>{e.stopPropagation();onDelete()}}
              style={{ flex:1, padding:'9px 0', borderRadius:9, border:'1px solid rgba(220,38,38,0.3)',
                       background:'rgba(220,38,38,0.18)', color:'rgba(252,165,165,1)',
                       fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )
    return createPortal(sheet, document.body)
  }

  // ── Desktop floating panel ────────────────────────────────────────────────────
  const panel = (
    <div onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
      style={{
        position:'fixed', zIndex:99999,
        top: pos.top, left: pos.left,
        transform: pos.anchor==='right'||pos.anchor==='left' ? 'translateY(-50%)' : 'translateX(-50%)',
        background: NEO_BG,
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:16,
        boxShadow: NEO_CARD,
        padding: collapsed ? '7px 8px' : '10px 8px',
        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
        width: W, userSelect:'none',
        fontFamily:'system-ui,-apple-system,sans-serif',
      }}>

      {/* Header: label + collapse toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>Edit Photo</span>
        <button onClick={e=>{e.stopPropagation();setCollapsed(c=>!c)}}
          title={collapsed?'Expand':'Collapse'}
          style={{ width:18, height:18, borderRadius:5, border:'1px solid rgba(255,255,255,0.1)',
                   background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.45)', cursor:'pointer',
                   display:'flex', alignItems:'center', justifyContent:'center' }}>
          {collapsed
            ? <svg width={8} height={8} viewBox="0 0 8 8" fill="currentColor"><path d="M4 1L7 6H1L4 1Z"/></svg>
            : <svg width={8} height={8} viewBox="0 0 8 8" fill="currentColor"><path d="M4 7L1 2H7L4 7Z"/></svg>}
        </button>
      </div>

      {!collapsed && <>
        <div style={{ display:'flex', alignItems:'center', gap:4, width:'100%' }}>
          <HBtn icon={<span style={{fontSize:18,lineHeight:1,fontWeight:300}}>−</span>} fn={()=>onZoom(0.985)} title="Zoom out"/>
          <Lbl t="Crop"/>
          <HBtn icon={<span style={{fontSize:18,lineHeight:1,fontWeight:300}}>+</span>} fn={()=>onZoom(1.015)} title="Zoom in"/>
        </div>
        <Sep/>
        <div style={{ display:'grid', gridTemplateColumns:'28px 28px 28px', gridTemplateRows:'28px 28px 28px', gap:3, margin:'0 auto' }}>
          <div/><HBtn icon={<Arr d="M5.5 8L5.5 3M5.5 3L3 5.5M5.5 3L8 5.5"/>} fn={()=>onPan(-PAN,'y')} title="Pan up"/><div/>
          <HBtn icon={<Arr d="M8 5.5L3 5.5M3 5.5L5.5 3M3 5.5L5.5 8"/>} fn={()=>onPan(-PAN,'x')} title="Pan left"/>
          <button onClick={e=>{e.stopPropagation();onDone()}}
            style={{ ...btnBase, background:'#1d4ed8', boxShadow:'0 2px 10px rgba(29,78,216,0.5)',
                     color:'#fff', border:'1px solid rgba(96,165,250,0.35)', fontSize:13, fontWeight:700 }}
            onMouseEnter={e=>e.currentTarget.style.background='#2563eb'}
            onMouseOut={e=>e.currentTarget.style.background='#1d4ed8'}>&#10003;</button>
          <HBtn icon={<Arr d="M3 5.5L8 5.5M8 5.5L5.5 3M8 5.5L5.5 8"/>} fn={()=>onPan(PAN,'x')} title="Pan right"/>
          <div/><HBtn icon={<Arr d="M5.5 3L5.5 8M5.5 8L3 5.5M5.5 8L8 5.5"/>} fn={()=>onPan(PAN,'y')} title="Pan down"/><div/>
        </div>
        <Sep/>
        <div style={{ display:'flex', alignItems:'center', gap:4, width:'100%' }}>
          <CBtn icon={<RotCCW/>} fn={()=>onRot(-90)} title="Rotate CCW"/>
          <Lbl t="Rotate"/>
          <CBtn icon={<RotCW/>}  fn={()=>onRot(90)}  title="Rotate CW"/>
        </div>
        <Sep/>
        <CBtn fn={onReplace} icon="Replace" title="Replace photo"
          style={{ width:'100%', borderRadius:7, border:'1px solid rgba(96,165,250,0.22)',
                   background:'rgba(29,78,216,0.14)', color:'rgba(147,197,253,0.95)',
                   fontSize:10, fontWeight:600, letterSpacing:'0.06em', padding:'5px 0', justifyContent:'center' }}/>
        <CBtn fn={onDelete} icon="Delete" title="Delete photo"
          style={{ width:'100%', borderRadius:7, border:'1px solid rgba(220,38,38,0.22)',
                   background:'rgba(220,38,38,0.12)', color:'rgba(252,165,165,0.95)',
                   fontSize:10, fontWeight:600, letterSpacing:'0.06em', padding:'5px 0', justifyContent:'center' }}/>
      </>}
    </div>
  )

  return createPortal(panel, document.body)
}

// ── ImgSlot — Canva-like in-place image editing ───────────────────────────────
function ImgSlot({ slotId, pageData, sampleUrl, onEdit, editMode, colors, className='', style={} }) {
  const showSamples = useContext(ShowSamplesCtx)
  const adjCtx      = useContext(ImageAdjustCtx)

  const wrapRef  = useRef(null)
  const drag     = useRef(null)   // { x, y } last pointer position
  const pinch    = useRef(null)   // last pinch distance

  const [isAdj, setIsAdj]   = useState(false)
  const [lCrop, setLCrop]   = useState(null)   // local crop while adjusting
  const [ballPos, setBallPos] = useState(null)  // portal position for ControlBall

  const saved = pageData?.images?.find(i => i.slotId === slotId) ?? null
  const url   = saved?.imageUrl ?? null
  const show  = editMode ? url : (url || (showSamples ? sampleUrl : null) || null)
  const cd    = (isAdj ? lCrop : saved?.cropData) || null

  const sc = cd?.scale || 1
  const rt = cd?.rotation || 0

  // ── Image dimensions (measured on load — required for both-axis panning) ───────
  const [imgNat, setImgNat] = useState(null)  // { w, h } — set by onLoad

  // Pixel-based image positioning — used by BOTH editor and thumbnail.
  // Thumbnail mode initially falls back to CSS (before imgNat loads), then switches to
  // pixel-based once the image fires onLoad and imgNat is known.
  // Using offsetWidth (not getBoundingClientRect) makes this transform-safe — correct
  // even inside the CSS scale() container used by thumbnail cards.
  const imgStyle = (() => {
    // Fallback: before natural dimensions are measured, use CSS cover centered.
    // Also used when wrapRef isn't mounted yet.
    if (!imgNat || !wrapRef.current) {
      return {
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: '50% 50%',
        transform: `scale(${sc})${rt ? ` rotate(${rt}deg)` : ''}`,
        transformOrigin: 'center center',
      }
    }

    // Pixel-based: exact crop/pan/rotation — matches the editor view 1:1.
    // offsetWidth gives CSS layout size, unaffected by parent transform: scale().
    const slotW  = wrapRef.current.offsetWidth  || 300
    const slotH  = wrapRef.current.offsetHeight || 400

    // Size the image to cover the slot (cover scale) + 30% extra pan room
    const coverSc = Math.max(slotW / imgNat.w, slotH / imgNat.h)
    const totalSc = coverSc * 1.3 * sc

    const iW = imgNat.w * totalSc
    const iH = imgNat.h * totalSc

    // Pan: cd.x/y are 0-100 where 50=center; map to pixel offset
    const panX = ((50 - (cd?.x || 50)) / 50) * Math.max(0, (iW - slotW) / 2)
    const panY = ((50 - (cd?.y || 50)) / 50) * Math.max(0, (iH - slotH) / 2)

    return {
      position: 'absolute',
      width:    `${iW}px`, height: `${iH}px`,
      left:     `calc(50% - ${iW/2}px + ${panX}px)`,
      top:      `calc(50% - ${iH/2}px + ${panY}px)`,
      maxWidth: 'none', maxHeight: 'none',
      transform: rt ? `rotate(${rt}deg)` : undefined,
      transformOrigin: 'center',
    }
  })()

  // ── Click ──────────────────────────────────────────────────────────────────
  const handleClick = (e) => {
    if (!editMode || isAdj) return
    if (url) {
      // Filled slot → enter inline adjust mode (buttons in overlay stop propagation)
      setIsAdj(true)
      setLCrop(saved?.cropData || { x:50, y:50, scale:1, rotation:0 })
    } else {
      // Empty slot → direct file picker, no modal
      const rect = wrapRef.current?.getBoundingClientRect()
      onEdit?.(slotId, { dims: rect ? { width:rect.width, height:rect.height } : null, existingUrl: null, existingCrop: null })
    }
  }

  // ── Replace — open file picker (e is optional — called from panel with no event) ──
  const handleReplace = (e) => {
    e?.stopPropagation()
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = (ev) => {
      const file = ev.target.files?.[0]
      if (file) { adjCtx?.onReplaceFile?.(slotId, file); exitAdj(false) }
    }
    input.click()
  }

  // ── Delete — remove image from slot (e optional) ─────────────────────────────
  const handleDelete = (e) => {
    e?.stopPropagation()
    adjCtx?.onDelete?.(slotId)
    exitAdj(false)
  }

  // ── Pan via drag ─────────────────────────────────────────────────────────────
  // Drag right (dx>0) → x decreases → image pans right, shows left content.
  const applyPan = (dx, dy) => {
    const { width=300, height=400 } = wrapRef.current?.getBoundingClientRect() || {}
    const factor = 55 / Math.max(lCrop?.scale||1, 1)
    setLCrop(p => p ? {
      ...p,
      x: Math.max(0, Math.min(100, (p.x||50) - (dx / width)  * factor)),
      y: Math.max(0, Math.min(100, (p.y||50) - (dy / height) * factor)),
    } : p)
  }

  // ── Pan via buttons — step in opposite direction to drag (subtract) ────────────
  const panStep = (dPct, axis) => {  // axis: 'x' or 'y', positive = pan right/down
    setLCrop(p => p ? {
      ...p,
      [axis]: Math.max(0, Math.min(100, (p[axis]||50) - dPct)),
    } : p)
  }

  // ── Zoom — maintain visual position by adjusting x/y when availPan range changes ──
  const applyZoom = (f) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const slotW = rect?.width  || 300
    const slotH = rect?.height || 400

    setLCrop(p => {
      if (!p) return p
      const sc_old = p.scale || 1
      const sc_new = Math.max(1, Math.min(6, sc_old * f))
      if (sc_new === sc_old) return p

      // If no imgNat yet, just update scale (fallback)
      if (!imgNat) return { ...p, scale: sc_new }

      const BASE = 1.3
      const cov = Math.max(slotW / imgNat.w, slotH / imgNat.h)

      // Available pan range (half-overflow) at old and new scale
      const avX_old = Math.max(1, (imgNat.w * cov * BASE * sc_old - slotW) / 2)
      const avY_old = Math.max(1, (imgNat.h * cov * BASE * sc_old - slotH) / 2)
      const avX_new = Math.max(1, (imgNat.w * cov * BASE * sc_new - slotW) / 2)
      const avY_new = Math.max(1, (imgNat.h * cov * BASE * sc_new - slotH) / 2)

      // Current pixel offset from center
      const panX = (50 - (p.x || 50)) * avX_old / 50
      const panY = (50 - (p.y || 50)) * avY_old / 50

      // Convert back to 0-100 coords using new range — keeps visual position fixed
      const x_new = Math.max(0, Math.min(100, 50 - panX * 50 / avX_new))
      const y_new = Math.max(0, Math.min(100, 50 - panY * 50 / avY_new))

      return { ...p, scale: sc_new, x: x_new, y: y_new }
    })
  }

  // ── Rotate (single-step, 90°) ────────────────────────────────────────────────
  const applyRot = (deg) => setLCrop(p => p ? { ...p, rotation: (((p.rotation||0) + deg) + 360) % 360 } : p)

  // ── Mouse drag — attach to document so drag works outside the element ────────
  const onMD = (e) => {
    if (!isAdj) return
    e.preventDefault()
    drag.current = { x:e.clientX, y:e.clientY }

    const onMove = (ev) => {
      if (!drag.current) return
      applyPan(ev.clientX - drag.current.x, ev.clientY - drag.current.y)
      drag.current = { x:ev.clientX, y:ev.clientY }
    }
    const onUp = () => {
      drag.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Non-passive wheel listener — React's onWheel is passive so can't preventDefault ──
  // Only captures scroll when slot is selected (isAdj=true); otherwise page scrolls normally
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e) => {
      if (!isAdj) return          // not selected → let page scroll freely
      e.preventDefault()          // selected → block page scroll, zoom image instead
      e.stopPropagation()
      applyZoom(e.deltaY < 0 ? 1.08 : 0.93)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [isAdj]) // eslint-disable-line

  // ── Touch events — non-passive touchmove via useEffect to allow preventDefault ──
  const onTS = (e) => {
    if (!isAdj) return
    if (e.touches.length === 1) { drag.current = { x:e.touches[0].clientX, y:e.touches[0].clientY }; pinch.current = null }
    else if (e.touches.length === 2) { drag.current = null; pinch.current = Math.hypot(e.touches[1].clientX-e.touches[0].clientX, e.touches[1].clientY-e.touches[0].clientY) }
  }
  const onTE = () => { drag.current = null; pinch.current = null }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const tmHandler = (e) => {
      if (!isAdj) return
      e.preventDefault()   // blocks page scroll/swipe while image is selected
      e.stopPropagation()
      if (e.touches.length === 1 && drag.current) {
        applyPan(e.touches[0].clientX-drag.current.x, e.touches[0].clientY-drag.current.y)
        drag.current = { x:e.touches[0].clientX, y:e.touches[0].clientY }
      } else if (e.touches.length === 2 && pinch.current) {
        const d = Math.hypot(e.touches[1].clientX-e.touches[0].clientX, e.touches[1].clientY-e.touches[0].clientY)
        applyZoom(d / pinch.current)
        pinch.current = d
      }
    }
    el.addEventListener('touchmove', tmHandler, { passive: false })
    return () => el.removeEventListener('touchmove', tmHandler)
  }, [isAdj]) // eslint-disable-line

  // ── Keyboard shortcuts (Ctrl+/Ctrl-) while adjusting ────────────────────────
  useEffect(() => {
    if (!isAdj) return
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key==='+' || e.key==='=')) { e.preventDefault(); applyZoom(1.1) }
      if ((e.ctrlKey || e.metaKey) && e.key==='-') { e.preventDefault(); applyZoom(0.9) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isAdj])

  // ── Click outside → save & exit ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAdj) return
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) exitAdj(true)
    }
    const tid = setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', h) }
  }, [isAdj, lCrop]) // eslint-disable-line

  // Smart-position the portal ControlBall: right → left → below
  useEffect(() => {
    if (!isAdj || !wrapRef.current) { setBallPos(null); return }
    const isMob  = window.innerWidth < 640
    const BALL_W = isMob ? 168 : 120, BALL_H = isMob ? 370 : 310
    const update = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth, vh = window.innerHeight
      let top = r.top + r.height / 2, left, anchor

      if (r.right + BALL_W + 16 <= vw) {
        // Enough space on right
        left = r.right + 10; anchor = 'right'
      } else if (r.left - BALL_W - 10 >= 0) {
        // Enough space on left
        left = r.left - BALL_W - 10; anchor = 'left'
      } else {
        // No side space (mobile) — show centered below the slot
        left = Math.max(8, Math.min(vw - BALL_W - 8, r.left + r.width / 2))
        top  = Math.min(r.bottom + 10, vh - BALL_H - 8)
        anchor = 'bottom'
      }
      // Clamp vertical so it doesn't go off screen
      if (anchor !== 'bottom') {
        top = Math.max(BALL_H / 2 + 4, Math.min(vh - BALL_H / 2 - 4, top))
      }
      setBallPos({ top, left, anchor })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [isAdj])

  const exitAdj = (save = true) => {
    if (save && lCrop) adjCtx?.onAdjust?.(slotId, lCrop)
    setIsAdj(false)
    setLCrop(null)
    setBallPos(null)
    drag.current = null
  }

  return (
    <div ref={wrapRef}
      className={'relative overflow-hidden ' + className}
      style={{ position:'relative', overflow:'hidden', background:colors?.surface||'#ddd', cursor:editMode?(isAdj?'grab':'pointer'):'default', userSelect:'none', ...style }}
      onClick={handleClick}
      onMouseDown={onMD}
      onTouchStart={onTS} onTouchEnd={onTE}>

      {show
        ? <img src={show} alt="" draggable={false} className="pointer-events-none"
            style={imgStyle}
            onLoad={e => setImgNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}/>
        : <div className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{ color:colors?.muted||'#999',
                     opacity: editMode ? 0.6 : 0.35,
                     background: editMode ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
            {(() => {
              const sz = typeof window !== 'undefined' && window.innerWidth < 640 ? 34 : 26
              return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            })()}
            {editMode && <span style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 640 ? 11 : 9,
                                        letterSpacing:'0.12em', textTransform:'uppercase', marginTop:2 }}>
              Tap to Add Photo
            </span>}
          </div>
      }

      {/* ── Adjust mode UI ── */}
      {isAdj && (
        <>
          {/* Selection border */}
          <div className="absolute inset-0 pointer-events-none" style={{ border:'2px solid #3b82f6', boxShadow:'inset 0 0 0 1px rgba(59,130,246,0.3)', zIndex:10 }}/>

          {/* Hint badge top-right */}
          <div className="absolute top-1 right-1 pointer-events-none" style={{ zIndex:11 }}>
            <span style={{ display:'block', background:'rgba(59,130,246,0.9)', borderRadius:3, padding:'2px 5px', fontSize:7, color:'white', fontFamily:'inherit', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              Drag · Scroll · Pinch
            </span>
          </div>

          {/* Control bar — compact, no duplicates (Replace/Delete are in the side panel) */}
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-between pointer-events-auto"
            style={{ background:'rgba(0,0,0,0.84)', backdropFilter:'blur(10px)', padding:'3px 6px', gap:3, zIndex:11 }}
            onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>

            <div className="flex items-center gap-0.5">
              {/* Rotate */}
              <button title="Rotate CCW" onClick={e=>{e.stopPropagation();applyRot(-90)}}
                className="w-6 h-6 rounded flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition-all" style={{ fontSize:13 }}>⟲</button>
              <button title="Rotate CW" onClick={e=>{e.stopPropagation();applyRot(90)}}
                className="w-6 h-6 rounded flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition-all" style={{ fontSize:13 }}>⟳</button>
              <div style={{ width:1, height:10, background:'rgba(255,255,255,0.18)', margin:'0 3px' }}/>
              {/* Crop */}
              <button title="Crop out" onClick={e=>{e.stopPropagation();applyZoom(0.88)}}
                className="w-6 h-6 rounded flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 font-bold transition-all" style={{ fontSize:15 }}>−</button>
              <button title="Crop in" onClick={e=>{e.stopPropagation();applyZoom(1.12)}}
                className="w-6 h-6 rounded flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 font-bold transition-all" style={{ fontSize:15 }}>+</button>
              <div style={{ width:1, height:10, background:'rgba(255,255,255,0.18)', margin:'0 3px' }}/>
              {/* Reset */}
              <button title="Reset position and zoom" onClick={e=>{e.stopPropagation();setLCrop({x:50,y:50,scale:1,rotation:0})}}
                className="h-5 rounded px-1.5 text-white/45 hover:text-white hover:bg-white/12 transition-all" style={{ fontSize:8, letterSpacing:'0.08em' }}>
                Reset
              </button>
            </div>

            <button onClick={e=>{e.stopPropagation();exitAdj(true)}}
              className="font-inter font-bold text-white rounded-lg transition-all hover:brightness-115 shrink-0"
              style={{ background:'#1d4ed8', fontSize:9, padding:'4px 10px', letterSpacing:'0.07em',
                       boxShadow:'0 1px 6px rgba(29,78,216,0.45)' }}>
              Done &#10003;
            </button>
          </div>
        </>
      )}

      {/* Hover overlay — Adjust / Replace / Delete (desktop hover OR mobile always-on) */}
      {editMode && show && !isAdj && (() => {
        const isMobView = typeof window !== 'undefined' && window.innerWidth < 640
        if (isMobView) {
          // Mobile: small pencil badge in corner — full controls appear in the bottom sheet ControlBall
          return (
            <div style={{ position:'absolute', top:6, right:6, pointerEvents:'none' }}>
              <div style={{ background:'rgba(0,0,0,0.55)', borderRadius:6, padding:'3px 7px',
                            display:'flex', alignItems:'center', gap:4 }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span style={{ fontFamily:'system-ui,sans-serif', fontSize:9,
                               color:'rgba(255,255,255,0.65)', letterSpacing:'0.06em' }}>Tap</span>
              </div>
            </div>
          )
        }
        // Desktop: hover overlay
        return (
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity"
            style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
            onClick={e=>e.stopPropagation()}>
            {[
              { label:'Adjust',  fn:()=>{setIsAdj(true);setLCrop(saved?.cropData||{x:50,y:50,scale:1,rotation:0})}, border:'rgba(255,255,255,0.3)', bg:'rgba(255,255,255,0.12)', col:'#fff' },
              { label:'Replace', fn:handleReplace, border:'rgba(96,165,250,0.45)', bg:'rgba(37,99,235,0.22)', col:'rgba(147,197,253,1)' },
              { label:'Delete',  fn:handleDelete,  border:'rgba(220,38,38,0.45)',  bg:'rgba(220,38,38,0.2)',  col:'rgba(252,165,165,1)' },
            ].map(({label,fn,border,bg,col}) => (
              <button key={label} onClick={e=>{e.stopPropagation();fn()}}
                style={{ fontFamily:'system-ui,sans-serif', fontSize:10, fontWeight:700,
                         padding:'6px 12px', borderRadius:8, border:`1px solid ${border}`,
                         background:bg, color:col, cursor:'pointer', letterSpacing:'0.06em',
                         backdropFilter:'blur(8px)', transition:'filter 0.15s',
                         boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}
                onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.25)'}
                onMouseOut={e=>e.currentTarget.style.filter=''}>
                {label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* ── Portal ControlBall — renders outside page at slot's right edge ── */}
      {isAdj && (
        <ControlBall pos={ballPos}
          onPan={panStep} onZoom={applyZoom} onRot={applyRot}
          onReplace={handleReplace} onDelete={handleDelete} onDone={()=>exitAdj(true)}/>
      )}
    </div>
  )
}

function TxtSlot({ slotId, layoutId, pageData, sampleTexts={}, onEdit, editMode, colors, style={}, className='', tag='p' }) {
  const defaults  = DEFAULT_TEXTS[layoutId] || {}
  const saved     = pageData?.texts?.find(t => t.slotId === slotId)?.content
  const content   = saved || sampleTexts[slotId] || defaults[slotId] || ''
  const Tag = tag

  // On input: fire a cheap '__dirty__' sentinel so the Save button appears immediately
  // WITHOUT calling setPages (which triggers re-render → React reconciles contentEditable
  // → resets cursor to beginning). Pages are only updated on blur (safe: user has left field).
  const handleInput = () => onEdit?.('__dirty__', slotId, null)
  const handleBlur  = (e) => onEdit?.('text', slotId, e.currentTarget.textContent)

  if (editMode) {
    return (
      <Tag contentEditable suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        style={{ outline:'none', cursor:'text', minWidth:10, ...style }} className={className}>
        {content}
      </Tag>
    )
  }
  return <Tag style={style} className={className}>{content}</Tag>
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYOUT RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

// ── COVER — full-bleed photo, gradient overlay, title bottom ─────────────────
function CoverPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  const alignMap = {
    'bottom-left':  { jc:'flex-end',   ai:'flex-start', p:'10% 8%' },
    'bottom-right': { jc:'flex-end',   ai:'flex-end',   p:'10% 8%' },
    'top-left':     { jc:'flex-start', ai:'flex-start', p:'12% 8%' },
    'top-right':    { jc:'flex-start', ai:'flex-end',   p:'12% 8%' },
    'center':       { jc:'center',     ai:'center',     p:'8%', ta:'center' },
  }
  const al = alignMap[cs.layout||'bottom-left'] || alignMap['bottom-left']
  return (
    <div className="relative w-full h-full flex flex-col"
      style={{ background:colors.bg, justifyContent:al.jc, alignItems:al.ai, padding:al.p }}>
      {cs.accentBar && <div className="absolute top-0 inset-x-0 h-[6px] z-20" style={{ background:colors.accent }}/>}
      <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
        onEdit={onEditImage} editMode={editMode} colors={colors}
        className="absolute inset-0" style={{ zIndex:0 }}/>
      <div className="absolute inset-0 z-[1]"
        style={{ background:'linear-gradient(to top,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.15) 55%,transparent 100%)' }}/>
      <div className="relative z-10" style={{ textAlign:al.ta||'left' }}>
        <TxtSlot slotId="title" layoutId="cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:cs.titleSize||'4.2rem', fontWeight:900,
            color:'#fff', lineHeight:0.88, letterSpacing:cs.letterSpacing||'-0.02em',
            fontStyle:cs.titleStyle||'normal', marginBottom:'0.55rem',
            textShadow:'0 2px 24px rgba(0,0,0,0.6)' }}/>
        <TxtSlot slotId="subtitle" layoutId="cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.58rem', color:'rgba(255,255,255,0.7)',
            letterSpacing:'0.35em', textTransform:'uppercase', marginBottom:'0.25rem' }}/>
        <TxtSlot slotId="tagline" layoutId="cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.82rem', color:colors.accent, fontStyle:'italic' }}/>
      </div>
      {cs.accentBar && <div className="absolute bottom-0 inset-x-0 h-[3px] z-20" style={{ background:colors.accent }}/>}
    </div>
  )
}

// ── PHOTO BOOK COVER — white, label + large serif title, full-width photo ────
function PhotoBookCoverPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col"
      style={{ background:'#ffffff', padding:'7% 8% 6%' }}>
      <TxtSlot slotId="subtitle" layoutId="photo-book-cover" pageData={pageData} sampleTexts={sampleTexts}
        onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
        style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.42em',
          textTransform:'uppercase', color:'#aaa', marginBottom:6 }}/>
      <div style={{ width:'100%', height:'1px', background:'#d8d8d8', marginBottom:'0.7rem' }}/>
      <TxtSlot slotId="title" layoutId="photo-book-cover" pageData={pageData} sampleTexts={sampleTexts}
        onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
        style={{ fontFamily:fonts.heading, fontSize:cs.titleSize||'3.2rem', fontWeight:900,
          color:'#111', lineHeight:0.9, letterSpacing:cs.letterSpacing||'-0.025em',
          fontStyle:cs.titleStyle||'normal', marginBottom:'5%' }}/>
      {/* minHeight:0 + overflow:hidden — clip boundary so the cover-scaled image
          never spills out (matters for html2canvas PDF export, harmless in app). */}
      <div style={{ flex:1, minHeight:0, overflow:'hidden', margin:'0 -8%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={{ surface:'#eee' }}
          className="w-full h-full"/>
      </div>
      <div style={{ marginTop:'5%' }}>
        <TxtSlot slotId="tagline" layoutId="photo-book-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.55rem', color:'#999',
            lineHeight:1.75, maxWidth:'82%' }}/>
      </div>
    </div>
  )
}

// ── WINDOW STRIP — dark BW bg + narrow color photo strip + bold title ────────
// Inspired by dramatic portrait-feature magazine spreads
function WindowStripPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden"
      style={{ background:colors.bg || '#1a1a1a' }}>
      {/* BW full-bleed portrait background */}
      <div className="absolute inset-0" style={{ filter:'grayscale(1) brightness(0.35)' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={null} editMode={false} colors={{ surface:'#333' }} className="w-full h-full"/>
      </div>
      {/* Narrow vertical color strip */}
      <div className="absolute overflow-hidden"
        style={{ left:'50%', top:'4%', bottom:'4%', width:'29%',
          transform:'translateX(-50%)',
          border:'1.5px solid rgba(255,255,255,0.6)',
          boxShadow:'0 0 48px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={null} editMode={false} colors={{ surface:'#444' }} className="w-full h-full"/>
        {editMode && (
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer"
            style={{ background:'rgba(0,0,0,0.4)' }}
            onClick={() => onEditImage?.('image','img1')}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.3}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
      </div>
      {/* Text — bottom left */}
      <div className="absolute z-10" style={{ bottom:'7%', left:'5%', width:'40%' }}>
        <TxtSlot slotId="title" layoutId="window-strip" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:'2.6rem', fontWeight:900,
            color:'#fff', lineHeight:0.88, letterSpacing:'-0.02em', marginBottom:'0.8rem' }}/>
        <TxtSlot slotId="body" layoutId="window-strip" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.68rem', color:'rgba(255,255,255,0.7)',
            lineHeight:1.8 }}/>
      </div>
      {/* Top right label */}
      <div className="absolute z-10" style={{ top:'5%', right:'5%', textAlign:'right' }}>
        <TxtSlot slotId="subtitle" layoutId="window-strip" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.48rem', color:'rgba(255,255,255,0.4)',
            letterSpacing:'0.2em', textTransform:'uppercase', lineHeight:1.9 }}/>
      </div>
    </div>
  )
}

// ── FULL BLEED — photo edge to edge, caption bottom ──────────────────────────
function FullBleedPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full">
      <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
        onEdit={onEditImage} editMode={editMode} colors={colors} className="absolute inset-0"/>
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%)' }}/>
      <div className="absolute bottom-0 left-0 right-0" style={{ padding:'6% 8%' }}>
        <TxtSlot slotId="caption" layoutId="full-bleed" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.92rem', color:'#fff',
            fontStyle:'italic', letterSpacing:'0.03em', lineHeight:1.55 }}/>
      </div>
    </div>
  )
}

// ── ROW 3 — three equal photos side by side ──────────────────────────────────
function Row3Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg, padding:'6%' }}>
      <div style={{ flex:1, display:'flex', gap:7, minHeight:0 }}>
        {[1,2,3].map(n => (
          <ImgSlot key={n} slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
            onEdit={onEditImage} editMode={editMode} colors={colors}
            className="flex-1 h-full" style={{ minWidth:0 }}/>
        ))}
      </div>
      <div style={{ paddingTop:'3%', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <TxtSlot slotId="caption" layoutId="row-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.3em',
            textTransform:'uppercase', color:colors.muted }}/>
        <TxtSlot slotId="subtitle" layoutId="row-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.5rem', color:colors.muted }}/>
      </div>
    </div>
  )
}

// ── ROW 2 — two photos side by side with title strip ─────────────────────────
function Row2Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg, padding:'6%' }}>
      <div style={{ flex:1, display:'flex', gap:9, minHeight:0 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors}
          className="flex-1 h-full" style={{ minWidth:0 }}/>
        <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
          onEdit={onEditImage} editMode={editMode} colors={colors}
          className="flex-1 h-full" style={{ minWidth:0 }}/>
      </div>
      <div style={{ paddingTop:'3%', borderTop:`1px solid ${colors.surface}` }}>
        <TxtSlot slotId="title" layoutId="row-2" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h3"
          style={{ fontFamily:fonts.heading, fontSize:'0.95rem', fontWeight:700,
            color:colors.text, marginBottom:4 }}/>
        <TxtSlot slotId="caption" layoutId="row-2" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.56rem', color:colors.muted,
            letterSpacing:'0.08em' }}/>
      </div>
    </div>
  )
}

// ── CATALOG SPREAD — left tall portrait + right 2×2 grid ────────────────────
function CatalogSpreadPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg, padding:14, gap:9 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ flex:1, minWidth:0, display:'grid',
        gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:9 }}>
        {[2,3,4,5].map(n => (
          <ImgSlot key={n} slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        ))}
      </div>
    </div>
  )
}

// ── PHOTO CAPTION — large photo + caption bar ────────────────────────────────
function PhotoCaptionPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg }}>
      <div style={{ flex:1 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ padding:'4% 6%', borderTop:`2px solid ${colors.accent}` }}>
        <TxtSlot slotId="caption" layoutId="photo-caption" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.7rem', color:colors.text,
            fontStyle:'italic', lineHeight:1.6 }}/>
      </div>
    </div>
  )
}

// ── PORTRAIT FEATURE — text left + tall portrait right ───────────────────────
function PortraitFeaturePage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg }}>
      <div className="flex flex-col justify-center" style={{ flex:1, padding:'8% 7%', minWidth:0 }}>
        <div style={{ width:30, height:3, background:colors.accent, marginBottom:'1.1rem' }}/>
        <TxtSlot slotId="name" layoutId="portrait-feature" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:'1.9rem', fontWeight:900,
            color:colors.text, lineHeight:0.9, letterSpacing:'-0.02em',
            marginBottom:'0.8rem', fontStyle:cs.titleStyle||'normal' }}/>
        <TxtSlot slotId="title" layoutId="portrait-feature" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.55rem', letterSpacing:'0.28em',
            textTransform:'uppercase', color:colors.accent, marginBottom:'1.1rem' }}/>
        <TxtSlot slotId="body" layoutId="portrait-feature" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.72rem', color:colors.muted, lineHeight:1.9 }}/>
      </div>
      <div style={{ width:'53%', flexShrink:0, height:'100%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── TEXT COLUMNS — dropcap + 2-column editorial text ────────────────────────
function TextColumnsPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg, padding:'8% 9%' }}>
      <div style={{ borderBottom:`1px solid ${colors.surface}`, paddingBottom:'0.9rem', marginBottom:'1.4rem' }}>
        <TxtSlot slotId="title" layoutId="text-columns" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.8rem', fontWeight:800,
            color:colors.text, letterSpacing:'-0.01em' }}/>
      </div>
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5%' }}>
        <TxtSlot slotId="body1" layoutId="text-columns" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.77rem', color:colors.text,
            lineHeight:1.95, textAlign:'justify' }}/>
        <TxtSlot slotId="body2" layoutId="text-columns" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.77rem', color:colors.muted,
            lineHeight:1.95, textAlign:'justify' }}/>
      </div>
    </div>
  )
}

// ── SPLIT LEFT — photo left, text right ─────────────────────────────────────
function SplitLeftPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg }}>
      <div style={{ width:'53%', flexShrink:0, height:'100%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div className="flex flex-col justify-center" style={{ flex:1, padding:'8% 7%' }}>
        <div style={{ width:30, height:3, background:colors.accent, marginBottom:'1.1rem' }}/>
        <TxtSlot slotId="title" layoutId="split-left" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.75rem', fontWeight:800,
            color:colors.text, lineHeight:1.0, marginBottom:'0.9rem',
            fontStyle:cs.titleStyle||'normal' }}/>
        <TxtSlot slotId="body" layoutId="split-left" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.71rem', color:colors.muted, lineHeight:1.9 }}/>
      </div>
    </div>
  )
}

// ── SPLIT RIGHT — text left, photo right ─────────────────────────────────────
function SplitRightPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg }}>
      <div className="flex flex-col justify-center" style={{ flex:1, padding:'8% 7%' }}>
        <div style={{ width:30, height:3, background:colors.accent, marginBottom:'1.1rem' }}/>
        <TxtSlot slotId="title" layoutId="split-right" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.75rem', fontWeight:800,
            color:colors.text, lineHeight:1.0, marginBottom:'0.9rem',
            fontStyle:cs.titleStyle||'normal' }}/>
        <TxtSlot slotId="body" layoutId="split-right" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.71rem', color:colors.muted, lineHeight:1.9 }}/>
      </div>
      <div style={{ width:'53%', flexShrink:0, height:'100%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── GRID 4 — 2×2 photo grid ──────────────────────────────────────────────────
function Grid4Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg }}>
      <div style={{ padding:'4% 5% 2%' }}>
        <TxtSlot slotId="caption" layoutId="grid-4" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.53rem', letterSpacing:'0.3em',
            textTransform:'uppercase', color:colors.muted }}/>
      </div>
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr',
        gridTemplateRows:'1fr 1fr', gap:6, padding:'2% 5% 5%' }}>
        {[1,2,3,4].map(n => (
          <ImgSlot key={n} slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        ))}
      </div>
    </div>
  )
}

// ── GRID 6 — 3×2 photo grid ──────────────────────────────────────────────────
function Grid6Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg }}>
      <div style={{ padding:'4% 5% 1.5%' }}>
        <TxtSlot slotId="caption" layoutId="grid-6" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.53rem', letterSpacing:'0.3em',
            textTransform:'uppercase', color:colors.muted }}/>
      </div>
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gridTemplateRows:'1fr 1fr', gap:5, padding:'0 5% 5%' }}>
        {[1,2,3,4,5,6].map(n => (
          <ImgSlot key={n} slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        ))}
      </div>
    </div>
  )
}

// ── FEATURE TRIO — big photo top, small photo + text bottom ──────────────────
function FeatureTrioPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg, padding:'5%', gap:8 }}>
      <div style={{ flex:2 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ flex:1.2, display:'flex', gap:10 }}>
        <div style={{ flex:1 }}>
          <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ width:26, height:3, background:colors.accent, marginBottom:8 }}/>
          <TxtSlot slotId="title" layoutId="feature-trio" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="h3"
            style={{ fontFamily:fonts.heading, fontSize:'1.15rem', fontWeight:800,
              color:colors.text, marginBottom:8 }}/>
          <TxtSlot slotId="body" layoutId="feature-trio" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.66rem', color:colors.muted, lineHeight:1.85 }}/>
        </div>
      </div>
    </div>
  )
}

// ── MASONRY 3 — tall left + 2 stacked right ──────────────────────────────────
function Masonry3Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg, padding:'5%', gap:8 }}>
      <div style={{ flex:1.3 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ flex:1 }}>
          <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
        <div style={{ flex:1 }}>
          <ImgSlot slotId="img3" pageData={pageData} sampleUrl={sampleImages.img3}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
        <TxtSlot slotId="caption" layoutId="masonry-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.52rem', color:colors.muted,
            letterSpacing:'0.15em', textTransform:'uppercase' }}/>
      </div>
    </div>
  )
}

// ── QUOTE PAGE — centered pull quote ─────────────────────────────────────────
function QuotePage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center"
      style={{ background:colors.bg, padding:'12%', textAlign:'center' }}>
      {sampleImages.img1 && !editMode && (
        <div className="absolute inset-0 opacity-[0.06]">
          <img src={sampleImages.img1} className="w-full h-full object-cover" alt=""/>
        </div>
      )}
      <div style={{ fontSize:'3.5rem', color:colors.accent, lineHeight:0.35,
        fontFamily:fonts.heading, marginBottom:'1.6rem', opacity:0.38 }}>"</div>
      <TxtSlot slotId="quote" layoutId="quote-page" pageData={pageData} sampleTexts={sampleTexts}
        onEdit={onEditText} editMode={editMode} colors={colors} tag="blockquote"
        style={{ fontFamily:fonts.heading, fontSize:'1.25rem', fontStyle:'italic',
          color:colors.text, lineHeight:1.55, marginBottom:'1.3rem', position:'relative' }}/>
      <div style={{ width:30, height:2, background:colors.accent, margin:'0 auto 0.8rem' }}/>
      <TxtSlot slotId="author" layoutId="quote-page" pageData={pageData} sampleTexts={sampleTexts}
        onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
        style={{ fontFamily:fonts.body, fontSize:'0.62rem', letterSpacing:'0.25em',
          textTransform:'uppercase', color:colors.muted }}/>
    </div>
  )
}

// ── TEXT SPREAD — text left + small photo right ───────────────────────────────
function TextSpreadPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg }}>
      <div className="flex flex-col justify-center"
        style={{ flex:1, padding:'8%', borderRight:`1px solid ${colors.surface}` }}>
        <div style={{ width:26, height:3, background:colors.accent, marginBottom:18 }}/>
        <TxtSlot slotId="title" layoutId="text-spread" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.55rem', fontWeight:800,
            color:colors.text, lineHeight:1.1, marginBottom:14 }}/>
        <TxtSlot slotId="body" layoutId="text-spread" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.73rem', color:colors.muted, lineHeight:1.95 }}/>
      </div>
      <div style={{ flex:0.65, display:'flex', alignItems:'center', justifyContent:'center', padding:'8%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors}
          className="w-full" style={{ height:'72%' }}/>
      </div>
    </div>
  )
}

// ── COLLAGE 5 — asymmetric 5-photo mosaic ────────────────────────────────────
function Collage5Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, sampleImages={} } = tpl
  return (
    <div className="w-full h-full"
      style={{ background:colors.bg, display:'grid',
        gridTemplateColumns:'1.4fr 1fr', gridTemplateRows:'1.3fr 1fr', gap:5, padding:12 }}>
      <div style={{ gridRow:'1', gridColumn:'1' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ gridRow:'1/3', gridColumn:'2', display:'flex', flexDirection:'column', gap:5 }}>
        {[2,3].map((n,i) => (
          <div key={n} style={{ flex:1 }}>
            <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
              onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
          </div>
        ))}
      </div>
      <div style={{ gridRow:'2', gridColumn:'1', display:'flex', gap:5 }}>
        {[4,5].map(n => (
          <div key={n} style={{ flex:1 }}>
            <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
              onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HERO TEXT — photo top, bold text bottom ───────────────────────────────────
function HeroTextPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, coverStyle:cs={}, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg }}>
      <div style={{ flex:1.5 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div className="flex flex-col justify-center"
        style={{ flex:1, padding:'5% 8%', borderTop:`4px solid ${colors.accent}` }}>
        <TxtSlot slotId="title" layoutId="hero-text" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'2rem', fontWeight:900,
            color:colors.text, lineHeight:0.9, letterSpacing:cs.letterSpacing||'-0.02em',
            marginBottom:8, fontStyle:cs.titleStyle||'normal' }}/>
        <TxtSlot slotId="body" layoutId="hero-text" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.63rem', color:colors.muted,
            letterSpacing:'0.16em', textTransform:'uppercase' }}/>
      </div>
    </div>
  )
}

// ── EDITORIAL 4 — large left + 2 stacked right + caption bar ────────────────
function Editorial4Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg, padding:'5%', gap:8 }}>
      <div style={{ flex:1, display:'flex', gap:8 }}>
        <div style={{ flex:2 }}>
          <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          {[2,3].map(n => (
            <div key={n} style={{ flex:1 }}>
              <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
                onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        borderTop:`1px solid ${colors.surface}`, paddingTop:8 }}>
        <TxtSlot slotId="title" layoutId="editorial-4" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h3"
          style={{ fontFamily:fonts.heading, fontSize:'1.05rem', fontWeight:800, color:colors.text }}/>
        <TxtSlot slotId="body" layoutId="editorial-4" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.6rem', color:colors.muted,
            maxWidth:'48%', textAlign:'right' }}/>
      </div>
    </div>
  )
}

// ── ARCH COVER — left text block + rotated spine label + right image ─────────
// Based on: Architectural Portfolio HTML design
function ArchCoverPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:'#ffffff' }}>
      {/* Left text column */}
      <div className="absolute flex flex-col justify-between" style={{ top:'8%', bottom:'8%', left:'6%', width:'42%', zIndex:2 }}>
        <div>
          <TxtSlot slotId="subtitle" layoutId="arch-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.22em',
              textTransform:'uppercase', color:colors.muted, marginBottom:6 }}/>
          <TxtSlot slotId="name" layoutId="arch-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
            style={{ fontFamily:fonts.heading, fontSize:'2.4rem', fontWeight:900,
              color:colors.text, lineHeight:0.88, letterSpacing:'-0.02em', marginBottom:10 }}/>
          <TxtSlot slotId="title" layoutId="arch-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.25em',
              textTransform:'uppercase', color:colors.muted }}/>
        </div>
        <TxtSlot slotId="year" layoutId="arch-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'2.8rem', fontWeight:800, color:colors.text }}/>
      </div>
      {/* Rotated center spine label */}
      <div className="absolute pointer-events-none" style={{ left:'48%', top:'50%', transform:'translate(-50%,-50%) rotate(-90deg)', zIndex:3 }}>
        <TxtSlot slotId="label" layoutId="arch-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'3.6rem', fontWeight:900,
            color:colors.text, letterSpacing:'0.22em', opacity:0.85, whiteSpace:'nowrap',
            mixBlendMode:'multiply', pointerEvents: editMode ? 'auto' : 'none' }}/>
      </div>
      {/* Right image block */}
      <div className="absolute" style={{ top:'5%', bottom:'5%', left:'52%', right:'4%', zIndex:1 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── GRID TOP DUO — large photo top + two smaller photos bottom ────────────────
// Based on: Minimalist Photo Book grid-split-bottom layout
function GridTopDuoPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, sampleImages={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg||'#fff', padding:'5%', gap:8 }}>
      <div style={{ flex:1.4 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ flex:1, display:'flex', gap:8 }}>
        <div style={{ flex:1, height:'100%' }}>
          <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
        <div style={{ flex:1, height:'100%' }}>
          <ImgSlot slotId="img3" pageData={pageData} sampleUrl={sampleImages.img3}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
    </div>
  )
}

// ── TWO STACK — two equal stacked photos ─────────────────────────────────────
// Based on: Minimalist Photo Book grid-stacked layout
function TwoStackPage({ tpl, pageData, editMode, onEditImage }) {
  const { colors, sampleImages={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg||'#fff', padding:'6%', gap:8 }}>
      <div style={{ flex:1 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      <div style={{ flex:1 }}>
        <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── ELEGANT PORTRAIT — script title + 3 text blocks left + tall portrait ─────
// Based on: Elegant Photography Portfolio page1 layout
function ElegantPortraitPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:'#ffffff', padding:'6% 8% 5%' }}>
      {/* Top title */}
      <div style={{ textAlign:'center', marginBottom:'4%' }}>
        <TxtSlot slotId="label" layoutId="elegant-portrait" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.35em',
            textTransform:'uppercase', color:'#cfa968', marginBottom:4 }}/>
        <TxtSlot slotId="title" layoutId="elegant-portrait" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'2.5rem', fontStyle:'italic',
            color:colors.text, lineHeight:1.05 }}/>
      </div>
      {/* Bottom: left text blocks + right portrait */}
      <div style={{ flex:1, display:'flex', gap:'5%', minHeight:0 }}>
        <div style={{ width:'34%', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:16, paddingBottom:'4%' }}>
          {[1,2,3].map(n => (
            <div key={n}>
              <TxtSlot slotId={`st${n}`} layoutId="elegant-portrait" pageData={pageData} sampleTexts={sampleTexts}
                onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
                style={{ fontFamily:fonts.body, fontSize:'0.55rem', fontWeight:700, color:colors.text, marginBottom:3 }}/>
              <TxtSlot slotId={`sb${n}`} layoutId="elegant-portrait" pageData={pageData} sampleTexts={sampleTexts}
                onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
                style={{ fontFamily:fonts.body, fontSize:'0.48rem', color:colors.muted, lineHeight:1.7 }}/>
            </div>
          ))}
        </div>
        <div style={{ flex:1, height:'100%' }}>
          <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
    </div>
  )
}

// ── CAPTIONS TRIO — title + 3 stacked landscape photos with captions ──────────
// Based on: Elegant Photography Portfolio page3 layout
function CaptionsTrioPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:'#ffffff', padding:'6% 8%' }}>
      <div style={{ marginBottom:'3%', flexShrink:0 }}>
        <TxtSlot slotId="title" layoutId="captions-trio" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.7rem', fontStyle:'italic', color:colors.text, marginBottom:6 }}/>
        <TxtSlot slotId="body" layoutId="captions-trio" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.58rem', color:colors.muted, lineHeight:1.8, maxWidth:'90%' }}/>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
        {[1,2,3].map(n => (
          <div key={n} style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            <div style={{ flex:1, minHeight:0 }}>
              <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
                onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
            </div>
            <TxtSlot slotId={`cap${n}`} layoutId="captions-trio" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.body, fontSize:'0.46rem', color:colors.muted,
                marginTop:3, textAlign:'center', flexShrink:0 }}/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── RETRO DIAGONAL — vintage diagonal polygon blocks + bold center text ────────
// Based on: Retro Magazine HTML cover design
function RetroDiagonalPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg||'#e2c792' }}>
      {/* Top color polygon */}
      <div className="absolute inset-0" style={{ background:colors.accent||'#e26d36',
        clipPath:'polygon(0 0, 100% 0, 100% 35%, 0 72%)' }}/>
      {/* Bottom color polygon */}
      <div className="absolute inset-0" style={{ background:colors.surface||'#088785',
        clipPath:'polygon(0 78%, 100% 42%, 100% 100%, 0 100%)' }}/>
      {/* Diagonal lines */}
      <div className="absolute" style={{ width:'150%', height:4, background:colors.text||'#2c2825',
        opacity:0.75, top:'41%', left:'-10%', transform:'rotate(-14deg)' }}/>
      <div className="absolute" style={{ width:'150%', height:4, background:colors.text||'#2c2825',
        opacity:0.75, top:'63%', left:'-10%', transform:'rotate(-14deg)' }}/>
      {/* Center text block */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex:10 }}>
        <TxtSlot slotId="prefix" layoutId="retro-diagonal" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'2rem', fontStyle:'italic',
            color:colors.text||'#2c2825', marginBottom:-6, lineHeight:1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:3, background:colors.text||'#2c2825' }}/>
          <TxtSlot slotId="title" layoutId="retro-diagonal" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
            style={{ fontFamily:fonts.heading, fontSize:'4.5rem', fontWeight:900,
              letterSpacing:'0.12em', color:colors.text||'#2c2825', lineHeight:1 }}/>
          <div style={{ width:36, height:3, background:colors.text||'#2c2825' }}/>
        </div>
        <TxtSlot slotId="subtitle" layoutId="retro-diagonal" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.75rem', fontWeight:800,
            letterSpacing:'0.32em', textTransform:'uppercase', color:colors.text||'#2c2825', marginTop:6 }}/>
      </div>
    </div>
  )
}

// ── RETRO COLS — two color columns with overlaid number + image + text ─────────
// Based on: Retro Magazine HTML spread1-left design
function RetroColsPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  const col1 = colors.accent || '#e26d36'
  const col2 = colors.surface || '#088785'
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg||'#e2c792', padding:12, gap:8 }}>
      {[1,2].map(n => (
        <div key={n} style={{ flex:1, display:'flex', flexDirection:'column',
          background:n===1?col1:col2, padding:10, overflow:'hidden', gap:0 }}>
          <div style={{ flex:1.5, position:'relative', overflow:'hidden' }}>
            <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
              onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex:2 }}>
              <span style={{ fontFamily:fonts.heading, fontSize:'6rem', fontWeight:900,
                color:'rgba(255,255,255,0.22)', lineHeight:1, mixBlendMode:'screen' }}>{n}</span>
            </div>
          </div>
          <TxtSlot slotId={`body${n}`} layoutId="retro-cols" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.58rem', color:'rgba(255,255,255,0.92)',
              lineHeight:1.7, padding:'8px 4px 0', flex:1 }}/>
        </div>
      ))}
    </div>
  )
}

// ── BOLD DARK — dark theme + numbered tag + body text + portrait image ─────────
// Based on: Modern Bold Portfolio HTML dark-left design
function BoldDarkPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg||'#1a1a1a' }}>
      <div style={{ width:'45%', padding:'8%', display:'flex', flexDirection:'column', justifyContent:'center', gap:12 }}>
        <TxtSlot slotId="tag" layoutId="bold-dark" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.46rem', letterSpacing:'0.32em',
            textTransform:'uppercase', color:colors.accent }}/>
        <div style={{ fontFamily:fonts.heading, fontSize:'3.8rem', fontWeight:900,
          color:colors.accent, lineHeight:0.9 }}>01</div>
        <TxtSlot slotId="title" layoutId="bold-dark" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h3"
          style={{ fontFamily:fonts.heading, fontSize:'1.1rem', fontWeight:700,
            color:colors.text, lineHeight:1.1 }}/>
        <TxtSlot slotId="body" layoutId="bold-dark" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.6rem', color:colors.muted, lineHeight:1.85 }}/>
      </div>
      <div style={{ flex:1, height:'100%' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── BOLD COVER — dark bg + big title + year + name + bottom split image ───────
// Based on: Modern Bold Portfolio HTML cover design
function BoldCoverPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg||'#1a1a1a' }}>
      <div style={{ padding:'8% 10% 4%', position:'relative', flexShrink:0 }}>
        <div style={{ textAlign:'center' }}>
          <TxtSlot slotId="title" layoutId="bold-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
            style={{ fontFamily:fonts.heading, fontSize:'3.5rem', fontWeight:900,
              letterSpacing:'-0.01em', color:colors.text, lineHeight:0.88 }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:12 }}>
          <div style={{ width:22, height:2, background:colors.accent }}/>
          <TxtSlot slotId="year" layoutId="bold-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.5rem', letterSpacing:'0.4em', color:colors.text }}/>
          <div style={{ width:22, height:2, background:colors.accent }}/>
        </div>
        <div style={{ marginTop:20, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <TxtSlot slotId="subtitle" layoutId="bold-cover" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.heading, fontSize:'0.62rem', fontWeight:700,
                color:colors.text, lineHeight:1.3 }}/>
            <div style={{ width:28, height:2, background:colors.muted, marginTop:5 }}/>
          </div>
          <div style={{ textAlign:'right' }}>
            <TxtSlot slotId="name" layoutId="bold-cover" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.heading, fontSize:'0.85rem', fontWeight:700,
                color:colors.text, lineHeight:1.1 }}/>
            <div style={{ width:28, height:2, background:colors.muted, marginTop:5, marginLeft:'auto' }}/>
          </div>
        </div>
      </div>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        <div style={{ position:'absolute', inset:0, left:0, width:'50%',
          background:colors.accent, opacity:0.3, pointerEvents:'none' }}/>
      </div>
    </div>
  )
}

// ── TRIPLE PORTRAIT — vertical label + three stacked portrait images ───────────
// Based on: Creative Portfolio Magazine HTML fashion-right design
function TriplePortraitPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg }}>
      {/* Left vertical label */}
      <div style={{ width:30, display:'flex', alignItems:'center', justifyContent:'center',
        borderRight:`1px solid ${colors.surface}`, flexShrink:0 }}>
        <TxtSlot slotId="label" layoutId="triple-portrait" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.42rem', letterSpacing:'0.25em',
            textTransform:'uppercase', color:colors.muted, lineHeight:1.9,
            writingMode:'vertical-rl', transform:'rotate(180deg)' }}/>
      </div>
      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'4%', gap:6 }}>
        <div style={{ flexShrink:0, marginBottom:4 }}>
          <TxtSlot slotId="title" layoutId="triple-portrait" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="h3"
            style={{ fontFamily:fonts.heading, fontSize:'1.0rem', fontWeight:800, color:colors.text }}/>
        </div>
        {[1,2,3].map(n => (
          <div key={n} style={{ flex:1, minHeight:0 }}>
            <ImgSlot slotId={`img${n}`} pageData={pageData} sampleUrl={sampleImages[`img${n}`]}
              onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VINTAGE COLLAGE — 5 scattered photos with white corner accents ────────────
// Based on: Vintage Memories Portfolio HTML cover-collage design
function VintageCollagePage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg||'#e6e6e6' }}>
      {/* Dark text box — top left */}
      <div className="absolute flex flex-col justify-end" style={{ top:'5%', left:'13%', width:'22%', height:'38%',
        background:colors.text||'#333', padding:12, zIndex:20 }}>
        <TxtSlot slotId="body" layoutId="vintage-collage" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.44rem', color:'#ccc', lineHeight:1.6, flex:1 }}/>
        <TxtSlot slotId="year" layoutId="vintage-collage" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'1.4rem', fontWeight:700, color:'#fff',
            textAlign:'center', marginTop:6 }}/>
      </div>
      {/* Photo 1 — top right large */}
      <div className="absolute" style={{ top:'13%', right:'4%', width:'54%', height:'32%', zIndex:10 }}>
        <div className="absolute" style={{ top:-8, right:-8, width:40, height:40, background:'white', zIndex:0 }}/>
        <div className="absolute" style={{ bottom:-8, left:-8, width:40, height:40, background:'white', zIndex:0 }}/>
        <div className="relative w-full h-full" style={{ zIndex:1, border:'5px solid white', boxShadow:'0 4px 16px rgba(0,0,0,0.14)' }}>
          <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
      {/* Photo 2 — middle left landscape */}
      <div className="absolute" style={{ top:'47%', left:'5%', width:'37%', height:'14%', zIndex:30 }}>
        <div className="absolute" style={{ top:-6, left:-6, width:24, height:24, background:'white', zIndex:0 }}/>
        <div className="relative w-full h-full" style={{ zIndex:1, border:'4px solid white', boxShadow:'0 3px 10px rgba(0,0,0,0.12)' }}>
          <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
      {/* Photo 3 — bottom left portrait */}
      <div className="absolute" style={{ bottom:'7%', left:'15%', width:'29%', height:'26%', zIndex:10,
        border:'4px solid white', boxShadow:'0 4px 12px rgba(0,0,0,0.12)' }}>
        <ImgSlot slotId="img3" pageData={pageData} sampleUrl={sampleImages.img3}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Photo 4 — center small */}
      <div className="absolute" style={{ bottom:'27%', left:'47%', width:'20%', height:'16%', zIndex:20,
        border:'4px solid white', boxShadow:'0 3px 10px rgba(0,0,0,0.12)' }}>
        <ImgSlot slotId="img4" pageData={pageData} sampleUrl={sampleImages.img4}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Photo 5 — middle right */}
      <div className="absolute" style={{ top:'50%', right:'5%', width:'27%', height:'24%', zIndex:10 }}>
        <div className="absolute" style={{ bottom:-8, right:-8, width:28, height:28, background:'white', zIndex:0 }}/>
        <div className="relative w-full h-full" style={{ zIndex:1, border:'4px solid white', boxShadow:'0 4px 12px rgba(0,0,0,0.12)' }}>
          <ImgSlot slotId="img5" pageData={pageData} sampleUrl={sampleImages.img5}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
      {/* Bottom right title */}
      <div className="absolute" style={{ bottom:'12%', right:'7%', textAlign:'center', zIndex:20 }}>
        <TxtSlot slotId="prefix" layoutId="vintage-collage" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'1.5rem', fontStyle:'italic',
            color:colors.text||'#333', transform:'rotate(-8deg)', display:'block', transformOrigin:'center' }}/>
        <TxtSlot slotId="title" layoutId="vintage-collage" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.2rem', fontWeight:700,
            letterSpacing:'0.15em', color:colors.text||'#333' }}/>
      </div>
    </div>
  )
}

// ── CONSTRUCTIVIST RED — bold red cover with geometric borders + image ─────────
// Based on: Constructivist Magazine Template HTML cover-right design
function ConstructivistRedPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.accent||'#c3151c', padding:'6%' }}>
      {/* Top bordered title */}
      <div style={{ border:'4px solid white', padding:'8px 12px', marginBottom:14, flexShrink:0 }}>
        <TxtSlot slotId="title" layoutId="constructivist-red" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:'3rem', fontWeight:900, lineHeight:0.85,
            letterSpacing:'0.04em', color:'#fff' }}/>
        <TxtSlot slotId="subtitle" layoutId="constructivist-red" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.46rem', letterSpacing:'0.3em',
            textAlign:'right', color:'rgba(255,255,255,0.75)', marginTop:4 }}/>
      </div>
      {/* Image + side menu */}
      <div style={{ flex:1, display:'flex', borderTop:'8px solid white', paddingTop:10, gap:10, minHeight:0 }}>
        <div style={{ width:'64%', borderRight:'4px solid rgba(255,255,255,0.35)', paddingRight:10 }}>
          <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
            onEdit={onEditImage} editMode={editMode} colors={{ surface:'rgba(255,255,255,0.1)' }}
            className="w-full h-full"/>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
          {['menu1','menu2','menu3'].map(k => (
            <TxtSlot key={k} slotId={k} layoutId="constructivist-red" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.heading, fontSize:'0.72rem', fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em', color:'#fff',
                borderBottom:'1px solid rgba(255,255,255,0.35)', paddingBottom:8 }}/>
          ))}
        </div>
      </div>
      {/* Bottom banner */}
      <div style={{ borderTop:'8px solid white', borderBottom:'8px solid white',
        padding:'6px 0', marginTop:10, flexShrink:0, textAlign:'center' }}>
        <TxtSlot slotId="tagline" layoutId="constructivist-red" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'1.8rem', fontWeight:900, lineHeight:0.9,
            letterSpacing:'0.06em', color:'#fff' }}/>
      </div>
    </div>
  )
}

// ── PILLARS TOC — giant heading + 3 colored pillars with section numbers ───────
// Based on: Constructivist Magazine Template HTML sumario-left design
function PillarsTocPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg||'#eedcc6' }}>
      {/* Header label */}
      <div style={{ position:'absolute', top:'6%', left:'5%', zIndex:10 }}>
        <TxtSlot slotId="label" layoutId="pillars-toc" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.48rem', letterSpacing:'0.25em',
            textTransform:'uppercase', color:colors.muted }}/>
      </div>
      {/* Giant heading text — wide overflow crop */}
      <div style={{ position:'absolute', top:'28%', left:'-5%', width:'115%', overflow:'hidden', lineHeight:0.75, zIndex:1 }}>
        <TxtSlot slotId="heading" layoutId="pillars-toc" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'9rem', fontWeight:900,
            color:colors.accent||'#c3151c', letterSpacing:'-0.02em', lineHeight:0.75 }}/>
      </div>
      {/* Three colored pillars at bottom */}
      <div style={{ position:'absolute', bottom:0, left:'5%', right:'5%', height:'46%',
        display:'flex', gap:8, alignItems:'flex-end', zIndex:10 }}>
        {[{h:'100%'},{h:'82%'},{h:'91%'}].map((p,i) => (
          <div key={i} style={{ flex:1, height:p.h, background:colors.accent||'#c3151c',
            display:'flex', flexDirection:'column', borderTop:`4px solid ${colors.text||'#1a1a1a'}`, padding:8 }}>
            <TxtSlot slotId={`lbl${i+1}`} layoutId="pillars-toc" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.body, fontSize:'0.46rem', fontWeight:700,
                textTransform:'uppercase', color:'rgba(255,255,255,0.9)', lineHeight:1.45, whiteSpace:'pre-line' }}/>
            <div style={{ marginTop:'auto', textAlign:'center' }}>
              <span style={{ fontFamily:fonts.heading, fontSize:'3.2rem', fontWeight:900, color:'#fff', lineHeight:0.8 }}>
                {String(i+1).padStart(2,'0')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INTERVIEW DUO — half image + half colored bg + large overlapping name ──────
// Based on: Constructivist Magazine Template HTML narda-left design
function InterviewDuoPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg }}>
      {/* Left image half */}
      <div className="absolute" style={{ top:0, left:0, width:'44%', height:'100%', zIndex:0 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Right colored half */}
      <div className="absolute flex flex-col justify-end"
        style={{ top:0, left:'42%', right:0, height:'100%', background:colors.accent||'#c3151c',
          padding:'6%', zIndex:1 }}>
        <TxtSlot slotId="subtitle" layoutId="interview-duo" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.46rem', letterSpacing:'0.3em',
            color:'rgba(255,255,255,0.65)', textAlign:'right' }}/>
      </div>
      {/* Giant overlapping name */}
      <div className="absolute" style={{ top:'50%', left:'12%', transform:'translateY(-50%)', zIndex:20, width:'82%' }}>
        <TxtSlot slotId="name" layoutId="interview-duo" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:'4.2rem', fontWeight:900, color:'#fff',
            lineHeight:0.8, letterSpacing:'-0.02em',
            textShadow:'0 4px 24px rgba(0,0,0,0.5)', whiteSpace:'pre-line' }}/>
      </div>
    </div>
  )
}

// ── JOURNAL PHOTO — bordered image with white corner accents + title + text ────
// Based on: Vintage Memories Portfolio HTML journal-left design
function JournalPhotoPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex flex-col" style={{ background:colors.bg||'#e6e6e6', padding:'8%' }}>
      {/* Image with white border + offset corner accents */}
      <div style={{ flex:1.5, position:'relative', margin:'0 auto', width:'90%' }}>
        <div style={{ position:'absolute', top:-12, left:-12, width:44, height:44, background:'white', zIndex:0 }}/>
        <div style={{ position:'absolute', bottom:-12, right:-12, width:44, height:44, background:'white', zIndex:0 }}/>
        <div style={{ position:'relative', width:'100%', height:'100%', zIndex:1,
          border:'6px solid white', boxShadow:'0 6px 24px rgba(0,0,0,0.12)' }}>
          <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
            onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
        </div>
      </div>
      {/* Text below */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center',
        textAlign:'center', paddingTop:'6%' }}>
        <TxtSlot slotId="label" layoutId="journal-photo" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.46rem', letterSpacing:'0.2em',
            textTransform:'uppercase', color:colors.muted, marginBottom:6 }}/>
        <TxtSlot slotId="title" layoutId="journal-photo" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.6rem', fontWeight:700,
            color:colors.text, marginBottom:10 }}/>
        <TxtSlot slotId="body" layoutId="journal-photo" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.56rem', color:colors.muted,
            lineHeight:1.85, textAlign:'justify' }}/>
      </div>
    </div>
  )
}

// ── SCATTER 3 — 3 overlapping offset photos with borders + year stamp ──────────
// Based on: Vintage Memories Portfolio HTML journal-right design
function Scatter3Page({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg||'#e6e6e6' }}>
      {/* Title — top right */}
      <div style={{ position:'absolute', top:'7%', right:'7%', textAlign:'right', zIndex:20 }}>
        <TxtSlot slotId="title" layoutId="scatter-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.8rem', fontStyle:'italic', color:colors.text }}/>
        <TxtSlot slotId="subtitle" layoutId="scatter-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'1rem', fontWeight:800,
            letterSpacing:'0.1em', textTransform:'uppercase', color:colors.text }}/>
      </div>
      {/* Photo 1 — top left */}
      <div style={{ position:'absolute', top:'21%', left:'7%', width:'50%', height:'32%', zIndex:10,
        border:'4px solid white', boxShadow:'0 4px 16px rgba(0,0,0,0.13)' }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Photo 2 — center right, overlapping */}
      <div style={{ position:'absolute', top:'42%', right:'7%', width:'46%', height:'35%', zIndex:20,
        border:'4px solid white', boxShadow:'0 6px 20px rgba(0,0,0,0.15)' }}>
        <ImgSlot slotId="img2" pageData={pageData} sampleUrl={sampleImages.img2}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Photo 3 — bottom left */}
      <div style={{ position:'absolute', bottom:'8%', left:'11%', width:'35%', height:'25%', zIndex:30,
        border:'4px solid white', boxShadow:'0 4px 14px rgba(0,0,0,0.13)' }}>
        <ImgSlot slotId="img3" pageData={pageData} sampleUrl={sampleImages.img3}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
      {/* Year stamp box */}
      <div style={{ position:'absolute', bottom:'14%', right:'14%', width:'16%', height:'8%',
        background:colors.text||'#333', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
        <TxtSlot slotId="year" layoutId="scatter-3" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'0.85rem', fontWeight:700, color:'white', letterSpacing:'0.2em' }}/>
      </div>
    </div>
  )
}

// ── LIFESTYLE COVER — portrait behind layered text blocks ────────────────────
// Based on: Men's Lifestyle Magazine Template HTML cover design
function LifestyleCoverPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background:colors.bg||'#ffffff' }}>
      {/* Background giant title text */}
      <div className="absolute" style={{ top:'8%', left:0, width:'100%', textAlign:'center', zIndex:0 }}>
        <TxtSlot slotId="bg_title" layoutId="lifestyle-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'6rem', lineHeight:0.8,
            color:colors.accent||'#cfa968', letterSpacing:'-0.04em', fontStyle:'italic' }}/>
      </div>
      {/* Portrait image — object-contain so full body shows through */}
      <div className="absolute" style={{ inset:0, top:'8%', zIndex:10 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={{ surface:'transparent' }}
          className="w-full h-full"/>
      </div>
      {/* Middle right text block */}
      <div className="absolute" style={{ zIndex:20, top:'38%', right:'5%', width:'30%' }}>
        <TxtSlot slotId="label1" layoutId="lifestyle-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.heading, fontSize:'0.68rem', fontWeight:800,
            color:colors.text, letterSpacing:'0.15em', lineHeight:1.3 }}/>
        <TxtSlot slotId="body1" layoutId="lifestyle-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
          style={{ fontFamily:fonts.body, fontSize:'0.44rem', color:colors.muted, lineHeight:1.65, marginTop:6 }}/>
      </div>
      {/* Bottom overlay text */}
      <div className="absolute" style={{ zIndex:20, bottom:'4%', width:'100%', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:4 }}>
          <div style={{ width:24, height:1, background:'rgba(255,255,255,0.8)' }}/>
          <TxtSlot slotId="subtitle" layoutId="lifestyle-cover" pageData={pageData} sampleTexts={sampleTexts}
            onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
            style={{ fontFamily:fonts.body, fontSize:'0.44rem', fontWeight:700, color:'rgba(255,255,255,0.9)',
              letterSpacing:'0.4em', textTransform:'uppercase' }}/>
          <div style={{ width:24, height:1, background:'rgba(255,255,255,0.8)' }}/>
        </div>
        <TxtSlot slotId="name" layoutId="lifestyle-cover" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h1"
          style={{ fontFamily:fonts.heading, fontSize:'5rem', fontWeight:900, color:'white',
            lineHeight:0.85, textShadow:'0 4px 20px rgba(0,0,0,0.65)', letterSpacing:'-0.02em' }}/>
      </div>
    </div>
  )
}

// ── TOC NUMBERED — numbered table of contents with items + image ──────────────
// Based on: Modeling Portfolio Magazine HTML spread2-left design
function TocNumberedPage({ tpl, pageData, editMode, onEditImage, onEditText }) {
  const { colors, fonts, sampleImages={}, sampleTexts={} } = tpl
  return (
    <div className="w-full h-full flex" style={{ background:colors.bg||'#fff' }}>
      {/* Left TOC */}
      <div style={{ flex:1, padding:'8%', display:'flex', flexDirection:'column',
        borderRight:`1px solid ${colors.surface}`, minWidth:0 }}>
        <TxtSlot slotId="title" layoutId="toc-numbered" pageData={pageData} sampleTexts={sampleTexts}
          onEdit={onEditText} editMode={editMode} colors={colors} tag="h2"
          style={{ fontFamily:fonts.heading, fontSize:'1.8rem', fontWeight:900, color:colors.text,
            marginBottom:'6%', lineHeight:1 }}/>
        {[1,2,3,4].map(n => (
          <div key={n} style={{ display:'flex', alignItems:'baseline', marginBottom:'5%',
            borderBottom:`1px solid ${colors.surface}`, paddingBottom:'5%' }}>
            <span style={{ fontFamily:fonts.heading, fontSize:'1.4rem', fontWeight:900,
              color:colors.accent, minWidth:34, flexShrink:0 }}>
              {String(n).padStart(2,'0')}
            </span>
            <TxtSlot slotId={`item${n}`} layoutId="toc-numbered" pageData={pageData} sampleTexts={sampleTexts}
              onEdit={onEditText} editMode={editMode} colors={colors} tag="p"
              style={{ fontFamily:fonts.body, fontSize:'0.55rem', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:colors.text, flex:1 }}/>
          </div>
        ))}
      </div>
      {/* Right image */}
      <div style={{ width:'42%', height:'100%', flexShrink:0 }}>
        <ImgSlot slotId="img1" pageData={pageData} sampleUrl={sampleImages.img1}
          onEdit={onEditImage} editMode={editMode} colors={colors} className="w-full h-full"/>
      </div>
    </div>
  )
}

// ── Layout registry ───────────────────────────────────────────────────────────
const LAYOUT_MAP = {
  'cover':            CoverPage,
  'photo-book-cover': PhotoBookCoverPage,
  'window-strip':     WindowStripPage,
  'full-bleed':       FullBleedPage,
  'split-left':       SplitLeftPage,
  'split-right':      SplitRightPage,
  'grid-4':           Grid4Page,
  'grid-6':           Grid6Page,
  'feature-trio':     FeatureTrioPage,
  'masonry-3':        Masonry3Page,
  'quote-page':       QuotePage,
  'text-spread':      TextSpreadPage,
  'collage-5':        Collage5Page,
  'hero-text':        HeroTextPage,
  'editorial-4':      Editorial4Page,
  'row-3':            Row3Page,
  'row-2':            Row2Page,
  'catalog-spread':   CatalogSpreadPage,
  'photo-caption':    PhotoCaptionPage,
  'portrait-feature':  PortraitFeaturePage,
  'text-columns':      TextColumnsPage,
  // New layouts from HTML references (batch 1 — 10 layouts)
  'arch-cover':           ArchCoverPage,
  'grid-top-duo':         GridTopDuoPage,
  'two-stack':            TwoStackPage,
  'elegant-portrait':     ElegantPortraitPage,
  'captions-trio':        CaptionsTrioPage,
  'retro-diagonal':       RetroDiagonalPage,
  'retro-cols':           RetroColsPage,
  'bold-dark':            BoldDarkPage,
  'bold-cover':           BoldCoverPage,
  'triple-portrait':      TriplePortraitPage,
  // New layouts from HTML references (batch 2 — 8 layouts)
  'vintage-collage':      VintageCollagePage,
  'constructivist-red':   ConstructivistRedPage,
  'pillars-toc':          PillarsTocPage,
  'interview-duo':        InterviewDuoPage,
  'journal-photo':        JournalPhotoPage,
  'scatter-3':            Scatter3Page,
  'lifestyle-cover':      LifestyleCoverPage,
  'toc-numbered':         TocNumberedPage,
}

export default function TemplatePage({ template, layoutId, pageData, editMode, onEditImage, onEditText, onAdjustImage, onDeleteImage, onReplaceFile, width, height, showSamples = true }) {
  const Component = LAYOUT_MAP[layoutId]
  if (!Component || !template) {
    return <div style={{ width, height, background: template?.colors?.bg || '#111' }}/>
  }
  return (
    <ShowSamplesCtx.Provider value={showSamples}>
      <ImageAdjustCtx.Provider value={{ onAdjust: onAdjustImage, onDelete: onDeleteImage, onReplaceFile }}>
        <div style={{ width, height, overflow:'hidden', position:'relative',
          fontFamily: template.fonts?.body, boxShadow:'0 4px 28px rgba(0,0,0,0.28)' }}>
          <Component tpl={template} pageData={pageData} editMode={editMode}
            onEditImage={onEditImage} onEditText={onEditText}/>
        </div>
      </ImageAdjustCtx.Provider>
    </ShowSamplesCtx.Provider>
  )
}
