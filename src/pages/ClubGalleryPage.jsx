import { useState, useEffect, useRef, useCallback } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import PageLayout            from '../components/PageLayout.jsx'
import GlassButton           from '../components/GlassButton.jsx'
import PhotographerSearch    from '../components/PhotographerSearch.jsx'
import ProgressiveImage      from '../components/ProgressiveImage.jsx'
import { galleryApi, uploadFileToS3 } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import { SkeletonMasonryGrid } from '../components/Skeleton.jsx'

// ── Upload/Edit dialog ────────────────────────────────────────────────────────
function PhotoDialog({ mode, photo, sections, onClose, onDone, L }) {
  // mode: 'upload' | 'edit'
  const [files,       setFiles]       = useState([])
  const [previews,    setPreviews]    = useState([])
  const [caption,     setCaption]     = useState(photo?.caption || '')
  // Default photographer to "anonymous" on a fresh upload — uploader can overwrite by
  // typing a name (free text) or picking a registered member from the dropdown.
  const [attribution, setAttribution] = useState(photo?.photographer || { name: 'anonymous' })
  const [section,     setSection]     = useState(photo?.section?._id || photo?.section || (sections[0]?._id || ''))
  const [dragIdx,     setDragIdx]     = useState(null)
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState('')
  const addMoreRef = useRef(null)

  const pickFiles = (picked) => {
    const all = [...files, ...Array.from(picked)].slice(0, 20)
    setFiles(all); setPreviews(all.map(f => URL.createObjectURL(f)))
  }
  const removeFile = (i) => { setFiles(f=>f.filter((_,j)=>j!==i)); setPreviews(p=>p.filter((_,j)=>j!==i)) }
  const onDragOver = (e, i) => {
    e.preventDefault()
    if (dragIdx===null||dragIdx===i) return
    const r=a=>{const b=[...a];const[m]=b.splice(dragIdx,1);b.splice(i,0,m);return b}
    setFiles(r);setPreviews(r);setDragIdx(i)
  }

  const validate = () => {
    if (mode==='upload' && !files.length) return 'Please select a photo.'
    if (!attribution?.name?.trim()) return 'Photographer name is required.'
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) return setMsg(err)
    setBusy(true); setMsg('')
    try {
      if (mode === 'edit') {
        await galleryApi.updatePhoto(photo._id, {
          caption: caption.trim() || undefined,
          photographer: attribution,
          section: section || undefined,
        })
      } else {
        const { key, publicUrl } = await uploadFileToS3(files[0], 'gallery')
        await galleryApi.addPhoto({
          imageUrl: publicUrl, s3Key: key, type: 'club',
          caption: caption.trim() || undefined,
          photographer: attribution,
          section: section || undefined,
          order: 0,
        })
      }
      onDone()
    } catch(e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      style={{background:'rgba(0,0,0,0.78)',backdropFilter:'blur(14px)'}} onClick={onClose}>
      <div className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border ${L?'bg-white border-black/8':'bg-[#0d0d10] border-white/8'}`}
        style={{maxHeight:'88vh',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}}
        onClick={e=>e.stopPropagation()}>
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${L?'bg-black/15':'bg-white/20'}`}/>
        </div>
        <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-1 sm:pt-5 space-y-2.5 sm:space-y-4" style={{overflowY:'auto'}}>
          <div className="flex items-center justify-between">
            <p className={`font-inter font-bold text-sm sm:text-base ${L?'text-gray-900':'text-white'}`}>
              {mode==='upload' ? 'Upload Photo' : 'Edit Photo'}
            </p>
            <button onClick={onClose} className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/8 transition-all hidden sm:flex">✕</button>
          </div>

          {/* Photo picker — upload mode only */}
          {mode === 'upload' && (
            previews.length > 0 ? (
              <div className="relative overflow-hidden rounded-lg" style={{maxHeight:160}}>
                <img src={previews[0]} alt="" className="w-full object-cover" style={{maxHeight:160}}/>
                <button onClick={()=>removeFile(0)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">✕</button>
                <div className="absolute bottom-1.5 left-1.5 font-inter text-[8px] text-white/70 px-2 py-0.5 rounded-full" style={{background:'rgba(0,0,0,0.55)'}}>1 photo selected</div>
              </div>
            ) : (
              <label className={`block cursor-pointer rounded-xl border-2 border-dashed transition-colors ${L?'border-black/10 hover:border-red-500/40':'border-white/10 hover:border-red-500/30'}`}>
                <div className={`flex flex-col items-center justify-center py-10 gap-2 ${L?'text-gray-400':'text-gray-600'}`}>
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <p className="font-inter text-sm font-medium">Click to select a photo</p>
                  <p className="font-inter text-[10px] opacity-60">One photo per upload</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files[0]; if(f){setFiles([f]);setPreviews([URL.createObjectURL(f)])} }}/>
              </label>
            )
          )}

          {/* Edit mode: show current photo */}
          {mode === 'edit' && photo?.imageUrl && (
            <div className="relative overflow-hidden" style={{maxHeight:140}}>
              <img src={photo.imageUrl} alt="" className="w-full object-cover" style={{maxHeight:140}}/>
            </div>
          )}

          {/* Photographer — REQUIRED */}
          <div>
            <label className="font-inter text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mb-1 sm:mb-1.5 flex items-center gap-1">
              Photographer <span className="text-red-400">*</span>
              <span className="normal-case text-gray-600 font-normal hidden sm:inline">(search or type name)</span>
            </label>
            <PhotographerSearch value={attribution} onSelect={setAttribution} required L={L}/>
          </div>

          {/* Description */}
          <div>
            <label className="font-inter text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mb-1 sm:mb-1.5 flex items-center justify-between">
              <span>Description <span className="normal-case text-gray-600">(optional)</span></span>
              <span className="text-gray-600 normal-case text-[9px]">{caption.length}/500</span>
            </label>
            <textarea value={caption} onChange={e=>setCaption(e.target.value.slice(0,500))} rows={2}
              placeholder="Story behind this photo…"
              className="glass-input w-full text-xs sm:text-sm resize-none" style={{borderRadius:8}}/>
          </div>

          {/* Section */}
          <div>
            <label className="font-inter text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mb-1 sm:mb-1.5 block">Section</label>
            <select value={section} onChange={e=>setSection(e.target.value)}
              className="glass-input w-full text-xs sm:text-sm appearance-none" style={{borderRadius:8}}>
              <option value="">General</option>
              {sections.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>

          {msg && <p className="font-inter text-[10px] text-red-400">{msg}</p>}

          <GlassButton type="button" variant="red" onClick={submit} disabled={busy}
            className="w-full font-inter text-xs sm:text-sm font-semibold" style={{borderRadius:12,minHeight:40}}>
            {busy
              ? (mode==='upload' ? 'Uploading…' : 'Saving…')
              : (mode==='upload' ? (files.length ? 'Upload Photo' : 'Select a Photo First') : 'Save Changes')}
          </GlassButton>
        </div>
      </div>
    </div>
  )
}

// ── Edit Grid dialog — reorder all photos ─────────────────────────────────────
function EditGridDialog({ photos, onClose, onSave, L }) {
  const [grid,    setGrid]    = useState([...photos])
  const [dragIdx, setDragIdx] = useState(null)
  const [saving,  setSaving]  = useState(false)

  const onDragOver = (e,i) => {
    e.preventDefault()
    if (dragIdx===null||dragIdx===i) return
    const arr=[...grid];const[m]=arr.splice(dragIdx,1);arr.splice(i,0,m)
    setDragIdx(i);setGrid(arr)
  }

  const save = async() => {
    setSaving(true)
    await galleryApi.reorderPhotos(grid.map(p=>p._id)).catch(()=>{})
    onSave(grid)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(16px)'}} onClick={onClose}>
      <div className={`w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border overflow-hidden ${L?'bg-white border-black/8':'bg-[#0d0d10] border-white/8'}`}
        style={{maxHeight:'88vh',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className={`w-10 h-1 rounded-full ${L?'bg-black/15':'bg-white/20'}`}/></div>
        <div className="px-4 sm:px-4 py-3 sm:p-4 border-b border-white/6 flex items-center justify-between">
          <div>
            <p className={`font-inter font-bold ${L?'text-gray-900':'text-white'}`}>Rearrange Gallery</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">Drag photos to reorder · {grid.length} photos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="font-inter text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-xl border border-white/8 transition-colors">Cancel</button>
            <GlassButton variant="red" onClick={save} disabled={saving}
              className="font-inter text-xs px-4" style={{borderRadius:10,minHeight:34}}>
              {saving?'Saving…':'Save Order'}
            </GlassButton>
          </div>
        </div>
        <div className="p-4 overflow-y-auto" style={{maxHeight:'70vh'}}>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {grid.map((p,i)=>(
              <div key={p._id}
                className={`relative aspect-square overflow-hidden cursor-grab active:cursor-grabbing ${dragIdx===i?'opacity-40 ring-2 ring-red-500':''}`}
                draggable
                onDragStart={()=>setDragIdx(i)}
                onDragOver={e=>onDragOver(e,i)}
                onDragEnd={()=>setDragIdx(null)}>
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/>
                <div className="absolute top-0.5 left-0.5 font-inter text-[7px] text-white bg-black/60 rounded px-1">{i+1}</div>
                {p.photographer?.name && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 font-inter text-[6px] text-white/70 truncate" style={{background:'linear-gradient(to top,rgba(0,0,0,0.7),transparent)'}}>
                    {p.photographer.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Photo lightbox — beautiful animated with photographer at top ──────────────
function PhotoLightbox({ photos, startIdx, onClose, onDelete, onEdit, canManage, L }) {
  const [idx,               setIdx]               = useState(startIdx)
  const [entered,           setEntered]           = useState(false)
  const [imgKey,            setImgKey]            = useState(0)
  const [deletePhotoConfirm,setDeletePhotoConfirm]= useState(null)
  const touchX = useRef(null)
  const p = photos[idx]
  const attr = p?.photographer

  useEffect(()=>{ requestAnimationFrame(()=>setEntered(true)) },[])
  useEffect(()=>{ setImgKey(k=>k+1) },[idx])
  useEffect(()=>{
    const h=e=>{
      if(e.key==='Escape') onClose()
      if(e.key==='ArrowLeft')  setIdx(i=>(i-1+photos.length)%photos.length)
      if(e.key==='ArrowRight') setIdx(i=>(i+1)%photos.length)
    }
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h)
  },[photos.length,onClose])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6"
      style={{background:entered?'rgba(0,0,0,0.92)':'rgba(0,0,0,0)',backdropFilter:entered?'blur(20px)':'blur(0)',transition:'background 300ms ease,backdrop-filter 300ms ease'}}
      onClick={onClose}
      onTouchStart={e=>{touchX.current=e.touches[0].clientX}}
      onTouchEnd={e=>{const dx=e.changedTouches[0].clientX-(touchX.current??0);if(Math.abs(dx)>45)setIdx(i=>dx<0?(i+1)%photos.length:(i-1+photos.length)%photos.length);touchX.current=null}}>

      <div className="relative w-full max-w-md flex flex-col gap-0"
        style={{opacity:entered?1:0,transform:entered?'scale(1)':'scale(0.93)',transition:'opacity 380ms cubic-bezier(0.22,1,0.36,1),transform 380ms cubic-bezier(0.22,1,0.36,1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* ── PHOTOGRAPHER CARD — top, floats above photo ── */}
        {attr?.name && (
          <div className="flex items-center gap-3 px-3 pb-3"
            style={{animation:'quickZoom 400ms cubic-bezier(0.22,1,0.36,1) 100ms both'}}>
            <div className="relative shrink-0">
              {attr.userId?.profilePhoto
                ? <img src={attr.userId.profilePhoto} alt="" className="w-11 h-11 rounded-full object-cover"
                    style={{boxShadow:'0 0 0 2.5px rgba(220,38,38,0.6),0 0 14px rgba(220,38,38,0.3)'}}/>
                : <div className="w-11 h-11 rounded-full flex items-center justify-center font-inter font-black text-base"
                    style={{background:'linear-gradient(135deg,#7f1d1d,#dc2626)',boxShadow:'0 0 0 2.5px rgba(220,38,38,0.6),0 0 14px rgba(220,38,38,0.3)',color:'#fff'}}>
                    {attr.name[0].toUpperCase()}
                  </div>}
              {/* Camera dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,0.8)'}}>
                <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-inter text-sm font-bold text-white leading-tight truncate">{attr.name}</p>
              <p className="font-inter text-[10px] text-white/45 uppercase tracking-[0.15em]">Photographer</p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors ml-auto shrink-0"
              style={{background:'rgba(255,255,255,0.08)'}}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Close button when no photographer */}
        {!attr?.name && (
          <div className="flex justify-end pb-2">
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white" style={{background:'rgba(255,255,255,0.08)'}}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* ── PHOTO — white border rectangular ── */}
        <div style={{background:'#fff',padding:'4px',boxShadow:'0 24px 64px rgba(0,0,0,0.7)'}}>
          <div className="relative overflow-hidden" style={{maxHeight:'62vh'}}>
            <img src={p?.imageUrl} alt="" key={imgKey}
              className="w-full block object-contain"
              style={{maxHeight:'62vh',animation:'quickZoom 280ms ease both'}}/>
            {/* Navigation */}
            {photos.length>1 && (
              <>
                <button onClick={e=>{e.stopPropagation();setIdx(i=>(i-1+photos.length)%photos.length)}}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)'}}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={e=>{e.stopPropagation();setIdx(i=>(i+1)%photos.length)}}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)'}}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <div className="absolute top-2 right-2 font-inter text-[9px] text-white/50 px-2 py-0.5 rounded-full tabular-nums" style={{background:'rgba(0,0,0,0.5)'}}>{idx+1}/{photos.length}</div>
              </>
            )}
          </div>
        </div>

        {/* ── INFO PANEL — below photo ── */}
        {(p?.caption || p?.section?.name || canManage) && (
          <div className="px-1 pt-3" style={{animation:'quickZoom 400ms cubic-bezier(0.22,1,0.36,1) 150ms both'}}>

            {/* Description */}
            {p?.caption && (
              <p className="font-inter text-sm text-white/65 leading-relaxed">{p.caption}</p>
            )}

            {/* Section + date + actions row */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {p?.section?.name && (
                <span className="font-inter text-[8px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full font-bold"
                  style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',color:'#f87171'}}>
                  {p.section.name}
                </span>
              )}
              {p?.createdAt && (
                <p className="font-inter text-[9px] text-white/30">{new Date(p.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
              )}
              {canManage && (
                <div className="flex gap-1.5 ml-auto">
                  <button onClick={()=>onEdit(p)} className="font-inter text-[9px] px-2.5 py-1 rounded-lg border border-white/15 text-white/50 hover:text-white hover:border-white/30 transition-all">Edit</button>
                  <button onClick={()=>setDeletePhotoConfirm(p._id)} className="font-inter text-[9px] px-2.5 py-1 rounded-lg border border-red-500/25 text-red-400/70 hover:text-red-400 transition-all">Delete</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dots */}
        {photos.length>1 && (
          <div className="flex justify-center gap-1.5 pt-3">
            {photos.slice(0,12).map((_,i)=>(
              <button key={i} onClick={()=>setIdx(i)} className="rounded-full transition-all duration-300"
                style={{height:4,width:i===idx?16:4,background:i===idx?'#dc2626':'rgba(255,255,255,0.25)'}}/>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!deletePhotoConfirm}
        title="Delete Photo?"
        message="This photo will be permanently deleted from the gallery."
        confirmLabel="Yes, Delete"
        onConfirm={() => { onDelete(deletePhotoConfirm); setDeletePhotoConfirm(null) }}
        onCancel={() => setDeletePhotoConfirm(null)}
      />
    </div>
  )
}

// ── Coordinator settings ──────────────────────────────────────────────────────
function CoordinatorPanel({ onClose, L }) {
  const [coordinators,setCoordinators]=useState([])
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(null)

  useEffect(()=>{ galleryApi.getCoordinators().then(d=>setCoordinators(d.coordinators)).finally(()=>setLoading(false)) },[])

  const toggle=async(user)=>{
    const newRole=user.role==='photographer'?'coordinator':'photographer'
    setBusy(user._id)
    try{await galleryApi.setCoordinatorRole(user._id,newRole);setCoordinators(p=>p.map(u=>u._id===user._id?{...u,role:newRole}:u))}catch{}finally{setBusy(null)}
  }

  const filtered=coordinators.filter(u=>!search||u.name.toLowerCase().includes(search.toLowerCase()))

  return(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(12px)'}} onClick={onClose}>
      <div className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden ${L?'bg-white border-black/8':'bg-[#0d0d10] border-white/8'}`}
        style={{maxHeight:'82vh',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className={`w-10 h-1 rounded-full ${L?'bg-black/15':'bg-white/20'}`}/></div>
        <div className="px-4 sm:px-5 pb-5 pt-2 sm:pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-inter font-bold ${L?'text-gray-900':'text-white'}`}>Gallery Coordinators</p>
              <p className="font-inter text-[10px] text-gray-500 mt-0.5">Toggle who can upload &amp; manage gallery</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members…" className="glass-input w-full text-sm" style={{borderRadius:10}}/>
          <div className="overflow-y-auto space-y-2" style={{maxHeight:'50vh'}}>
            {loading ? <p className="text-center py-8 font-inter text-sm text-gray-600 animate-pulse">Loading…</p>
            :filtered.map(u=>{
              const isCoord=['coordinator','core','admin'].includes(u.role)
              const locked=['admin','core'].includes(u.role)
              return(
                <div key={u._id} className={`flex items-center gap-3 p-3 rounded-xl border ${L?'border-black/6':'border-white/5'}`}>
                  {u.profilePhoto?<img src={u.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0"/>
                    :<div className="w-9 h-9 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 font-inter font-bold text-sm shrink-0">{u.name[0]}</div>}
                  <div className="flex-1 min-w-0">
                    <p className={`font-inter text-sm font-semibold truncate ${L?'text-gray-900':'text-white'}`}>{u.name}</p>
                    <p className="font-inter text-[10px] text-gray-500 capitalize">{u.role}</p>
                  </div>
                  {locked?<span className="font-inter text-[9px] text-amber-400 border border-amber-500/25 px-2 py-1 rounded-lg capitalize">{u.role}</span>
                  :<button onClick={()=>toggle(u)} disabled={busy===u._id}
                    style={{position:'relative',width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',flexShrink:0,
                      background:isCoord?'#dc2626':L?'#c8c8cc':'#252530',
                      boxShadow:isCoord?'inset 2px 2px 5px rgba(0,0,0,0.3)':L?'inset 2px 2px 5px rgba(0,0,0,0.08)':'inset 2px 2px 7px rgba(0,0,0,0.9)',
                      transition:'all 250ms ease'}}>
                    <span style={{position:'absolute',top:2,width:20,height:20,borderRadius:'50%',background:'#fff',left:isCoord?22:2,boxShadow:'1px 1px 4px rgba(0,0,0,0.2)',transition:'left 280ms cubic-bezier(0.34,1.56,0.64,1)'}}/>
                  </button>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClubGalleryPage() {
  const { theme } = useTheme()
  const { user }  = useAuth()
  const L = theme === 'light'

  const [photos,     setPhotos]     = useState([])
  const [sections,   setSections]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lightbox,   setLightbox]   = useState(null)
  const [dialog,     setDialog]     = useState(null)  // { mode: 'upload'|'edit', photo? }
  const [editGrid,   setEditGrid]   = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [filterSect, setFilterSect] = useState('all')
  const [showCoord,  setShowCoord]  = useState(false)
  const [dragFrom,   setDragFrom]   = useState(null)

  const canManage = user && ['admin','core','coordinator'].includes(user.role)
  const isAdminOrCore = user && ['admin','core'].includes(user.role)

  const fetchPhotos = useCallback(async(silent)=>{
    try{
      const[sd,pd]=await Promise.all([galleryApi.getSections({type:'club'}),galleryApi.getPhotos({type:'club',limit:300})])
      setSections(sd.sections||[])
      setPhotos(pd.photos||[])
    }catch{}finally{ if(!silent) setLoading(false) }
  },[])

  useEffect(()=>{ fetchPhotos(false) },[fetchPhotos])

  // Live refresh — skip while the user is actively editing/reordering/dragging to avoid clobbering in-progress changes
  useEffect(()=>{
    const poll = setInterval(()=>{
      if(!editGrid && dragFrom===null && !dialog) fetchPhotos(true)
    }, 15000)
    return ()=>clearInterval(poll)
  },[fetchPhotos, editGrid, dragFrom, dialog])

  const deletePhoto=async(id)=>{
    await galleryApi.deletePhoto(id).catch(()=>{})
    setPhotos(p=>p.filter(ph=>ph._id!==id)); setLightbox(null)
  }

  const handleDragOver=(e,i)=>{
    e.preventDefault();if(dragFrom===null||dragFrom===i)return
    const arr=[...photos];const[m]=arr.splice(dragFrom,1);arr.splice(i,0,m)
    setDragFrom(i);setPhotos(arr)
  }
  const handleDragEnd=async()=>{setDragFrom(null);await galleryApi.reorderPhotos(photos.map(p=>p._id)).catch(()=>{})}

  // Filter photos by section; 'general' = photos with no section assigned
  const generalCount = photos.filter(p => !p.section?._id && !p.section).length
  const displayed = filterSect==='all'
    ? photos
    : filterSect==='general'
      ? photos.filter(p => !p.section?._id && !p.section)
      : photos.filter(p => (p.section?._id||p.section)===filterSect)

  // Photo cell
  const PhotoCell=({p,i})=>(
    <div className={`relative overflow-hidden group cursor-pointer ${canManage&&dragFrom===i?'opacity-40 ring-2 ring-red-500':''}`}
      draggable={canManage}
      onDragStart={()=>canManage&&setDragFrom(i)}
      onDragOver={e=>canManage&&handleDragOver(e,i)}
      onDragEnd={()=>canManage&&handleDragEnd()}
      onClick={()=>setLightbox(i)}
      style={{breakInside:'avoid',marginBottom:3,animation:`quickZoom 380ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*12,360)}ms both`}}>
      <ProgressiveImage masonry src={p.imageUrl} className="w-full block" style={{display:'block',height:'auto',transition:'transform 500ms ease'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
      {/* Photographer attribution — always visible at the bottom over a soft vignette.
          Shows the photographer's profile photo (or a camera icon for free-typed names)
          plus their name. Caption (if any) is revealed on hover. */}
      {p.photographer?.name && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{padding:'26px 9px 7px',background:'linear-gradient(to top,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.38) 52%,transparent 100%)'}}>
          <div className="flex items-center gap-1.5">
            {p.photographer?.userId?.profilePhoto
              ? <img src={p.photographer.userId.profilePhoto} alt="" className="w-4 h-4 rounded-full object-cover shrink-0"
                  style={{boxShadow:'0 0 0 1px rgba(255,255,255,0.35)'}}/>
              : <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'#dc2626'}}>
                  <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>}
            <p className="font-inter text-[10px] font-semibold text-white/95 truncate">{p.photographer.name}</p>
          </div>
          {p.caption && (
            <p className="font-inter text-[9px] text-white/60 italic truncate mt-0.5 max-h-0 group-hover:max-h-5 overflow-hidden transition-all duration-300">{p.caption}</p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <PageLayout title="Club Gallery" subtitle="A curated collection of moments captured by the IEM Photography Club." loading={loading}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-16">

        {/* Action bar */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <p className={`font-inter text-[10px] text-gray-500 uppercase tracking-[0.18em] flex-1`}>
            {displayed.length} photo{displayed.length!==1?'s':''}
          </p>

          {/* Filter button — show if any named sections exist */}
          {sections.length > 0 && (
            <button onClick={()=>setShowFilter(v=>!v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-[10px] uppercase tracking-wider border transition-all ${showFilter?'bg-red-600 text-white border-red-600':'text-gray-400 border-white/8 hover:border-white/20'}`}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
              Filter{filterSect!=='all'?' ●':''}
            </button>
          )}

          {canManage && (
            <>
              <button onClick={()=>setEditGrid(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-[10px] uppercase tracking-wider border transition-all text-gray-400 border-white/8 hover:border-white/20`}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Edit Grid
              </button>
              {isAdminOrCore && (
                <button onClick={()=>setShowCoord(true)}
                  className="px-3 py-2 rounded-xl font-inter text-[10px] uppercase tracking-wider border text-gray-400 border-white/8 hover:border-white/20 transition-all">
                  Coordinators
                </button>
              )}
              <GlassButton variant="red" onClick={()=>setDialog({mode:'upload'})}
                className="font-inter text-xs px-4" style={{borderRadius:12,minHeight:36}}>
                + Upload
              </GlassButton>
            </>
          )}
        </div>

        {/* Filter panel — shows only when toggled */}
        {showFilter && sections.length > 0 && (
          <div className={`mb-5 p-3 rounded-2xl border flex flex-wrap gap-2 ${L?'border-black/6 bg-black/2':'border-white/6 bg-white/2'}`}>
            {[{_id:'all',name:'All'},{_id:'general',name:'General'},...sections].map(s=>(
              <button key={s._id} onClick={()=>setFilterSect(s._id)}
                className={`px-3 py-1.5 rounded-xl font-inter text-[10px] font-semibold transition-all ${filterSect===s._id?'bg-red-600 text-white':'text-gray-400 border border-white/8 hover:text-white'}`}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Masonry grid — all photos together, no section grouping */}
        {loading ? (
          <SkeletonMasonryGrid n={9} />
        ) : displayed.length===0 ? (
          <div className={`py-24 text-center rounded-3xl border ${L?'border-black/7 bg-white/50':'border-white/7'}`}>
            <p className="text-4xl mb-3">🖼️</p>
            <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>
              {filterSect!=='all' ? 'No photos in this section.' : 'No photos yet.'}
            </p>
            {canManage&&filterSect==='all'&&<button onClick={()=>setDialog({mode:'upload'})} className="mt-4 font-inter text-sm text-red-400 hover:text-red-300">Upload the first photo →</button>}
          </div>
        ) : (
          <div className="pl-section-in" style={{columns:'3 auto',columnGap:3,width:'100%'}}>
            {displayed.map((p,i)=><PhotoCell key={p._id} p={p} i={i}/>)}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {dialog && (
        <PhotoDialog mode={dialog.mode} photo={dialog.photo} sections={sections}
          onClose={()=>setDialog(null)} onDone={()=>{setDialog(null);fetchPhotos()}} L={L}/>
      )}
      {lightbox!==null && (
        <PhotoLightbox photos={displayed} startIdx={lightbox} onClose={()=>setLightbox(null)}
          onDelete={deletePhoto} onEdit={p=>setDialog({mode:'edit',photo:p})} canManage={canManage} L={L}/>
      )}
      {editGrid && (
        <EditGridDialog photos={photos} onClose={()=>setEditGrid(false)} onSave={newOrder=>{setPhotos(newOrder);setEditGrid(false)}} L={L}/>
      )}
      {showCoord && <CoordinatorPanel onClose={()=>setShowCoord(false)} L={L}/>}
    </PageLayout>
  )
}
