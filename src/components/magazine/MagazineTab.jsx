import { useState, useEffect, useCallback, useRef } from 'react'
import { TEMPLATES, CATEGORIES, getTemplateById } from './templates.js'
import TemplatePage from './TemplatePage.jsx'
import { magazineApi, uploadFileToS3 } from '../../api/api.js'
import GlassButton from '../GlassButton.jsx'
import DownloadingOverlay from '../DownloadingOverlay.jsx'
import { useToast } from '../Toast.jsx'

const PAGE_W = 420
const PAGE_H = 560
const THUMB_SCALE = 0.33

// ── Scaled template thumbnail ─────────────────────────────────────────────────
function TemplateThumbnail({ tpl, onClick, selected }) {
  // Calculate exact pixel dimensions from scale so outer wrapper matches inner content
  const displayW = Math.round(PAGE_W * THUMB_SCALE)   // 139px
  const displayH = Math.round(PAGE_H * THUMB_SCALE)   // 185px
  const firstLayout = tpl.pages?.[0] || 'cover'

  return (
    <div onClick={onClick} className="cursor-pointer group"
      style={{ transition:'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)', width:'100%' }}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.04) translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform=''}>
      {/* Exact-size wrapper — no aspect-ratio mismatch */}
      <div style={{ width:'100%', paddingBottom:`${(displayH/displayW)*100}%`, position:'relative',
        overflow:'hidden', borderRadius:10,
        outline: selected ? '2.5px solid #dc2626' : '2px solid transparent',
        boxShadow: selected ? '0 0 0 4px rgba(220,38,38,0.25),0 4px 20px rgba(0,0,0,0.4)' : '0 2px 14px rgba(0,0,0,0.35)',
        transition:'outline 0.2s,box-shadow 0.2s' }}>
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}>
          <div style={{ transform:`scale(${THUMB_SCALE})`, transformOrigin:'top left', width:PAGE_W, height:PAGE_H }}>
            <TemplatePage template={tpl} layoutId={firstLayout} pageData={null} editMode={false} width={PAGE_W} height={PAGE_H}/>
          </div>
        </div>
      </div>
      <p style={{ fontSize:10, color:'#ccc', marginTop:6, fontFamily:'inherit', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tpl.name}</p>
      <p style={{ fontSize:9, color:'#666', fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.1em' }}>{tpl.category.replace(/-/g,' ')}</p>
    </div>
  )
}

// ── Page-turn viewer ──────────────────────────────────────────────────────────
function PageViewer({ pages, template, currentPage, onPageChange, editMode, onEditImage, onEditText, onAdjustImage, onDeleteImage, onReplaceFile, onDeletePage, viewMode, isMobile }) {
  const [anim, setAnim]           = useState({ on:false, dir:1 })
  const containerRef              = useRef(null)
  const [containerW, setContainerW] = useState(PAGE_W + 100)
  const [viewportH,  setViewportH]  = useState(typeof window !== 'undefined' ? window.innerHeight : 800)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setContainerW(containerRef.current.offsetWidth)
      setViewportH(window.innerHeight)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const go = (next) => {
    if (next < 0 || next >= pages.length || anim.on) return
    const dir = next > currentPage ? 1 : -1
    setAnim({ on:true, dir })
    setTimeout(() => { onPageChange(next); setAnim({ on:false, dir }) }, 340)
  }

  // On mobile force single-page (spread is too cramped)
  const effectiveViewMode = isMobile ? '1page' : viewMode
  const show2   = effectiveViewMode === '2page' && currentPage + 1 < pages.length
  const numPg   = show2 ? 2 : 1
  const gap     = show2 ? 8 : 0
  const sidePad = isMobile ? 8 : 40

  // Spread: width-only constraint (unchanged)
  // Single: also constrain by viewport height so page fits without scrolling.
  //   Reserve ~190px for 2 toolbar rows + dots + page counter + padding.
  const scaleByW = (containerW - sidePad) / (PAGE_W * numPg + gap)
  const reservedH = isMobile ? 380 : 190
  const scaleByH  = show2 ? Infinity : (viewportH - reservedH) / PAGE_H
  const maxScale  = show2 ? 0.94 : 1.0
  const scale     = Math.min(maxScale, scaleByW, scaleByH)
  // Visual container dimensions (what the user sees)
  const pw = Math.round(PAGE_W * scale)
  const ph = Math.round(PAGE_H * scale)

  const pStyle = {
    opacity:   anim.on ? 0 : 1,
    transform: anim.on ? `perspective(1200px) translateX(${anim.dir*40}px) rotateY(${anim.dir*8}deg)` : 'none',
    transition:'opacity 0.34s ease, transform 0.34s ease',
  }

  // Arrow button shared style
  const arrowBtn = (disabled) => ({
    display:'flex', alignItems:'center', justifyContent:'center',
    background: disabled ? 'transparent' : 'rgba(255,255,255,0.06)',
    border:'1px solid rgba(255,255,255,0.12)',
    color: disabled ? 'rgba(255,255,255,0.18)' : '#fff',
    borderRadius:'50%', cursor: disabled ? 'default' : 'pointer',
    flexShrink:0, transition:'background 0.15s',
    // Larger tap target on mobile
    width: isMobile ? 48 : 36,
    height: isMobile ? 48 : 36,
    fontSize: isMobile ? 22 : 18,
  })

  // Render TemplatePage always at full PAGE_W×PAGE_H, then CSS-scale the outer container.
  // This ensures rem-based font sizes in templates stay proportional regardless of viewport.
  // Passing scaled width/height directly caused text overflow on mobile (rem units don't scale).
  const scaledPage = (pageIdx) => {
    const isSecond = pageIdx > 0
    return (
      <div style={{ width:pw, height:ph, overflow:'hidden', flexShrink:0 }}>
        <div style={{ transform:`scale(${scale})`, transformOrigin:'top left',
                      width:PAGE_W, height:PAGE_H }}>
          <TemplatePage template={template} layoutId={pages[pageIdx]?.layoutId}
            pageData={pages[pageIdx]} editMode={editMode}
            onEditImage={(slotId,extra)=>onEditImage(pageIdx,slotId,extra)}
            onEditText={(t,s,v)=>onEditText(pageIdx,t,s,v)}
            onAdjustImage={(slotId,cd)=>onAdjustImage(pageIdx,slotId,cd)}
            onDeleteImage={(slotId)=>onDeleteImage(pageIdx,slotId)}
            onReplaceFile={(slotId,file)=>onReplaceFile(pageIdx,slotId,file)}
            width={PAGE_W} height={PAGE_H}/>
        </div>
      </div>
    )
  }

  const pages_el = (
    <div className="flex gap-2" style={pStyle}>
      {scaledPage(currentPage)}
      {show2 && currentPage + 1 < pages.length && scaledPage(currentPage + 1)}
    </div>
  )

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full" style={{ gap: isMobile ? 14 : 12 }}>

      {isMobile ? (
        /* ── Mobile: page full-width, arrows below ── */
        <>
          <div className="flex justify-center w-full overflow-hidden">
            {pages_el}
          </div>
          {/* Mobile nav row: ‹ dots › */}
          <div className="flex items-center justify-between w-full px-2">
            <button onClick={()=>go(currentPage-1)} disabled={currentPage===0}
              style={arrowBtn(currentPage===0)}>‹</button>

            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-2 flex-wrap justify-center">
                {pages.map((_,i)=>(
                  <button key={i} onClick={()=>go(i)}
                    style={{ width:i===currentPage?20:8, height:8, borderRadius:4,
                             background:i===currentPage?'#dc2626':'rgba(255,255,255,0.18)',
                             transition:'all 0.3s', padding:0, border:'none', cursor:'pointer' }}/>
                ))}
              </div>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:'inherit' }}>
                Page {currentPage+1} of {pages.length}
              </p>
            </div>

            <button onClick={()=>go(currentPage+1)} disabled={currentPage>=pages.length-1}
              style={arrowBtn(currentPage>=pages.length-1)}>›</button>
          </div>
        </>
      ) : (
        /* ── Desktop: arrows on sides ── */
        <>
          <div className="flex items-center gap-2 w-full justify-center">
            <button onClick={()=>go(currentPage-1)} disabled={currentPage===0}
              style={arrowBtn(currentPage===0)}
              onMouseEnter={e=>{ if(currentPage>0) e.currentTarget.style.background='rgba(255,255,255,0.1)' }}
              onMouseLeave={e=>e.currentTarget.style.background=currentPage===0?'transparent':'rgba(255,255,255,0.06)'}>‹</button>
            <div className="overflow-hidden">{pages_el}</div>
            <button onClick={()=>go(currentPage+1)} disabled={currentPage>=pages.length-1}
              style={arrowBtn(currentPage>=pages.length-1)}
              onMouseEnter={e=>{ if(currentPage<pages.length-1) e.currentTarget.style.background='rgba(255,255,255,0.1)' }}
              onMouseLeave={e=>e.currentTarget.style.background=currentPage>=pages.length-1?'transparent':'rgba(255,255,255,0.06)'}>›</button>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {pages.map((_,i)=>(
              <button key={i} onClick={()=>go(i)}
                className="rounded-full transition-all duration-300"
                style={{ width:i===currentPage?18:5, height:5, background:i===currentPage?'#dc2626':'rgba(255,255,255,0.18)' }}/>
            ))}
          </div>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.28)', fontFamily:'inherit' }}>
            Page {currentPage+1} of {pages.length}
          </p>
        </>
      )}
    </div>
  )
}

// ── Page overview — drag to reorder + delete ──────────────────────────────────
function PageOverview({ pages, template, onReorder, onClose }) {
  const [order,    setOrder]    = useState(pages.map((_,i)=>i))
  const [dragging, setDragging] = useState(null)
  const thumbW = 130, thumbH = Math.round(130 * PAGE_H / PAGE_W)

  const handleDragStart = i => setDragging(i)
  const handleDragOver  = (e,i) => {
    e.preventDefault()
    if (dragging === null || dragging === i) return
    const next = [...order]; const [moved] = next.splice(dragging,1); next.splice(i,0,moved)
    setOrder(next); setDragging(i)
  }
  const deletePage = (pos) => {
    if (order.length <= 1) return  // keep at least 1 page
    setOrder(o => o.filter((_,i) => i !== pos))
  }
  const apply = () => { onReorder(order.map(i=>pages[i])); onClose() }

  return (
    <div className="fixed inset-0 z-[400] flex flex-col" style={{ background:'rgba(0,0,0,0.93)', backdropFilter:'blur(16px)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <p className="font-inter font-bold text-white text-sm">Page Overview</p>
          <p className="font-inter text-xs text-gray-600 mt-0.5">Drag to reorder · Click 🗑 to delete</p>
        </div>
        <div className="flex gap-2">
          <GlassButton onClick={apply} variant="red" className="font-inter text-xs px-4" style={{ borderRadius:10, minHeight:34 }}>Apply</GlassButton>
          <GlassButton onClick={onClose} className="font-inter text-xs px-4" style={{ borderRadius:10, minHeight:34 }}>Cancel</GlassButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-4 justify-center">
          {order.map((pageIdx, pos) => (
            <div key={pageIdx} className="flex flex-col items-center gap-1.5">
              <div draggable
                onDragStart={()=>handleDragStart(pos)}
                onDragOver={e=>handleDragOver(e,pos)}
                onDragEnd={()=>setDragging(null)}
                className={`cursor-grab active:cursor-grabbing rounded-xl overflow-hidden relative group ${dragging===pos?'opacity-40 ring-2 ring-red-500':''}`}
                style={{ boxShadow:'0 4px 16px rgba(0,0,0,0.5)', userSelect:'none' }}>
                <div style={{ width:thumbW, height:thumbH, overflow:'hidden' }}>
                  <div style={{ transform:`scale(${thumbW/PAGE_W})`, transformOrigin:'top left', width:PAGE_W, height:PAGE_H }}>
                    <TemplatePage template={template} layoutId={pages[pageIdx]?.layoutId}
                      pageData={pages[pageIdx]} editMode={false} width={PAGE_W} height={PAGE_H}/>
                  </div>
                </div>
                {/* Delete button */}
                {order.length > 1 && (
                  <button onClick={e=>{e.stopPropagation();deletePage(pos)}}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    title="Delete page">🗑</button>
                )}
              </div>
              <p className="font-inter text-[10px] text-gray-500">Page {pos+1}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Image crop / pan / zoom modal ─────────────────────────────────────────────
function ImageCropModal({ slotAspect = 3/4, existingUrl = null, existingCrop = null, onConfirm, onClose }) {
  const [phase,    setPhase]    = useState(existingUrl ? 'crop' : 'pick')
  const [blobUrl,  setBlobUrl]  = useState(null)
  const [file,     setFile]     = useState(null)
  const [uploading,setUploading]= useState(false)
  const [err,      setErr]      = useState('')

  // Crop state — x/y = objectPosition %, scale = zoom multiplier
  const [cx, setCx] = useState(existingCrop?.x  ?? 50)
  const [cy, setCy] = useState(existingCrop?.y  ?? 50)
  const [sc, setSc] = useState(existingCrop?.scale ?? 1)

  const previewUrl = blobUrl || existingUrl

  // Responsive preview size
  const maxW     = Math.min(340, (typeof window !== 'undefined' ? window.innerWidth - 64 : 320))
  const prevW    = maxW
  const prevH    = Math.round(maxW / Math.max(0.3, slotAspect))

  // Interaction refs
  const dragging      = useRef(false)
  const lastPos       = useRef(null)
  const lastPinchDist = useRef(null)

  const applyDrag = (dx, dy) => {
    const sens = 60 / sc
    setCx(p => Math.max(0, Math.min(100, p - (dx / prevW) * sens)))
    setCy(p => Math.max(0, Math.min(100, p - (dy / prevH) * sens)))
  }

  // Mouse
  const onMD = e => { dragging.current=true; lastPos.current={x:e.clientX,y:e.clientY} }
  const onMM = e => {
    if (!dragging.current||!lastPos.current) return
    applyDrag(e.clientX-lastPos.current.x, e.clientY-lastPos.current.y)
    lastPos.current={x:e.clientX,y:e.clientY}
  }
  const onMU = () => { dragging.current=false }
  const onWheel = e => {
    e.preventDefault()
    setSc(p => Math.max(1, Math.min(5, p * (e.deltaY < 0 ? 1.08 : 0.93))))
  }

  // Touch
  const onTS = e => {
    if (e.touches.length===1) {
      dragging.current=true; lastPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; lastPinchDist.current=null
    } else if (e.touches.length===2) {
      dragging.current=false
      lastPinchDist.current=Math.hypot(e.touches[1].clientX-e.touches[0].clientX, e.touches[1].clientY-e.touches[0].clientY)
    }
  }
  const onTM = e => {
    e.preventDefault()
    if (e.touches.length===1 && dragging.current && lastPos.current) {
      applyDrag(e.touches[0].clientX-lastPos.current.x, e.touches[0].clientY-lastPos.current.y)
      lastPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY}
    } else if (e.touches.length===2 && lastPinchDist.current) {
      const d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX, e.touches[1].clientY-e.touches[0].clientY)
      setSc(p=>Math.max(1,Math.min(5,p*(d/lastPinchDist.current))))
      lastPinchDist.current=d
    }
  }
  const onTE = () => { dragging.current=false; lastPinchDist.current=null }

  const pickFile = e => {
    const f=e.target.files[0]; if(!f) return
    setFile(f); setBlobUrl(URL.createObjectURL(f))
    setCx(50); setCy(50); setSc(1); setPhase('crop')
  }

  const confirm = async () => {
    setUploading(true); setErr('')
    try {
      let finalUrl = existingUrl, s3Key = null
      if (file) {
        const res = await uploadFileToS3(file,'magazines')
        finalUrl = res.publicUrl; s3Key = res.key
      }
      onConfirm({ imageUrl:finalUrl, s3Key, cropData:{ x:cx, y:cy, scale:sc } })
    } catch(e) { setErr(e.message) } finally { setUploading(false) }
  }

  const imgPreviewStyle = {
    position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover',
    objectPosition:`${cx}% ${cy}%`,
    ...(sc>1 ? {transform:`scale(${sc})`,transformOrigin:`${cx}% ${cy}%`} : {}),
    pointerEvents:'none', userSelect:'none',
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center"
      style={{ background:'rgba(0,0,0,0.92)', backdropFilter:'blur(18px)' }}
      onClick={onClose}>
      <div className="bg-[#111] w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 -8px 40px rgba(0,0,0,0.7)' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <p className="font-inter font-bold text-white text-xs uppercase tracking-widest">
            {phase==='pick' ? 'Add Photo' : (file ? 'Crop Photo' : 'Adjust Photo')}
          </p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            style={{ background:'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          {phase==='pick' ? (
            <label className="block rounded-2xl border-2 border-dashed border-white/12 cursor-pointer hover:border-red-600/50 transition-colors">
              <div className="py-14 text-center">
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={1.2} className="mx-auto mb-3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="font-inter text-sm text-gray-400 font-medium">Tap to choose photo</p>
                <p className="font-inter text-xs text-gray-600 mt-1">JPG · PNG · WEBP</p>
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile}/>
            </label>
          ) : (
            <>
              {/* Crop preview — exact slot ratio */}
              <div className="mx-auto rounded-xl overflow-hidden relative"
                style={{ width:prevW, height:prevH, cursor:'grab', touchAction:'none',
                  outline:'2px solid rgba(220,38,38,0.5)', userSelect:'none' }}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
                onWheel={onWheel}
                onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
                <img src={previewUrl} alt="" style={imgPreviewStyle} draggable={false}/>
                {/* Rule-of-thirds grid */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',
                  backgroundSize:`${prevW/3}px ${prevH/3}px`
                }}/>
                {/* Center crosshair */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div style={{ width:16,height:1,background:'rgba(255,255,255,0.35)' }}/>
                </div>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div style={{ width:1,height:16,background:'rgba(255,255,255,0.35)' }}/>
                </div>
              </div>

              {/* Zoom control */}
              <div className="flex items-center gap-3">
                <button onClick={()=>setSc(p=>Math.max(1,+(p*0.9).toFixed(3)))}
                  className="w-8 h-8 rounded-full font-bold text-gray-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  style={{ background:'rgba(255,255,255,0.06)', fontSize:18 }}>−</button>
                <input type="range" min={100} max={500} step={1} value={Math.round(sc*100)}
                  onChange={e=>setSc(Number(e.target.value)/100)}
                  className="flex-1 accent-red-600" style={{ height:4 }}/>
                <button onClick={()=>setSc(p=>Math.min(5,+(p*1.1).toFixed(3)))}
                  className="w-8 h-8 rounded-full font-bold text-gray-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  style={{ background:'rgba(255,255,255,0.06)', fontSize:18 }}>+</button>
              </div>

              <p className="text-center font-inter text-xs text-gray-600">
                Drag to reposition · Pinch or scroll to zoom
              </p>

              {/* Change photo */}
              <div className="text-center">
                <label className="cursor-pointer inline-block">
                  <span className="font-inter text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
                    Change photo
                  </span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile}/>
                </label>
              </div>
            </>
          )}

          {err && <p className="font-inter text-xs text-red-400 text-center">{err}</p>}

          {phase==='crop' && (
            <div className="flex gap-2 pt-1">
              <button onClick={confirm} disabled={uploading||(!file&&!existingUrl)}
                className="flex-1 py-3 rounded-xl font-inter text-sm font-bold text-white disabled:opacity-40 transition-all"
                style={{ background:'#dc2626', boxShadow:'0 3px 12px rgba(220,38,38,0.35)' }}>
                {uploading?'Uploading…': file?'Place Photo':'Apply'}
              </button>
              <button onClick={onClose}
                className="px-5 py-3 rounded-xl font-inter text-sm transition-colors"
                style={{ background:'rgba(255,255,255,0.06)', color:'#888' }}>
                Cancel
              </button>
            </div>
          )}
          {phase==='pick' && (
            <button onClick={onClose} className="w-full py-2.5 rounded-xl font-inter text-sm transition-colors"
              style={{ background:'rgba(255,255,255,0.06)', color:'#888' }}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Custom confirm dialog ─────────────────────────────────────────────────────
function MagConfirmDialog({ dialog, onResolve }) {
  if (!dialog) return null
  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, icon } = dialog
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:99998,
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }} onClick={()=>onResolve(false)}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:360,
        background:'#111116', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:20, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.8)',
        fontFamily:'system-ui,-apple-system,sans-serif',
        animation:'dialogIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Icon */}
        {icon && (
          <div style={{ width:44, height:44, borderRadius:12, marginBottom:16,
                        background: danger ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.06)',
                        border:`1px solid ${danger ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.1)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
            {icon}
          </div>
        )}

        {/* Title */}
        <p style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8, lineHeight:1.3 }}>
          {title}
        </p>

        {/* Message */}
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:24, whiteSpace:'pre-line' }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>onResolve(false)}
            style={{ flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer',
                     background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                     color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600 }}>
            {cancelLabel}
          </button>
          <button onClick={()=>onResolve(true)} autoFocus
            style={{ flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer', border:'none',
                     background: danger ? '#dc2626' : '#2563eb',
                     color:'#fff', fontSize:13, fontWeight:700,
                     boxShadow: danger ? '0 4px 14px rgba(220,38,38,0.35)' : '0 4px 14px rgba(37,99,235,0.35)' }}>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`@keyframes dialogIn { from { opacity:0; transform:scale(0.92) translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}

// ── Main Magazine Tab ─────────────────────────────────────────────────────────
export default function MagazineTab({ user }) {
  const { toast }     = useToast()
  const [view,        setView]        = useState('browser')
  const [category,    setCategory]    = useState('all')
  const [selectedTpl, setSelectedTpl] = useState(null)
  const [magazine,    setMagazine]    = useState(null)
  const [myMags,      setMyMags]      = useState([])
  const [pages,       setPages]       = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [viewMode,    setViewMode]    = useState('1page')
  const [isEditMode,  setIsEditMode]  = useState(false)
  const [magName,     setMagName]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [pdfDlBusy,   setPdfDlBusy]  = useState(false)
  const [shareUrl,    setShareUrl]    = useState('')
  const [copied,      setCopied]      = useState(false)
  const [copiedBrowserId, setCopiedBrowserId] = useState(null)  // for My Magazines copy buttons
  const [imgModal,    setImgModal]    = useState(null)
  const [showOverview,setShowOverview]= useState(false)
  const [loading,     setLoading]     = useState(true)
  const [isDirty,       setIsDirty]       = useState(false)
  const [needsRepublish,setNeedsRepublish] = useState(false)
  const [nameStatus,    setNameStatus]    = useState('')
  const [isMobile,      setIsMobile]      = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const [activeDialog,  setActiveDialog]  = useState(null)  // custom confirm dialog state
  const nameTimerRef  = useRef(null)
  const initDoneRef   = useRef(false)
  const pendingPdfRef = useRef(false)

  // Promise-based custom confirm — replaces all window.confirm() calls
  const showConfirm = (opts) => new Promise(resolve => {
    setActiveDialog({ ...opts, resolve })
  })
  const resolveDialog = (result) => {
    setActiveDialog(prev => { prev?.resolve(result); return null })
  }

  const fetchMags = useCallback(() =>
    magazineApi.list().then(d=>setMyMags(d.magazines||[])).catch(()=>{}).finally(()=>setLoading(false)), [])

  useEffect(() => { fetchMags() }, [fetchMags])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Mark dirty when pages change in edit mode (skip initial load snapshot)
  const cleanPagesRef = useRef(null)   // snapshot of pages at last save/load
  useEffect(() => {
    if (!isEditMode) return
    if (cleanPagesRef.current === null) {
      cleanPagesRef.current = JSON.stringify(pages)
      return
    }
    if (JSON.stringify(pages) !== cleanPagesRef.current) setIsDirty(true)
  }, [pages, isEditMode]) // eslint-disable-line

  // Autosave name with 800ms debounce
  useEffect(() => {
    if (!magName || !magazine?._id) return
    clearTimeout(nameTimerRef.current)
    setNameStatus('saving')
    nameTimerRef.current = setTimeout(async () => {
      try {
        await magazineApi.save(magazine._id, { name: magName })
        setNameStatus('saved')
        setTimeout(() => setNameStatus(''), 2500)
      } catch { setNameStatus('') }
    }, 800)
    return () => clearTimeout(nameTimerRef.current)
  }, [magName]) // eslint-disable-line

  // Safe page picker — never crashes on single-layout or empty templates
  const safeLayout = (layouts, i) => {
    if (!layouts?.length) return 'cover'
    if (i < layouts.length) return layouts[i]
    // Repeat inner pages (not cover) for additional pages
    const inner = layouts.length > 1 ? layouts.slice(1) : layouts
    return inner[(i - layouts.length) % inner.length] || layouts[layouts.length - 1]
  }

  const buildDefaultPages = useCallback((tpl) => {
    const layouts = tpl?.pages || ['cover']
    return Array.from({ length: 3 }, (_, i) => ({
      layoutId: safeLayout(layouts, i),
      images: [],
      texts: [],
    }))
  }, [])

  const startEditing = async (tplArg, existing=null) => {
    let tpl = tplArg
    if (!tpl && existing?.templateId) tpl = getTemplateById(existing.templateId)
    if (!tpl) return

    setSelectedTpl(tpl)
    setCurrentPage(0)
    setIsEditMode(false)
    setIsDirty(false)
    setNeedsRepublish(false)
    setNameStatus('')
    initDoneRef.current = false
    cleanPagesRef.current = null

    if (existing?._id) {
      try {
        const fresh = await magazineApi.get(existing._id)
        const mag   = fresh.magazine || existing
        setMagazine(mag)
        // Load draftPages if they exist (user's saved work), else load live pages
        const workingPages = mag.draftPages?.length ? mag.draftPages
                           : mag.pages?.length      ? mag.pages
                           : buildDefaultPages(tpl)
        setPages(workingPages)
        setMagName(mag.name || user?.name || '')
        // Restore needsRepublish from DB: if draftPages exist, there are saved-but-unpublished changes
        setNeedsRepublish(mag.draftPages?.length > 0)
        if (mag.status === 'published') {
          setShareUrl(`${window.location.origin}/magazine/${mag._id}`)
        }
      } catch {
        setMagazine(existing)
        setPages(existing.pages?.length ? existing.pages : buildDefaultPages(tpl))
        setMagName(existing.name || user?.name || '')
      }
    } else {
      setMagazine(null)
      setPages(buildDefaultPages(tpl))
      setMagName(user?.name || '')
    }

    requestAnimationFrame(() => { initDoneRef.current = true })
    setView('editor')
  }

  // Track pending direct upload (no modal)
  const uploadRef = useRef(null)

  const handleEditImage = (pageIdx, slotId, extra={}) => {
    if (!extra.existingUrl) {
      // ── Empty slot: direct file picker — no dialog ──────────────────────────
      uploadRef.current = { pageIdx, slotId }
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !uploadRef.current) return
        const { pageIdx: pIdx, slotId: sId } = uploadRef.current
        uploadRef.current = null
        try {
          const res = await uploadFileToS3(file, 'magazines')
          setPages(prev => prev.map((p, i) => {
            if (i !== pIdx) return p
            const imgs = (p.images||[]).filter(im => im.slotId !== sId)
            return { ...p, images:[...imgs, { slotId:sId, imageUrl:res.publicUrl, s3Key:res.key, cropData:{x:50,y:50,scale:1,rotation:0} }] }
          }))
        } catch(err) { console.error('Upload failed:', err) }
      }
      input.click()
    }
    // Filled slots: ImgSlot handles inline adjustment — no modal needed
  }

  const handleImageConfirmed = ({ imageUrl, s3Key, cropData }) => {
    if (!imgModal) return
    setPages(prev => prev.map((p,i) => {
      if (i !== imgModal.pageIdx) return p
      const imgs = (p.images||[]).filter(im => im.slotId !== imgModal.slotId)
      return { ...p, images:[...imgs, { slotId:imgModal.slotId, imageUrl, s3Key, cropData }] }
    }))
    setImgModal(null)
  }

  // ── In-place crop adjustment ─────────────────────────────────────────────────
  const handleCropAdjust = (pageIdx, slotId, cropData) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIdx) return p
      return { ...p, images: (p.images||[]).map(im => im.slotId === slotId ? { ...im, cropData } : im) }
    }))
  }

  // ── Delete image from slot ───────────────────────────────────────────────────
  const handleDeleteImage = (pageIdx, slotId) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIdx) return p
      return { ...p, images: (p.images||[]).filter(im => im.slotId !== slotId) }
    }))
  }

  // ── Replace image in slot — upload new file ──────────────────────────────────
  const handleReplaceFile = (pageIdx, slotId, file) => {
    uploadFileToS3(file, 'magazines').then(res => {
      setPages(prev => prev.map((p, i) => {
        if (i !== pageIdx) return p
        const imgs = (p.images||[]).filter(im => im.slotId !== slotId)
        return { ...p, images:[...imgs, { slotId, imageUrl:res.publicUrl, s3Key:res.key, cropData:{x:50,y:50,scale:1,rotation:0} }] }
      }))
    }).catch(e => console.error('Replace upload failed:', e))
  }
  const handleEditText = (pageIdx, type, slotId, value) => {
    // '__dirty__' is fired by TxtSlot.onInput — just mark dirty without touching pages.
    // This shows the Save button immediately as the user types, without causing a
    // React re-render that would reset the contentEditable cursor position.
    if (type === '__dirty__') { setIsDirty(true); return }
    setPages(prev => prev.map((p,i) => {
      if (i!==pageIdx) return p
      return { ...p, texts:[...(p.texts||[]).filter(t=>t.slotId!==slotId), { slotId, content:value }] }
    }))
  }

  const addPage = () => {
    if (!selectedTpl) return
    const layoutId = safeLayout(selectedTpl.pages, pages.length)
    setPages(prev => [...prev, { layoutId, images:[], texts:[] }])
  }

  // Save draft — does NOT publish. Status unchanged.
  const save = async () => {
    if (!selectedTpl) return

    // If published magazine already has a saved draft, confirm overwrite
    if (magazine?._id && magazine?.status === 'published' && magazine?.draftPages?.length > 0) {
      const ok = await showConfirm({
        title: 'Overwrite existing draft?',
        message: 'You already have a saved draft.\n\nSaving will replace it with your current changes.',
        confirmLabel: 'Yes, overwrite',
        cancelLabel: 'Cancel',
      })
      if (!ok) return
    }

    setSaving(true); setSaveMsg('')
    try {
      const pagesData    = pages.map((p,i) => ({ ...p, order:i }))
      let magId          = magazine?._id
      let wasPublished   = magazine?.status === 'published'

      if (!magId) {
        const draft  = await magazineApi.create({ templateId:selectedTpl.id, slot:1, name:magName })
        magId        = draft.magazine._id
        setMagazine(draft.magazine)
        wasPublished = false
      }

      const updated = await magazineApi.save(magId, { pages: pagesData, name: magName })
      // updated.magazine.draftPages should now have pages (for published mags) or updated.magazine.pages (for drafts)
      setMagazine(updated.magazine)
      // Force refresh the magazines list so thumbnails update immediately
      const refreshed = await magazineApi.list()
      setMyMags(refreshed.magazines || [])

      setIsDirty(false)
      cleanPagesRef.current = JSON.stringify(pages)
      if (wasPublished) setNeedsRepublish(true)

      toast.success('Saved', 'Draft saved'); setSaveMsg('')
    } catch(e) {
      setSaveMsg('✗ ' + (e.message || 'Save failed — check your connection'))
    } finally { setSaving(false) }
  }

  // Publish / Republish (saves first if dirty, then publishes, then emails PDF)
  const publish = async () => {
    if (!selectedTpl) return
    setSaving(true); setSaveMsg('')
    const wasPublished = magazine?.status === 'published'
    try {
      const pagesData = pages.map((p,i)=>({ ...p, order:i }))
      let magId = magazine?._id
      if (!magId) {
        const draft = await magazineApi.create({ templateId:selectedTpl.id, slot:1, name:magName })
        magId = draft.magazine._id
        setMagazine(draft.magazine)
      }
      if (isDirty) {
        const updated = await magazineApi.save(magId, { pages:pagesData, name:magName })
        setMagazine(updated.magazine)
        setIsDirty(false)
      }

      // One live magazine per user: if a different magazine is already published, warn and delete it first
      if (!wasPublished) {
        const existingPublished = myMags.find(m => m.status === 'published' && m._id !== magId)
        if (existingPublished) {
          setSaving(false)
          const ok = await showConfirm({
            title: 'Replace your live magazine?',
            message: `Publishing this will permanently delete your current live magazine "${existingPublished.name || 'Untitled'}" and all its photos.\n\nThis cannot be undone. Continue?`,
            confirmLabel: 'Yes, replace it',
            cancelLabel: 'Cancel',
            danger: true,
            icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></svg>,
          })
          if (!ok) return
          setSaving(true)
          await magazineApi.delete(existingPublished._id)
        }
      }

      await magazineApi.publish(magId)
      await fetchMags()
      const refreshed = await magazineApi.list()
      const updated = (refreshed.magazines||[]).find(m=>m._id===magId)
      if (updated) setMagazine(updated)
      setNeedsRepublish(false)
      setIsDirty(false)
      toast.success(wasPublished ? 'Republished!' : 'Published!', 'Your magazine is live')
      setSaveMsg(''); setSaving(false)

      // Set the shareable link immediately
      setShareUrl(`${window.location.origin}/magazine/${magId}`)

      // Background tasks — don't block UI
      const publishedPages = isDirty ? pagesData : pages
      generateAndSaveThumbnail(magId, publishedPages)
      emailPdfAfterPublish(magId, wasPublished, publishedPages)
    } catch(e) { setSaveMsg('✗ '+e.message); setSaving(false) }
  }

  const doUnpublish = async (id) => {
    try {
      const result = await magazineApi.unpublish(id)
      // Update local state if this is the magazine being edited
      if (result?.magazine && magazine?._id === id) setMagazine(result.magazine)
    } catch (e) { console.error('Unpublish failed:', e) }
    fetchMags()
  }
  const doDelete = async (id) => {
    const ok = await showConfirm({
      title: 'Delete this magazine?',
      message: 'This will permanently delete the magazine and all its pages. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    })
    if (!ok) return
    await magazineApi.delete(id).catch(()=>{})
    if (magazine?._id === id) { setView('browser'); setMagazine(null) }
    fetchMags()
  }

  // Convert any https:// image URL to a same-origin data URL via our server proxy.
  // This bypasses S3 CORS restrictions so html2canvas can capture images without tainting the canvas.
  const proxyToDataUrl = async (url) => {
    if (!url || url.startsWith('data:')) return url   // already a data URL
    try {
      const res = await fetch(`/api/proxy/image?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error(`proxy ${res.status}`)
      const blob = await res.blob()
      return await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve(r.result)
        r.onerror   = reject
        r.readAsDataURL(blob)
      })
    } catch(e) {
      console.warn('Image proxy failed for', url, e.message)
      return url  // fallback to original (may still be blank in canvas)
    }
  }

  // pdfPages: all pages with data URLs; pdfCapIdx: which single page is currently rendered
  const [pdfPages,  setPdfPages]  = useState(null)
  const [pdfCapIdx, setPdfCapIdx] = useState(-1)

  // Collect ALL applied CSS from the live document's CSSOM (already loaded, synchronous).
  // html2canvas creates its clone before the clone's <link> stylesheets finish loading,
  // so Tailwind utilities (flex, h-full, w-full, flex-col, flex:1) don't apply in the
  // clone — the layout collapses and the title expands to fill the whole page.
  // By injecting the full CSS inline via onclone we bypass that async loading race.
  const getFullCSSForClone = () => {
    const parts = []
    // <style> elements first (Vite injects Tailwind this way in dev mode)
    for (const el of document.querySelectorAll('style')) {
      const t = el.textContent?.trim()
      if (t) parts.push(t)
    }
    // Same-origin <link> stylesheets (production bundles)
    for (const sheet of document.styleSheets) {
      try {
        if (!sheet.cssRules || sheet.ownerNode?.tagName === 'STYLE') continue
        const text = Array.from(sheet.cssRules).map(r => r.cssText).join('\n')
        if (text.trim()) parts.push(text)
      } catch {
        // Cross-origin stylesheet (Google Fonts link) — handled by fetchExternalFontCSS
      }
    }
    return parts.join('\n')
  }

  const fetchExternalFontCSS = async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .filter(l => l.href.includes('googleapis.com/css') || l.href.includes('fontshare.com'))
    const parts = await Promise.all(
      links.map(l =>
        Promise.race([
          fetch(l.href).then(r => r.ok ? r.text() : ''),
          new Promise(res => setTimeout(() => res(''), 4000)),
        ]).catch(() => '')
      )
    )
    return parts.join('\n')
  }

  // Convert external font file URLs (fonts.gstatic.com etc.) in CSS text to base64
  // data URIs for the fonts matching `fontFamilies`.  This makes the clone's @font-face
  // declarations self-contained — no network fetches needed during html2canvas rendering.
  const embedFontFilesAsDataURLs = async (cssText, fontFamilies) => {
    if (!cssText.trim()) return cssText
    const targets = fontFamilies
      .filter(Boolean)
      .map(f => f.split(',')[0].replace(/['"]/g, '').trim().toLowerCase())

    // Collect woff2/woff/ttf/otf URLs from @font-face blocks matching target families
    const urls = new Set()
    const blockRe = /@font-face\s*\{[^{}]+\}/gi
    let bm
    while ((bm = blockRe.exec(cssText)) !== null) {
      const block = bm[0]
      const famM = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/i)
      if (!famM) continue
      const fam = famM[1].trim().toLowerCase()
      if (targets.length && !targets.some(t => fam.startsWith(t.split(' ')[0]) || t.startsWith(fam.split(' ')[0]))) continue
      const urlRe = /url\(['"]?(https?:\/\/[^'")\s]+\.(?:woff2?|ttf|otf))['"]?\)/gi
      let um
      while ((um = urlRe.exec(block)) !== null) urls.add(um[1])
    }

    // Fetch each font file and convert to base64 data URI
    const urlMap = {}
    await Promise.all([...urls].map(async absUrl => {
      try {
        const resp = await Promise.race([
          fetch(absUrl, { mode: 'cors' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
        ])
        if (!resp.ok) return
        const ab = await resp.arrayBuffer()
        const bytes = new Uint8Array(ab)
        let b64 = ''
        for (let i = 0; i < bytes.length; i += 8192)
          b64 += String.fromCharCode(...bytes.subarray(i, i + 8192))
        b64 = btoa(b64)
        const ext = absUrl.split('.').pop().toLowerCase()
        const mime = { woff2:'font/woff2', woff:'font/woff', ttf:'font/truetype', otf:'font/opentype' }[ext] || 'font/opentype'
        urlMap[absUrl] = `data:${mime};base64,${b64}`
      } catch {}
    }))

    // Inline data URIs into the CSS text
    return cssText.replace(
      /url\(['"]?(https?:\/\/[^'")\s]+\.(?:woff2?|ttf|otf))['"]?\)/gi,
      (match, url) => urlMap[url] ? `url('${urlMap[url]}')` : match
    )
  }

  // Force the clone's root font-size to match the LIVE document exactly.
  // The app sets html { font-size: 17.5px } (mobile) / 19px (desktop ≥1024px) — NOT 16px.
  // Every rem-based size in the templates (e.g. titleSize: '3.5rem') resolves against this,
  // so a mismatch here makes the PDF title the wrong size and breaks the flex proportions
  // (title overlaps the image). Reading the live value guarantees PDF === app preview.
  const getCloneResetCSS = () =>
    `html { font-size: ${getComputedStyle(document.documentElement).fontSize} !important; }\n`

  // Core PDF builder — renders pages one-at-a-time, returns jsPDF instance.
  const buildPdf = async (pageSrc = null) => {
    const srcPages = pageSrc || pages
    if (srcPages.length === 0) return null

    // 1. Pre-fetch images as data URLs (CORS-safe)
    const urlSet = new Set()
    srcPages.forEach(p => (p.images||[]).forEach(im => { if (im.imageUrl) urlSet.add(im.imageUrl) }))
    const dataUrlMap = {}
    await Promise.all([...urlSet].map(async url => { dataUrlMap[url] = await proxyToDataUrl(url) }))

    const pagesWithData = srcPages.map(p => ({
      ...p,
      images: (p.images||[]).map(im => ({ ...im, imageUrl: dataUrlMap[im.imageUrl] || im.imageUrl }))
    }))
    setPdfPages(pagesWithData)

    // 2. Wait for ALL fonts (Google Fonts + local OTF/TTF) to finish loading.
    //    Without this, text renders with fallback metrics → flex sections collapse
    //    → layout gaps (like the space between title and photo) disappear in PDF.
    await document.fonts.ready

    // Pre-load the specific fonts this template uses
    const tplFonts = [
      selectedTpl?.fonts?.heading,
      selectedTpl?.fonts?.body,
      'Oswald', 'Cormorant Garamond', 'Inter',
    ].filter(Boolean)
    await Promise.all(
      tplFonts.flatMap(f => [
        document.fonts.load(`400 16px "${f}"`).catch(()=>{}),
        document.fonts.load(`700 16px "${f}"`).catch(()=>{}),
        document.fonts.load(`400 16px "${f}"`).catch(()=>{}),
      ])
    )

    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF }       = await import('jspdf')
    const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:[PAGE_W, PAGE_H], compress: true })
    const bg  = selectedTpl?.colors?.bg || '#ffffff'

    // Build CSS for clone:
    //  1. Full Tailwind layout CSS (from CSSOM — already loaded, synchronous).
    //     html2canvas's clone <link> stylesheets load async, so flex/h-full/w-full
    //     etc. would be missing without this inline injection.
    //  2. Google Fonts @font-face with font FILE URLs replaced by base64 data URIs.
    //     The clone can't fetch fonts.gstatic.com before html2canvas renders, so the
    //     text falls back to Georgia/serif (wider) — embedding the files fixes this.
    const layoutCSS          = getFullCSSForClone()
    const rawExternalFontCSS = await fetchExternalFontCSS()
    const targetFonts        = [selectedTpl?.fonts?.heading, selectedTpl?.fonts?.body].filter(Boolean)
    const externalFontCSS    = await embedFontFilesAsDataURLs(rawExternalFontCSS, targetFonts)
    const allCSS             = getCloneResetCSS() + layoutCSS + '\n' + externalFontCSS

    let added = 0
    for (let i = 0; i < pagesWithData.length; i++) {
      // 3. Mount the single page to capture
      setPdfCapIdx(i)

      // 4. Wait: React render → data-URL img onLoad → setImgNat → re-render with
      //    correct pixel imgStyle → browser paint. 500ms is enough for data URLs.
      await new Promise(r => setTimeout(r, 500))
      // Two rAF cycles ensure all React batched state updates have been painted.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

      const el = document.getElementById('mag-pdf-page')
      if (!el) continue

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: false,
        allowTaint: false,
        logging: false,
        backgroundColor: bg,
        width:  PAGE_W,
        height: PAGE_H,
        // windowWidth/windowHeight intentionally omitted: the capture element is
        // position:fixed at left:-430px — setting windowWidth=420 would put it
        // entirely outside the clone's viewport and break coordinate mapping.
        onclone: (clonedDoc) => {
          const s = clonedDoc.createElement('style')
          s.textContent = allCSS
          clonedDoc.head.appendChild(s)
        },
      })

      if (added > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait')
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, PAGE_W, PAGE_H)
      added++
    }

    setPdfPages(null)
    setPdfCapIdx(-1)
    return added > 0 ? pdf : null
  }

  const downloadPDF = async () => {
    if (pages.length === 0) { setSaveMsg('No pages to export'); return }
    setPdfDlBusy(true)
    setSaveMsg('Preparing images…')
    try {
      const pdf = await buildPdf()
      if (!pdf) { setSaveMsg('✗ No pages captured'); return }
      const filename = (magName || 'magazine').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'magazine'
      pdf.save(`${filename}.pdf`)
      toast.success('Downloaded', 'PDF ready!'); setSaveMsg('')
    } catch(e) {
      console.error('PDF error:', e)
      setSaveMsg('✗ PDF failed: ' + e.message)
    } finally {
      setPdfDlBusy(false)
    }
  }

  // Capture first page as JPEG → upload to S3 → save URL (used for OG image in share link)
  const generateAndSaveThumbnail = async (magId, srcPages) => {
    if (!srcPages?.length || !selectedTpl) return
    try {
      // Pre-fetch first page's images as data URLs
      const firstPage = srcPages[0]
      const urlSet = new Set()
      ;(firstPage.images || []).forEach(im => { if (im.imageUrl) urlSet.add(im.imageUrl) })
      const dataUrlMap = {}
      await Promise.all([...urlSet].map(async url => { dataUrlMap[url] = await proxyToDataUrl(url) }))
      const pageWithData = {
        ...firstPage,
        images: (firstPage.images || []).map(im => ({ ...im, imageUrl: dataUrlMap[im.imageUrl] || im.imageUrl }))
      }

      // Mount for capture
      setPdfPages([pageWithData])
      setPdfCapIdx(0)
      await document.fonts.ready
      await new Promise(r => setTimeout(r, 500))
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

      const el = document.getElementById('mag-pdf-page')
      if (!el) return

      const { default: html2canvas } = await import('html2canvas')
      const layoutCSS          = getFullCSSForClone()
      const rawExternalFontCSS = await fetchExternalFontCSS()
      const thumbFonts         = [selectedTpl?.fonts?.heading, selectedTpl?.fonts?.body].filter(Boolean)
      const externalFontCSS    = await embedFontFilesAsDataURLs(rawExternalFontCSS, thumbFonts)
      const allCSS             = getCloneResetCSS() + layoutCSS + '\n' + externalFontCSS
      const canvas  = await html2canvas(el, {
        scale: 2, useCORS: false, allowTaint: false, logging: false,
        backgroundColor: selectedTpl.colors?.bg || '#ffffff',
        width: PAGE_W, height: PAGE_H,
        onclone: (clonedDoc) => {
          const s = clonedDoc.createElement('style')
          s.textContent = allCSS
          clonedDoc.head.appendChild(s)
        },
      })

      // Convert canvas to blob and upload to S3
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88))
      const file = new File([blob], `magazine-cover-${magId}.jpg`, { type: 'image/jpeg' })
      const { publicUrl } = await uploadFileToS3(file, 'magazines/thumbnails')
      await magazineApi.saveThumbnail(magId, publicUrl)
    } catch(e) {
      console.warn('Thumbnail generation failed:', e.message)
    } finally {
      setPdfPages(null)
      setPdfCapIdx(-1)
    }
  }

  // Generate PDF silently and email it to the user.
  // Called after publish/republish — runs in background (no setSaveMsg spam).
  const emailPdfAfterPublish = async (magId, isRepublish, publishedPages) => {
    try {
      setSaveMsg('Sending email…')
      const pdf = await buildPdf(publishedPages)
      if (!pdf) return
      const base64 = pdf.output('base64')
      await magazineApi.sendPublishEmail(magId, { pdfBase64: base64, isRepublish })
      toast.success(isRepublish ? 'Email Sent' : 'Congratulations!', isRepublish ? 'Republish confirmed!' : 'Email sent successfully')
      setSaveMsg('')
    } catch(e) {
      console.warn('Email PDF failed:', e.message)
      toast.info('Published', 'Email could not be sent')
      setSaveMsg('')
    }
  }

  const tplList = category==='all' ? TEMPLATES : TEMPLATES.filter(t=>t.category===category)
  const slotAspect = imgModal?.slotDims
    ? imgModal.slotDims.width / imgModal.slotDims.height
    : 3/4

  // ── BROWSER ─────────────────────────────────────────────────────────────────
  const CW    = 190                            // desktop card width
  const CH    = Math.round(CW * PAGE_H / PAGE_W)
  const CW_M  = 130                            // mobile card width (fits 2 side-by-side)
  const CH_M  = Math.round(CW_M * PAGE_H / PAGE_W)

  // Neomorphic button style — slightly smaller on mobile
  const neoBtn = (c='rgba(255,255,255,0.07)', tc='rgba(255,255,255,0.75)') => ({
    fontFamily:'system-ui,sans-serif', fontSize: isMobile ? 10 : 11, fontWeight:600,
    color:tc, padding: isMobile ? '5px 10px' : '7px 14px', borderRadius:10, cursor:'pointer',
    border:'1px solid rgba(255,255,255,0.1)', background:c,
    boxShadow:'3px 3px 8px rgba(0,0,0,0.45),-1px -1px 4px rgba(255,255,255,0.04)',
    transition:'box-shadow 0.15s, background 0.15s', display:'inline-flex',
    alignItems:'center', gap:4,
  })

  const discardDraft = async (magId) => {
    const ok = await showConfirm({
      title: 'Discard saved draft?',
      message: 'Your draft changes will be lost. The current live published version will remain unchanged.',
      confirmLabel: 'Discard',
      danger: true,
    })
    if (!ok) return
    try {
      await magazineApi.discardDraft(magId)
      fetchMags()
    } catch(e) { console.error(e) }
  }

  const publishDraftNow = async (m) => {
    const ok = await showConfirm({
      title: 'Publish this draft?',
      message: 'This will replace the current live version with your saved draft.',
      confirmLabel: 'Publish',
    })
    if (!ok) return
    try {
      await magazineApi.publish(m._id)
      fetchMags()
    } catch(e) { console.error(e) }
  }

  const pdfFromBrowser = async (tpl, m) => {
    pendingPdfRef.current = true
    await startEditing(tpl, m)
  }

  // Auto-trigger PDF if opened via pdfFromBrowser
  useEffect(() => {
    if (pendingPdfRef.current && view === 'editor' && pages.length > 0) {
      pendingPdfRef.current = false
      // Small delay so the hidden render container is painted first
      setTimeout(() => downloadPDF(), 300)
    }
  }, [view, pages]) // eslint-disable-line

  if (view==='browser') return (
    <div className="space-y-5 pb-10">
      <MagConfirmDialog dialog={activeDialog} onResolve={resolveDialog}/>

      {/* My Magazines */}
      {!loading && myMags.length > 0 && (
        <div className="space-y-3">
          <p style={{ fontFamily:'inherit', fontSize:11, fontWeight:700, letterSpacing:'0.1em',
                      textTransform:'uppercase', color:'rgba(255,255,255,0.35)' }}>My Magazines</p>

          {myMags.map(m => {
            const tpl = getTemplateById(m.templateId)
            if (!tpl) return null
            const hasDraft = m.draftPages?.length > 0
            const isLive   = m.status === 'published'

            const cw = isMobile ? CW_M : CW
            const ch = isMobile ? CH_M : CH

            const renderCard = (cardPages, isDraft) => (
              <div style={{ width:cw, cursor:'pointer' }} onClick={()=>startEditing(tpl,m)}>
                <div style={{ width:cw, height:ch, borderRadius:10, overflow:'hidden',
                              border:`1px solid ${isDraft?'rgba(251,191,36,0.2)':'rgba(255,255,255,0.1)'}`,
                              boxShadow:'0 4px 20px rgba(0,0,0,0.5)', position:'relative' }}>
                  <div style={{ transform:`scale(${cw/PAGE_W})`, transformOrigin:'top left', width:PAGE_W, height:PAGE_H }}>
                    <TemplatePage template={tpl} layoutId={cardPages?.[0]?.layoutId||tpl.pages[0]}
                      pageData={cardPages?.[0]} editMode={false} showSamples={false} width={PAGE_W} height={PAGE_H}/>
                  </div>
                  {/* Overlay label */}
                  <div style={{ position:'absolute', top:8, left:8 }}>
                    {isDraft ? (
                      <div style={{ padding:'2px 8px', borderRadius:6, background:'rgba(251,191,36,0.15)',
                                    border:'1px solid rgba(251,191,36,0.35)' }}>
                        <span style={{ fontSize:8, fontWeight:700, color:'#fbbf24', letterSpacing:'0.08em', textTransform:'uppercase' }}>Draft</span>
                      </div>
                    ) : isLive ? (
                      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px',
                                    borderRadius:6, background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.3)' }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 5px #4ade80' }}/>
                        <span style={{ fontSize:8, fontWeight:700, color:'#4ade80', letterSpacing:'0.08em', textTransform:'uppercase' }}>Live</span>
                      </div>
                    ) : (
                      <div style={{ padding:'2px 8px', borderRadius:6, background:'rgba(255,255,255,0.06)',
                                    border:'1px solid rgba(255,255,255,0.12)' }}>
                        <span style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Draft</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )

            // Shared action buttons (used in both layouts)
            const isCopied = copiedBrowserId === m._id
            const actionBtns = (
              <div style={{ display:'flex', gap: isMobile?6:8, flexWrap:'wrap', alignItems:'center' }}>
                <button style={neoBtn()} onClick={()=>startEditing(tpl,m)}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.12)';e.currentTarget.style.boxShadow='1px 1px 4px rgba(0,0,0,0.4),-1px -1px 2px rgba(255,255,255,0.03)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.boxShadow='3px 3px 8px rgba(0,0,0,0.45),-1px -1px 4px rgba(255,255,255,0.04)'}}>
                  ✏ Edit
                </button>
                <button style={neoBtn()} onClick={()=>pdfFromBrowser(tpl,m)}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                  ↓ PDF
                </button>
                {isLive && (
                  <button onClick={()=>{
                    const url=`${window.location.origin}/magazine/${m._id}`
                    navigator.clipboard.writeText(url).then(()=>{setCopiedBrowserId(m._id);setTimeout(()=>setCopiedBrowserId(null),2000)})
                  }}
                    style={{ ...neoBtn(isCopied?'rgba(74,222,128,0.12)':'rgba(99,102,241,0.1)', isCopied?'#4ade80':'rgba(167,139,250,0.85)'),
                             border:`1px solid ${isCopied?'rgba(74,222,128,0.3)':'rgba(99,102,241,0.25)'}` }}>
                    {isCopied
                      ? <><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                      : <><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Share</>}
                  </button>
                )}
                {hasDraft && <>
                  <button style={neoBtn('rgba(220,38,38,0.85)','#fff')} onClick={()=>publishDraftNow(m)}
                    onMouseEnter={e=>e.currentTarget.style.background='#dc2626'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(220,38,38,0.85)'}>
                    Publish Draft
                  </button>
                  <button style={neoBtn('rgba(255,255,255,0.06)','rgba(255,255,255,0.5)')} onClick={()=>discardDraft(m._id)}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
                    Discard
                  </button>
                </>}
                {/* Secondary: Unpublish + Delete */}
                <div style={{ display:'flex', gap:5, marginLeft: isMobile?0:'auto' }}>
                  {isLive && (
                    <button style={{ fontFamily:'system-ui,sans-serif', fontSize:10, fontWeight:600,
                                     color:'rgba(253,224,71,0.8)', padding:'4px 9px', borderRadius:7, cursor:'pointer',
                                     border:'1px solid rgba(234,179,8,0.2)', background:'rgba(234,179,8,0.06)',
                                     display:'flex', alignItems:'center', gap:4 }}
                      onClick={()=>doUnpublish(m._id)}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(234,179,8,0.14)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(234,179,8,0.06)'}>
                      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M17 12H3m10-7-5 7 5 7"/></svg>
                      Unpublish
                    </button>
                  )}
                  <button style={{ fontFamily:'system-ui,sans-serif', fontSize:10, fontWeight:600,
                                   color:'rgba(252,165,165,0.75)', padding:'4px 9px', borderRadius:7, cursor:'pointer',
                                   border:'1px solid rgba(220,38,38,0.18)', background:'rgba(220,38,38,0.05)',
                                   display:'flex', alignItems:'center', gap:4 }}
                    onClick={()=>doDelete(m._id)}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(220,38,38,0.13)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(220,38,38,0.05)'}>
                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    Delete
                  </button>
                </div>
              </div>
            )

            // Right column content (shared)
            const rightCol = hasDraft ? (
              <div style={{ minWidth:0 }}>
                {!isMobile && <p style={{ fontFamily:'inherit', fontSize:10, fontWeight:600, letterSpacing:'0.1em',
                                          textTransform:'uppercase', color:'rgba(74,222,128,0.7)', marginBottom:8 }}>
                  Published (Live)
                </p>}
                {renderCard(m.pages, false)}
                {!isMobile && <p style={{ fontFamily:'inherit', fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:6 }}>
                  {m.draftUpdatedAt ? `Draft saved ${new Date(m.draftUpdatedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : ''}
                </p>}
              </div>
            ) : (
              <div style={{ minWidth:0 }}>
                {!isMobile && <p style={{ fontFamily:'inherit', fontSize:10, fontWeight:600, letterSpacing:'0.1em',
                                          textTransform:'uppercase', color:'rgba(255,255,255,0.15)', marginBottom:8 }}>
                  Draft
                </p>}
                <div style={{ width:cw, height:ch, borderRadius:10,
                              border:'1px dashed rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.02)',
                              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <svg width={isMobile?18:24} height={isMobile?18:24} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.2}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <span style={{ fontFamily:'inherit', fontSize: isMobile?9:10, color:'rgba(255,255,255,0.2)' }}>No draft</span>
                </div>
              </div>
            )

            // Key includes updatedAt so React re-renders thumbnail after save
            return (
              <div key={m._id + (m.updatedAt||'') + (m.draftUpdatedAt||'')}
                style={{ background:'rgba(255,255,255,0.03)', borderRadius:16,
                         border:'1px solid rgba(255,255,255,0.07)',
                         padding: isMobile ? 14 : 20 }}>

                {/* Magazine name */}
                <p style={{ fontFamily:'inherit', fontSize: isMobile?13:15, fontWeight:700, color:'#fff',
                             marginBottom: isMobile?10:16, letterSpacing:'0.01em' }}>
                  {m.name || tpl.name}
                </p>

                {isMobile ? (
                  /* ── MOBILE: cards side-by-side, buttons below ── */
                  <>
                    {/* Status labels row */}
                    <div style={{ display:'flex', gap:10, marginBottom:6 }}>
                      <div style={{ flex:1 }}>
                        <span style={{ fontFamily:'inherit', fontSize:9, fontWeight:600, letterSpacing:'0.08em',
                                       textTransform:'uppercase',
                                       color: hasDraft ? 'rgba(251,191,36,0.7)' : isLive ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.4)' }}>
                          {hasDraft ? 'Latest' : isLive ? 'Published' : 'Draft'}
                          {isLive && <span style={{ color:'rgba(74,222,128,0.7)', marginLeft:4 }}>●</span>}
                        </span>
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ fontFamily:'inherit', fontSize:9, fontWeight:600, letterSpacing:'0.08em',
                                       textTransform:'uppercase',
                                       color: hasDraft ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.2)' }}>
                          {hasDraft ? 'Live' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    {/* Two cards side by side */}
                    <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        {renderCard(hasDraft ? m.draftPages : m.pages, hasDraft)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        {rightCol}
                      </div>
                    </div>

                    {/* Buttons spanning full width below both cards */}
                    {actionBtns}
                  </>
                ) : (
                  /* ── DESKTOP: original layout — unchanged ── */
                  <div style={{ display:'flex', gap:40, alignItems:'flex-start' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <p style={{ fontFamily:'inherit', fontSize:10, fontWeight:600, letterSpacing:'0.1em',
                                     textTransform:'uppercase',
                                     color: hasDraft ? 'rgba(251,191,36,0.7)' : isLive ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.4)' }}>
                          {hasDraft ? 'Latest Saved' : isLive ? 'Published' : 'Draft'}
                        </p>
                        {isLive && (
                          <span style={{ fontFamily:'inherit', fontSize:9, color:'rgba(74,222,128,0.8)',
                                         padding:'1px 6px', borderRadius:4, border:'1px solid rgba(74,222,128,0.3)',
                                         background:'rgba(74,222,128,0.08)' }}>Live</span>
                        )}
                      </div>
                      {renderCard(hasDraft ? m.draftPages : m.pages, hasDraft)}
                      <div style={{ marginTop:12 }}>{actionBtns}</div>
                    </div>
                    {rightCol}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {[{id:'all',label:'All'},...CATEGORIES].map(c=>(
          <button key={c.id} onClick={()=>setCategory(c.id)}
            className={'font-inter text-xs px-3 py-1.5 rounded-lg border transition-all '+(
              category===c.id?'bg-red-700 text-white border-red-700':'text-gray-400 border-white/10 hover:text-white'
            )}>{c.label}</button>
        ))}
      </div>

      <p className="font-inter text-gray-600" style={{ fontSize:11 }}>{tplList.length} templates — click any to preview</p>

      {/* Template grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))' }}>
        {tplList.map(tpl=>(
          <TemplateThumbnail key={tpl.id} tpl={tpl} selected={false} onClick={()=>startEditing(tpl)}/>
        ))}
      </div>
    </div>
  )

  // ── EDITOR ──────────────────────────────────────────────────────────────────
  const tpl = selectedTpl
  const editorStyle = isEditMode
    ? { position:'fixed', inset:0, zIndex:600, background:'#050505',
        padding: isMobile ? '10px 10px 24px' : '12px 16px',
        overflowY:'auto', WebkitOverflowScrolling:'touch',
        animation:'editorEnter 0.22s cubic-bezier(0.22,1,0.36,1)' }
    : {}

  if (typeof document !== 'undefined' && !document.getElementById('editor-anim')) {
    const s = document.createElement('style'); s.id = 'editor-anim'
    s.textContent = `@keyframes editorEnter { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }`
    document.head.appendChild(s)
  }

  return (
    <div className="flex flex-col gap-3 pb-10" style={editorStyle}>
      {/* Crop modal */}
      {imgModal && (
        <ImageCropModal
          slotAspect={slotAspect}
          existingUrl={imgModal.existingUrl}
          existingCrop={imgModal.existingCrop}
          onConfirm={handleImageConfirmed}
          onClose={()=>setImgModal(null)}/>
      )}
      {showOverview && <PageOverview pages={pages} template={tpl} onReorder={setPages} onClose={()=>setShowOverview(false)}/>}
      <MagConfirmDialog dialog={activeDialog} onResolve={resolveDialog}/>

      {/* ── Shared sub-components ── */}
      {(() => {
        const Spin = () => (
          <svg className="animate-spin" width={11} height={11} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.5} style={{display:'inline',verticalAlign:'middle',marginRight:5}}>
            <circle cx="12" cy="12" r="9" strokeOpacity=".25"/>
            <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round"/>
          </svg>
        )
        const LiveBadge = ({ faded }) => (
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px',
            borderRadius:7, border:'1px solid rgba(74,222,128,0.2)',
            background:'rgba(0,0,0,0.35)', flexShrink:0, opacity: faded ? 0.6 : 1 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 5px rgba(74,222,128,0.7)', flexShrink:0 }}/>
            <span style={{ fontFamily:'system-ui,sans-serif', fontSize:10, fontWeight:700,
                           color:'rgba(255,255,255,0.8)', letterSpacing:'0.07em', textTransform:'uppercase' }}>Live</span>
          </div>
        )
        const actionBtn = (bg='#dc2626') => ({
          fontFamily:'system-ui,sans-serif', fontSize:isMobile?13:12, fontWeight:700, color:'#fff',
          padding: isMobile ? '8px 18px' : '5px 14px', borderRadius:8, border:'none', cursor:'pointer',
          background:bg, boxShadow:`0 2px 8px ${bg}55`, flexShrink:0,
          display:'flex', alignItems:'center', transition:'opacity 0.15s',
        })
        const isPublished = magazine?.status === 'published'

        /* ── Copy link button — shown after publish ── */
        const copyLinkBtn = shareUrl ? (
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
            title={shareUrl}
            style={{ fontFamily:'system-ui,sans-serif', fontSize:isMobile?12:11, fontWeight:600,
                     color: copied ? '#4ade80' : 'rgba(255,255,255,0.75)',
                     padding: isMobile?'8px 12px':'5px 11px', borderRadius:8, flexShrink:0,
                     border:`1px solid ${copied ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.15)'}`,
                     background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.06)',
                     cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                     transition:'all 0.2s' }}>
            {copied ? (
              <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
            ) : (
              <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link</>
            )}
          </button>
        ) : null

        /* ── Action buttons (shared between layouts) ── */
        const pdfBtn = (
          <button onClick={downloadPDF} disabled={saving || pages.length === 0}
            title="Download all pages as PDF"
            style={{ fontFamily:'system-ui,sans-serif', fontSize:isMobile?13:11, fontWeight:600,
                     color:'rgba(255,255,255,0.75)', padding: isMobile?'8px 14px':'5px 11px', borderRadius:8,
                     border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.06)',
                     cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4,
                     opacity: pages.length === 0 ? 0.35 : 1 }}
            onMouseEnter={e=>{ if(pages.length>0) e.currentTarget.style.background='rgba(255,255,255,0.12)' }}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            PDF
          </button>
        )

        const actionButtons = <>
          {isDirty && (
            <button onClick={save} disabled={saving}
              style={{ fontFamily:'system-ui,sans-serif', fontSize:isMobile?13:11, fontWeight:600,
                       color:'rgba(255,255,255,0.9)', padding: isMobile?'8px 16px':'5px 13px', borderRadius:8,
                       border:'1px solid rgba(255,255,255,0.22)', background:'rgba(255,255,255,0.1)',
                       cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.16)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
              {saving ? <><Spin/>Saving…</> : 'Save'}
            </button>
          )}
          {pdfBtn}
          {copyLinkBtn}
          {!isEditMode && <>
            {magazine && (
              <button onClick={()=>doDelete(magazine._id)}
                style={{ fontFamily:'system-ui,sans-serif', fontSize:isMobile?13:11, fontWeight:500,
                         color:'rgba(248,113,113,0.8)', padding: isMobile?'8px 14px':'5px 11px', borderRadius:8,
                         border:'1px solid rgba(248,113,113,0.22)', background:'transparent',
                         cursor:'pointer', flexShrink:0 }}>
                Delete
              </button>
            )}
            {isPublished ? (
              <>
                <LiveBadge faded={needsRepublish}/>
                {needsRepublish && (
                  <button onClick={publish} disabled={saving} style={actionBtn('rgba(220,38,38,0.9)')}>
                    {saving ? <><Spin/>Publishing…</> : 'Republish'}
                  </button>
                )}
              </>
            ) : (
              <button onClick={publish} disabled={saving} style={actionBtn()}>
                {saving ? <><Spin/>Publishing…</> : 'Publish'}
              </button>
            )}
          </>}
          {isEditMode && <>
            {isPublished && !isDirty && <LiveBadge faded={needsRepublish}/>}
            {(!isPublished || isDirty || needsRepublish) && (
              <button onClick={publish} disabled={saving} style={actionBtn()}>
                {saving ? <><Spin/>Publishing…</> : (isPublished ? 'Republish' : 'Publish')}
              </button>
            )}
          </>}
        </>

        return isMobile ? (
          /* ════════ MOBILE TOOLBAR — single compact header ════════ */
          <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>

            {/* Row 1: ← | name | Preview/Edit toggle */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={async ()=>{
                  if (isDirty) {
                    const ok = await showConfirm({ title:'Unsaved changes', message:'Go back without saving? Your changes will be lost.', confirmLabel:'Leave', danger:true })
                    if (!ok) return
                  }
                  setView('browser')
                }}
                style={{ color:'#9ca3af', background:'none', border:'none', cursor:'pointer',
                         fontSize:20, padding:'2px 4px', lineHeight:1, flexShrink:0 }}>
                ←
              </button>

              <input value={magName} onChange={e=>setMagName(e.target.value)}
                style={{ flex:1, minWidth:0, background:'transparent', fontFamily:'system-ui,sans-serif',
                         fontSize:13, color:'#fff', outline:'none',
                         borderBottom:'1px solid rgba(255,255,255,0.14)', padding:'3px 0' }}
                placeholder="Name…"/>

              {saveMsg && (
                <span style={{ fontFamily:'system-ui,sans-serif', fontSize:10, flexShrink:0,
                               color: saveMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>
                  {saveMsg}
                </span>
              )}

              {/* Preview / Edit pill */}
              <div style={{ display:'flex', borderRadius:8, overflow:'hidden', flexShrink:0,
                            border:'1px solid rgba(255,255,255,0.15)' }}>
                <button onClick={()=>setIsEditMode(false)}
                  style={{ fontFamily:'system-ui,sans-serif', fontSize:11, fontWeight:600, padding:'6px 10px',
                           background: !isEditMode ? '#fff' : 'transparent',
                           color: !isEditMode ? '#000' : '#9ca3af', border:'none', cursor:'pointer' }}>
                  Preview
                </button>
                <button onClick={()=>setIsEditMode(true)}
                  style={{ fontFamily:'system-ui,sans-serif', fontSize:11, fontWeight:600, padding:'6px 10px',
                           background: isEditMode ? '#dc2626' : 'transparent',
                           color: isEditMode ? '#fff' : '#9ca3af', border:'none', cursor:'pointer' }}>
                  Edit
                </button>
              </div>
            </div>

            {/* Row 2: context-sensitive compact actions */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {/* Edit mode: page management */}
              {isEditMode && (
                <>
                  <button onClick={()=>setShowOverview(true)}
                    style={{ fontFamily:'system-ui,sans-serif', fontSize:11, color:'#9ca3af',
                             padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)',
                             background:'transparent', cursor:'pointer', flexShrink:0 }}>
                    ⊞ Pages
                  </button>
                  <button onClick={addPage}
                    style={{ fontFamily:'system-ui,sans-serif', fontSize:11, color:'#9ca3af',
                             padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)',
                             background:'transparent', cursor:'pointer', flexShrink:0 }}>
                    + Page
                  </button>
                </>
              )}

              <div style={{ flex:1 }}/>

              {/* PDF button */}
              {pdfBtn}

              {/* Save (when dirty) */}
              {isDirty && (
                <button onClick={save} disabled={saving}
                  style={{ fontFamily:'system-ui,sans-serif', fontSize:12, fontWeight:600,
                           color:'rgba(255,255,255,0.9)', padding:'6px 14px', borderRadius:8,
                           border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.1)',
                           cursor:'pointer', flexShrink:0 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}

              {/* Status + Publish */}
              {!isEditMode && <>
                {isPublished ? (
                  <>
                    <LiveBadge faded={needsRepublish}/>
                    {needsRepublish && (
                      <button onClick={publish} disabled={saving} style={actionBtn('rgba(220,38,38,0.9)')}>
                        Republish
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={publish} disabled={saving} style={actionBtn()}>Publish</button>
                )}
              </>}
              {isEditMode && <>
                {isPublished && !isDirty && <LiveBadge faded={needsRepublish}/>}
                {(!isPublished || isDirty || needsRepublish) && (
                  <button onClick={publish} disabled={saving} style={actionBtn()}>
                    {isPublished ? 'Republish' : 'Publish'}
                  </button>
                )}
              </>}
            </div>
          </div>
        ) : (
          /* ════════ DESKTOP TOOLBAR ════════ */
          <>
            {/* Row 1: ← | name | status | Preview/Edit */}
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <button onClick={async ()=>{
                  if (isDirty) {
                    const ok = await showConfirm({ title:'Unsaved changes', message:'Go back without saving? Your changes will be lost.', confirmLabel:'Leave', danger:true })
                    if (!ok) return
                  }
                  setView('browser')
                }}
                className="font-inter text-sm text-gray-400 hover:text-white transition-colors shrink-0 flex items-center gap-1">
                ← <span>Templates</span>
              </button>
              <div className="w-px h-5 shrink-0" style={{ background:'rgba(255,255,255,0.12)' }}/>

              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <input value={magName} onChange={e=>setMagName(e.target.value)}
                  className="min-w-0 w-48 bg-transparent font-inter text-sm text-white outline-none placeholder-gray-600 border-b border-white/12 py-0.5"
                  placeholder="Magazine name…"/>
                {nameStatus==='saving' && <span className="font-inter text-[10px] text-gray-600 shrink-0">Autosaving…</span>}
                {nameStatus==='saved'  && <span className="font-inter text-[10px] text-gray-500 shrink-0">Saved</span>}
                {!nameStatus && <span className="font-inter text-[9px] text-gray-700 shrink-0">(autosaved)</span>}
              </div>

              {saveMsg && <span className={'font-inter text-xs shrink-0 '+(saveMsg.startsWith('✓')?'text-green-400':'text-red-400')}>{saveMsg}</span>}
              <div className="w-px h-5 shrink-0" style={{ background:'rgba(255,255,255,0.12)' }}/>

              <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border:'1px solid rgba(255,255,255,0.12)' }}>
                <button onClick={()=>setIsEditMode(false)}
                  className={'font-inter px-3 py-1.5 text-xs font-semibold transition-all '+(
                    !isEditMode?'bg-white text-black':'text-gray-400 hover:text-white bg-transparent'
                  )}>Preview</button>
                <button onClick={()=>setIsEditMode(true)}
                  className={'font-inter px-3 py-1.5 text-xs font-semibold transition-all '+(
                    isEditMode?'bg-red-600 text-white':'text-gray-400 hover:text-white bg-transparent'
                  )}>Edit</button>
              </div>
            </div>

            {/* Row 2: view controls | spacer | action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border:'1px solid rgba(255,255,255,0.1)' }}>
                {['1page','2page'].map(m=>(
                  <button key={m} onClick={()=>setViewMode(m)}
                    className={'font-inter px-3 py-1.5 text-xs font-medium transition-all '+(
                      viewMode===m?'bg-white/10 text-white':'text-gray-500 hover:text-white bg-transparent'
                    )}>
                    {m==='1page'?'Single':'Spread'}
                  </button>
                ))}
              </div>

              {isEditMode && <>
                <button onClick={()=>setShowOverview(true)}
                  className="font-inter text-xs text-gray-500 hover:text-white transition-colors shrink-0 px-2.5 py-1.5 rounded-lg border border-white/8 hover:border-white/20">
                  ⊞ Pages</button>
                <button onClick={addPage}
                  className="font-inter text-xs text-gray-500 hover:text-white transition-colors shrink-0 px-2.5 py-1.5 rounded-lg border border-white/8 hover:border-white/20">
                  + Page</button>
              </>}

              <div className="flex-1"/>
              {saving && (
                <span className="font-inter text-[10px] text-gray-500 shrink-0 flex items-center gap-1">
                  <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  {isDirty ? 'Saving…' : 'Publishing…'}
                </span>
              )}
              {actionButtons}
            </div>
          </>
        )
      })()}

      {/* Single-page PDF capture container — renders ONE page at a time so html2canvas
          captures the correct page without position-calculation issues from stacked siblings. */}
      {pdfPages && pdfCapIdx >= 0 && pdfCapIdx < pdfPages.length && (
        <div id="mag-pdf-page"
          style={{ position:'fixed', top:0, left:`-${PAGE_W+10}px`, zIndex:-1,
                   width:PAGE_W, height:PAGE_H, overflow:'hidden', pointerEvents:'none' }}>
          <TemplatePage template={tpl} layoutId={pdfPages[pdfCapIdx]?.layoutId || tpl?.pages?.[0]}
            pageData={pdfPages[pdfCapIdx]} editMode={false} showSamples={false}
            width={PAGE_W} height={PAGE_H}/>
        </div>
      )}
      {/* Page viewer */}
      <PageViewer pages={pages} template={tpl} currentPage={currentPage}
        onPageChange={setCurrentPage} editMode={isEditMode}
        onEditImage={handleEditImage} onEditText={handleEditText}
        onAdjustImage={handleCropAdjust} isMobile={isMobile}
        onDeleteImage={handleDeleteImage}
        onReplaceFile={handleReplaceFile}
        onDeletePage={(pageIdx) => {
          if (pages.length <= 1) return
          setPages(prev => prev.filter((_,i) => i !== pageIdx))
          setCurrentPage(p => Math.min(p, pages.length - 2))
        }}
        viewMode={viewMode}/>

      <DownloadingOverlay visible={pdfDlBusy} message={saveMsg} />
    </div>
  )
}
