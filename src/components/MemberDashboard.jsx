import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi, clearToken }  from '../api/auth.js'
import { membersApi, eventsApi, competitionsApi, activitiesApi, postsApi, postcardsApi, galleryApi, magazineApi, settingsApi, uploadFileToS3 } from '../api/api.js'
import MagazineTab            from './magazine/MagazineTab.jsx'
import AnnouncementStudio     from './AnnouncementStudio.jsx'
import MyGalleryTab           from './MyGalleryTab.jsx'
import { computeAcademicYear, isCurrentSession, getItemSession, getPrimaryItemDate, currentSession }  from '../utils/yearCalc.js'
import { useTheme, useAuth }    from '../App.jsx'
import GlassButton              from './GlassButton.jsx'
import ImageUpload              from './ImageUpload.jsx'
import PhotographerSearch       from './PhotographerSearch.jsx'
import { downloadCSV, downloadPDF } from '../utils/profileReport.js'
import { generateWinnersPDF } from '../utils/winnersPdf.js'
import DownloadingOverlay from './DownloadingOverlay.jsx'
import { SkeletonGrid, SkeletonList, SkeletonCard, SkeletonProfile } from './Skeleton.jsx'
import ProgressiveImage from './ProgressiveImage.jsx'
import Lightbox        from './Lightbox.jsx'
import { useToast } from './Toast.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

const ROLE_META = {
  admin:        { label:'Admin',        color:'#dc2626' },
  core:         { label:'Core Member',  color:'#d97706' },
  coordinator:  { label:'Coordinator',  color:'#2563eb' },
  photographer: { label:'Photographer', color:'#059669' },
}

const STATUS_STYLE = {
  upcoming:'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  ongoing: 'bg-green-900/50 text-green-300 border-green-800/50',
  past:    'bg-gray-800/40 text-gray-400 border-gray-700/40',
}

// ─── TAB: PROFILE ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['S','M','T','W','T','F','S']
const STATUS_DOT_CLS = { upcoming:'bg-yellow-400', active:'bg-emerald-400', ongoing:'bg-emerald-400', past:'bg-gray-600', draft:'bg-gray-600' }

export function ProfileTab({ user, L }) {
  const { setUser } = useAuth()
  const role        = ROLE_META[user.role] || ROLE_META.photographer
  const academicYear= computeAcademicYear(user.startYear, user.endYear)
  const initials    = user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const dept        = user.department === 'OTHER' ? (user.departmentOther||'Other') : user.department
  const isAdminRole  = user.role === 'admin'
  const isCoreRole   = user.role === 'core'
  const myId        = user._id?.toString()

  const [events,         setEvents]         = useState([])
  const [comps,          setComps]          = useState([])
  const [acts,           setActs]           = useState([])
  const [loadingStats,   setLoadingStats]   = useState(true)
  const [myPostcardCount,setMyPostcardCount] = useState(0)
  const [calMonth,       setCalMonth]       = useState(() => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1) })
  const [expandedStat,   setExpandedStat]   = useState(null)
  const [editing,        setEditing]        = useState(false)
  const [bio,            setBio]            = useState(user.bio||'')
  const [insta,          setInsta]          = useState(user.instagramHandle||'')
  const [photo,          setPhoto]          = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [saveMsg,        setSaveMsg]        = useState('')
  const [reportOpen,     setReportOpen]     = useState(false)
  const [reportBusy,     setReportBusy]     = useState(false)
  const [reportMsg,      setReportMsg]      = useState('')

  useEffect(() => { setBio(user.bio||''); setInsta(user.instagramHandle||'') }, [user.bio, user.instagramHandle])

  useEffect(() => {
    const load = () => Promise.all([
      eventsApi.list().then(d=>d.events||[]),
      competitionsApi.list().then(d=>d.competitions||[]),
      activitiesApi.list().then(d=>d.activities||[]),
    ]).then(([ev,co,ac])=>{setEvents(ev);setComps(co);setActs(ac)}).catch(()=>{}).finally(()=>setLoadingStats(false))
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const load = () => postcardsApi.list({ limit: 1000 }).then(d => {
      const all = d.postcards || []
      const count = all.filter(p => {
        const pid = typeof p.photographer === 'object' ? p.photographer?._id : p.photographer
        return pid?.toString() === myId
      }).length
      setMyPostcardCount(count)
    }).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [myId])

  const isEnrolledEvent = e => {
    if (isAdminRole || isCoreRole) return true
    return (e.members||[]).some(m=>(typeof m.user==='object'?m.user?._id:m.user)?.toString()===myId)
  }
  const isEnrolledComp = c => {
    if (isAdminRole) return true
    if (isCoreRole) return !(c.excludedCores||[]).map(u=>(typeof u==='object'?u._id?.toString():u?.toString())||'').includes(myId)
    return (c.volunteers||[]).some(v=>(typeof v.user==='object'?v.user?._id:v.user)?.toString()===myId)
  }
  const isEnrolledAct = a => {
    if (isAdminRole) return true
    if (isCoreRole) return !(a.excludedCores||[]).map(u=>(typeof u==='object'?u._id?.toString():u?.toString())||'').includes(myId)
    return (a.volunteers||[]).some(v=>(typeof v.user==='object'?v.user?._id:v.user)?.toString()===myId)
  }
  const getEventRole = e => { if(isAdminRole||isCoreRole)return 'core'; const m=(e.members||[]).find(m=>(typeof m.user==='object'?m.user?._id:m.user)?.toString()===myId); return m?.eventRole||'photographer' }
  const getCompRole  = c => { if(isAdminRole||isCoreRole)return 'coordinator'; const v=(c.volunteers||[]).find(v=>(typeof v.user==='object'?v.user?._id:v.user)?.toString()===myId); return v?.role||'volunteer' }
  const getActRole   = a => { if(isAdminRole||isCoreRole)return 'coordinator'; const v=(a.volunteers||[]).find(v=>(typeof v.user==='object'?v.user?._id:v.user)?.toString()===myId); return v?.role||'volunteer' }

  const currentEvents  = events.filter(isCurrentSession)
  const currentComps   = comps.filter(isCurrentSession)
  const currentActs    = acts.filter(isCurrentSession)
  const enrolledEvents = currentEvents.filter(isEnrolledEvent)
  const enrolledComps  = currentComps.filter(isEnrolledComp)
  const enrolledActs   = currentActs.filter(isEnrolledAct)

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const body={bio,instagramHandle:insta}
      if(photo){body.profilePhoto=photo.publicUrl;body.profilePhotoS3Key=photo.key}
      const {user:updated}=await membersApi.updateMe(body)
      setUser(updated); setSaveMsg('Saved!'); setTimeout(()=>{setSaveMsg('');setEditing(false)},1500)
    } catch(e){setSaveMsg(e.message)} finally{setSaving(false)}
  }

  const handleReport = async type => {
    setReportBusy(true); setReportMsg('')
    const data = {
      user, enrolledEvents, enrolledComps, enrolledActs,
      totalEvents: currentEvents.length,
      totalComps:  currentComps.length,
      totalActs:   currentActs.length,
      postcardCount: myPostcardCount,
      getEventRole, getCompRole, getActRole,
      academicYear: academicYear.label, dept,
    }
    try {
      if (type === 'csv') {
        downloadCSV(data)
        setReportOpen(false)
      } else {
        await downloadPDF({ ...data, onProgress: msg => setReportMsg(msg || '') })
        setReportOpen(false)
      }
    } catch(e) { setReportMsg('Failed: ' + e.message) }
    finally { setReportBusy(false) }
  }

  const ac = user.role==='admin'||user.role==='core'
    ?{text:'#fbbf24',bg:'rgba(217,119,6,0.10)',border:'rgba(217,119,6,0.25)',glow:'rgba(217,119,6,0.3)'}
    :user.role==='coordinator'
    ?{text:'#60a5fa',bg:'rgba(37,99,235,0.10)',border:'rgba(37,99,235,0.25)',glow:'rgba(37,99,235,0.3)'}
    :{text:'#34d399',bg:'rgba(5,150,105,0.10)',border:'rgba(5,150,105,0.25)',glow:'rgba(5,150,105,0.3)'}

  // Calendar
  const todayRaw=new Date(), calYear=calMonth.getFullYear(), calMon=calMonth.getMonth()
  const firstDow=new Date(calYear,calMon,1).getDay(), daysInMon=new Date(calYear,calMon+1,0).getDate()
  const dayMap={}
  const markDay=(v,en)=>{const d=new Date(v);if(d.getFullYear()===calYear&&d.getMonth()===calMon){const n=d.getDate();if(!dayMap[n]||(!dayMap[n].enrolled&&en))dayMap[n]={enrolled:en}}}
  events.forEach(e=>{const en=isEnrolledEvent(e);(e.dates||[]).forEach(d=>markDay(d,en));if(e.startDate)markDay(e.startDate,en);if(e.eventDate)markDay(e.eventDate,en)})
  comps.forEach(c=>{const en=isEnrolledComp(c);if(c.eventDate)markDay(c.eventDate,en);if(c.startDate)markDay(c.startDate,en)})
  acts.forEach(a=>{const en=isEnrolledAct(a);if(a.eventDate)markDay(a.eventDate,en);if(a.startDate)markDay(a.startDate,en)})
  const totalCells=Math.ceil((firstDow+daysInMon)/7)*7
  const cells=Array.from({length:totalCells},(_,i)=>{const d=i-firstDow+1;return(d>=1&&d<=daysInMon)?d:null})

  const statsData=[
    {key:'events',      label:'Events',      Icon:()=><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, total:currentEvents.length,   enrolled:enrolledEvents.length, items:enrolledEvents, getRole:getEventRole, thumb:e=>e.logoUrl,   path:'events'},
    {key:'competitions',label:'Comps',        Icon:()=><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,   total:currentComps.length,    enrolled:enrolledComps.length,  items:enrolledComps,  getRole:getCompRole,  thumb:c=>c.bannerUrl, path:'competitions'},
    {key:'activities',  label:'Activities',  Icon:()=><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,                                   total:currentActs.length,     enrolled:enrolledActs.length,   items:enrolledActs,   getRole:getActRole,   thumb:a=>a.bannerUrl, path:'activities'},
  ]

  const expandData = expandedStat ? statsData.find(s=>s.key===expandedStat) : null
  const accountRows=[['Email',user.email],['Roll No.',user.rollNumber],['Enrollment',user.enrollmentNumber],['Department',dept],['Academic Year',academicYear.label],['Programme',user.startYear&&user.endYear?`${user.startYear} – ${user.endYear}`:null]].filter(([,v])=>v)

  return (
    <div className="space-y-4 pb-6 min-w-0 overflow-x-hidden">

      {/* ── Hero card ── */}
      <div className={`rounded-3xl border ${L?'border-black/8 bg-white':'border-white/8 bg-[#0d0d0d]'}`}>
        <div className="p-5 sm:p-6">
          <div className="flex gap-4 sm:gap-5 items-start">
            {/* Profile photo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-gray-800"
              style={{border:'2px solid rgba(220,38,38,0.4)',boxShadow:'0 0 0 4px rgba(220,38,38,0.08),0 8px 24px rgba(0,0,0,0.3)'}}>
              {user.profilePhoto
                ?<img src={user.profilePhoto} alt="" className="w-full h-full object-cover"/>
                :<span className="font-cine text-3xl text-white">{initials}</span>}
            </div>

            {/* Info + actions */}
            <div className="flex-1 min-w-0">
              {/* Name — full width so it never crowds the buttons */}
              <h2 className={`font-inter text-xl sm:text-2xl font-bold leading-tight truncate mb-1.5 ${L?'text-gray-900':'text-white'}`}>{user.name}</h2>
              {/* Role badge + action buttons on their own row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-1 rounded-full font-inter text-xs font-bold border tracking-wide shrink-0" style={{background:`${role.color}18`,color:role.color,borderColor:`${role.color}40`}}>{role.label}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={()=>setReportOpen(true)} title="Download Report"
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${L?'bg-black/6 text-gray-500 hover:bg-black/10':'bg-white/8 text-gray-400 hover:bg-white/10'}`}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button onClick={()=>{if(!editing){setPhoto(null);setSaveMsg('')};setEditing(v=>!v)}}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${editing?(L?'bg-red-100 text-red-500':'bg-red-600/20 text-red-400'):(L?'bg-black/6 text-gray-500 hover:bg-black/10':'bg-white/8 text-gray-400 hover:bg-white/10')}`}>
                    {editing
                      ?<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      :<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                  </button>
                </div>
              </div>
              <p className={`font-inter text-sm font-medium ${L?'text-gray-500':'text-gray-400'}`}>{dept} · {academicYear.label}</p>
              {!editing&&user.bio&&<p className={`font-inter text-sm mt-2.5 leading-relaxed line-clamp-3 ${L?'text-gray-600':'text-gray-400'}`}>{user.bio}</p>}
              {!editing&&user.instagramHandle&&(
                <a href={`https://instagram.com/${user.instagramHandle}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 font-inter text-xs text-pink-400 hover:text-pink-300 transition-colors">
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  @{user.instagramHandle}
                </a>
              )}
            </div>
          </div>

          {/* Edit form */}
          {editing&&(
            <div className="mt-5 space-y-3.5 border-t pt-5" style={{borderColor:L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.07)'}}>
              <div>
                <p className="font-inter text-xs text-gray-500 uppercase tracking-wider mb-2">Profile Photo</p>
                <ImageUpload folder="profiles" onUpload={r=>setPhoto(r)} label="Choose new photo" preview={false}/>
              </div>
              <div>
                <label className="font-inter text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Bio ({bio.length}/500)</label>
                <textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,500))} rows={3} placeholder="About yourself…" className="glass-input w-full resize-none text-sm" style={{borderRadius:'10px'}}/>
              </div>
              <div>
                <label className="font-inter text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Instagram</label>
                <div className="w-full flex items-center glass-input overflow-hidden" style={{borderRadius:'10px',padding:0}}>
                  <span className="px-3 font-inter text-sm text-gray-500 border-r border-white/10 py-3 shrink-0">@</span>
                  <input value={insta} onChange={e=>setInsta(e.target.value.replace('@',''))} placeholder="yourhandle" className="flex-1 min-w-0 bg-transparent border-0 outline-none py-3 px-3 font-inter text-sm" style={{color:L?'#111':'#fff'}}/>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-3 rounded-xl font-inter text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50" style={{background:'#dc2626'}}>
                  {saving?'Saving…':'Save Changes'}
                </button>
                {saveMsg&&<span className="font-inter text-xs text-emerald-400 shrink-0">{saveMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {statsData.map(({key,label,Icon,total,enrolled})=>{
          const isOpen=expandedStat===key
          const canExpand=!isAdminRole&&!loadingStats&&total>0
          return(
            <button key={key} disabled={!canExpand}
              onClick={()=>setExpandedStat(isOpen?null:key)}
              className={`rounded-2xl p-3 sm:p-4 border flex flex-col text-left transition-all overflow-hidden ${canExpand?'active:scale-[0.97]':''}`}
              style={{background:ac.bg,borderColor:isOpen?ac.text:ac.border,boxShadow:isOpen?`0 0 0 1px ${ac.glow}`:undefined}}>
              <div className="flex items-center gap-1.5 mb-2" style={{color:ac.text}}>
                <Icon/>
                <span className="font-inter text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-none truncate">{label}</span>
              </div>
              <p className={`font-inter font-bold text-3xl leading-none ${L?'text-gray-900':'text-white'}`}>
                {loadingStats?<span className="text-xl text-gray-500 animate-pulse">—</span>:total}
              </p>
              {isAdminRole
                ?<p className="font-inter text-xs text-gray-500 mt-1.5">total</p>
                :<p className="font-inter text-sm font-bold mt-1.5 leading-none" style={{color:ac.text}}>
                  {loadingStats?'—':enrolled}<span className="font-normal text-gray-500 text-xs ml-1">enrolled</span>
                </p>
              }
              {canExpand&&(
                <p className="font-inter text-xs mt-2 text-gray-500">{isOpen?'▲ hide':'▼ tap to view'}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Expanded enrolled list ── */}
      {expandData&&(
        <div className={`rounded-2xl border overflow-hidden ${L?'bg-white border-black/8':'bg-[#0d0d0d] border-white/8'}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${L?'border-black/5':'border-white/5'}`}>
            <p className="font-inter text-xs font-semibold uppercase tracking-wider text-gray-500">
              My {expandData.key==='events'?'Events':expandData.key==='competitions'?'Competitions':'Activities'}
              <span className="ml-2" style={{color:ac.text}}>{expandData.items.length}</span>
            </p>
            <button onClick={()=>setExpandedStat(null)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${L?'hover:bg-black/8 text-gray-400':'hover:bg-white/8 text-gray-500'}`}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {expandData.items.length===0
              ?<p className="font-inter text-sm text-gray-500 px-4 py-5 text-center">None yet</p>
              :expandData.items.map((item,idx)=>{
                const thumb=expandData.thumb(item)
                return(
                  <Link key={item._id} to={`/${expandData.path}/${item._id}`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${L?'hover:bg-black/3':'hover:bg-white/4'} ${idx>0?(L?'border-t border-black/5':'border-t border-white/5'):''}`}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center" style={{border:`1px solid ${ac.border}`}}>
                      {thumb?<img src={thumb} alt="" className="w-full h-full object-cover"/>:<span className="font-inter text-xs font-bold" style={{color:ac.text}}>{item.name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-inter text-sm font-medium truncate ${L?'text-gray-800':'text-gray-200'}`}>{item.name}</p>
                      <p className="font-inter text-xs text-gray-500 capitalize mt-0.5">{expandData.getRole(item)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT_CLS[item.status]||'bg-gray-600'}`}/>
                      <span className="font-inter text-xs text-gray-500 capitalize">{item.status}</span>
                    </div>
                  </Link>
                )
              })
            }
          </div>
        </div>
      )}

      {/* ── Calendar ── */}
      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${L?'border-black/5':'border-white/5'}`}>
          <button onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${L?'hover:bg-black/8':'hover:bg-white/8'}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <p className={`font-inter text-sm font-semibold ${L?'text-gray-700':'text-gray-300'}`}>{MONTH_NAMES[calMon]} {calYear}</p>
          <button onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${L?'hover:bg-black/8':'hover:bg-white/8'}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 px-3 pt-2 pb-0">
          {CAL_DAYS.map((d,i)=><div key={i} className="text-center font-inter text-xs font-semibold text-gray-500 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 px-3 pb-2">
          {cells.map((day,i)=>{
            if(!day)return<div key={i} className="h-9"/>
            const info=dayMap[day]
            const isToday=calYear===todayRaw.getFullYear()&&calMon===todayRaw.getMonth()&&day===todayRaw.getDate()
            return(
              <div key={i} className="h-9 flex flex-col items-center justify-center">
                <div className={`w-7 h-7 rounded-full flex flex-col items-center justify-center relative ${isToday?'ring-2 ring-red-500/50':''}`}
                  style={isToday?{background:'rgba(220,38,38,0.18)'}:{}}>
                  <span className={`font-inter text-xs font-medium leading-none ${isToday?'text-red-400':L?'text-gray-700':'text-gray-400'}`}>{day}</span>
                  {info&&<div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${info.enrolled?'bg-emerald-400':'bg-gray-600'}`} style={info.enrolled?{boxShadow:'0 0 3px rgba(52,211,153,0.7)'}:{}}/>}
                </div>
              </div>
            )
          })}
        </div>
        <div className={`flex items-center gap-4 px-4 py-2.5 border-t ${L?'border-black/5':'border-white/5'}`}>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" style={{boxShadow:'0 0 3px rgba(52,211,153,0.6)'}}/><span className="font-inter text-xs text-gray-500">Enrolled</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-600"/><span className="font-inter text-xs text-gray-500">Not enrolled</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/70"/><span className="font-inter text-xs text-gray-500">Today</span></div>
        </div>
      </div>

      {/* ── Account Details ── */}
      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'}`}>
          <p className="font-inter text-xs font-semibold text-gray-500 uppercase tracking-widest">Account Details</p>
        </div>
        <div className={`divide-y ${L?'divide-black/5':'divide-white/5'}`}>
          {accountRows.map(([k,v])=>(
            <div key={k} className="flex justify-between items-center px-4 py-3 gap-4">
              <span className="font-inter text-xs text-gray-500 uppercase tracking-wider shrink-0">{k}</span>
              <span className={`font-inter text-sm font-medium text-right truncate ${L?'text-gray-800':'text-gray-200'}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── My Gear ── */}
      {user.devices?.length>0&&(
        <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
          <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'}`}>
            <p className="font-inter text-xs font-semibold text-gray-500 uppercase tracking-widest">My Gear</p>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {user.devices.map((d,i)=>(
              <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${L?'bg-black/4':'bg-white/4'}`}>
                <span className="text-base shrink-0">{d.type==='camera'?'📷':d.type==='lens'?'🔭':'📦'}</span>
                <p className={`font-inter text-sm truncate ${L?'text-gray-700':'text-gray-300'}`}>{d.name}{d.brand?` — ${d.brand}`:''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className={`font-inter text-center text-xs ${L?'text-gray-400':'text-gray-600'}`}>
        Member since {new Date(user.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'long'})}
      </p>

      {/* ── Report Download Dialog ── */}
      {reportOpen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,0.72)',backdropFilter:'blur(6px)'}}>
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden ${L?'bg-white border-black/10':'bg-[#0d0d0d] border-white/10'}`}>

            {/* Dialog header */}
            <div className="relative h-20 overflow-hidden" style={{background:'linear-gradient(135deg,#1a0005,#2a0010,#050020)'}}>
              <div className="absolute inset-0 opacity-30" style={{backgroundImage:'radial-gradient(circle at 30% 60%, #dc2626 0%, transparent 60%)'}}/>
              <div className="absolute inset-0 flex items-center px-5 gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-600/30 flex items-center justify-center shrink-0">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={1.8}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </div>
                <div>
                  <p className="font-breathing text-base font-semibold text-white leading-tight">Download Report</p>
                  <p className="font-inter text-[11px] text-gray-400 mt-0.5">{user.name} · {dept}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Format choice */}
              <p className={`font-inter text-[11px] font-semibold uppercase tracking-widest ${L?'text-gray-500':'text-gray-400'}`}>Choose format</p>

              <div className="grid grid-cols-2 gap-3">
                {/* CSV option */}
                <button onClick={()=>!reportBusy&&handleReport('csv')} disabled={reportBusy}
                  className={`group flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all active:scale-[0.97] disabled:opacity-50
                    ${L?'border-black/10 hover:border-emerald-400/40 hover:bg-emerald-50':'border-white/10 hover:border-emerald-500/40 hover:bg-emerald-600/8'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                    ${L?'bg-emerald-50 border border-emerald-200 group-hover:bg-emerald-100':'bg-emerald-600/10 border border-emerald-600/20 group-hover:bg-emerald-600/20'}`}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  </div>
                  <div className="text-center">
                    <p className={`font-inter text-sm font-semibold ${L?'text-gray-800':'text-gray-200'}`}>Excel</p>
                    <p className={`font-inter text-[10px] mt-0.5 ${L?'text-gray-400':'text-gray-500'}`}>Spreadsheet</p>
                  </div>
                </button>

                {/* PDF option */}
                <button onClick={()=>!reportBusy&&handleReport('pdf')} disabled={reportBusy}
                  className={`group flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all active:scale-[0.97] disabled:opacity-50
                    ${L?'border-black/10 hover:border-red-400/40 hover:bg-red-50':'border-white/10 hover:border-red-500/40 hover:bg-red-600/8'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                    ${L?'bg-red-50 border border-red-200 group-hover:bg-red-100':'bg-red-600/10 border border-red-600/20 group-hover:bg-red-600/20'}`}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div className="text-center">
                    <p className={`font-inter text-sm font-semibold ${L?'text-gray-800':'text-gray-200'}`}>PDF</p>
                    <p className={`font-inter text-[10px] mt-0.5 ${L?'text-gray-400':'text-gray-500'}`}>Designed report</p>
                  </div>
                </button>
              </div>

              {/* Progress / error message */}
              {(reportBusy||reportMsg)&&(
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${L?'bg-black/5':'bg-white/5'}`}>
                  {reportBusy&&(
                    <svg className="animate-spin shrink-0" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={reportMsg.startsWith('Failed')?'#f87171':'#9ca3af'} strokeWidth={2.5}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  )}
                  <p className={`font-inter text-[11px] ${reportMsg.startsWith('Failed')?'text-red-400':'text-gray-400'}`}>
                    {reportMsg || 'Generating…'}
                  </p>
                </div>
              )}

              {/* Cancel */}
              <button onClick={()=>!reportBusy&&setReportOpen(false)} disabled={reportBusy}
                className={`w-full py-2.5 rounded-2xl font-inter text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40
                  ${L?'text-gray-600 hover:bg-black/5':'text-gray-400 hover:bg-white/5'}`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <DownloadingOverlay visible={reportBusy} message={reportMsg} />
    </div>
  )
}

// ─── TAB: FEED ────────────────────────────────────────────────────────────────
function FeedTab({ currentUser, L }) {
  const [posts,     setPosts]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caption,   setCaption]   = useState('')
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [msg,       setMsg]       = useState('')
  const [lightbox,  setLightbox]  = useState(null)

  const fetchPosts = useCallback(async () => {
    try { const d = await postsApi.feed({ limit:30 }); setPosts(d.posts) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchPosts()
    const t = setInterval(fetchPosts, 8000)
    return () => clearInterval(t)
  }, [fetchPosts])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return setMsg('Please select a photo.')
    setUploading(true); setMsg('')
    try {
      const { key, publicUrl } = await uploadFileToS3(file, 'posts')
      const { post } = await postsApi.create({ imageUrl:publicUrl, s3Key:key, caption })
      setPosts(p => [post, ...p])
      setFile(null); setCaption(''); setPreview(null)
    } catch (e) { setMsg(e.message) }
    finally { setUploading(false) }
  }

  const toggleLike = async (postId, liked) => {
    await postsApi.like(postId).catch(()=>{})
    setPosts(p => p.map(x => x._id === postId ? { ...x, likes: liked ? x.likes.filter(l => l !== currentUser._id) : [...(x.likes||[]), currentUser._id] } : x))
  }

  const deletePost = async (postId) => {
    await postsApi.delete(postId).catch(()=>{})
    setPosts(p => p.filter(x => x._id !== postId))
  }

  return (
    <div className="space-y-4 pb-6">
      <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'}`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Share a Photo</p>
        <form onSubmit={submit} className="space-y-3">
          <label className={`block w-full rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition-colors ${file?'border-transparent':L?'border-black/15 hover:border-red-600/40':'border-white/15 hover:border-red-600/40'}`}>
            {preview
              ? <img src={preview} alt="" className="w-full max-h-64 object-cover" />
              : <div className={`flex flex-col items-center justify-center py-10 ${L?'text-gray-400':'text-gray-600'}`}>
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-2 text-gray-500"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <p className="font-inter text-sm">Choose photo</p>
                </div>}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
          <textarea value={caption} onChange={e=>setCaption(e.target.value.slice(0,2200))} rows={2}
            placeholder="Write a caption…" className="glass-input w-full resize-none text-sm" style={{ borderRadius:'10px' }} />
          {msg && <p className="font-inter text-xs text-red-400">{msg}</p>}
          <GlassButton type="submit" variant="red" disabled={uploading||!file}
            className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
            {uploading ? 'Sharing…' : 'Share'}
          </GlassButton>
        </form>
      </div>

      {loading ? (
        <SkeletonList n={4} />
      ) : posts.length === 0 ? (
        <div className={`py-16 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 text-gray-500"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>No posts yet. Be the first!</p>
        </div>
      ) : posts.map(post => {
        const author    = post.author || {}
        const liked     = (post.likes||[]).includes(currentUser?._id)
        const isOwner   = currentUser?._id === (author._id||author)
        const initials_ = (author.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
        return (
          <div key={post._id} className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/15 bg-gray-800 flex items-center justify-center">
                  {author.profilePhoto ? <img src={author.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="font-inter text-xs font-bold text-white">{initials_}</span>}
                </div>
                <div>
                  <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>{author.name}</p>
                  <p className="font-inter text-[10px] text-gray-500">{timeAgo(post.createdAt)}</p>
                </div>
              </div>
              {isOwner && <button onClick={() => deletePost(post._id)} className="text-gray-600 hover:text-red-400 transition-colors text-sm px-2">🗑</button>}
            </div>
            <div className="relative overflow-hidden cursor-pointer" style={{ aspectRatio:'1/1' }} onClick={() => setLightbox(post.imageUrl)}>
              <ProgressiveImage src={post.imageUrl} className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-4">
                <button onClick={() => toggleLike(post._id, liked)}
                  className={`text-xl transition-transform hover:scale-110 ${liked?'filter drop-shadow-[0_0_4px_rgba(220,38,38,0.8)]':''}`}>
                  {liked ? '❤️' : '🤍'}
                </button>
              </div>
              {(post.likes||[]).length > 0 && <p className={`font-inter text-xs font-semibold ${L?'text-gray-800':'text-white'}`}>{(post.likes||[]).length} {(post.likes||[]).length===1?'like':'likes'}</p>}
              {post.caption && <p className={`font-inter text-sm ${L?'text-gray-700':'text-gray-200'}`}><span className="font-semibold">{author.name?.split(' ')[0]} </span>{post.caption}</p>}
            </div>
          </div>
        )
      })}

      {lightbox && (
        <Lightbox
          photos={[{ url: lightbox }]}
          startIndex={0}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

// ─── TAB: EVENTS ──────────────────────────────────────────────────────────────
function EventsTab({ currentUser, L }) {
  const [events,        setEvents]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const [sectData,      setSectData]      = useState(null)

  useEffect(() => {
    Promise.all([
      eventsApi.list().then(d => setEvents(d.events || [])),
      settingsApi.getSections().then(setSectData).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const getEventRole = (e) => {
    if (currentUser?.role === 'core') return 'core'
    const m = e.members?.find(m => {
      const uid = typeof m.user === 'object' ? m.user?._id : m.user
      return uid?.toString() === currentUser?._id?.toString()
    })
    return m?.eventRole || null
  }

  const isAdminOrCore = ['admin','core'].includes(currentUser?.role)
  const showPast      = isAdminOrCore || (sectData?.sections?.['show-past-events'] !== false)
  const curSession    = currentSession()

  const currentItems  = events.filter(e => isCurrentSession(e))
  const pastItems     = events.filter(e => !isCurrentSession(e))
  const pastBySession = pastItems.reduce((acc, e) => {
    const s = getItemSession(getPrimaryItemDate(e)) || 'Older'
    ;(acc[s] = acc[s] || []).push(e)
    return acc
  }, {})
  const pastSessions  = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions   = [curSession, ...pastSessions]
  const sessionItems  = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession = sessionFilter !== curSession
  const visibleSessions = (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0))

  const upcoming = sessionItems.filter(e => ['upcoming','ongoing'].includes(e.status))
  const past     = sessionItems.filter(e => e.status === 'past')
  const mine     = sessionItems.filter(e => !!getEventRole(e))
  const filtered = filter==='mine' ? mine : filter==='upcoming' ? upcoming : filter==='past' ? past : sessionItems

  return (
    <div className="space-y-4 pb-6">
      {/* Session pills */}
      {!loading && visibleSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
          {visibleSessions.map(s => {
            const isAct = sessionFilter === s
            const isCur = s === curSession
            return (
              <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                  isAct ? 'bg-red-700 text-white border-red-700'
                  : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}>
                {s}{isCur ? ' · Current' : ''}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {[['all',`All (${sessionItems.length})`],['mine',`Mine (${mine.length})`],['upcoming',`Upcoming (${upcoming.length})`],['past',`Past (${past.length})`]].map(([id,label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-medium transition-all border ${
              filter===id ? 'bg-red-700 text-white border-red-700' : `auth-glass ${L?'text-gray-600 border-black/8':'text-gray-400 border-white/8'} hover:text-white`
            }`}>
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <SkeletonGrid n={4} />
      ) : filtered.length === 0 ? (
        <p className={`text-center py-10 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No events found.</p>
      ) : (
        <>
          {isPastSession && (
            <div className="flex items-center gap-3 py-1">
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
              <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                {sessionFilter} · {sessionItems.length} event{sessionItems.length !== 1 ? 's' : ''}
              </span>
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {filtered.map(e => {
              const myRole    = getEventRole(e)
              const enrolled  = !!myRole
              const canView   = enrolled || e.isOpenToAll || isPastSession
              const primaryDate = e.eventDate || e.startDate || (e.dates||[])[0]
              const dates     = primaryDate ? new Date(primaryDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : ''
              const sc        = { upcoming:'text-yellow-400 bg-yellow-900/25 border-yellow-700/40', ongoing:'text-emerald-400 bg-emerald-900/25 border-emerald-700/40', past:'text-gray-500 bg-gray-800/30 border-gray-700/30' }[e.status] || ''
              const roleLabel = myRole === 'coordinator' ? 'Coordinator' : myRole === 'core' ? 'Core' : myRole === 'photographer' ? 'Photographer' : null
              const roleCls   = myRole === 'coordinator' || myRole === 'core' ? 'bg-red-900/80 text-red-300 border-red-600/50' : 'bg-emerald-900/80 text-emerald-300 border-emerald-600/50'

              const card = (
                <div key={e._id}
                  className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 aspect-square
                    ${L?'bg-gray-100 border-black/8':'bg-[#0a0a0a] border-white/8'}
                    ${enrolled ? 'shadow-[0_0_0_1px_rgba(220,38,38,0.25),0_4px_20px_rgba(220,38,38,0.1)]' : ''}`}
                  style={{ filter: isPastSession ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
                  onMouseEnter={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
                  onMouseLeave={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
                  {e.logoUrl
                    ? <img src={e.logoUrl} alt={e.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center" style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
                        <span className="font-clash text-5xl font-bold text-white opacity-15">{e.name[0]}</span>
                      </div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full font-inter text-[8px] font-bold uppercase tracking-wider border ${
                    roleLabel ? roleCls : 'bg-black/50 text-gray-400 border-white/15'
                  }`} style={{ backdropFilter:'blur(8px)' }}>
                    {roleLabel ? <><svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>{roleLabel}</> : 'Not Enrolled'}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="font-clash font-semibold text-xs leading-tight text-white truncate">{e.name}</p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      {dates && <p className="font-inter text-[8px] text-white/60 truncate">{dates}</p>}
                      <span className={`font-inter text-[8px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider font-semibold shrink-0 ${sc}`}>{e.status}</span>
                    </div>
                  </div>
                </div>
              )

              return canView
                ? <Link key={e._id} to={`/events/${e._id}`}>{card}</Link>
                : <div key={e._id} className="opacity-50 cursor-not-allowed">{card}</div>
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TAB: COMPETITIONS ────────────────────────────────────────────────────────
function CompetitionsTab({ currentUser, L }) {
  const [comps,         setComps]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const [sectData,      setSectData]      = useState(null)

  useEffect(() => {
    Promise.all([
      competitionsApi.list().then(d => setComps(d.competitions||[])),
      settingsApi.getSections().then(setSectData).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const myId = currentUser?._id?.toString()
  const enrolledIds = new Set()
  comps.forEach(c => {
    if (!myId) return
    const isCore = currentUser?.role === 'core'
    const excluded = (c.excludedCores||[]).map(u => (typeof u==='object' ? u._id?.toString() : u?.toString()) || '')
    if (isCore && !excluded.includes(myId)) { enrolledIds.add(c._id); return }
    const vol = (c.volunteers||[]).find(v => {
      try {
        const uid = typeof v.user==='object' ? v.user?._id?.toString() : v.user?.toString()
        return uid && uid === myId
      } catch { return false }
    })
    if (vol) enrolledIds.add(c._id)
  })

  const sortComps = (arr) => [...arr].sort((a, b) => {
    const aE = enrolledIds.has(a._id) ? 0 : 1
    const bE = enrolledIds.has(b._id) ? 0 : 1
    if (aE !== bE) return aE - bE
    const aDate = new Date(a.eventDate || a.startDate || a.createdAt)
    const bDate = new Date(b.eventDate || b.startDate || b.createdAt)
    if (aDate - bDate !== 0) return aDate - bDate
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const isAdminOrCore = ['admin','core'].includes(currentUser?.role)
  const showPast      = isAdminOrCore || (sectData?.sections?.['show-past-competitions'] !== false)
  const curSession    = currentSession()

  const currentItems  = comps.filter(c => isCurrentSession(c))
  const pastItems     = comps.filter(c => !isCurrentSession(c))
  const pastBySession = pastItems.reduce((acc, c) => {
    const s = getItemSession(getPrimaryItemDate(c)) || 'Older'
    ;(acc[s] = acc[s] || []).push(c)
    return acc
  }, {})
  const pastSessions  = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions   = [curSession, ...pastSessions]
  const sessionItems  = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession = sessionFilter !== curSession
  const visibleSessions = (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0))

  const ongoing  = sortComps(sessionItems.filter(c => c.status === 'ongoing'))
  const upcoming = sortComps(sessionItems.filter(c => c.status === 'upcoming'))
  const past     = sortComps(sessionItems.filter(c => c.status === 'past'))
  const mine     = sortComps(sessionItems.filter(c => enrolledIds.has(c._id)))
  const filtered = sortComps(filter==='mine' ? mine : filter==='ongoing' ? ongoing : filter==='upcoming' ? upcoming : filter==='past' ? past : sessionItems)

  const STATUS_CLS = {
    ongoing:  'text-green-400 bg-green-900/25 border-green-700/40',
    upcoming: 'text-yellow-400 bg-yellow-900/25 border-yellow-700/40',
    past:     'text-gray-500 bg-gray-800/30 border-gray-700/30',
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Session pills */}
      {!loading && visibleSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
          {visibleSessions.map(s => {
            const isAct = sessionFilter === s
            const isCur = s === curSession
            return (
              <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                  isAct ? 'bg-red-700 text-white border-red-700'
                  : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}>
                {s}{isCur ? ' · Current' : ''}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {[
          ['all',      `All (${sessionItems.length})`],
          ['mine',     `Mine (${mine.length})`],
          ['ongoing',  `Ongoing (${ongoing.length})`],
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['past',     `Past (${past.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-medium transition-all border ${
              filter===id ? 'bg-red-700 text-white border-red-700' : `auth-glass ${L?'text-gray-600 border-black/8':'text-gray-400 border-white/8'} hover:text-white`
            }`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid n={4} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
            {filter==='mine' ? "You're not enrolled in any competitions yet." : 'No competitions found.'}
          </p>
          {filter==='mine' && (
            <Link to="/competitions" className="font-inter text-xs text-red-400 hover:text-red-300 transition-colors mt-2 inline-block">
              Browse Competitions →
            </Link>
          )}
        </div>
      ) : (
        <>
          {isPastSession && (
            <div className="flex items-center gap-3 py-1">
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
              <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                {sessionFilter} · {sessionItems.length} competition{sessionItems.length !== 1 ? 's' : ''}
              </span>
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {filtered.map(c => {
              const enrolled = enrolledIds.has(c._id)
              const canView  = enrolled || c.isOpenToAll || isAdminOrCore || isPastSession
              const volEntry = c.volunteers?.find(v => {
                const uid = typeof v.user==='object' ? v.user?._id : v.user
                return uid?.toString() === currentUser?._id?.toString()
              })
              const myRole = currentUser?.role === 'core' ? 'coordinator' : (volEntry?.role || null)

              const card = (
                <div className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 aspect-square
                  ${L?'bg-gray-100 border-black/8':'bg-[#0a0a0a] border-white/8'}
                  ${enrolled ? 'shadow-[0_0_0_1px_rgba(220,38,38,0.25),0_4px_20px_rgba(220,38,38,0.1)]' : ''}`}
                  style={{ filter: isPastSession ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
                  onMouseEnter={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
                  onMouseLeave={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
                  {c.bannerUrl
                    ? <img src={c.bannerUrl} alt={c.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center" style={{ background:'linear-gradient(135deg,#1a0010,#0a0a1e)' }}>
                        <span className="font-clash text-5xl font-bold text-white opacity-10">{c.name[0]}</span>
                      </div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full font-inter text-[8px] font-bold uppercase tracking-wider border ${
                    myRole === 'coordinator' ? 'bg-red-900/80 text-red-300 border-red-600/50'
                    : enrolled ? 'bg-emerald-900/80 text-emerald-300 border-emerald-600/50'
                    : 'bg-black/50 text-gray-400 border-white/15'
                  }`} style={{ backdropFilter:'blur(8px)' }}>
                    {enrolled
                      ? <><svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                          {myRole === 'coordinator' ? 'Coordinator' : myRole === 'volunteer' ? 'Volunteer' : 'Enrolled'}
                        </>
                      : 'Not Enrolled'}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="font-clash font-semibold text-xs leading-tight text-white truncate">{c.name}</p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      {(c.eventDate || c.startDate) && <p className="font-inter text-[8px] text-white/60 truncate">{new Date(c.eventDate || c.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>}
                      <span className={`font-inter text-[8px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider font-semibold shrink-0 ${STATUS_CLS[c.status]||''}`}>{c.status}</span>
                    </div>
                  </div>
                </div>
              )

              return (
                <div key={c._id} className="flex flex-col gap-1.5">
                  {canView
                    ? <Link to={`/competitions/${c._id}`}>{card}</Link>
                    : <div className="opacity-50 cursor-not-allowed" title="Enrollment required">{card}</div>}
                  {c.winners?.length > 0 && c.hideWinnersTab !== true && (
                    <button onClick={() => generateWinnersPDF(c)}
                      className={'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl font-inter text-[10px] font-semibold border transition-all ' + (L ? 'border-amber-600/40 text-amber-600 hover:bg-amber-50' : 'border-amber-600/35 text-amber-400 hover:bg-amber-900/15')}
                      style={{ backdropFilter:'blur(8px)' }}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Results
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TAB: SETTINGS ────────────────────────────────────────────────────────────
function SettingsTab({ user, L }) {
  const { setUser }    = useAuth()
  const { toast }      = useToast()
  const [bio,   setBio]   = useState(user?.bio||'')
  const [insta, setInsta] = useState(user?.instagramHandle||'')
  const [photo, setPhoto] = useState(null)
  const [saving,setSaving]= useState(false)
  const [msg,   setMsg]   = useState('')

  const save = async (e) => {
    e.preventDefault(); setMsg(''); setSaving(true)
    try {
      const body = { bio, instagramHandle: insta }
      if (photo) { body.profilePhoto = photo.publicUrl; body.profilePhotoS3Key = photo.key }
      const { user: updated } = await membersApi.updateMe(body)
      setUser(updated); toast.success('Saved', 'Profile updated!')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="space-y-4 pb-6">
      <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'}`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Profile Photo</p>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 ${L?'border-black/12':'border-white/15'} bg-gray-800 flex items-center justify-center shrink-0`}>
            {(photo?.publicUrl||user?.profilePhoto) ? <img src={photo?.publicUrl||user?.profilePhoto} alt="" className="w-full h-full object-cover" /> : <span className="font-cine text-xl text-white">{user?.name[0]}</span>}
          </div>
          <ImageUpload folder="profiles" onUpload={r=>setPhoto(r)} label="Change photo" preview={false} className="flex-1" />
        </div>
      </div>

      <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'} space-y-4`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Bio & Links</p>
        <div>
          <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Bio ({bio.length}/500)</label>
          <textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,500))} rows={4}
            placeholder="Tell the club about yourself…" className="glass-input w-full resize-none text-sm" style={{ borderRadius:'10px' }} />
        </div>
        <div>
          <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Instagram Handle</label>
          <div className="flex items-center glass-input overflow-hidden" style={{ borderRadius:'10px', padding:0 }}>
            <span className="px-3 font-inter text-sm text-gray-500 border-r border-white/10 py-3">@</span>
            <input value={insta} onChange={e=>setInsta(e.target.value.replace('@',''))}
              placeholder="yourhandle" className="flex-1 bg-transparent border-0 outline-none py-3 px-3 font-inter text-sm text-white" />
          </div>
        </div>
      </div>

      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'}`}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Account (read-only)</p>
        </div>
        {[['Name',user?.name],['Email',user?.email],['Role',user?.role]].map(([k,v])=>(
          <div key={k} className={`flex justify-between px-4 py-3 border-b last:border-0 ${L?'border-black/5':'border-white/5'}`}>
            <span className="font-inter text-[11px] text-gray-500 uppercase tracking-wider">{k}</span>
            <span className={`font-inter text-sm ${L?'text-gray-800':'text-gray-200'}`}>{v}</span>
          </div>
        ))}
      </div>

      {msg && <p className={`font-inter text-sm ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
      <GlassButton type="submit" variant="red" disabled={saving}
        className="w-full font-inter text-sm tracking-[0.06em] uppercase" style={{ borderRadius:'14px', minHeight:'52px' }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </GlassButton>
    </form>
  )
}

// ─── TAB: POSTCARDS ───────────────────────────────────────────────────────────
function PostcardsUploadTab({ currentUser, canCreateSection = false, L }) {
  const { toast }       = useToast()
  const [sections,      setSections]      = useState([])
  const [postcards,     setPostcards]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [files,         setFiles]         = useState([])
  const [previews,      setPreviews]      = useState([])
  const [dragIdx,       setDragIdx]       = useState(null)
  const [caption,       setCaption]       = useState('')
  const [newSecName,    setNewSecName]    = useState('')
  const [creatingSec,   setCreatingSec]   = useState(false)
  const [showSecForm,   setShowSecForm]   = useState(false)
  const [section,    setSection]    = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [msg,        setMsg]        = useState('')
  const [editId,     setEditId]     = useState(null)
  const [editCaption,setEditCaption]= useState('')
  const [editImages, setEditImages] = useState([])
  const [editMsg,    setEditMsg]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const addMoreRef = useRef(null)

  useEffect(() => {
    Promise.all([postcardsApi.getSections(), postcardsApi.list({ limit: 50 })])
      .then(([sd, pd]) => {
        setSections(sd.sections)
        if (sd.sections.length) setSection(sd.sections[0]._id)
        const mine = pd.postcards.filter(pc => {
          const id = typeof pc.photographer === 'object' ? pc.photographer?._id : pc.photographer
          return id?.toString() === currentUser?._id?.toString()
        })
        setPostcards(mine)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentUser?._id])

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files).slice(0, 15)
    if (!picked.length) return
    setFiles(picked); setPreviews(picked.map(f => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const handleAddMore = (e) => {
    const newPicked = Array.from(e.target.files)
    if (!newPicked.length) return
    const combined    = [...files, ...newPicked].slice(0, 15)
    const newPreviews = newPicked.slice(0, 15 - files.length).map(f => URL.createObjectURL(f))
    setFiles(combined); setPreviews(p => [...p, ...newPreviews].slice(0, 15))
    e.target.value = ''
  }

  const removePreview = (i) => {
    setFiles(f => f.filter((_, fi) => fi !== i))
    setPreviews(p => p.filter((_, pi) => pi !== i))
  }

  const onDragStart = (i) => setDragIdx(i)
  const onDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const reorder = arr => {
      const a = [...arr]; const [moved] = a.splice(dragIdx, 1); a.splice(i, 0, moved); return a
    }
    setFiles(reorder); setPreviews(reorder); setDragIdx(i)
  }
  const onDragEnd = () => setDragIdx(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!files.length) return setMsg('Select at least one photo.')
    setUploading(true); setMsg('')
    try {
      const images = []
      for (const file of files) {
        const { key, publicUrl } = await uploadFileToS3(file, 'postcards')
        images.push({ url: publicUrl, s3Key: key })
      }
      const { postcard } = await postcardsApi.uploadCarousel({ images, section: section || undefined, caption })
      setPostcards(p => [postcard, ...p])
      setFiles([]); setPreviews([]); setCaption('')
      toast.success('Shared!', 'Postcard posted successfully')
    } catch (err) { setMsg(err.message) }
    finally { setUploading(false) }
  }

  const deletePostcard = async (id) => {
    await postcardsApi.delete(id).catch(() => {})
    setPostcards(p => p.filter(pc => pc._id !== id))
    if (editId === id) setEditId(null)
  }

  const startEdit = (pc) => {
    setEditId(pc._id); setEditCaption(pc.caption || ''); setEditMsg('')
    const imgs = pc.images?.length ? pc.images : pc.imageUrl ? [{ url: pc.imageUrl, s3Key: pc.s3Key }] : []
    setEditImages(imgs)
  }

  const removeEditImage = (idx) => setEditImages(arr => arr.filter((_, i) => i !== idx))

  const saveEdit = async (id) => {
    if (editImages.length === 0) return setEditMsg('At least one photo is required.')
    setSaving(true); setEditMsg('')
    try {
      await postcardsApi.update(id, { caption: editCaption, images: editImages })
      setPostcards(p => p.map(pc => pc._id === id ? { ...pc, caption: editCaption, images: editImages } : pc))
      setEditId(null)
    } catch (err) { setEditMsg(err.message || 'Save failed — try again.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 pb-6">
      <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'}`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Create a Postcard</p>
        <form onSubmit={submit} className="space-y-3">
          {previews.length > 0 ? (
            <div className="space-y-2">
              <p className={`font-inter text-[10px] ${L?'text-gray-400':'text-gray-500'}`}>Drag to reorder photos</p>
              <div className="grid grid-cols-3 gap-1.5">
                {previews.map((src, i) => (
                  <div key={i}
                    className={`relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing ${dragIdx === i ? 'opacity-40 ring-2 ring-red-500' : ''}`}
                    style={{ paddingBottom:'125%' }} draggable
                    onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}>
                    <div className="absolute inset-0"><img src={src} alt="" className="w-full h-full object-cover" /></div>
                    <button type="button" onClick={() => removePreview(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center z-10">✕</button>
                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center z-10">
                      <span className="font-inter text-[8px] text-white font-bold">{i+1}</span>
                    </div>
                  </div>
                ))}
              </div>
              {files.length < 15 && (
                <>
                  <button type="button" onClick={() => addMoreRef.current?.click()}
                    className={`w-full py-2 rounded-xl border-2 border-dashed font-inter text-xs transition-colors ${
                      L ? 'border-black/10 text-gray-500 hover:border-red-600/30' : 'border-white/10 text-gray-500 hover:border-red-600/30'
                    }`}>+ Add more photos ({files.length}/15)</button>
                  <input ref={addMoreRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddMore} />
                </>
              )}
            </div>
          ) : (
            <label className={`block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ${L ? 'border-black/12 hover:border-red-600/30' : 'border-white/10 hover:border-red-600/30'}`}>
              <div className={`flex flex-col items-center justify-center py-10 gap-1 ${L?'text-gray-400':'text-gray-600'}`}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-1 text-gray-500"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p className="font-inter text-sm">Add photos (up to 15)</p>
                <p className="font-inter text-[10px] text-gray-500">They'll cycle like a carousel</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </label>
          )}
          <div className="relative">
            <input value={caption} onChange={e => setCaption(e.target.value.slice(0, 50))}
              placeholder="Short caption (max 50 chars)…"
              className="glass-input w-full text-sm pr-14" style={{ borderRadius:'10px' }} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-inter text-[10px] text-gray-500 pointer-events-none">{caption.length}/50</span>
          </div>
          <div className="space-y-1.5">
            <select value={section} onChange={e => setSection(e.target.value)} className="glass-input w-full text-sm" style={{ borderRadius:'10px' }}>
              <option value="">General</option>
              {sections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {canCreateSection && !showSecForm && (
              <button type="button" onClick={() => setShowSecForm(true)}
                className={`font-inter text-[10px] ${L?'text-gray-400 hover:text-gray-700':'text-gray-500 hover:text-gray-300'} transition-colors`}>
                + Create new section
              </button>
            )}
            {canCreateSection && showSecForm && (
              <div className="flex gap-2">
                <input value={newSecName} onChange={e => setNewSecName(e.target.value)}
                  placeholder="Section name"
                  className="glass-input flex-1 text-sm" style={{ borderRadius:'8px' }} />
                <button type="button" disabled={creatingSec || !newSecName.trim()}
                  onClick={async () => {
                    if (!newSecName.trim()) return
                    setCreatingSec(true)
                    try {
                      const { section: s } = await postcardsApi.createSection({ name: newSecName.trim() })
                      setSections(prev => [...prev, s])
                      setSection(s._id)
                      setNewSecName(''); setShowSecForm(false)
                    } catch (err) { setMsg(err.message) }
                    finally { setCreatingSec(false) }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-inter text-xs disabled:opacity-40">
                  {creatingSec ? '…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setShowSecForm(false); setNewSecName('') }}
                  className={`px-2 py-1.5 rounded-lg font-inter text-xs ${L?'text-gray-500':'text-gray-400'}`}>
                  Cancel
                </button>
              </div>
            )}
          </div>
          {msg && <p className={`font-inter text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
          <GlassButton type="submit" variant="red" disabled={uploading || !files.length}
            className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
            {uploading ? `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`
              : files.length ? `Share Postcard (${files.length} photo${files.length > 1 ? 's' : ''})` : 'Share Postcard'}
          </GlassButton>
        </form>
      </div>

      <div>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">My Postcards</p>
        {loading ? (
          <SkeletonGrid n={4} />
        ) : postcards.length === 0 ? (
          <div className={`py-12 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 text-gray-500"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>No postcards yet. Share your first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {postcards.map(pc => {
              const imgs = pc.images?.length
                ? pc.images.map(img => (typeof img === 'string' ? img : img.url))
                : pc.imageUrl ? [pc.imageUrl] : []
              const isEditing = editId === pc._id
              return (
                <div key={pc._id} className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-inter text-[12px] font-semibold ${L?'text-gray-900':'text-white'}`}>
                        {imgs.length} photo{imgs.length !== 1 ? 's' : ''}
                      </p>
                      <p className="font-inter text-[10px] text-gray-500">
                        {pc.section?.name || 'General'} · {new Date(pc.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                      </p>
                    </div>
                    <button onClick={() => isEditing ? setEditId(null) : startEdit(pc)}
                      className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        isEditing
                          ? L ? 'border-black/10 text-gray-500' : 'border-white/10 text-gray-500'
                          : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                      }`}>{isEditing ? 'Cancel' : 'Edit'}</button>
                    <button onClick={() => deletePostcard(pc._id)}
                      className="font-inter text-[10px] px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </div>

                  {isEditing ? (
                    <div className="px-4 pb-3 space-y-3">
                      <p className="font-inter text-[10px] text-gray-500">Drag to reorder · tap × to remove</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {editImages.map((imgObj, i) => {
                          const url = typeof imgObj === 'string' ? imgObj : (imgObj.url || imgObj)
                          return (
                            <div key={i}
                              className={`relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing ${dragIdx === i ? 'opacity-40 ring-2 ring-red-500' : ''}`}
                              style={{ paddingBottom:'125%' }} draggable
                              onDragStart={() => setDragIdx(i)}
                              onDragOver={e => {
                                e.preventDefault()
                                if (dragIdx === null || dragIdx === i) return
                                const reorder = arr => { const a=[...arr]; const [m]=a.splice(dragIdx,1); a.splice(i,0,m); return a }
                                setEditImages(reorder); setDragIdx(i)
                              }}
                              onDragEnd={() => setDragIdx(null)}>
                              <div className="absolute inset-0"><img src={url} alt="" className="w-full h-full object-cover" /></div>
                              <button onClick={() => removeEditImage(i)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center z-10">
                                <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center z-10">
                                <span className="font-inter text-[8px] text-white font-bold">{i+1}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {editImages.length === 0 && <p className="font-inter text-[11px] text-red-400 text-center py-1">At least one photo required</p>}
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <input value={editCaption} onChange={e => setEditCaption(e.target.value.slice(0, 50))}
                            placeholder="Edit caption…"
                            className="glass-input w-full text-sm pr-12" style={{ borderRadius:'8px' }} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-inter text-[9px] text-gray-500 pointer-events-none">{editCaption.length}/50</span>
                        </div>
                        <GlassButton type="button" variant="red" onClick={() => saveEdit(pc._id)}
                          disabled={saving || editImages.length === 0}
                          className="font-inter text-[11px] shrink-0" style={{ borderRadius:'8px', minHeight:'34px', padding:'0 12px' }}>
                          {saving ? '…' : 'Save'}
                        </GlassButton>
                      </div>
                      {editMsg && <p className="font-inter text-xs text-red-400">{editMsg}</p>}
                    </div>
                  ) : (
                    <>
                      {imgs.length > 0 && (
                        <div className="grid grid-cols-4 gap-0.5 px-4 pb-2">
                          {imgs.slice(0, 8).map((url, i) => (
                            <div key={i} className="aspect-square rounded-lg overflow-hidden relative">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              {i === 7 && imgs.length > 8 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <span className="text-white font-inter text-xs font-bold">+{imgs.length - 8}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {pc.caption && <p className={`px-4 pb-3 font-inter text-sm ${L?'text-gray-700':'text-gray-400'}`}>{pc.caption}</p>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: ACTIVITIES ─────────────────────────────────────────────────────────
function ActivitiesTab({ currentUser, L }) {
  const [acts,          setActs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const [sectData,      setSectData]      = useState(null)

  useEffect(() => {
    Promise.all([
      activitiesApi.list().then(d => setActs(d.activities||[])),
      settingsApi.getSections().then(setSectData).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const myId = currentUser?._id?.toString()
  const enrolledIds = new Set()
  acts.forEach(a => {
    if (!myId) return
    const isCore = currentUser?.role === 'core'
    const excluded = (a.excludedCores||[]).map(u => (typeof u==='object' ? u._id?.toString() : u?.toString()) || '')
    if (isCore && !excluded.includes(myId)) { enrolledIds.add(a._id); return }
    const vol = (a.volunteers||[]).find(v => {
      try {
        const uid = typeof v.user==='object' ? v.user?._id?.toString() : v.user?.toString()
        return uid && uid === myId
      } catch { return false }
    })
    if (vol) enrolledIds.add(a._id)
  })

  const sortActs = (arr) => [...arr].sort((a, b) => {
    const aE = enrolledIds.has(a._id) ? 0 : 1
    const bE = enrolledIds.has(b._id) ? 0 : 1
    if (aE !== bE) return aE - bE
    return new Date(a.eventDate||a.startDate||a.createdAt) - new Date(b.eventDate||b.startDate||b.createdAt)
  })

  const isAdminOrCore = ['admin','core'].includes(currentUser?.role)
  const showPast      = isAdminOrCore || (sectData?.sections?.['show-past-activities'] !== false)
  const curSession    = currentSession()

  const currentItems  = acts.filter(a => isCurrentSession(a))
  const pastItems     = acts.filter(a => !isCurrentSession(a))
  const pastBySession = pastItems.reduce((acc, a) => {
    const s = getItemSession(getPrimaryItemDate(a)) || 'Older'
    ;(acc[s] = acc[s] || []).push(a)
    return acc
  }, {})
  const pastSessions  = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions   = [curSession, ...pastSessions]
  const sessionItems  = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession = sessionFilter !== curSession
  const visibleSessions = (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0))

  const ongoing  = sortActs(sessionItems.filter(a => a.status==='ongoing'))
  const upcoming = sortActs(sessionItems.filter(a => a.status==='upcoming'))
  const past     = sortActs(sessionItems.filter(a => a.status==='past'))
  const mine     = sortActs(sessionItems.filter(a => enrolledIds.has(a._id)))
  const filtered = sortActs(filter==='mine'?mine:filter==='ongoing'?ongoing:filter==='upcoming'?upcoming:filter==='past'?past:sessionItems)

  const STATUS_CLS = {
    ongoing:  'text-emerald-400 bg-emerald-900/25 border-emerald-700/40',
    upcoming: 'text-violet-400 bg-violet-900/25 border-violet-700/40',
    past:     'text-gray-500 bg-gray-800/30 border-gray-700/30',
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Session pills */}
      {!loading && visibleSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
          {visibleSessions.map(s => {
            const isAct = sessionFilter === s
            const isCur = s === curSession
            return (
              <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                  isAct ? 'bg-violet-700 text-white border-violet-700'
                  : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}>
                {s}{isCur ? ' · Current' : ''}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {[
          ['all',      `All (${sessionItems.length})`],
          ['mine',     `Mine (${mine.length})`],
          ['ongoing',  `Ongoing (${ongoing.length})`],
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['past',     `Past (${past.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-medium transition-all border ${
              filter===id ? 'bg-violet-700 text-white border-violet-700' : `auth-glass ${L?'text-gray-600 border-black/8':'text-gray-400 border-white/8'} hover:text-white`
            }`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid n={4} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
            {filter==='mine' ? "You're not enrolled in any activities yet." : 'No activities found.'}
          </p>
          {filter==='mine' && (
            <Link to="/activities" className="font-inter text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2 inline-block">
              Browse Activities →
            </Link>
          )}
        </div>
      ) : (
        <>
          {isPastSession && (
            <div className="flex items-center gap-3 py-1">
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
              <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                {sessionFilter} · {sessionItems.length} activit{sessionItems.length !== 1 ? 'ies' : 'y'}
              </span>
              <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {filtered.map(a => {
              const enrolled = enrolledIds.has(a._id)
              const volEntry = a.volunteers?.find(v => {
                const uid = typeof v.user==='object' ? v.user?._id : v.user
                return uid?.toString() === currentUser?._id?.toString()
              })
              const myRole = currentUser?.role==='core' ? 'coordinator' : (volEntry?.role||null)
              return (
                <Link key={a._id} to={`/activities/${a._id}`}
                  className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 aspect-square block
                    ${L?'bg-gray-100 border-black/8':'bg-[#0a0a0a] border-white/8'}
                    ${enrolled?'shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_4px_20px_rgba(139,92,246,0.1)]':''}`}
                  style={{ filter: isPastSession ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
                  onMouseEnter={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
                  onMouseLeave={isPastSession ? evt => { evt.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
                  {a.bannerUrl
                    ? <img src={a.bannerUrl} alt={a.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center" style={{ background:'linear-gradient(135deg,#0d0720,#0a0a1e)' }}>
                        <span className="font-clash font-black text-white/5" style={{ fontSize:'clamp(48px,7vw,80px)' }}>{a.name[0]}</span>
                      </div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={`font-inter text-[8px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider font-semibold backdrop-blur-sm ${STATUS_CLS[a.status]||''}`}>{a.status}</span>
                    {a.showNewBadge && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse font-bold">NEW</span>}
                  </div>
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full font-inter text-[8px] font-bold uppercase tracking-wider border ${
                    myRole === 'coordinator' ? 'bg-red-900/80 text-red-300 border-red-600/50'
                    : enrolled ? 'bg-emerald-900/80 text-emerald-300 border-emerald-600/50'
                    : 'bg-black/50 text-gray-400 border-white/15'
                  }`} style={{ backdropFilter:'blur(8px)' }}>
                    {enrolled
                      ? <><svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                          {myRole === 'coordinator' ? 'Coordinator' : myRole === 'volunteer' ? 'Volunteer' : 'Enrolled'}
                        </>
                      : 'Not Enrolled'}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="font-inter text-xs font-semibold leading-tight text-white truncate">{a.name}</p>
                    {a.subject && <p className="font-inter text-[8px] text-violet-300 truncate mt-0.5">{a.subject}</p>}
                    {(a.eventDate || a.startDate) && <p className="font-inter text-[8px] text-white/60 mt-0.5">{new Date(a.eventDate || a.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TAB: COORDINATOR GALLERY ─────────────────────────────────────────────────
function CoordGalleryTab({ user, canUpload = true, L }) {
  const { toast }   = useToast()
  const [photos,    setPhotos]    = useState([])
  const [sections,  setSections]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [files,     setFiles]     = useState([])
  const [previews,  setPreviews]  = useState([])
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [section,   setSection]   = useState('')
  const [caption,   setCaption]   = useState('')
  // Coordinators (like cores/admins) MANAGE the club gallery — they add photos on behalf
  // of the actual photographer, not themselves. Defaults to "anonymous"; they search/pick
  // a registered member from the dropdown or free-type the photographer's name.
  const [attribution, setAttribution] = useState({ name: 'anonymous' })
  const [photogKey, setPhotogKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [msg,       setMsg]       = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [sd, pd] = await Promise.all([galleryApi.getSections(), galleryApi.getPhotos()])
      setSections(sd.sections || [])
      if (sd.sections?.length) setSection(sd.sections[0]._id)
      // Photos this coordinator ADDED (they may attribute them to any photographer),
      // so their own uploads always appear here for management regardless of attribution.
      const mine = (pd.photos || []).filter(p => {
        const by = p.addedBy
          ? (typeof p.addedBy === 'object' ? p.addedBy?._id : p.addedBy)
          : null
        return by?.toString() === user?._id?.toString()
      })
      setPhotos(mine)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?._id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFile = (e) => {
    const fs = Array.from(e.target.files)
    if (!fs.length) return
    setFiles(fs); setPreviews(fs.map(f => URL.createObjectURL(f))); e.target.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!files.length) return setMsg('Please select at least one photo.')
    if (!attribution?.name?.trim()) return setMsg('Photographer name is required.')
    setUploading(true); setMsg('')
    const count = files.length
    try {
      const added = []
      for (let i = 0; i < count; i++) {
        setUploadProgress({ current: i + 1, total: count })
        const r = await uploadFileToS3(files[i], 'gallery')
        const { photo } = await galleryApi.addPhoto({
          imageUrl: r.publicUrl, s3Key: r.key, mobileUrl: r.mobileUrl, mobileS3Key: r.mobileKey,
          caption:  caption || undefined,
          section:  section || undefined,
          photographer: attribution,
        })
        added.push(photo)
      }
      setPhotos(p => [...added.reverse(), ...p])
      setFiles([]); setPreviews([]); setCaption('')
      setAttribution({ name: 'anonymous' }); setPhotogKey(k => k + 1)
      toast.success('Added!', `${count} photo${count > 1 ? 's' : ''} added to gallery`)
    } catch (err) { setMsg(err.message) }
    finally { setUploading(false); setUploadProgress({ current: 0, total: 0 }) }
  }

  const deletePhoto = async (id) => {
    await galleryApi.deletePhoto(id).catch(() => {})
    setPhotos(p => p.filter(x => x._id !== id))
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-inter text-lg font-semibold ${L?'text-gray-900':'text-white'}`}>Club Gallery</p>
          <p className="font-inter text-xs text-gray-500 mt-0.5">{photos.length} photo{photos.length !== 1 ? 's' : ''} added by you</p>
        </div>
        <Link to="/gallery">
          <GlassButton variant="default" className="font-inter text-xs" style={{ borderRadius:10, minHeight:34, padding:'0 14px' }}>
            Manage Full Gallery →
          </GlassButton>
        </Link>
      </div>

      {/* Upload form — only shown when upload is permitted */}
      {!canUpload && (
        <div className={`auth-glass rounded-2xl border p-5 text-center ${L?'border-black/8':'border-white/8'}`}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2 text-gray-500"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>Gallery upload is currently disabled for coordinators.</p>
        </div>
      )}
      {canUpload && <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'}`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Add Photo to Gallery</p>
        <form onSubmit={submit} className="space-y-3">
          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-square">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <label className={`block w-full rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition-colors ${L ? 'border-black/12 hover:border-red-600/30' : 'border-white/10 hover:border-red-600/30'}`}>
              <div className={`flex flex-col items-center justify-center py-8 ${L?'text-gray-400':'text-gray-600'}`}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-2 text-gray-500"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <p className="font-inter text-sm">Choose photos</p>
              </div>
              <input type="file" accept="image/*" className="hidden" multiple onChange={handleFile} />
            </label>
          )}
          {files.length > 0 && (
            <button type="button" onClick={() => { setFiles([]); setPreviews([]) }}
              className={`font-inter text-xs transition-colors ${L?'text-gray-500 hover:text-red-600':'text-gray-500 hover:text-red-400'}`}>
              Remove all ({files.length})
            </button>
          )}
          {/* Photographer — required, defaults to you, searchable dropdown */}
          <div>
            <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              Photographer <span className="text-red-400">*</span>
              <span className="normal-case text-gray-600 font-normal">(search or type name)</span>
            </label>
            <PhotographerSearch key={photogKey} value={attribution} onSelect={v=>setAttribution(v)} required L={L} />
          </div>
          <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0,200))} rows={2}
            placeholder="Caption (optional)"
            className="glass-input w-full resize-none text-sm" style={{ borderRadius:'10px' }} />
          <select value={section} onChange={e => setSection(e.target.value)}
            className="glass-input w-full text-sm" style={{ borderRadius:'10px' }}>
            <option value="">General</option>
            {sections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          {msg && <p className={`font-inter text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
          {uploading && uploadProgress.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="font-inter text-xs text-gray-400">Uploading {uploadProgress.current} of {uploadProgress.total}…</p>
              </div>
              <div className={`w-full h-1 rounded-full overflow-hidden ${L?'bg-black/8':'bg-white/8'}`}>
                <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <GlassButton type="submit" variant="red" disabled={uploading || !files.length}
            className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'42px' }}>
            {uploading ? 'Uploading…' : `Add to Gallery${files.length > 1 ? ` (${files.length})` : ''}`}
          </GlassButton>
        </form>
      </div>}

      {/* My contributions */}
      {loading ? (
        <SkeletonGrid n={6} />
      ) : photos.length > 0 ? (
        <div>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Photos You Added</p>
          <div style={{ columns:'3 auto', gap:'6px' }}>
            {photos.map((p, i) => (
              <div key={p._id} className="relative group mb-1.5 rounded-xl overflow-hidden break-inside-avoid cursor-pointer"
                onClick={() => setLightboxIdx(i)}>
                <ProgressiveImage src={p.imageUrl} mobileSrc={p.mobileUrl} alt="" masonry />
                {/* Photographer attribution — so the manager can verify who it's credited to */}
                {p.photographer?.name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-2 pt-4 pb-1 flex items-center gap-1.5">
                    {p.photographer?.userId?.profilePhoto
                      ? <img src={p.photographer.userId.profilePhoto} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" style={{boxShadow:'0 0 0 1px rgba(255,255,255,0.35)'}}/>
                      : <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{background:'#dc2626'}}>
                          <svg width={6} height={6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>}
                    <p className="font-inter text-[9px] font-semibold text-white/95 truncate">{p.photographer.name}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); deletePhoto(p._id) }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-inter text-[10px] font-semibold">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`py-10 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-3 text-gray-500 mx-auto"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>No gallery photos contributed yet.</p>
        </div>
      )}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos.map(p => ({
            url: p.imageUrl,
            photographer: p.photographer?.name
              ? { name: p.photographer.name, photoUrl: p.photographer.userId?.profilePhoto }
              : undefined
          }))}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  )
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  profile: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
    </svg>
  ),
  magazine: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  postcards: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  ),
  events: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  mygallery: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  gallery: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  settings: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  competitions: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  activities: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  announce: (a, L) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a?'#dc2626':L?'#9ca3af':'#6b7280'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
}

const BASE_TABS  = [
  { id:'profile',      label:'My Profile'   },
  { id:'mygallery',    label:'My Gallery'   },
  { id:'magazine',     label:'Magazine'     },
  { id:'postcards',    label:'Postcards'    },
  { id:'events',       label:'Events'       },
  { id:'competitions', label:'Competitions' },
  { id:'activities',   label:'Activities'   },
]
const COORD_TAB      = { id:'gallery',   label:'Club Gallery'   }
const COORD_ANN_TAB  = { id:'announce',  label:'Announcements'  }

// ─── SIDEBAR NAV ITEM ─────────────────────────────────────────────────────────
function SidebarNavItem({ t, active, onSelect, L }) {
  return (
    <button onClick={() => onSelect(t.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-inter text-xs font-medium transition-all duration-200 active:scale-[0.97] text-left neo-interactive"
      style={{
        background: active
          ? L ? 'rgba(255,242,242,0.88)' : 'rgba(220,38,38,0.14)'
          : 'transparent',
        color: active ? '#dc2626' : L ? '#64748b' : '#6b7280',
        boxShadow: active
          ? L ? '4px 4px 10px rgba(163,177,200,0.35), -2px -2px 6px rgba(255,255,255,0.78), inset 0 1px 0 rgba(255,255,255,0.90)'
              : 'inset 2px 2px 5px rgba(0,0,0,0.4),0 0 10px rgba(220,38,38,0.15)'
          : 'none',
        transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
      }}>
      <span className="shrink-0" style={{ opacity: active ? 1 : 0.6 }}>{TAB_ICONS[t.id]?.(active, L)}</span>
      <span className="truncate">{t.label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background:'#dc2626', boxShadow:'0 0 6px rgba(220,38,38,0.8)' }} />}
    </button>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function MemberDashboard({ onLogout }) {
  const { theme, toggleTheme } = useTheme()
  const { user, setUser }      = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading,  setLoading] = useState(!user)
  // All valid tab ids — used to reject garbage URL values
  const _allTabIds = ['profile','mygallery','magazine','postcards','events','competitions','activities','gallery','announce']
  const _rawTab    = searchParams.get('tab')
  const tab        = (_rawTab && _allTabIds.includes(_rawTab)) ? _rawTab : 'profile'
  const setTab     = (tabId) => setSearchParams({ tab: tabId }, { replace: true })
  const [error,    setError]   = useState('')
  const [menuOpen, setMenuOpen]= useState(false)
  const L = theme === 'light'

  // Mobile-only compaction: shrink the root font while the dashboard is mounted so
  // every rem-based size (text, padding, gaps, radii) tightens into an app-like feel.
  // Scoped to <1024px via CSS media query — desktop is completely unaffected.
  useEffect(() => {
    document.documentElement.classList.add('dash-compact')
    return () => document.documentElement.classList.remove('dash-compact')
  }, [])

  useEffect(() => {
    if (user) return
    authApi.getMe()
      .then(d => setUser(d.user))
      .catch(() => { setError('Session expired. Please sign in again.'); clearToken() })
      .finally(() => setLoading(false))
  }, [user, setUser])

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    clearToken()
    onLogout?.()
  }

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${L?'bg-gray-50':'bg-[#050505]'}`}>
      <SkeletonProfile />
    </div>
  )
  if (error) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${L?'bg-gray-50':'bg-[#050505]'}`}>
      <p className="font-inter text-sm text-red-400">{error}</p>
      <button onClick={handleLogout} className="font-inter text-xs text-white underline">Sign out</button>
    </div>
  )
  if (!user) return null

  const isAdmin = ['admin','core'].includes(user.role)
  const isCoord = ['coordinator','core','admin'].includes(user.role)
  const isPureCoord = user.role === 'coordinator'

  // Section visibility — hide tabs for hidden sections (admin/core always see all)
  const [sectionVis,  setSectionVis]  = useState({})
  const [coordPerms, setCoordPerms] = useState({ canUploadGallery: true, canCreatePostcardSection: false, canSendAnnouncements: false })
  useEffect(() => {
    settingsApi.getSections().then(d => setSectionVis(d.sections || {})).catch(() => {})
    const t = setInterval(() => {
      settingsApi.getSections().then(d => setSectionVis(d.sections || {})).catch(() => {})
    }, 60000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!isPureCoord) return
    const fetch = () => settingsApi.coordPermissions().then(d => setCoordPerms(d.permissions || {})).catch(() => {})
    fetch()
    const t = setInterval(fetch, 60000)
    return () => clearInterval(t)
  }, [isPureCoord])

  const TAB_TO_SECTION = { competitions: 'competitions', activities: 'activities', postcards: 'postcards' }
  const filteredBase = isAdmin
    ? BASE_TABS
    : BASE_TABS.filter(t => {
        const sid = TAB_TO_SECTION[t.id]
        return !sid || sectionVis[sid] !== false
      })
  const coordGalleryAllowed = !isPureCoord || coordPerms.canUploadGallery !== false
  const tabs = [
    ...filteredBase,
    ...(isCoord && coordGalleryAllowed ? [COORD_TAB] : []),
    ...(isPureCoord && coordPerms.canSendAnnouncements ? [COORD_ANN_TAB] : []),
  ]

  // If current tab got hidden, fall back to first available tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === tab)) setTab(tabs[0].id)
  }, [tabs.map(t=>t.id).join()])

  const role    = ROLE_META[user.role] || ROLE_META.photographer

  // Sidebar glass styles
  const sbBg     = L ? 'rgba(238,241,247,0.97)' : 'rgba(9,9,13,0.97)'
  const sbBorder = L ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.07)'

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${L?'bg-[#e8ecf3]':'bg-[#060608]'}`}>

      {/* ──────────────── DESKTOP SIDEBAR ──────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col z-[201]"
        style={{
          background:           sbBg,
          backdropFilter:       'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight:          `1px solid ${sbBorder}`,
          boxShadow: L
            ? '8px 0 24px rgba(163,177,200,0.30), inset -1px 0 0 rgba(255,255,255,0.60)'
            : '4px 0 32px rgba(0,0,0,0.4)',
        }}>

        {/* Brand + User — matches admin panel layout */}
        <div className="p-5 shrink-0">
          {/* IEM logo row */}
          <Link to="/" className="flex items-center gap-3 mb-5 group">
            <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-9 h-9 rounded-full shrink-0"
              style={{ boxShadow:'0 0 0 2px rgba(220,38,38,0.4)' }} />
            <div className="min-w-0">
              <p className={`font-inter text-xs font-black uppercase tracking-[0.14em] ${L?'text-gray-800':'text-white'}`}>IEM Photography</p>
              <p className="font-inter text-[9px] text-gray-500 uppercase tracking-widest">
                {isAdmin ? (user.role==='admin'?'Admin Panel':'Core Panel') : isPureCoord ? 'Coordinator' : 'Dashboard'}
              </p>
            </div>
          </Link>

          {/* User card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl"
            style={{
              background: L ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.05)',
              border:     L ? '1px solid rgba(255,255,255,0.88)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow:  L ? '4px 4px 10px rgba(163,177,200,0.32), -2px -2px 6px rgba(255,255,255,0.80)' : undefined,
            }}>
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background:'#1a1a20', border:'2px solid rgba(220,38,38,0.4)' }}>
              {user.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="font-inter text-sm font-bold text-white">
                    {user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-inter text-xs font-semibold truncate ${L?'text-gray-900':'text-white'}`}>{user.name}</p>
              <span className="inline-flex px-2 py-0.5 mt-0.5 rounded-full font-inter text-[9px] font-bold uppercase tracking-wider border"
                style={{ background:`${role.color}15`, color:role.color, borderColor:`${role.color}35` }}>
                {role.label}
              </span>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-3">
          {tabs.map(t => (
            <SidebarNavItem key={t.id} t={t} active={tab===t.id} onSelect={setTab} L={L} />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 shrink-0 space-y-1"
          style={{ borderTop: L ? '1px solid rgba(174,185,210,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={toggleTheme}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-inter text-xs transition-all active:scale-95 ${L?'text-gray-500 hover:text-gray-800 hover:bg-black/5':'text-gray-400 hover:text-white hover:bg-white/8'}`}>
            {L
              ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
            {L ? 'Dark Mode' : 'Light Mode'}
          </button>
          {isAdmin && (
            <Link to="/admin"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-inter text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/8 transition-all active:scale-95">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="shrink-0"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Admin Panel
            </Link>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-inter text-xs text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-all active:scale-95">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ──────────────── MAIN CONTENT ──────────────── */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">

        {/* Mobile sticky header */}
        <header className="lg:hidden sticky top-0 z-50 px-3 pt-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background:           L ? 'rgba(236,240,248,0.92)' : 'rgba(10,10,14,0.82)',
              backdropFilter:       'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border:               L ? '1px solid rgba(255,255,255,0.88)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow: L
                ? '8px 8px 20px rgba(163,177,200,0.38), -5px -5px 12px rgba(255,255,255,0.85), inset 0 1px 0 rgba(255,255,255,0.96)'
                : '0 4px 20px rgba(0,0,0,0.5)',
            }}>
            <div className="flex-1 min-w-0">
              <p className={`font-inter text-sm font-bold truncate ${L?'text-gray-900':'text-white'}`}>
                {tabs.find(t=>t.id===tab)?.label || 'Dashboard'}
              </p>
              <p className="font-inter text-[9px] text-gray-500 uppercase tracking-wider">
                {isPureCoord ? 'Coordinator' : isAdmin ? (user.role==='admin'?'Admin Panel':'Core Panel') : 'Member Dashboard'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0" style={{border:'1.5px solid rgba(220,38,38,0.4)'}}>
                {user.profilePhoto
                  ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-inter font-bold text-[10px] text-white" style={{background:'#1a1a20'}}>
                      {user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>}
              </div>
              {isAdmin && (
                <Link to="/admin"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-inter text-[10px] font-semibold uppercase tracking-wider text-orange-400 transition-all active:scale-95"
                  style={{ background:'rgba(234,88,12,0.1)', border:'1px solid rgba(234,88,12,0.25)' }}>
                  Admin
                </Link>
              )}
              {/* Theme toggle icon */}
              <button onClick={toggleTheme} aria-label={L ? 'Switch to dark mode' : 'Switch to light mode'}
                className="flex items-center justify-center p-2 rounded-xl transition-all active:scale-90"
                style={{background:L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.07)',boxShadow:L?'-1px -1px 3px rgba(255,255,255,0.8),2px 2px 4px rgba(0,0,0,0.07)':'-1px -1px 2px rgba(255,255,255,0.02),2px 2px 4px rgba(0,0,0,0.6)',color:L?'#6b7280':'#9ca3af'}}>
                {L
                  ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
              </button>
              <button onClick={() => setMenuOpen(v => !v)} aria-label="Open navigation menu"
                className="flex flex-col items-center justify-center gap-[3px] p-2 rounded-xl transition-all active:scale-90"
                style={{
                  background: L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)',
                  boxShadow:  L ? '-1px -1px 3px rgba(255,255,255,0.8),2px 2px 4px rgba(0,0,0,0.07)' : '-1px -1px 2px rgba(255,255,255,0.02),2px 2px 4px rgba(0,0,0,0.6)',
                }}>
                {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: L?'#6b7280':'#9ca3af' }}/>)}
              </button>
            </div>
          </div>
        </header>

        {/* Desktop page title */}
        <div className="hidden lg:flex items-center gap-4 px-8 pt-7 pb-3">
          <div className="w-1 h-7 rounded-full" style={{background:'#dc2626'}} />
          <p className={`font-breathing italic text-4xl font-semibold ${L?'text-gray-900':'text-white'}`}>
            {tabs.find(t=>t.id===tab)?.label || 'Dashboard'}
          </p>
        </div>

        {/* Tab content */}
        <div className="flex-1 px-3 sm:px-5 lg:px-8 py-4 pb-28 lg:pb-8 overflow-x-hidden">
          <div key={tab} className="tab-panel">
            {tab === 'profile'      && <ProfileTab         user={user} onLogout={handleLogout} L={L} />}
            {tab === 'mygallery'    && <MyGalleryTab       user={user} L={L} />}
            {tab === 'magazine'     && <MagazineTab        user={user} />}
            {tab === 'postcards'    && <PostcardsUploadTab currentUser={user} canCreateSection={isAdmin || (isPureCoord && coordPerms.canCreatePostcardSection)} L={L} />}
            {tab === 'events'       && <EventsTab          currentUser={user} L={L} />}
            {tab === 'competitions' && <CompetitionsTab    currentUser={user} L={L} />}
            {tab === 'activities'   && <ActivitiesTab      currentUser={user} L={L} />}
            {tab === 'gallery'      && <CoordGalleryTab user={user} canUpload={coordGalleryAllowed} L={L} />}
            {tab === 'announce'     && <AnnouncementStudio  L={L} isCoordinator={true} />}
          </div>
        </div>
      </div>

      {/* ──────────────── MOBILE BOTTOM SHEET ──────────────── */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[280]"
          style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}
          onClick={() => setMenuOpen(false)} />
      )}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-[290] transition-all duration-350 ease-in-out ${menuOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '80vh' }}>
        <div className="rounded-t-3xl overflow-hidden flex flex-col"
          style={{
            background:           L ? 'rgba(236,240,248,0.96)' : 'rgba(8,8,12,0.94)',
            backdropFilter:       'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border:               L ? '1px solid rgba(255,255,255,0.90)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: L
              ? '-12px -12px 30px rgba(255,255,255,0.80), 0 -8px 24px rgba(163,177,200,0.35), inset 0 1px 0 rgba(255,255,255,0.96)'
              : '0 -8px 40px rgba(0,0,0,0.4)',
            maxHeight:            '80vh',
          }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: L?'rgba(174,185,210,0.55)':'rgba(255,255,255,0.2)' }} />
          </div>
          {/* User row */}
          <div className="px-5 pb-3 shrink-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0" style={{ border:'2px solid rgba(220,38,38,0.4)' }}>
              {user.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-inter font-bold text-white" style={{background:'#1a1a20'}}>
                    {user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>}
            </div>
            <div>
              <p className={`font-inter text-sm font-bold ${L?'text-gray-900':'text-white'}`}>{user.name}</p>
              <p className="font-inter text-[10px] text-gray-500 uppercase tracking-wider">{role.label}</p>
            </div>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="ml-auto text-gray-500 p-2">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Tab list */}
          <div className="overflow-y-auto px-3 pb-6 space-y-1">
            {tabs.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => { setTab(t.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm font-medium transition-all active:scale-[0.97] neo-interactive"
                  style={{
                    background: active ? 'rgba(220,38,38,0.12)' : 'transparent',
                    color:      active ? '#dc2626' : L ? '#374151' : '#d1d5db',
                    boxShadow:  active ? 'inset 2px 2px 5px rgba(0,0,0,0.15)' : 'none',
                  }}>
                  <span className="shrink-0">{TAB_ICONS[t.id]?.(active, L)}</span>
                  <span>{t.label}</span>
                  {active && <div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{background:'#dc2626'}} />}
                </button>
              )
            })}
            <div className="pt-2 space-y-1">
              <button onClick={toggleTheme}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm transition-all active:scale-[0.97] ${L?'text-gray-600':'text-gray-300'}`}>
                {L
                  ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  : <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
                {L ? 'Dark Mode' : 'Light Mode'}
              </button>
              {isAdmin && (
                <Link to="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm"
                  style={{ color:'#f97316' }}
                  onClick={() => setMenuOpen(false)}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  Admin Panel
                </Link>
              )}
              <Link to="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm ${L?'text-gray-500':'text-gray-400'}`}
                onClick={() => setMenuOpen(false)}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Website
              </Link>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm text-red-400">
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Website pill — bottom-right mobile, top-right desktop (matches admin) */}
      <Link to="/"
        className="fixed bottom-6 right-5 lg:bottom-auto lg:top-4 lg:right-4 z-[300] flex items-center gap-1.5 font-inter font-semibold uppercase transition-all active:scale-95 hover:scale-105"
        style={{
          fontSize:'0.6rem', letterSpacing:'0.12em', padding:'7px 14px', borderRadius:50,
          background:'rgba(220,38,38,0.11)', border:'1px solid rgba(220,38,38,0.3)',
          color:'#f87171', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          boxShadow:'0 4px 16px rgba(220,38,38,0.15)',
        }}>
        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        Website
      </Link>
    </div>
  )
}
