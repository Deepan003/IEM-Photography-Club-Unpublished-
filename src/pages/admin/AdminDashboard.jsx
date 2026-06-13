import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../../hooks/useData.js'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi }            from '../../api/admin.js'
import { postcardsApi, galleryApi, eventsApi, membersApi, coreApi, competitionsApi, activitiesApi, socialApi, announceApi, settingsApi, magazineApi, uploadFileToS3 } from '../../api/api.js'
import HeroThemesTab                 from '../../components/admin/HeroThemesTab.jsx'
import AnnouncementStudio            from '../../components/AnnouncementStudio.jsx'
import ContextAnnouncementStudio    from '../../components/announcement/ContextAnnouncementStudio.jsx'
import MagazineTabForCore from '../../components/magazine/MagazineTab.jsx'
import MagazineViewer    from '../../components/magazine/MagazineViewer.jsx'
import TemplatePage      from '../../components/magazine/TemplatePage.jsx'
import { getTemplateById } from '../../components/magazine/templates.js'
import { computeAcademicYear, currentSession, isCurrentSession, getItemSession, getPrimaryItemDate } from '../../utils/yearCalc.js'
import { downloadCSV, downloadPDF, downloadAdminBulkCSV, downloadAdminBulkPDF,
         downloadSingleItemCSV, downloadSingleItemPDF, downloadAllItemsCSV, downloadAllItemsPDF
} from '../../utils/profileReport.js'
import { useTheme, useAuth }   from '../../App.jsx'
import { clearToken }          from '../../api/auth.js'
import GlassButton             from '../../components/GlassButton.jsx'
import ImageUpload             from '../../components/ImageUpload.jsx'
import ProgressiveImage        from '../../components/ProgressiveImage.jsx'
import Lightbox               from '../../components/Lightbox.jsx'
import ConfirmDialog           from '../../components/ConfirmDialog.jsx'
import PhotographerSearch      from '../../components/PhotographerSearch.jsx'
import { ProfileTab as MemberProfileTab } from '../../components/MemberDashboard.jsx'
import DownloadingOverlay from '../../components/DownloadingOverlay.jsx'
import { SkeletonGrid, SkeletonList, SkeletonCard, SkeletonTable } from '../../components/Skeleton.jsx'
import { useToast } from '../../components/Toast.jsx'

// ── Shared primitives ─────────────────────────────────────────────────────────

const ROLE_BADGE = {
  admin:        'bg-red-900/40 text-red-400 border-red-800/50',
  core:         'bg-amber-900/40 text-amber-400 border-amber-800/50',
  coordinator:  'bg-blue-900/40 text-blue-400 border-blue-800/50',
  photographer: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/40',
}
const STATUS_BADGE = {
  approved:      'bg-green-900/30 text-green-400 border-green-800/40',
  pending_admin: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
  pending_email: 'bg-gray-800/50 text-gray-400 border-gray-700/40',
  rejected:      'bg-red-900/30 text-red-400 border-red-800/40',
  banned:        'bg-red-950/60 text-red-300 border-red-900/60',
  passout:       'bg-gray-800/30 text-gray-500 border-gray-700/30',
}
const STATUS_LABEL = {
  approved:      'Approved',
  pending_admin: 'Awaiting Approval',
  pending_email: 'Email Unverified',
  rejected:      'Rejected',
  banned:        'Banned',
  passout:       'Passout',
}

function Badge({ style, children }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-inter uppercase tracking-wider ${style}`}>{children}</span>
}

// Module-level dirty flag — only one admin form is ever active at a time
let _adminDirty = false

// Hook: registers dirty state globally + blocks browser refresh when dirty
function useUnsavedGuard(isDirty) {
  useEffect(() => {
    _adminDirty = isDirty
    return () => { _adminDirty = false }
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}

// Stub — tab-switch warning is now handled by AdminDashboard's ConfirmDialog
function RouteBlockDialog() { return null }

// Reusable coordinator permission toggle banner shown at top of each tab
function CoordToggle({ label, value, onChange, L }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-4 ${
      value
        ? (L ? 'border-green-700/30 bg-green-900/10' : 'border-green-700/25 bg-green-900/10')
        : (L ? 'border-black/6 bg-black/[0.02]' : 'border-white/6 bg-white/[0.02]')
    }`}>
      <div className="flex items-center gap-2">
        <span className="font-inter text-[10px] text-gray-500">Coordinators can</span>
        <span className={`font-inter text-xs font-semibold ${value ? 'text-green-400' : (L?'text-gray-500':'text-gray-600')}`}>{label}</span>
        {!value && <span className="font-inter text-[9px] text-gray-600 italic">(disabled)</span>}
      </div>
      <button onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors duration-250 shrink-0 ${value ? 'bg-green-600' : 'bg-gray-700'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-250 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

// Editable Google Drive link for the public gallery banner — saved via the passed onSave(value) handler
function DriveLinkSetting({ value, onSave, L }) {
  const { toast } = useToast()
  const [link, setLink] = useState(value || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setLink(value || '') }, [value])
  const save = async () => {
    setBusy(true)
    try { await onSave(link.trim()); toast.success('Saved', 'Drive link updated') }
    catch (e) { toast.error('Error', e.message) }
    finally { setBusy(false) }
  }
  return (
    <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'} space-y-2`}>
      <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Full Gallery — Google Drive Link</p>
      <p className="font-inter text-[10px] text-gray-600">Paste a shareable Google Drive folder link. It's shown to visitors as a "view full gallery on Drive" banner — handy since not every photo from the event gets uploaded here.</p>
      <div className="flex gap-2">
        <input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…"
          className="glass-input flex-1 text-sm" style={{ borderRadius:10 }} />
        <GlassButton variant="red" disabled={busy || link.trim()===(value||'')} onClick={save}
          className="font-inter text-xs shrink-0" style={{ borderRadius:10, minHeight:38, padding:'0 16px' }}>
          {busy ? 'Saving…' : 'Save'}
        </GlassButton>
      </div>
    </div>
  )
}

// ── Custom named dates editor — shared by Events / Competitions / Activities ──
function CustomDatesEditor({ value = [], onChange, L }) {
  const [adding,    setAdding]    = useState(false)
  const [newTitle,  setNewTitle]  = useState('')
  const [newDate,   setNewDate]   = useState('')
  const [editIdx,   setEditIdx]   = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate,  setEditDate]  = useState('')

  const add = () => {
    if (!newTitle.trim() || !newDate) return
    onChange([...value, { title: newTitle.trim(), date: newDate }])
    setNewTitle(''); setNewDate(''); setAdding(false)
  }
  const remove = (i) => onChange(value.filter((_, j) => j !== i))
  const startEdit = (i) => { setEditIdx(i); setEditTitle(value[i].title); setEditDate(value[i].date?.slice(0,10) || '') }
  const saveEdit  = () => {
    if (!editTitle.trim() || !editDate) return
    const updated = [...value]; updated[editIdx] = { ...updated[editIdx], title: editTitle.trim(), date: editDate }
    onChange(updated); setEditIdx(null)
  }

  return (
    <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2.5`}>
      <div className="flex items-center justify-between">
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Custom Dates</p>
        {!adding && editIdx === null && (
          <button type="button" onClick={() => setAdding(true)} className="font-inter text-[10px] text-red-400 hover:text-red-300">+ Add Date</button>
        )}
      </div>

      {value.map((cd, i) => editIdx === i ? (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="glass-input flex-1 text-xs" style={{ borderRadius:8, minWidth:110 }} placeholder="Title..." />
          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
            className="glass-input text-xs" style={{ borderRadius:8, colorScheme:'dark', minWidth:130 }} />
          <button type="button" onClick={saveEdit} className="font-inter text-[10px] text-green-400 hover:text-green-300 px-1">✓ Save</button>
          <button type="button" onClick={() => setEditIdx(null)} className="font-inter text-[10px] text-gray-500 hover:text-gray-300 px-1">✕</button>
        </div>
      ) : (
        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${L?'bg-black/[0.03]':'bg-white/[0.03]'}`}>
          <div className="flex-1 min-w-0">
            <span className={`font-inter text-xs font-medium ${L?'text-gray-800':'text-gray-200'}`}>{cd.title}</span>
            {cd.date && (
              <span className="font-inter text-[10px] text-gray-500 ml-2">
                {new Date(cd.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
              </span>
            )}
          </div>
          <button type="button" onClick={() => startEdit(i)} className="font-inter text-[10px] text-gray-500 hover:text-blue-400 shrink-0 transition-colors">Edit</button>
          <button type="button" onClick={() => remove(i)} className="font-inter text-[10px] text-gray-600 hover:text-red-400 shrink-0 transition-colors">✕</button>
        </div>
      ))}

      {adding && (
        <div className="flex gap-2 items-center flex-wrap">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="glass-input flex-1 text-xs" style={{ borderRadius:8, minWidth:110 }} placeholder="Title (e.g. Ceremony Day)..." autoFocus />
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="glass-input text-xs" style={{ borderRadius:8, colorScheme:'dark', minWidth:130 }} />
          <button type="button" onClick={add} className="font-inter text-[10px] text-green-400 hover:text-green-300 px-1">Add</button>
          <button type="button" onClick={() => { setAdding(false); setNewTitle(''); setNewDate('') }} className="font-inter text-[10px] text-gray-500 hover:text-gray-300 px-1">✕</button>
        </div>
      )}

      {value.length === 0 && !adding && (
        <p className="font-inter text-[10px] text-gray-600">No custom dates. Use "+ Add Date" to add named milestones.</p>
      )}
    </div>
  )
}

function EventDatesEditor({ value = [], onChange, L }) {
  const [adding,   setAdding]   = useState(false)
  const [newDate,  setNewDate]  = useState('')
  const [editIdx,  setEditIdx]  = useState(null)
  const [editDate, setEditDate] = useState('')

  const add = () => {
    if (!newDate) return
    onChange([...value, newDate])
    setNewDate(''); setAdding(false)
  }
  const remove = (i) => onChange(value.filter((_, j) => j !== i))
  const startEdit = (i) => { setEditIdx(i); setEditDate(value[i]?.slice(0,10) || '') }
  const saveEdit  = () => {
    if (!editDate) return
    const updated = [...value]; updated[editIdx] = editDate
    onChange(updated); setEditIdx(null)
  }
  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : ''

  return (
    <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2.5`}>
      <div className="flex items-center justify-between">
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Event Dates</p>
        {!adding && editIdx === null && (
          <button type="button" onClick={() => setAdding(true)} className="font-inter text-[10px] text-red-400 hover:text-red-300">+ Add Date</button>
        )}
      </div>

      {value.map((d, i) => editIdx === i ? (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
            className="glass-input text-xs flex-1" style={{ borderRadius:8, colorScheme:'dark', minWidth:140 }} autoFocus />
          <button type="button" onClick={saveEdit} className="font-inter text-[10px] text-green-400 hover:text-green-300 px-1">✓ Save</button>
          <button type="button" onClick={() => setEditIdx(null)} className="font-inter text-[10px] text-gray-500 hover:text-gray-300 px-1">✕</button>
        </div>
      ) : (
        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${L?'bg-black/[0.03]':'bg-white/[0.03]'}`}>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={`font-inter text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${L?'bg-black/[0.06] text-gray-500':'bg-white/[0.06] text-gray-500'}`}>
              {i === 0 ? 'Primary' : `Day ${i + 1}`}
            </span>
            <span className={`font-inter text-xs font-medium ${L?'text-gray-800':'text-gray-200'}`}>{fmt(d)}</span>
          </div>
          <button type="button" onClick={() => startEdit(i)} className="font-inter text-[10px] text-gray-500 hover:text-blue-400 shrink-0 transition-colors">Edit</button>
          <button type="button" onClick={() => remove(i)} className="font-inter text-[10px] text-gray-600 hover:text-red-400 shrink-0 transition-colors">✕</button>
        </div>
      ))}

      {adding && (
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="glass-input text-xs flex-1" style={{ borderRadius:8, colorScheme:'dark', minWidth:140 }} autoFocus />
          <button type="button" onClick={add} className="font-inter text-[10px] text-green-400 hover:text-green-300 px-1">Add</button>
          <button type="button" onClick={() => { setAdding(false); setNewDate('') }} className="font-inter text-[10px] text-gray-500 hover:text-gray-300 px-1">✕</button>
        </div>
      )}

      {value.length === 0 && !adding && (
        <p className="font-inter text-[10px] text-gray-600">No event dates. The first date added is used by the auto-status bot.</p>
      )}
    </div>
  )
}

// ── Floating Action Button — portal to body so position:fixed always works ────
function CreateFAB({ label, onCreate, isActive }) {
  const [open, setOpen] = useState(false)
  const { theme } = useTheme()
  const L = theme === 'light'
  // true on mobile (≤640px), false on desktop — recalculated on resize
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const shortType = label.replace('Create ', '')

  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (isActive) { onCreate(); return }
    setOpen(o => !o)
  }
  const handleCreate = () => { onCreate(); setOpen(false) }

  const SZ = 48
  const EW = 210

  const bg = isActive
    ? (L ? 'rgba(226,230,239,0.96)' : 'rgba(40,40,52,0.92)')
    : open
      ? (L ? 'rgba(242,244,250,0.97)' : 'rgba(12,12,20,0.93)')
      : 'linear-gradient(135deg,rgba(222,38,38,0.97),rgba(168,16,16,1))'

  const shadow = isActive
    ? (L ? '6px 6px 18px rgba(163,177,200,0.38),-4px -4px 10px rgba(255,255,255,0.80)' : '0 8px 28px rgba(0,0,0,0.50),0 3px 10px rgba(0,0,0,0.35)')
    : open
      ? (L
          ? '10px 10px 32px rgba(163,177,200,0.55),-6px -6px 18px rgba(255,255,255,0.96),inset 0 1px 0 rgba(255,255,255,0.70)'
          : '0 18px 52px rgba(0,0,0,0.72),0 6px 22px rgba(0,0,0,0.52),inset 0 1px 0 rgba(255,255,255,0.07)')
      : '0 12px 38px rgba(220,38,38,0.55),0 5px 18px rgba(0,0,0,0.38),inset 0 1px 0 rgba(255,255,255,0.24)'

  const borderColor = (open || isActive)
    ? (L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.13)')
    : 'rgba(255,255,255,0.28)'

  const iconColor = (open || isActive)
    ? (L ? '#374151' : 'rgba(255,255,255,0.88)')
    : 'white'

  // Mobile: button on LEFT edge, pill expands rightward (icon on left, text on right)
  // Desktop: button on RIGHT edge, pill expands leftward (text on left, icon on right)
  const posStyle = isMobile
    ? { position: 'fixed', bottom: 24, left: 20, zIndex: 9999 }
    : { position: 'fixed', bottom: 28, right: 24, zIndex: 9999 }

  // On desktop the pill grows leftward: we anchor the RIGHT edge (icon) and expand left
  // achieved by flex-direction row-reverse on desktop
  const flexDir = isMobile ? 'row' : 'row-reverse'

  const fab = (
    <div ref={ref} style={posStyle}>
      <div style={{
        display: 'flex',
        flexDirection: flexDir,
        alignItems: 'center',
        height: SZ,
        width: open ? EW : SZ,
        borderRadius: SZ / 2,
        overflow: 'hidden',
        transition: 'width 0.40s cubic-bezier(0.34,1.56,0.64,1), background 0.26s ease, box-shadow 0.26s ease',
        background: bg,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: shadow,
      }}>
        {/* Toggle icon button — always the anchor end */}
        <button
          onClick={handleToggle}
          title={open ? 'Collapse' : `New ${shortType}`}
          style={{
            width: SZ, height: SZ, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: 'none', border: 'none', outline: 'none',
          }}>
          <svg width={19} height={19} viewBox="0 0 24 24" fill="none"
            stroke={iconColor} strokeWidth={2.6} strokeLinecap="round"
            style={{
              transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
              transform: (open || isActive) ? 'rotate(45deg)' : 'rotate(0deg)',
            }}>
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        {/* Divider */}
        <div style={{
          width: 1, height: 26, flexShrink: 0,
          background: L ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.12)',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.18s ease',
        }} />

        {/* Create label */}
        <button
          onClick={handleCreate}
          style={{
            flex: 1, height: '100%',
            display: 'flex', alignItems: 'center',
            // On mobile text is to the right of icon; on desktop text is to the left of icon
            paddingLeft: isMobile ? 12 : 18,
            paddingRight: isMobile ? 18 : 12,
            gap: 5,
            cursor: 'pointer', background: 'none', border: 'none', outline: 'none',
            whiteSpace: 'nowrap',
            opacity: open ? 1 : 0,
            transform: open ? 'translateX(0)' : (isMobile ? 'translateX(-8px)' : 'translateX(8px)'),
            transition: 'opacity 0.22s ease 0.14s, transform 0.22s ease 0.14s',
            pointerEvents: open ? 'all' : 'none',
          }}>
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
            color: isActive
              ? (L ? '#6b7280' : 'rgba(255,255,255,0.50)')
              : (L ? '#1e293b' : 'rgba(255,255,255,0.92)'),
          }}>
            {isActive ? 'Close form' : `New ${shortType}`}
          </span>
          {!isActive && (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
              stroke={L ? '#94a3b8' : 'rgba(255,255,255,0.45)'}
              strokeWidth={2.5} strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )

  return createPortal(fab, document.body)
}

function Pill({ active, onClick, children }) {
  const { theme } = useTheme()
  const L = theme === 'light'
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-red-700 text-white'
          : L
            ? 'bg-black/5 text-gray-600 hover:text-gray-900 hover:bg-black/8'
            : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/8'
      }`}>
      {children}
    </button>
  )
}

// ── User Profile Modal ────────────────────────────────────────────────────────
function UserProfileModal({ user, onClose, onAction, currentUserRole }) {
  const [busy,       setBusy]       = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectMsg,  setRejectMsg]  = useState('')
  const [feedback,   setFeedback]   = useState('')
  const [dlBusy,     setDlBusy]     = useState(false)
  const [dlMsg,      setDlMsg]      = useState('')

  const academicYear = computeAcademicYear(user.startYear, user.endYear)
  const initials     = user.name.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  const dept         = user.department === 'OTHER' ? (user.departmentOther || 'Other') : user.department

  const act = async (fn, label) => {
    setBusy(true); setFeedback('')
    try { await fn(); setFeedback(`✓ ${label}`); onAction() }
    catch (e) { setFeedback(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  const handleDownload = async format => {
    setDlBusy(true); setDlMsg('Fetching data…')
    try {
      const uid = user._id
      const matchUid = (a, b) => String(a?._id || a) === String(b?._id || b)
      const [evData, coData, acData, pcData] = await Promise.all([
        eventsApi.list(),
        competitionsApi.list(),
        activitiesApi.list(),
        postcardsApi.list({ limit: 1000 }),
      ])
      const enrolledEvents = (evData.events || []).filter(e =>
        (e.members || []).some(m => matchUid(m.user, uid))
      )
      const enrolledComps = (coData.competitions || []).filter(c =>
        (c.volunteers || []).some(v => matchUid(v.user, uid))
      )
      const enrolledActs = (acData.activities || []).filter(a =>
        (a.volunteers || []).some(v => matchUid(v.user, uid))
      )
      const postcardCount = (pcData.postcards || []).filter(p => matchUid(p.photographer, uid)).length
      const getEventRole = e => { const m = (e.members || []).find(m => matchUid(m.user, uid)); return m?.eventRole || 'photographer' }
      const getCompRole  = c => { const v = (c.volunteers || []).find(v => matchUid(v.user, uid)); return v?.role || 'volunteer' }
      const getActRole   = a => { const v = (a.volunteers || []).find(v => matchUid(v.user, uid)); return v?.role || 'volunteer' }
      const data = {
        user, enrolledEvents, enrolledComps, enrolledActs, postcardCount,
        getEventRole, getCompRole, getActRole,
        academicYear: academicYear.label || '', dept,
      }
      if (format === 'csv') {
        await downloadCSV(data)
        setDlMsg('✓ Downloaded')
      } else {
        setDlMsg('Building PDF…')
        await downloadPDF({ ...data, onProgress: msg => setDlMsg(msg || 'Building PDF…') })
        setDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setDlMsg(`✗ ${e.message}`)
    } finally {
      if (format === 'csv') { setTimeout(() => setDlBusy(false), 1600) } else { setDlBusy(false) }
      setTimeout(() => setDlMsg(''), 3500)
    }
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative auth-glass w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col auth-sheet-mobile sm:auth-modal-desktop">

        {/* Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header — stays pinned */}
        <div className="p-5 border-b border-white/8 flex items-center justify-between shrink-0">
          <h3 className="font-clash text-lg font-semibold text-white">Member Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="p-5 space-y-5 overflow-y-auto no-scrollbar flex-1">
          {/* Avatar + basic info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/15 bg-gray-800 flex items-center justify-center shrink-0">
              {user.profilePhoto
                ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                : <span className="font-clash text-xl font-bold text-white">{initials}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-clash text-lg font-semibold text-white leading-tight">{user.name}</p>
              <p className="font-inter text-xs text-gray-500 truncate">{user.email}</p>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <Badge style={ROLE_BADGE[user.role] || ROLE_BADGE.photographer}>{user.role}</Badge>
                <Badge style={STATUS_BADGE[user.status] || ''}>{STATUS_LABEL[user.status] || user.status}</Badge>
                {academicYear.label && <Badge style="bg-white/5 text-gray-400 border-white/10">{academicYear.label}</Badge>}
              </div>
            </div>
          </div>

          {/* Download report */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mr-auto">Download Report</p>
            <GlassButton onClick={() => handleDownload('csv')} disabled={dlBusy}
              className="font-inter text-[11px] px-2.5 text-blue-400" style={{ borderRadius:'8px', minHeight:'26px' }}>
              ↓ Excel
            </GlassButton>
            <GlassButton onClick={() => handleDownload('pdf')} disabled={dlBusy}
              className="font-inter text-[11px] px-2.5 text-emerald-400" style={{ borderRadius:'8px', minHeight:'26px' }}>
              ↓ PDF
            </GlassButton>
            {dlMsg && (
              <p className={`font-inter text-[10px] ${dlMsg.startsWith('✓') ? 'text-green-400' : dlMsg.startsWith('✗') ? 'text-red-400' : 'text-gray-400 animate-pulse'}`}>
                {dlMsg}
              </p>
            )}
          </div>

          {/* Details grid */}
          <div className="auth-glass rounded-xl p-4 space-y-2.5">
            {[
              ['Department',    dept],
              ['Enrollment No.',user.enrollmentNumber],
              ['Roll Number',   user.rollNumber],
              ['Programme',     `${user.startYear} – ${user.endYear}`],
              ['Academic Year', academicYear.label || '—'],
              ['Joined',        new Date(user.createdAt).toLocaleDateString('en-IN')],
            ].map(([k,v]) => v && (
              <div key={k} className="flex justify-between items-center border-b border-white/5 last:border-0 pb-2 last:pb-0">
                <span className="font-inter text-[11px] text-gray-500 uppercase tracking-wider">{k}</span>
                <span className="font-inter text-sm text-white">{v}</span>
              </div>
            ))}
            {user.bio && <p className="font-inter text-xs text-gray-400 pt-1 italic">"{user.bio}"</p>}
          </div>

          {/* Devices */}
          {user.devices?.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Gear</p>
              {user.devices.map((d,i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-inter text-gray-300">
                  <span className="font-inter text-[10px] text-gray-500">{d.type === 'camera' ? 'CAM' : d.type === 'lens' ? 'LENS' : 'GEAR'}</span>
                  <span>{d.name}{d.brand ? ` — ${d.brand}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {user.role !== 'admin' && (
            <div className="space-y-2">
              <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Actions</p>
              <div className="flex flex-wrap gap-2">
                {user.status === 'pending_admin' && (
                  <>
                    <GlassButton onClick={() => act(() => adminApi.approve(user._id), 'Approved')} disabled={busy}
                      className="font-inter text-xs px-3 text-emerald-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      ✓ Approve
                    </GlassButton>
                    <GlassButton onClick={() => setRejectOpen(r => !r)} disabled={busy}
                      className="font-inter text-xs px-3 text-red-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      ✗ Reject
                    </GlassButton>
                  </>
                )}

                {/* Role promotion */}
                {user.status === 'approved' && user.role === 'photographer' && (
                  <GlassButton onClick={() => act(() => adminApi.promote(user._id, 'coordinator'), 'Promoted')} disabled={busy}
                    className="font-inter text-xs px-3 text-blue-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    ↑ Coordinator
                  </GlassButton>
                )}
                {user.status === 'approved' && ['photographer','coordinator'].includes(user.role) && currentUserRole === 'admin' && (
                  <GlassButton onClick={() => act(() => adminApi.promote(user._id, 'core'), 'Promoted to Core')} disabled={busy}
                    className="font-inter text-xs px-3 text-amber-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    ↑ Core
                  </GlassButton>
                )}
                {user.status === 'approved' && user.role !== 'photographer' && (
                  <GlassButton onClick={() => act(() => adminApi.demote(user._id), 'Demoted')} disabled={busy}
                    className="font-inter text-xs px-3 text-gray-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    ↓ Demote
                  </GlassButton>
                )}

                {/* Ban / Unban */}
                {user.status !== 'banned' ? (
                  <GlassButton onClick={() => act(() => adminApi.ban(user._id), 'Banned')} disabled={busy}
                    className="font-inter text-xs px-3 text-orange-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    Ban
                  </GlassButton>
                ) : (
                  <GlassButton onClick={() => act(() => adminApi.unban(user._id), 'Unbanned')} disabled={busy}
                    className="font-inter text-xs px-3 text-green-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    ✓ Unban
                  </GlassButton>
                )}

                {/* Delete */}
                {currentUserRole === 'admin' && (
                  <GlassButton onClick={() => setDelConfirm(d => !d)} disabled={busy}
                    className="font-inter text-xs px-3 text-red-500" style={{ borderRadius:'9px', minHeight:'32px' }}>
                    🗑 Delete
                  </GlassButton>
                )}
              </div>

              {rejectOpen && (
                <div className="space-y-2 p-3 auth-glass rounded-xl border border-red-900/30">
                  <input value={rejectMsg} onChange={e => setRejectMsg(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="glass-input w-full text-sm" style={{ borderRadius:'9px' }} />
                  <div className="flex gap-2">
                    <GlassButton onClick={() => act(() => adminApi.reject(user._id, rejectMsg), 'Rejected')} disabled={busy}
                      className="flex-1 font-inter text-xs text-red-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      Confirm Reject
                    </GlassButton>
                    <GlassButton onClick={() => setRejectOpen(false)}
                      className="flex-1 font-inter text-xs" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      Cancel
                    </GlassButton>
                  </div>
                </div>
              )}

              {delConfirm && (
                <div className="p-3 auth-glass rounded-xl border border-red-900/40 space-y-2">
                  <p className="font-inter text-xs text-red-300">Permanently delete {user.name}? Cannot be undone.</p>
                  <div className="flex gap-2">
                    <GlassButton onClick={() => act(() => adminApi.deleteUser(user._id), 'Deleted')} disabled={busy}
                      className="flex-1 font-inter text-xs text-red-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      Yes, Delete Forever
                    </GlassButton>
                    <GlassButton onClick={() => setDelConfirm(false)}
                      className="flex-1 font-inter text-xs" style={{ borderRadius:'9px', minHeight:'32px' }}>
                      Cancel
                    </GlassButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {feedback && (
            <p className={`font-inter text-xs text-center ${feedback.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{feedback}</p>
          )}
        </div>
      </div>
      <DownloadingOverlay visible={dlBusy} message={dlMsg} />
    </div>
  )
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab({ currentUserRole, L }) {
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filters,     setFilters]     = useState({ status:'', role:'', department:'', year:'' })
  const [selectedUser,setSelectedUser]= useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bulkDlOpen,  setBulkDlOpen]  = useState(false)
  const [bulkDlBusy,  setBulkDlBusy]  = useState(false)
  const [bulkDlMsg,   setBulkDlMsg]   = useState('')

  const _curSessBase = Number(currentSession().split('-')[0])
  const [sessionBase, setSessionBase] = useState(_curSessBase)

  const STATUS_OPTIONS = ['', 'approved', 'pending_admin', 'pending_email', 'rejected', 'banned', 'passout']
  const ROLE_OPTIONS   = ['', 'admin', 'core', 'coordinator', 'photographer']
  const DEPT_OPTIONS   = ['', 'BBA', 'BTECH', 'MTECH', 'BCA', 'LLB', 'MBA', 'OTHER']

  const [fetchError, setFetchError] = useState('')

  const fetchUsers = useCallback(async (silent) => {
    if (!silent) { setLoading(true); setFetchError('') }
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.role)   params.role   = filters.role
      if (search)         params.q      = search
      const data = await adminApi.getUsers(params)
      setUsers(data.users || [])
    } catch (e) {
      if (!silent) {
        console.error('[UsersTab] fetch error:', e)
        setFetchError(e.message || 'Failed to load users — check server logs.')
      }
    }
    finally { if (!silent) setLoading(false) }
  }, [filters, search])

  useEffect(() => { const t = setTimeout(() => fetchUsers(false), 300); return () => clearTimeout(t) }, [fetchUsers])

  // Live refresh — picks up new signups / status changes from elsewhere (skip while a user panel is open)
  useEffect(() => {
    const poll = setInterval(() => { if (!selectedUser) fetchUsers(true) }, 15000)
    return () => clearInterval(poll)
  }, [fetchUsers, selectedUser])

  const sessionUsers = sessionBase === 0
    ? users
    : users.filter(u => Number(u.startYear) <= sessionBase && Number(u.endYear) > sessionBase)

  const ROLE_RANK = { admin: -1, core: 0, coordinator: 1, photographer: 2 }

  const filtered = sessionUsers.filter(u => {
    if (filters.department && u.department !== filters.department) return false
    if (filters.year) {
      const yr = computeAcademicYear(u.startYear, u.endYear)
      if (filters.year === 'passout' && !yr.isPassout) return false
      if (filters.year !== 'passout' && yr.year !== Number(filters.year)) return false
    }
    return true
  }).sort((a, b) => {
    const rA = ROLE_RANK[a.role] ?? 2
    const rB = ROLE_RANK[b.role] ?? 2
    if (rA !== rB) return rA - rB
    // Within same role: senior year first (lower startYear = further along = 4th year before 1st)
    const sA = Number(a.startYear) || 9999
    const sB = Number(b.startYear) || 9999
    if (sA !== sB) return sA - sB
    return (a.name || '').localeCompare(b.name || '')
  })

  const members = sessionUsers.filter(u => u.role !== 'admin')
  const stats = {
    total:    members.length,
    approved: members.filter(u => u.status === 'approved').length,
    pending:  members.filter(u => u.status === 'pending_admin').length,
    banned:   members.filter(u => u.status === 'banned').length,
  }

  const sessionOptions = (() => {
    const minStart = users.length ? Math.min(...users.map(u => Number(u.startYear) || _curSessBase)) : _curSessBase
    const opts = []
    for (let y = _curSessBase; y >= Math.max(minStart, _curSessBase - 6); y--) opts.push(y)
    return opts
  })()

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: f[k] === v ? '' : v }))

  const handleBulkDownload = async format => {
    setBulkDlBusy(true); setBulkDlMsg('Fetching data…')
    try {
      const [evData, coData, acData] = await Promise.all([
        eventsApi.list(), competitionsApi.list(), activitiesApi.list(),
      ])
      const allEvents = evData.events || []
      const allComps  = coData.competitions || []
      const allActs   = acData.activities || []
      if (format === 'csv') {
        await downloadAdminBulkCSV({ members: sessionUsers, events: allEvents, comps: allComps, acts: allActs })
        setBulkDlMsg('✓ Downloaded')
      } else {
        await downloadAdminBulkPDF({
          members: sessionUsers, events: allEvents, comps: allComps, acts: allActs,
          onProgress: msg => setBulkDlMsg(msg || 'Building PDF…'),
        })
        setBulkDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setBulkDlMsg(`✗ ${e.message}`)
    } finally {
      if (format === 'csv') { setTimeout(() => setBulkDlBusy(false), 1600) } else { setBulkDlBusy(false) }
      setTimeout(() => { setBulkDlMsg(''); setBulkDlOpen(false) }, 3500)
    }
  }

  const dept = u => u.department === 'OTHER' ? (u.departmentOther || 'Other') : u.department

  return (
    <div className="space-y-5">
      {/* Bulk download */}
      <div className="flex items-center gap-2">
        <button onClick={() => setBulkDlOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all border ${
            bulkDlOpen
              ? 'bg-red-700/20 text-red-400 border-red-700/40'
              : `${L?'border-black/10 bg-black/5':'border-white/8 bg-white/5'} text-gray-400 hover:text-white`
          }`}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All Members Report
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            className={`transition-transform duration-200 ${bulkDlOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {bulkDlOpen && (
        <div className={`p-4 rounded-xl border space-y-3 ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>All Members Report</p>
              <p className="font-inter text-[10px] text-gray-500 mt-0.5">{sessionUsers.filter(u => u.role !== 'admin').length} members · CSV exports a participation matrix, PDF generates per-member activity cards</p>
            </div>
          </div>
          {bulkDlMsg && (
            <p className={`font-inter text-xs ${bulkDlMsg.startsWith('✓') ? 'text-green-400' : bulkDlMsg.startsWith('✗') ? 'text-red-400' : 'text-gray-400 animate-pulse'}`}>
              {bulkDlMsg}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <GlassButton onClick={() => handleBulkDownload('csv')} disabled={bulkDlBusy}
              className="font-inter text-xs px-4 text-blue-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {bulkDlBusy ? '…' : '↓ Excel Matrix'}
            </GlassButton>
            <GlassButton onClick={() => handleBulkDownload('pdf')} disabled={bulkDlBusy}
              className="font-inter text-xs px-4 text-emerald-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {bulkDlBusy ? '…' : '↓ PDF Report'}
            </GlassButton>
            <GlassButton onClick={() => { setBulkDlOpen(false); setBulkDlMsg('') }} disabled={bulkDlBusy}
              className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'32px' }}>
              Cancel
            </GlassButton>
          </div>
        </div>
      )}

      {/* Session filter */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="font-inter text-[10px] text-gray-500 uppercase tracking-wider shrink-0">Session</span>
        {sessionOptions.map(y => (
          <Pill key={y} active={sessionBase === y} onClick={() => setSessionBase(y)}>
            {`${y}-${String(y + 1).slice(-2)}`}{y === _curSessBase ? ' ·current' : ''}
          </Pill>
        ))}
        <Pill active={sessionBase === 0} onClick={() => setSessionBase(0)}>All</Pill>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total',    val: stats.total,    color:'text-white'        },
          { label:'Approved', val: stats.approved, color:'text-emerald-400'  },
          { label:'Pending',  val: stats.pending,  color:'text-yellow-400'   },
          { label:'Banned',   val: stats.banned,   color:'text-red-400'      },
        ].map(s => (
          <div key={s.label} className={`auth-glass rounded-xl p-3 text-center border ${L ? 'border-black/7' : 'border-white/7'}`}>
            <p className={`font-clash text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="font-inter text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="font-inter text-xs text-red-400">{fetchError}</p>
          <button onClick={fetchUsers} className="ml-auto font-inter text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search name, email, enrollment…"
        className="glass-input w-full" style={{ borderRadius:'12px' }} />

      {/* Filters */}
      <div className="space-y-2">
        {/* Status — always visible */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="font-inter text-[10px] text-gray-500 uppercase tracking-wider shrink-0">Status</span>
          {[
            ['approved',      'Approved'],
            ['pending_admin', 'Awaiting'],
            ['pending_email', 'Unverified'],
            ['rejected',      'Rejected'],
            ['banned',        'Banned'],
            ['passout',       'Passout'],
          ].map(([val, lbl]) => (
            <Pill key={val} active={filters.status === val} onClick={() => setFilter('status', val)}>{lbl}</Pill>
          ))}
        </div>

        {/* Filter button + expanded panel */}
        <div className="space-y-2">
          {/* Toggle row */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const n = [filters.role, filters.department, filters.year].filter(Boolean).length
              return (
                <button
                  onClick={() => setFiltersOpen(o => !o)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all border ${
                    filtersOpen || n > 0
                      ? 'bg-red-700/20 text-red-400 border-red-700/40'
                      : `${L?'border-black/10 bg-black/5':'border-white/8 bg-white/5'} text-gray-400 hover:text-white`
                  }`}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                  </svg>
                  Filters
                  {n > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{n}</span>
                  )}
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                    className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              )
            })()}
            {(filters.status || filters.role || filters.department || filters.year || search) && (
              <button onClick={() => { setFilters({status:'',role:'',department:'',year:''}); setSearch(''); setFiltersOpen(false) }}
                className="font-inter text-[11px] text-red-400 hover:text-red-300 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* Expanded panel */}
          {filtersOpen && (
            <div className={`space-y-3 p-3 rounded-xl border ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="font-inter text-[10px] text-gray-600 uppercase tracking-wider w-10 shrink-0">Role</span>
                {['photographer','coordinator','core','admin'].map(r => (
                  <Pill key={r} active={filters.role === r} onClick={() => setFilter('role', r)}
                    >{r.charAt(0).toUpperCase()+r.slice(1)}</Pill>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="font-inter text-[10px] text-gray-600 uppercase tracking-wider w-10 shrink-0">Dept</span>
                {['BBA','BTECH','MTECH','BCA','LLB','MBA','OTHER'].map(d => (
                  <Pill key={d} active={filters.department === d} onClick={() => setFilter('department', d)}>{d}</Pill>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="font-inter text-[10px] text-gray-600 uppercase tracking-wider w-10 shrink-0">Year</span>
                {['1','2','3','4','passout'].map(y => (
                  <Pill key={y} active={filters.year === y} onClick={() => setFilter('year', y)}>
                    {y === 'passout' ? 'Passout' : `${y}${['st','nd','rd','th'][Number(y)-1]} Year`}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table / Card list */}
      {loading ? (
        <SkeletonGrid n={4} />
      ) : filtered.length === 0 ? (
        <div className={`py-14 text-center auth-glass rounded-2xl border ${L ? 'border-black/7' : 'border-white/7'}`}>
          <p className="font-inter text-sm text-gray-500">No users match the selected filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden sm:block auth-glass rounded-2xl border overflow-hidden ${L ? 'border-black/8' : 'border-white/8'}`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${L ? 'border-black/8 bg-black/2' : 'border-white/8 bg-white/3'}`}>
                  {['#','Member','Dept','Year','Role','Status','Actions'].map(h => (
                    <th key={h} className="font-inter text-[10px] uppercase tracking-widest text-gray-500 px-4 py-3 text-left first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => { let serial = 0; return filtered.map(u => {
                  const isAdminRow = u.role === 'admin'
                  if (!isAdminRow) serial++
                  const yr = computeAcademicYear(u.startYear, u.endYear)
                  return (
                    <tr key={u._id}
                      onClick={() => setSelectedUser(u)}
                      className={`border-b cursor-pointer transition-colors last:border-0 ${
                        isAdminRow
                          ? L ? 'border-amber-200/40 bg-amber-50/60 hover:bg-amber-50' : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
                          : L ? 'border-black/5 hover:bg-black/3' : 'border-white/5 hover:bg-white/3'
                      }`}>
                      <td className="px-4 py-3 pl-5">
                        <span className={`font-inter text-xs ${isAdminRow ? 'text-amber-500/70' : 'text-gray-500'}`}>
                          {isAdminRow ? '⚙' : serial}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full overflow-hidden border flex items-center justify-center shrink-0 ${isAdminRow ? 'bg-amber-900/30 border-amber-500/30' : 'bg-gray-800 border-white/10'}`}>
                            {u.profilePhoto
                              ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                              : <span className={`font-clash text-xs font-bold ${isAdminRow ? 'text-amber-400' : 'text-white'}`}>{u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-inter text-sm font-medium truncate ${isAdminRow ? 'text-amber-300' : L ? 'text-gray-900' : 'text-white'}`}>{u.name}</p>
                            <p className={`font-inter text-[10px] truncate ${isAdminRow ? 'text-amber-500/70' : 'text-gray-500'}`}>
                              {isAdminRow ? 'System Control Account' : u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-inter text-xs text-gray-400">{isAdminRow ? '—' : dept(u)}</span></td>
                      <td className="px-4 py-3"><span className="font-inter text-xs text-gray-400">{isAdminRow ? '—' : yr.isPassout ? 'Passout' : yr.label}</span></td>
                      <td className="px-4 py-3"><Badge style={ROLE_BADGE[u.role] || ROLE_BADGE.photographer}>{u.role}</Badge></td>
                      <td className="px-4 py-3"><Badge style={STATUS_BADGE[u.status] || ''}>{STATUS_LABEL[u.status] || u.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                          {!isAdminRow && (
                            <Link to={`/members/${u._id}`}
                              className="font-inter text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                              style={{ background:'rgba(59,130,246,0.12)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.2)' }}>
                              See Profile
                            </Link>
                          )}
                          <span className="font-inter text-xs text-gray-500 hover:text-white transition-colors cursor-pointer"
                            onClick={e => { e.stopPropagation(); setSelectedUser(u) }}>
                            View →
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })})()}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(u => {
              const yr = computeAcademicYear(u.startYear, u.endYear)
              const isAdminRow = u.role === 'admin'
              return (
                <div key={u._id}
                  className={`flex items-center gap-3 p-3.5 auth-glass rounded-2xl border ${L ? 'border-black/8' : 'border-white/8'}`}>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-white/10 flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => setSelectedUser(u)}>
                    {u.profilePhoto
                      ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                      : <span className="font-clash text-sm font-bold text-white">{u.name[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <p className={`font-inter text-sm font-medium ${L ? 'text-gray-900' : 'text-white'} truncate`}>{u.name}</p>
                    <p className="font-inter text-[10px] text-gray-500 truncate">{dept(u)} · {yr.isPassout ? 'Passout' : yr.label}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    <Badge style={ROLE_BADGE[u.role] || ROLE_BADGE.photographer}>{u.role}</Badge>
                    <Badge style={STATUS_BADGE[u.status] || ''}>{STATUS_LABEL[u.status] || u.status}</Badge>
                    {!isAdminRow && (
                      <Link to={`/members/${u._id}`}
                        className="font-inter text-[9px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                        style={{ background:'rgba(59,130,246,0.12)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.2)' }}>
                        See Profile
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="font-inter text-[11px] text-gray-600 text-center">{filtered.filter(u => u.role !== 'admin').length} members shown</p>
        </>
      )}

      {/* Past Members section removed — use the "Passout" status filter pill instead */}
      {false && (() => {
        const byYear = {}
        const years = []
        return (
          <div className={`rounded-2xl border overflow-hidden ${L ? 'border-black/8' : 'border-white/8'}`}>
            {/* Toggle header */}
            <button
              onClick={togglePastTable}
              className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 transition-colors ${
                L ? 'bg-black/[0.02] hover:bg-black/[0.04]' : 'bg-white/[0.02] hover:bg-white/[0.04]'
              }`}>
              <div className="flex items-center gap-2.5">
                <span className="font-inter text-sm font-semibold" style={{ color:'rgba(180,140,60,0.85)' }}>
                  Past Members
                </span>
                {passoutFetched && (
                  <span className="font-inter text-[10px] text-gray-500">
                    · {passoutUsers.length} alumni
                  </span>
                )}
              </div>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                style={{ color:'rgba(180,140,60,0.6)', transition:'transform 250ms', transform: pastTableOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Collapsible body */}
            {pastTableOpen && (
              <div className={`border-t ${L ? 'border-black/8' : 'border-white/8'}`}>
                {passoutLoading2 ? (
                  <p className="py-10 text-center font-inter text-sm text-gray-500 animate-pulse">Loading alumni…</p>
                ) : passoutUsers.length === 0 ? (
                  <p className="py-10 text-center font-inter text-sm text-gray-500">No past members yet.</p>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={`border-b ${L ? 'border-black/8 bg-black/2' : 'border-white/8 bg-white/3'}`}>
                            {['Member','Dept','Year','Role','Status','Actions'].map(h => (
                              <th key={h} className="font-inter text-[10px] uppercase tracking-widest text-gray-500 px-4 py-3 text-left first:pl-5">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {years.map(year => [
                            // Year group header row
                            <tr key={`hdr-${year}`}>
                              <td colSpan={6} className={`px-5 py-2 border-b ${L ? 'border-black/5 bg-amber-50/40' : 'border-white/5 bg-amber-900/10'}`}>
                                <span className="font-inter text-[10px] font-semibold uppercase tracking-[0.2em]"
                                  style={{ color:'rgba(180,140,60,0.7)' }}>
                                  Passout {year} · {byYear[year].length} members
                                </span>
                              </td>
                            </tr>,
                            // Member rows for this year
                            ...byYear[year].map(u => (
                              <tr key={u._id}
                                onClick={() => setSelectedUser(u)}
                                className={`border-b cursor-pointer transition-colors ${L ? 'border-black/5 hover:bg-black/3' : 'border-white/5 hover:bg-white/3'} last:border-0`}>
                                <td className="px-4 py-3 pl-5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 flex items-center justify-center shrink-0"
                                      style={{ filter:'grayscale(1) brightness(0.85)' }}>
                                      {u.profilePhoto
                                        ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                                        : <span className="font-clash text-xs font-bold text-white">{u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`font-inter text-sm font-medium truncate ${L ? 'text-gray-500' : 'text-gray-400'}`}>{u.name}</p>
                                      <p className="font-inter text-[10px] text-gray-600 truncate">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3"><span className="font-inter text-xs text-gray-500">{dept(u)}</span></td>
                                <td className="px-4 py-3">
                                  <span className="font-inter text-xs" style={{ color:'rgba(180,140,60,0.7)' }}>
                                    Passout {year || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3"><Badge style={ROLE_BADGE[u.role] || ROLE_BADGE.photographer}>{u.role}</Badge></td>
                                <td className="px-4 py-3"><Badge style={STATUS_BADGE.passout}>{STATUS_LABEL.passout}</Badge></td>
                                <td className="px-4 py-3">
                                  <span className="font-inter text-xs text-gray-600 hover:text-white transition-colors">View →</span>
                                </td>
                              </tr>
                            ))
                          ])}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2 p-3">
                      {years.map(year => (
                        <div key={year}>
                          <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.18em] px-1 py-2"
                            style={{ color:'rgba(180,140,60,0.65)' }}>
                            Passout {year} · {byYear[year].length}
                          </p>
                          <div className="space-y-2">
                            {byYear[year].map(u => (
                              <div key={u._id} onClick={() => setSelectedUser(u)}
                                className={`flex items-center gap-3 p-3.5 auth-glass rounded-2xl border cursor-pointer ${L ? 'border-black/8' : 'border-white/8'}`}>
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-white/10 flex items-center justify-center shrink-0"
                                  style={{ filter:'grayscale(1) brightness(0.85)' }}>
                                  {u.profilePhoto
                                    ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                                    : <span className="font-clash text-sm font-bold text-white">{u.name[0]}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-inter text-sm font-medium truncate ${L ? 'text-gray-500' : 'text-gray-400'}`}>{u.name}</p>
                                  <p className="font-inter text-[10px] text-gray-600 truncate">{dept(u)} · Passout {u.endYear || '—'}</p>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                  <Badge style={ROLE_BADGE[u.role] || ROLE_BADGE.photographer}>{u.role}</Badge>
                                  <Badge style={STATUS_BADGE.passout}>{STATUS_LABEL.passout}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="font-inter text-[11px] text-gray-600 text-center py-3">{passoutUsers.length} alumni</p>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {selectedUser && createPortal(
        <UserProfileModal
          user={selectedUser}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedUser(null)}
          onAction={() => { fetchUsers(); setSelectedUser(null) }}
        />,
        document.body
      )}
      <DownloadingOverlay visible={bulkDlBusy} message={bulkDlMsg} />
    </div>
  )
}

// ── Postcard thumbnail (used inside PostcardsTab) ─────────────────────────────
function PostcardThumb({ card, onDelete, onView }) {
  const imgs = card.images?.length
    ? card.images.map(img => (typeof img === 'string' ? img : img.url))
    : card.imageUrl ? [card.imageUrl] : []
  const thumb = imgs[0]

  return (
    <div className="relative group rounded-xl overflow-hidden cursor-pointer"
         style={{ background:'#fff', padding:'4px 4px 20px', boxShadow:'0 2px 10px rgba(0,0,0,0.25)' }}>
      {thumb
        ? <div className="relative w-full aspect-[4/5] overflow-hidden rounded-lg cursor-pointer" onClick={() => onView?.(card)}>
            <ProgressiveImage src={thumb} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        : <div className="w-full aspect-[4/5] bg-gray-900 rounded-lg flex items-center justify-center"><svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.4}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
      }
      {imgs.length > 1 && (
        <span className="absolute top-1.5 left-1.5 font-inter text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background:'rgba(0,0,0,0.6)' }}>
          ×{imgs.length}
        </span>
      )}
      <p className="absolute bottom-1 left-0 right-0 text-center font-clash text-[9px] font-bold text-gray-700 truncate px-1">
        {card.photographer?.name}
      </p>
      <button
        onClick={() => onDelete?.(card)}
        className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-white text-[9px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex">
        ✕
      </button>
    </div>
  )
}

// ── POSTCARDS TAB ─────────────────────────────────────────────────────────────
function PostcardsTab({ L }) {
  const { user }                      = useAuth()
  const [sections,    setSections]    = useState([])
  const [postcards,   setPostcards]   = useState([])
  const [activeSection, setActiveSection] = useState('all')
  const [newSection,  setNewSection]  = useState('')
  const [creating,    setCreating]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [lightbox,    setLightbox]    = useState(null)
  const [uploadSect,  setUploadSect]  = useState('')
  const [uploading,   setUploading]   = useState(false)
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState('')
  const [confirm,     setConfirm]     = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([postcardsApi.getSections(), postcardsApi.list()])
      setSections(s.sections); setPostcards(p.postcards)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const createSection = async () => {
    if (!newSection.trim()) return; setBusy(true)
    try { await postcardsApi.createSection({ name: newSection }); setNewSection(''); setCreating(false); fetchAll() }
    catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  const doDeleteSection  = async () => {
    await postcardsApi.deleteSection(confirm.id).catch(()=>{})
    if (activeSection === confirm.id) setActiveSection('general')
    setConfirm(null); fetchAll()
  }
  const doDeletePostcard = async () => { await postcardsApi.delete(confirm.id).catch(()=>{}); setPostcards(p=>p.filter(x=>x._id!==confirm.id)); setConfirm(null) }

  const handleAdminUpload = async (files) => {
    if (!files?.length) return
    setUploading(true); setMsg('')
    try {
      for (const file of Array.from(files)) {
        const { key, publicUrl } = await uploadFileToS3(file, 'postcards')
        await postcardsApi.upload({ imageUrl: publicUrl, s3Key: key, section: uploadSect || undefined })
      }
      fetchAll()
    } catch (e) { setMsg(e.message) } finally { setUploading(false) }
  }

  const generalCountPc = postcards.filter(p => !p.section?._id && !p.section).length
  const filtered = activeSection === 'all'
    ? postcards
    : activeSection === 'general'
      ? postcards.filter(p => !p.section?._id && !p.section)
      : postcards.filter(p => p.section?._id === activeSection)

  return (
    <div className="space-y-5">
      <div className={`auth-glass rounded-2xl p-4 border ${L?'border-black/8':'border-white/8'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Sections ({sections.length})</p>
          <GlassButton onClick={() => setCreating(c=>!c)} className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'30px' }}>+ New Section</GlassButton>
        </div>
        {creating && (
          <div className="pt-3 space-y-2">
            <input value={newSection} onChange={e=>setNewSection(e.target.value)}
              className="glass-input w-full text-sm" placeholder="Section name..." style={{ borderRadius:'9px' }} />
            <div className="flex gap-2">
              <GlassButton onClick={createSection} variant="red" disabled={busy||!newSection.trim()}
                className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'32px' }}>Create</GlassButton>
              <GlassButton onClick={()=>{setCreating(false);setNewSection('')}}
                className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'32px' }}>Cancel</GlassButton>
            </div>
            {msg&&<p className="font-inter text-xs text-red-400">{msg}</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
          <button onClick={()=>setActiveSection('all')}
            className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection==='all'?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
            All ({postcards.length})
          </button>
          <button onClick={()=>setActiveSection('general')}
            className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection==='general'?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
            General ({generalCountPc})
          </button>
          {sections.map(s=>(
            <div key={s._id} className="flex items-center gap-1">
              <button onClick={()=>setActiveSection(s._id)}
                className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection===s._id?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
                {s.name} ({postcards.filter(p=>p.section?._id===s._id).length})
              </button>
              <button onClick={()=>setConfirm({type:'section',id:s._id,name:s.name})}
                className="text-gray-700 hover:text-red-400 text-xs transition-colors ml-1">x</button>
            </div>
          ))}
        </div>
      </div>
      <div className={`auth-glass rounded-2xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Upload Postcard</p>
        <select value={uploadSect} onChange={e=>setUploadSect(e.target.value)}
          className="glass-input w-full text-sm appearance-none" style={{ borderRadius:'9px' }}>
          <option value="">General</option>
          {sections.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <label className={`block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ${L?'border-black/12 hover:border-red-600/30':'border-white/10 hover:border-red-600/30'}`}>
          <div className="flex items-center justify-center py-5 text-gray-500">
            {uploading?<p className="font-inter text-sm animate-pulse">Uploading...</p>:<p className="font-inter text-sm">Click or drag to upload</p>}
          </div>
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
            onChange={e=>handleAdminUpload(e.target.files)} />
        </label>
      </div>
      {loading ? (
        <SkeletonList n={4} />
      ) : filtered.length === 0 ? (
        <p className={`text-center py-8 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No postcards yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(c=>(
            <PostcardThumb key={c._id} card={c}
              onDelete={()=>setConfirm({type:'postcard',id:c._id,name:c.photographer?.name||'photo'})}
              onView={setLightbox} />
          ))}
        </div>
      )}
      {lightbox && (
        <Lightbox
          photos={[{ url: lightbox.imageUrl || lightbox.url || '' }]}
          startIndex={0}
          onClose={() => setLightbox(null)}
        />
      )}
      <ConfirmDialog open={!!confirm} title={confirm?.type==='section'?`Delete "${confirm?.name}"?`:'Delete Postcard?'}
        message={confirm?.type==='section'
          ? `All postcards in this section will be moved to General. The section itself will be permanently deleted.`
          : confirm ? `Delete "${confirm.name}"?` : ''}
        confirmLabel="Yes, Delete" onConfirm={confirm?.type==='section'?doDeleteSection:doDeletePostcard}
        onCancel={()=>setConfirm(null)} />
    </div>
  )
}
// ── EVENTS ADMIN TAB ─────────────────────────────────────────────────────────
function EventsTab({ currentUser, L }) {
  const [events,      setEvents]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [eventFilter,   setEventFilter]   = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [creating,    setCreating]    = useState(false)
  const [busy,        setBusy]        = useState(false)
  const [createMsg,   setCreateMsg]   = useState('')
  const [newForm,     setNewForm]     = useState({ name:'', description:'', venue:'', startDate:'', endDate:'', eventDates:[], manualStatus:false, status:'', isOpenToAll:false })
  const [showPastSetting, setShowPastSetting] = useState(true)
  const [settingBusy, setSettingBusy] = useState(false)

  useEffect(() => {
    settingsApi.getSections().then(d => {
      setShowPastSetting(d?.sections?.['show-past-events'] !== false)
    }).catch(() => {})
  }, [])

  const toggleShowPast = async () => {
    const next = !showPastSetting
    setSettingBusy(true)
    try {
      await settingsApi.setSectionVisible('show-past-events', next)
      setShowPastSetting(next)
    } catch (e) { console.error(e) }
    finally { setSettingBusy(false) }
  }

  const [tabDlOpen, setTabDlOpen] = useState(false)
  const [tabDlBusy, setTabDlBusy] = useState(false)
  const [tabDlMsg,  setTabDlMsg]  = useState('')

  const fetchEvents = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try { const d = await eventsApi.list(); setEvents(d.events || []) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents(false) }, [fetchEvents])

  // Live refresh of the list while browsing it (skip while inside an event's manager view)
  useEffect(() => {
    const poll = setInterval(() => { if (!selected) fetchEvents(true) }, 15000)
    return () => clearInterval(poll)
  }, [fetchEvents, selected])

  const isCreateDirty = creating && !!(newForm.name.trim() || newForm.description.trim() || newForm.venue.trim() || newForm.startDate || newForm.endDate || newForm.eventDates.length > 0)
  const createBlocker = useUnsavedGuard(isCreateDirty)

  const doDelete = async () => {
    if (!deleteConfirm) return
    try { await eventsApi.delete(deleteConfirm._id) } catch (e) { console.error(e) }
    setDeleteConfirm(null)
    fetchEvents()
  }

  const createEvent = async () => {
    if (!newForm.name.trim()) return setCreateMsg('Event name is required.')
    setBusy(true); setCreateMsg('')
    try {
      const body = { name: newForm.name, description: newForm.description, venue: newForm.venue, isOpenToAll: newForm.isOpenToAll, manualStatus: newForm.manualStatus }
      if (newForm.startDate) body.startDate = newForm.startDate
      if (newForm.endDate)   body.endDate   = newForm.endDate
      if (newForm.eventDates?.length) { body.eventDates = newForm.eventDates; body.eventDate = newForm.eventDates[0] }
      if (newForm.manualStatus) body.status = newForm.status || ''
      const d = await eventsApi.create(body)
      setCreating(false)
      setNewForm({ name:'', description:'', venue:'', startDate:'', endDate:'', eventDates:[], manualStatus:false, status:'', isOpenToAll:false })
      fetchEvents()
      setSelected(d.event)
    } catch (e) { setCreateMsg(e.message || 'Failed to create event.') }
    finally { setBusy(false) }
  }

  const handleTabEventsDownload = async (fmt) => {
    setTabDlBusy(true); setTabDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      // Fetch full user list to populate event.memberIds
      const membersData = await membersApi.list()
      const userMap = {}
      for (const u of membersData.members) userMap[u._id] = u
      // Build items array: [{item, members:[{user, role}]}] — current session only
      const itemsArr = events.filter(ev => isCurrentSession(ev)).map(ev => {
        const members = (ev.memberIds || []).map(uid => {
          const uidStr = String(uid?._id || uid)
          const u = userMap[uidStr]
          if (!u) return null
          const m = (ev.members || []).find(m => String(m.user?._id || m.user) === uidStr)
          return { user: u, role: m?.eventRole || 'photographer' }
        }).filter(Boolean)
        return { item: ev, members }
      })
      if (fmt === 'csv') {
        await downloadAllItemsCSV({ items: itemsArr, itemType: 'event' })
        setTabDlMsg('✓ Downloaded')
      } else {
        await downloadAllItemsPDF({ items: itemsArr, itemType: 'event', onProgress: msg => setTabDlMsg(msg || 'Building PDF…') })
        setTabDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setTabDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setTabDlBusy(false), 1600) } else { setTabDlBusy(false) }
      setTimeout(() => { setTabDlMsg(''); setTabDlOpen(false) }, 3500)
    }
  }

  if (selected) {
    return <EventManager event={selected} onBack={() => { setSelected(null); fetchEvents() }} currentUser={currentUser} L={L} />
  }

  const STATUS_CLS = {
    upcoming: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
    ongoing:  'text-green-400 bg-green-900/20 border-green-800/30',
    past:     'text-gray-400 bg-gray-800/30 border-gray-700/30',
  }

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
  const ec = { all: sessionItems.length, upcoming: sessionItems.filter(e=>e.status==='upcoming').length, ongoing: sessionItems.filter(e=>e.status==='ongoing').length, past: sessionItems.filter(e=>e.status==='past').length }
  const filtered = eventFilter === 'all' ? sessionItems : sessionItems.filter(e => e.status === eventFilter)

  const EventCard = ({ e, dim = false }) => (
    <div key={e._id} className={`group auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'} relative`}
      style={{ filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
      onMouseEnter={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
      onMouseLeave={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
      <div className="cursor-pointer" onClick={() => setSelected(e)}>
        {e.logoUrl
          ? <img src={e.logoUrl} alt="" className="w-full h-28 sm:h-32 object-cover group-hover:opacity-90 transition-opacity" />
          : <div className="w-full h-28 sm:h-32 flex items-center justify-center" style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#0a1628,#1a2040)' }}>
              <span className="font-clash text-4xl font-black" style={{ color: L ? 'rgba(163,177,200,0.22)' : 'rgba(255,255,255,0.10)' }}>{e.name[0]}</span>
            </div>}
        <div className="p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={`font-clash font-semibold text-sm ${L?'text-gray-900':'text-white'} truncate min-w-0`}>{e.name}</p>
            <span className={`font-inter text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${STATUS_CLS[e.status]||''}`}>{e.status}</span>
          </div>
          <div className="flex gap-3 font-inter text-xs text-gray-500">
            <span>{e.memberIds?.length||0} members</span>
            {e.formPublished && <span className="text-emerald-400">Form live</span>}
          </div>
          <p className="font-inter text-xs text-gray-600 mt-1">Click to manage →</p>
        </div>
      </div>
      <div onClick={ev => ev.stopPropagation()} className={`px-3 sm:px-3.5 pb-3 flex items-center gap-2 border-t pt-2 ${L?'border-black/5':'border-white/5'}`}>
        <span className="font-inter text-[9px] text-gray-600 uppercase tracking-wider mr-1">Gallery</span>
        {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
          const active = val === null ? (e.showInGallery === null || e.showInGallery === undefined) : e.showInGallery === val
          return (
            <button key={lbl}
              onClick={async () => {
                await eventsApi.setGalleryOrder(e._id, { showInGallery: val }).catch(() => {})
                setEvents(prev => prev.map(ev => ev._id === e._id ? { ...ev, showInGallery: val } : ev))
              }}
              className={`px-2 py-0.5 rounded font-inter text-[9px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
              {lbl}
            </button>
          )
        })}
      </div>
      <button
        onClick={ev => { ev.stopPropagation(); setDeleteConfirm(e) }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-900/70 hover:bg-red-600 text-white/70 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        title="Delete event">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Tab-level download */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTabDlOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all border ${
            tabDlOpen
              ? 'bg-red-700/20 text-red-400 border-red-700/40'
              : `${L?'border-black/10 bg-black/5':'border-white/8 bg-white/5'} text-gray-400 hover:text-white`
          }`}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All Events Report
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            className={`transition-transform duration-200 ${tabDlOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      {tabDlOpen && (
        <div className={`p-4 rounded-xl border space-y-3 ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
          <div>
            <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>All Events Report</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">{events.filter(e => isCurrentSession(e)).length} events this session · CSV exports one row per participation, PDF generates per-event sections with member cards</p>
          </div>
          {tabDlMsg && (
            <p className={`font-inter text-xs ${tabDlMsg.startsWith('✓') ? 'text-green-400' : tabDlMsg.startsWith('✗') ? 'text-red-400' : 'text-gray-400 animate-pulse'}`}>
              {tabDlMsg}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <GlassButton onClick={() => handleTabEventsDownload('csv')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-blue-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ Excel'}
            </GlassButton>
            <GlassButton onClick={() => handleTabEventsDownload('pdf')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-emerald-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ PDF Report'}
            </GlassButton>
            <GlassButton onClick={() => { setTabDlOpen(false); setTabDlMsg('') }} disabled={tabDlBusy}
              className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'32px' }}>
              Cancel
            </GlassButton>
          </div>
        </div>
      )}

      {/* Create event form — shown when FAB is clicked */}
      {creating && (
        <div className={`auth-glass rounded-2xl border p-5 space-y-4 ${L?'border-black/8':'border-white/8'}`}>
          <div className="flex items-center justify-between">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">New Event</p>
            <button onClick={() => { setCreating(false); setCreateMsg('') }} className="font-inter text-xs text-gray-500 hover:text-gray-300 transition-colors">✕ Cancel</button>
          </div>
          <div>
            <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Event Name *</label>
            <input value={newForm.name} onChange={e => setNewForm(f=>({...f,name:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Photography Walk 2026" />
          </div>
          <div>
            <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Description</label>
            <textarea value={newForm.description} onChange={e => setNewForm(f=>({...f,description:e.target.value}))} rows={2} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} placeholder="Brief description..." />
          </div>
          <div>
            <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Venue</label>
            <input value={newForm.venue} onChange={e => setNewForm(f=>({...f,venue:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Venue..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['startDate','Start Date'],['endDate','End Date']].map(([k,lbl]) => (
              <div key={k}>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">{lbl}</label>
                <input type="date" value={newForm[k]} onChange={e => setNewForm(f=>({...f,[k]:e.target.value}))}
                  className="glass-input w-full text-xs" style={{ borderRadius:'10px', colorScheme:'dark' }} />
              </div>
            ))}
          </div>
          <EventDatesEditor L={L} value={newForm.eventDates}
            onChange={v => setNewForm(f=>({...f, eventDates:v}))} />
          <div className="space-y-1.5">
            <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setNewForm(f=>({...f,manualStatus:false,status:''}))}
                className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${!newForm.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                Auto
              </button>
              {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                <button key={lbl} type="button"
                  onClick={() => setNewForm(f=>({...f,manualStatus:true,status:val}))}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${newForm.manualStatus && newForm.status===val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            {!newForm.manualStatus && <p className="font-inter text-[10px] text-gray-500">Auto — computed from start/end dates on save</p>}
            {newForm.manualStatus && newForm.status === '' && <p className="font-inter text-[10px] text-yellow-500">No status badge shown on card</p>}
            {newForm.manualStatus && newForm.status !== '' && <p className="font-inter text-[10px] text-gray-500">Manually set to <span className="capitalize text-gray-400">{newForm.status}</span></p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newForm.isOpenToAll} onChange={e => setNewForm(f=>({...f,isOpenToAll:e.target.checked}))} className="accent-red-600 w-4 h-4" />
            <span className="font-inter text-xs text-gray-400">Open to all members (no individual enrolment needed)</span>
          </label>
          {createMsg && <p className={`font-inter text-xs ${createMsg.startsWith('Event name')||createMsg.startsWith('Failed') ? 'text-red-400' : 'text-green-400'}`}>{createMsg}</p>}
          <GlassButton onClick={createEvent} variant="red" disabled={busy || !newForm.name.trim()}
            className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
            {busy ? 'Creating…' : 'Create Event'}
          </GlassButton>
        </div>
      )}

      {/* Show Past Sessions toggle — controls visibility for members/coordinators */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
        <div>
          <p className={`font-inter text-xs font-semibold ${L?'text-gray-700':'text-gray-300'}`}>Show previous years events to members</p>
          <p className="font-inter text-[10px] text-gray-500 mt-0.5">When off, past session events are hidden for members and coordinators. Admins and core always see them.</p>
        </div>
        <button
          onClick={toggleShowPast}
          disabled={settingBusy}
          className={`relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 ${
            showPastSetting
              ? 'bg-emerald-600 border-emerald-500'
              : L ? 'bg-black/10 border-black/15' : 'bg-white/10 border-white/15'
          } ${settingBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${showPastSetting ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Session filter */}
      {allSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="font-inter text-[10px] uppercase tracking-widest text-gray-400">Session</span>
          {allSessions.map(s => (
            <button key={s} onClick={() => { setSessionFilter(s); setEventFilter('all') }}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                sessionFilter === s
                  ? 'bg-red-700 text-white border-red-700'
                  : L ? 'border-black/15 text-gray-600 hover:text-gray-900 hover:border-black/25'
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}>
              {s}{s === curSession ? ' · Current' : ''}
            </button>
          ))}
          {!showPastSetting && (
            <span className="font-inter text-[9px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/30 uppercase tracking-wider">Past hidden from members</span>
          )}
        </div>
      )}

      {/* Status filter */}
      {sessionItems.length > 0 && (
        <div className={`flex flex-wrap gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
          {[['all','All'],['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past']].map(([id,label]) => (
            ec[id] > 0 || id === 'all' ? (
              <button key={id} onClick={() => setEventFilter(id)}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-inter text-[10px] sm:text-xs font-semibold capitalize transition-all ${
                  eventFilter === id
                    ? {all:'bg-red-700',upcoming:'bg-amber-700',ongoing:'bg-green-700',past:'bg-gray-600'}[id] + ' text-white'
                    : 'text-gray-500 hover:text-white'
                }`}>
                {label} {ec[id] > 0 && <span className="opacity-70 text-[10px]">{ec[id]}</span>}
              </button>
            ) : null
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonGrid n={4} />
      ) : sessionItems.length === 0 ? (
        <div className={`py-16 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold text-lg ${L?'text-gray-900':'text-white'}`}>No events{isPastSession ? ` in ${sessionFilter}` : ' yet'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`py-12 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold text-lg ${L?'text-gray-900':'text-white'}`}>No {eventFilter} events</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4${isPastSession ? ' opacity-80' : ''}`}>
          {filtered.map(e => <EventCard key={e._id} e={e} dim={isPastSession} />)}
        </div>
      )}


      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Event?"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"? This will permanently delete all event data, photos, member records, and uploaded files from storage. This cannot be undone.` : ''}
        confirmLabel="Yes, Delete Everything"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <CreateFAB label="Create Event" isActive={creating} onCreate={() => setCreating(c => !c)} />
      <DownloadingOverlay visible={tabDlBusy} message={tabDlMsg} />
      <RouteBlockDialog blocker={createBlocker} L={L} />
    </div>
  )
}

// ── EVENT MANAGER (admin/core full management) ────────────────────────────────
function EventManager({ event: initialEvent, onBack, currentUser, L }) {
  const [event,       setEvent]       = useState(initialEvent)
  const [activeTab,   setActiveTab]   = useState('details')
  const [allMembers,  setAllMembers]  = useState([])
  const [photos,      setPhotos]      = useState([])
  const [ann,         setAnn]         = useState([])
  const [editForm,    setEditForm]    = useState({
    name:         initialEvent.name        || '',
    venue:        initialEvent.venue       || '',
    description:  initialEvent.description || '',
    startDate:    initialEvent.startDate ? initialEvent.startDate.slice(0,10) : '',
    endDate:      initialEvent.endDate   ? initialEvent.endDate.slice(0,10)   : '',
    eventDates:   initialEvent.eventDates?.map(d => d?.slice?.(0,10) || '') || (initialEvent.eventDate ? [initialEvent.eventDate.slice(0,10)] : []),
    customDates:  initialEvent.customDates?.map(cd => ({ ...cd, date: cd.date?.slice(0,10) || '' })) || [],
    manualStatus: initialEvent.manualStatus || false,
    status:       initialEvent.manualStatus ? (initialEvent.status || '') : '',
    isOpenToAll:  initialEvent.isOpenToAll  || false,
  })
  const [editSaving,    setEditSaving]    = useState(false)
  const [logoFile,      setLogoFile]      = useState(null)
  const [logoPreview,   setLogoPreview]   = useState(initialEvent.logoUrl || '')
  const [pendingAdds,   setPendingAdds]   = useState(new Set())
  const [mgrDlBusy, setMgrDlBusy] = useState(false)
  const [mgrDlMsg,  setMgrDlMsg]  = useState('')
  const [memberSearch,  setMemberSearch]  = useState('')
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState('')
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [roleConfirm,   setRoleConfirm]   = useState(null)
  const [showMemberFilters, setShowMemberFilters] = useState(false)
  const [memberFilter,  setMemberFilter]  = useState({ year:'all', stream:'all', role:'all' })
  const [uploading,         setUploading]         = useState(false)
  const [photoDragIdx,      setPhotoDragIdx]      = useState(null)
  const [orderChanged,      setOrderChanged]      = useState(false)
  const [savingOrder,       setSavingOrder]       = useState(false)
  const [deletePhotoConfirm,setDeletePhotoConfirm]= useState(null)
  const [photoLightboxIdx,  setPhotoLightboxIdx]  = useState(null)
  const [announce,          setAnnounce]          = useState('')
  const [annSubject,    setAnnSubject]    = useState('')
  const [recipType,     setRecipType]     = useState('all')
  const [busy,          setBusy]          = useState(false)
  const [backConfirm,   setBackConfirm]   = useState(false)
  const isAdmin = ['admin','core'].includes(currentUser?.role)
  const { toast } = useToast()

  const isDirty = useMemo(() => {
    const ef = editForm, ev = event
    return ef.name !== (ev.name || '') ||
      ef.venue !== (ev.venue || '') ||
      ef.description !== (ev.description || '') ||
      ef.startDate !== (ev.startDate ? ev.startDate.slice(0,10) : '') ||
      ef.endDate !== (ev.endDate ? ev.endDate.slice(0,10) : '') ||
      ef.manualStatus !== (ev.manualStatus || false) ||
      ef.status !== (ev.manualStatus ? (ev.status || '') : '') ||
      ef.isOpenToAll !== (ev.isOpenToAll || false)
  }, [editForm, event])
  const routeBlocker = useUnsavedGuard(isDirty)

  const refreshEvent = async () => { const d = await eventsApi.get(event._id); setEvent(d.event) }

  useEffect(() => {
    eventsApi.get(event._id).then(d => setEvent(d.event)).catch(() => {})
    membersApi.list().then(d => setAllMembers(d.members || [])).catch(() => {})
    galleryApi.getPhotos({ type:'event', event: event._id }).then(d => setPhotos(d.photos || [])).catch(() => {})
  }, [event._id])


  // ── Details save ─────────────────────────────────────────────────────────────
  const saveEventDetails = async () => {
    setEditSaving(true)
    try {
      const body = {
        name:         editForm.name,
        venue:        editForm.venue,
        description:  editForm.description,
        startDate:    editForm.startDate || null,
        endDate:      editForm.endDate   || null,
        eventDates:   editForm.eventDates?.filter(Boolean) || [],
        eventDate:    editForm.eventDates?.[0] || null,
        customDates:  editForm.customDates.filter(cd => cd.title && cd.date),
        manualStatus: editForm.manualStatus,
        status:       editForm.manualStatus ? (editForm.status || '') : undefined,
        isOpenToAll:  (editForm.manualStatus && editForm.status === 'past') || (!editForm.manualStatus && event.status === 'past') ? true : editForm.isOpenToAll,
      }
      if (logoFile) {
        const { key, publicUrl } = await uploadFileToS3(logoFile, 'events')
        body.logoUrl = publicUrl; body.logoS3Key = key
      }
      const d = await eventsApi.update(event._id, body)
      setEvent(d.event); setLogoFile(null)
      toast.success('Saved', 'Event details updated')
    } catch (e) { setMsg(e.message) } finally { setEditSaving(false) }
  }

  const toggleCoordPerm = async (field) => {
    const v = !event[field]
    await eventsApi.setCoordPerms(event._id, { [field]: v }).catch(() => {})
    setEvent(ev => ({ ...ev, [field]: v }))
  }

  // ── Member management ─────────────────────────────────────────────────────────
  const memberIds = new Set(event.members?.map(m => { const u=m.user; return (u && typeof u==='object')?u._id?.toString():u?.toString() }).filter(Boolean) || [])
  const excludedCoreIds = new Set((event.excludedCores||[]).map(u=>((u && typeof u==='object')?u._id?.toString():u?.toString())||''))
  const notInEvent = allMembers.filter(m => {
    if (m.role === 'admin') return false
    if (memberIds.has(m._id?.toString())) return false
    if (m.role === 'core') return excludedCoreIds.has(m._id?.toString()) // removed cores re-appear here
    return true
  })
  const filteredNonMembers = memberSearch.trim() ? notInEvent.filter(m => m.name?.toLowerCase().includes(memberSearch.toLowerCase()) || m.department?.toLowerCase().includes(memberSearch.toLowerCase())) : notInEvent
  const explicitByUserId = new Map((event.members||[]).map(m => { const uid=(m.user && typeof m.user==='object')?m.user?._id?.toString():m.user?.toString(); return [uid,m] }))
  const coreClubMembers = allMembers.filter(m => m.role==='core' && !excludedCoreIds.has(m._id?.toString()))
  const allDisplayRows = [
    // Cores default to 'core'; admin can override to coordinator/photographer for a specific event
    ...coreClubMembers.map(c => { const ex=explicitByUserId.get(c._id?.toString()); return { user:c, eventRole:ex?.eventRole||'core', isImplicit:!ex } }),
    ...(event.members||[]).filter(m=>{ const u=m.user; if(!u) return false; const r=typeof u==='object'?u.role:''; return r!=='admin'&&r!=='core' }).map(m=>({ user:m.user, eventRole:m.eventRole, isImplicit:false })),
  ]
  // Sort order: core → coordinator → photographer; within each group, original insertion order (newest last)
  const EVENT_ROLE_RANK = { core: 0, coordinator: 1, photographer: 2 }
  const displayMembers = allDisplayRows.filter(row => {
    const u=row.user; if(!u||typeof u!=='object') return false
    if (memberFilter.year!=='all' && (computeAcademicYear(u.startYear,u.endYear).label||'—')!==memberFilter.year) return false
    if (memberFilter.stream!=='all' && u.department!==memberFilter.stream) return false
    if (memberFilter.role!=='all' && row.eventRole!==memberFilter.role) return false
    return true
  }).sort((a, b) => (EVENT_ROLE_RANK[a.eventRole] ?? 2) - (EVENT_ROLE_RANK[b.eventRole] ?? 2))
  const uniqueYears  = [...new Set(allDisplayRows.map(r=>{const u=r.user;return u?.startYear&&u?.endYear?(computeAcademicYear(u.startYear,u.endYear).label||null):null}).filter(Boolean))]
  const uniqueStreams = [...new Set(allDisplayRows.map(r=>r.user?.department).filter(Boolean))]
  const uniqueRoles  = [...new Set(allDisplayRows.map(r=>r.eventRole).filter(Boolean))]

  const canRemoveMember = (userObj, isCore, eventRole) => {
    if (!userObj) return false
    if (currentUser?.role==='admin') return true
    if (isCore||eventRole==='core') return false
    const uRole=typeof userObj==='object'?userObj.role:''
    return currentUser?.role==='core'&&uRole!=='admin'&&uRole!=='core'
  }
  const togglePending = uid => setPendingAdds(prev=>{ const n=new Set(prev); n.has(uid)?n.delete(uid):n.add(uid); return n })
  const saveMembers = async () => {
    if (!pendingAdds.size) return; setSaving(true); setMsg('')
    let added=0
    try { for (const uid of pendingAdds) { await eventsApi.addMember(event._id,{userId:uid}); added++ }
      setPendingAdds(new Set()); setMsg(`✓ ${added} member${added>1?'s':''} added and notified.`); await refreshEvent()
    } catch(e){setMsg(`✗ ${e.message}`)} finally{setSaving(false)}
  }
  const removeMember = async () => { try{await eventsApi.removeMember(event._id,removeConfirm)}catch(e){console.error(e)} setRemoveConfirm(null); refreshEvent() }
  const setEventRole = async (uid, role) => { try{await eventsApi.setMemberRole(event._id,uid,{eventRole:role})}catch(e){console.error(e)} refreshEvent() }

  // ── Gallery ───────────────────────────────────────────────────────────────────
  const uploadPhoto = async (file) => {
    setUploading(true)
    try { const {key,publicUrl}=await uploadFileToS3(file,'event-gallery'); const {photo}=await galleryApi.addPhoto({imageUrl:publicUrl,s3Key:key,event:event._id,type:'event',order:photos.length}); setPhotos(p=>[...p,photo]) }
    catch(e){setMsg(e.message)} finally{setUploading(false)}
  }
  const deletePhoto = async id => { await galleryApi.deletePhoto(id).catch(()=>{}); setPhotos(p=>p.filter(x=>x._id!==id)) }
  const handleDragStart = i => setPhotoDragIdx(i)
  const handleDragOver  = (e,i) => { e.preventDefault(); if(photoDragIdx===null||photoDragIdx===i) return; const r=[...photos]; const [m]=r.splice(photoDragIdx,1); r.splice(i,0,m); setPhotos(r); setPhotoDragIdx(i); setOrderChanged(true) }
  const savePhotoOrder  = async () => { setSavingOrder(true); try{await galleryApi.reorderPhotos(photos.map(p=>p._id),event._id); setOrderChanged(false)}catch(e){setMsg(e.message)}finally{setSavingOrder(false)} }

  // ── Announcements ─────────────────────────────────────────────────────────────

  const handleMgrEventDownload = async (fmt) => {
    setMgrDlBusy(true); setMgrDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      const members = allDisplayRows.map(row => ({ user: row.user, role: row.eventRole }))
      if (fmt === 'csv') {
        await downloadSingleItemCSV({ item: event, itemType: 'event', members })
        setMgrDlMsg('✓ Downloaded')
      } else {
        await downloadSingleItemPDF({ item: event, itemType: 'event', members, onProgress: msg => setMgrDlMsg(msg || 'Building PDF…') })
        setMgrDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setMgrDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setMgrDlBusy(false), 1600) } else { setMgrDlBusy(false) }
      setTimeout(() => setMgrDlMsg(''), 3500)
    }
  }

  const SUBTABS = ['details','members','gallery','announcements']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => isDirty ? setBackConfirm(true) : onBack()} className="text-gray-500 hover:text-white transition-colors">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className={`font-clash text-xl font-semibold ${L?'text-gray-900':'text-white'}`}>{event.name}</h2>
        {isDirty && <span className="font-inter text-xs text-amber-400/80 ml-1">Unsaved</span>}
        <Badge style={{ upcoming:'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',ongoing:'bg-green-900/30 text-green-400 border-green-800/40',past:'bg-gray-800/30 text-gray-500 border-gray-700/30' }[event.status]||''}>{event.status}</Badge>
      </div>

      {/* Sub-tabs */}
      <div className={`flex gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
        {SUBTABS.map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            className={`px-3 py-1.5 rounded-lg font-inter text-xs font-medium capitalize transition-all ${activeTab===t?'bg-red-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── DETAILS ── */}
      {activeTab==='details' && (
        <div className="space-y-4 tab-panel-sub">
          <CoordToggle L={L} label="edit event details" value={event.coordCanEditDetails!==false} onChange={()=>toggleCoordPerm('coordCanEditDetails')} />

          <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Event Banner / Logo</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-900 flex items-center justify-center">
                {logoPreview?<img src={logoPreview} alt="" className="w-full h-full object-cover"/>:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
              </div>
              <label className="glass-btn glass-btn-light px-4 font-inter text-xs cursor-pointer" style={{ borderRadius:10, minHeight:34 }}>
                Change Banner
                <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(!f)return;setLogoFile(f);setLogoPreview(URL.createObjectURL(f))}} />
              </label>
            </div>
          </div>

          <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Event Details</p>
            <div>
              <label className="font-inter text-xs text-gray-500 mb-1 block">Name {editForm.name!==event.name&&<span className="text-yellow-400 ml-1">• Members will be notified</span>}</label>
              <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="glass-input w-full text-sm" style={{borderRadius:10}}/>
            </div>
            <div>
              <label className="font-inter text-xs text-gray-500 mb-1 block">Venue</label>
              <input value={editForm.venue} onChange={e=>setEditForm(f=>({...f,venue:e.target.value}))} placeholder="Location / venue" className="glass-input w-full text-sm" style={{borderRadius:10}}/>
            </div>
            <div>
              <label className="font-inter text-xs text-gray-500 mb-1 block">Description</label>
              <textarea value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} rows={3} className="glass-input w-full text-sm resize-none" style={{borderRadius:10}}/>
            </div>
            <div className={`auth-glass rounded-xl p-3.5 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Dates</p>
              <div className="grid grid-cols-2 gap-3">
                {[['startDate','Start Date'],['endDate','End Date']].map(([k,lbl]) => (
                  <div key={k}>
                    <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">{lbl}</label>
                    <input type="date" value={editForm[k]} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                      className="glass-input w-full text-xs" style={{ borderRadius:9, colorScheme:'dark' }} />
                  </div>
                ))}
              </div>
            </div>
            <EventDatesEditor L={L} value={editForm.eventDates}
              onChange={v => setEditForm(f=>({...f, eventDates:v}))} />
            <CustomDatesEditor L={L} value={editForm.customDates}
              onChange={v => setEditForm(f=>({...f, customDates:v}))} />

            {/* Status */}
            <div className={`auth-glass rounded-xl p-3.5 border ${L?'border-black/8':'border-white/8'} space-y-2.5`}>
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Status</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button"
                  onClick={() => setEditForm(f=>({...f, manualStatus:false, status:''}))}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                    !editForm.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                  }`}>
                  Auto
                </button>
                {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                  <button key={lbl} type="button"
                    onClick={() => setEditForm(f=>({...f, manualStatus:true, status:val}))}
                    className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                      editForm.manualStatus && editForm.status===val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
              {!editForm.manualStatus && (
                <p className="font-inter text-[10px] text-gray-500">Auto — computed from dates. Current: <span className="capitalize text-gray-400">{event.status || 'upcoming'}</span></p>
              )}
              {editForm.manualStatus && editForm.status === '' && (
                <p className="font-inter text-[10px] text-yellow-500">No status badge shown on card</p>
              )}
              {editForm.manualStatus && editForm.status !== '' && (
                <p className="font-inter text-[10px] text-gray-500">Manually set to <span className="capitalize text-gray-400">{editForm.status}</span></p>
              )}
            </div>
          </div>

          {/* Coordinator permission toggles */}
          <div className={`auth-glass rounded-2xl border p-4 ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Coordinator Permissions</p>
            <CoordToggle L={L} label="upload gallery photos"  value={event.coordCanUpload!==false}   onChange={()=>toggleCoordPerm('coordCanUpload')} />
            <CoordToggle L={L} label="reorder gallery photos" value={event.coordCanReorder!==false}  onChange={()=>toggleCoordPerm('coordCanReorder')} />
            <CoordToggle L={L} label="post announcements"     value={event.coordCanAnnounce!==false} onChange={()=>toggleCoordPerm('coordCanAnnounce')} />
          </div>

          {(() => {
            const isPast = (editForm.manualStatus && editForm.status === 'past') || (!editForm.manualStatus && event.status === 'past')
            return (
              <label className={`flex items-center gap-2 ${isPast ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>
                <input type="checkbox"
                  checked={isPast ? true : editForm.isOpenToAll}
                  disabled={isPast}
                  onChange={e => !isPast && setEditForm(f => ({ ...f, isOpenToAll: e.target.checked }))}
                  className="accent-red-600 w-4 h-4" />
                <span className="font-inter text-xs text-gray-400">
                  Open to all members (no individual enrolment needed)
                  {isPast && <span className="ml-1 text-gray-500">— always on for past events</span>}
                </span>
              </label>
            )
          })()}
          {msg&&<p className={`font-inter text-sm ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
          <GlassButton variant="red" onClick={saveEventDetails} disabled={editSaving} className="w-full font-inter text-sm" style={{borderRadius:14,minHeight:48}}>
            {editSaving?'Saving…':'Save Changes'}
          </GlassButton>
        </div>
      )}

      {/* ── MEMBERS ── */}
      {activeTab==='members' && (
        <div className="space-y-5 tab-panel-sub">
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} space-y-2.5`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">
                  Members ({(memberFilter.year!=='all'||memberFilter.stream!=='all'||memberFilter.role!=='all') ? `${displayMembers.length} of ${allDisplayRows.length}` : allDisplayRows.length})
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-inter text-[9px] text-gray-600 hidden sm:block">Cores always participate</p>
                  {mgrDlMsg && <span className={`font-inter text-[9px] ${mgrDlMsg.startsWith('✓')?'text-green-400':mgrDlMsg.startsWith('✗')?'text-red-400':'text-gray-400 animate-pulse'}`}>{mgrDlMsg}</span>}
                  <button onClick={() => handleMgrEventDownload('csv')} disabled={mgrDlBusy}
                    title="Download Excel"
                    className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}>
                    ↓ Excel
                  </button>
                  <button onClick={() => handleMgrEventDownload('pdf')} disabled={mgrDlBusy}
                    title="Download PDF"
                    className="font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all text-emerald-400/70 border-emerald-800/30 hover:text-emerald-400">
                    ↓ PDF
                  </button>
                  <button onClick={()=>setShowMemberFilters(v=>!v)} className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${showMemberFilters?'bg-red-700/20 text-red-400 border-red-700/40':`${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}`}>{showMemberFilters?'✕ Filters':'⚙ Filter'}</button>
                </div>
              </div>
              {showMemberFilters&&(<div className="flex gap-2 flex-wrap">
                {[{key:'year',label:'Year',opts:uniqueYears},{key:'stream',label:'Stream',opts:uniqueStreams},{key:'role',label:'Position',opts:uniqueRoles}].map(f=>(
                  <select key={f.key} value={memberFilter[f.key]} onChange={e=>setMemberFilter(p=>({...p,[f.key]:e.target.value}))} className="glass-input text-[10px] appearance-none px-2 py-1" style={{borderRadius:8}}>
                    <option value="all">All {f.label}s</option>
                    {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                {(memberFilter.year!=='all'||memberFilter.stream!=='all'||memberFilter.role!=='all')&&<button onClick={()=>setMemberFilter({year:'all',stream:'all',role:'all'})} className="font-inter text-[10px] text-red-400 hover:text-red-300 px-2">✕ Clear</button>}
              </div>)}
            </div>
            {displayMembers.length===0?<p className="p-6 text-center font-inter text-sm text-gray-600">No members match filters.</p>:(
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className={`border-b ${L?'border-black/5':'border-white/5'}`}>
                    {['Member','Stream','Year','Designation',''].map(h=><th key={h} className="px-4 py-2.5 text-left font-inter text-[9px] text-gray-500 uppercase tracking-[0.12em]">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {displayMembers.map((row,i)=>{
                      const u=row.user; const name=u?.name||'—'; const dept=u?.department||'—'; const yr=u?.startYear?computeAcademicYear(u.startYear,u.endYear).label||'—':'—'; const uid=u?._id||u; const isCore=u?.role==='core'; const isAdminU=currentUser?.role==='admin'
                      const showRemove=isAdminU?(!row.isImplicit||isCore):canRemoveMember(u,isCore,row.eventRole)&&!row.isImplicit
                      // Left-border accent based on event role (not club role) — avoids confusion
                      const rowAccent = row.eventRole==='core' ? 'rgba(245,158,11,0.55)' : row.eventRole==='coordinator' ? 'rgba(99,179,237,0.45)' : 'transparent'
                      return (
                        <tr key={i} className={`border-b last:border-0 ${L?'border-black/5':'border-white/5'} hover:bg-white/[0.02] transition-colors`}
                          style={{ boxShadow:`inset 3px 0 0 ${rowAccent}` }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0 flex items-center justify-center">
                                {u?.profilePhoto?<img src={u.profilePhoto} alt="" className="w-full h-full object-cover"/>:<span className="font-inter text-[10px] font-bold text-white">{name[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{name}</p>
                                {u?.email&&<p className="font-inter text-[9px] text-gray-500 truncate">{u.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 truncate max-w-[120px]">{dept}</p></td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 whitespace-nowrap">{yr}</p></td>
                          <td className="px-4 py-3">
                            {isCore && !isAdminU ? (
                              <span className="font-inter text-[10px] px-2 py-1 rounded-lg border border-amber-500/30 text-amber-400 bg-amber-900/10 capitalize">
                                Core
                              </span>
                            ) : (
                              <select value={row.eventRole} onChange={e=>{const to=e.target.value;const roles=['photographer','coordinator','core'];const verb=roles.indexOf(to)>roles.indexOf(row.eventRole)?'promote':'demote';setRoleConfirm({uid,name,from:row.eventRole,to,verb})}}
                                className="glass-input text-[10px] appearance-none px-2 py-1 capitalize" style={{borderRadius:8,minWidth:96}}>
                                {/* Admin sees all options incl. core; non-admin cannot assign core role */}
                                {(isAdminU?['photographer','coordinator','core']:['photographer','coordinator']).map(r=><option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end flex-wrap">
                              {/* Promote — admin: anyone incl. cores; core user: only non-core explicit members */}
                              {(isAdminU||(!isCore&&!row.isImplicit))&&(()=>{
                                const targets=[]
                                if(row.eventRole==='photographer') targets.push({label:'Coordinator',role:'coordinator'})
                                // Only admin can promote to core (and cores can't be promoted further)
                                if(row.eventRole==='coordinator'&&isAdminU) targets.push({label:'Core',role:'core'})
                                return targets.map(t=><button key={t.role} onClick={()=>setRoleConfirm({uid,name,from:row.eventRole,to:t.role,verb:'promote'})} className="font-inter text-[9px] px-2 py-1 rounded-lg border border-green-500/25 text-green-400/70 hover:text-green-400 hover:border-green-500/50 transition-all">↑ {t.label}</button>)
                              })()}
                              {/* Demote — admin can demote anyone (incl. cores); core user can only demote non-core explicit */}
                              {row.eventRole!=='photographer'&&(isAdminU||(!isCore&&!row.isImplicit))&&(
                                <button onClick={()=>setRoleConfirm({uid,name,from:row.eventRole,to:'photographer',verb:'demote'})} className="font-inter text-[9px] px-2 py-1 rounded-lg border border-yellow-500/25 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/50 transition-all">↓ Photographer</button>
                              )}
                              {showRemove&&<button onClick={()=>setRemoveConfirm(uid)} className="font-inter text-[9px] px-2 py-1 rounded-lg border border-red-500/25 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-all">Remove</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add members */}
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} flex items-center justify-between gap-3 flex-wrap`}>
              <div>
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Add Members</p>
                <p className="font-inter text-[10px] text-gray-600 mt-0.5">{pendingAdds.size>0?`${pendingAdds.size} selected — click Save to add & notify`:'Select members below to add them'}</p>
              </div>
              <GlassButton onClick={saveMembers} variant="red" disabled={saving||pendingAdds.size===0} className="font-inter text-sm font-semibold px-5 shrink-0" style={{borderRadius:'12px',minHeight:'40px',opacity:pendingAdds.size===0?0.35:1}}>
                {saving?'Saving…':pendingAdds.size>0?`💌 Save & Notify ${pendingAdds.size}`:'💌 Save & Notify'}
              </GlassButton>
            </div>
            <div className="p-4 space-y-3">
              <input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search by name or department…" className="glass-input w-full text-sm" style={{borderRadius:'10px'}}/>
              {filteredNonMembers.length===0?<p className={`text-center py-6 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>{memberSearch?'No members match.':'All members already added.'}</p>:(
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto no-scrollbar pr-1">
                  {filteredNonMembers.map(m=>{
                    const sel=pendingAdds.has(m._id)
                    return (<button key={m._id} onClick={()=>togglePending(m._id)} className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200 border ${sel?'border-red-600/60 bg-red-900/20':'${L?"border-black/8 hover:border-black/20":"border-white/8 hover:border-white/20"} auth-glass'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${sel?'bg-red-600 border-red-600':'border-white/25'}`}>{sel&&<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}</div>
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-white/10 shrink-0">{m.profilePhoto?<img src={m.profilePhoto} alt="" className="w-full h-full object-cover rounded-full"/>:<span className="font-clash text-xs font-bold text-white">{m.name[0]}</span>}</div>
                      <div className="min-w-0 flex-1"><p className={`font-inter text-xs font-medium ${L?'text-gray-800':'text-gray-200'} truncate`}>{m.name}</p><p className="font-inter text-[10px] text-gray-500 truncate">{m.department} · {m.role}</p></div>
                    </button>)
                  })}
                </div>
              )}
              {pendingAdds.size>0&&<div className={`flex items-center justify-between pt-2 border-t ${L?'border-black/5':'border-white/5'}`}><p className="font-inter text-xs text-gray-500"><span className="text-white font-semibold">{pendingAdds.size}</span> selected</p><button onClick={()=>setPendingAdds(new Set())} className="font-inter text-[11px] text-gray-600 hover:text-white transition-colors">Clear</button></div>}
            </div>
          </div>

          {msg&&<p className={`font-inter text-sm ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
          <ConfirmDialog open={!!removeConfirm} title="Remove Member?" message="This person will be removed from the event." confirmLabel="Yes, Remove" onConfirm={removeMember} onCancel={()=>setRemoveConfirm(null)}/>
          <ConfirmDialog open={!!roleConfirm} title={roleConfirm?.verb==='promote'?`Promote to ${roleConfirm?.to}?`:`Demote to ${roleConfirm?.to}?`} message={roleConfirm?`${roleConfirm.name} will be ${roleConfirm.verb==='promote'?'promoted':'demoted'}: ${roleConfirm.from} → ${roleConfirm.to}. They'll receive a notification.`:''} confirmLabel={roleConfirm?.verb==='promote'?'Yes, Promote':'Yes, Demote'} onConfirm={async()=>{if(!roleConfirm)return;await setEventRole(roleConfirm.uid,roleConfirm.to);setRoleConfirm(null)}} onCancel={()=>setRoleConfirm(null)}/>
        </div>
      )}

      {/* ── GALLERY ── */}
      {activeTab==='gallery' && (
        <div className="space-y-4 tab-panel-sub">
          {/* Show in Gallery toggle */}
          <div className={`flex items-center justify-between py-2 border-b ${L?'border-black/5':'border-white/5'}`}>
            <div>
              <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'}`}>Show in Public Gallery</p>
              <p className="font-inter text-[10px] text-gray-500 mt-0.5">Auto = visible when event is past/ongoing</p>
            </div>
            <div className="flex gap-1">
              {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
                const active = val === null ? (event.showInGallery === null || event.showInGallery === undefined) : event.showInGallery === val
                return (
                  <button key={lbl}
                    onClick={async () => {
                      await eventsApi.setGalleryOrder(event._id, { showInGallery: val }).catch(() => {})
                      setEvent(ev => ({ ...ev, showInGallery: val }))
                    }}
                    className={`px-2.5 py-1 rounded-lg font-inter text-[10px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : `text-gray-500 border-white/10 hover:text-white`}`}>
                    {lbl}
                  </button>
                )
              })}
            </div>
          </div>
          <CoordToggle L={L} label="upload gallery photos"  value={event.coordCanUpload!==false}  onChange={()=>toggleCoordPerm('coordCanUpload')} />
          <CoordToggle L={L} label="reorder gallery photos" value={event.coordCanReorder!==false} onChange={()=>toggleCoordPerm('coordCanReorder')} />

          <DriveLinkSetting L={L} value={event.driveLink} onSave={async link => {
            const d = await eventsApi.update(event._id, { driveLink: link }); setEvent(d.event)
          }} />

          <div className="flex items-center justify-between">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">{photos.length} Photos</p>
            <div className="flex items-center gap-2">
              {orderChanged&&<GlassButton variant="red" disabled={savingOrder} onClick={savePhotoOrder} className="font-inter text-xs" style={{borderRadius:8,minHeight:28,padding:'0 12px'}}>{savingOrder?'Saving…':'Save Order'}</GlassButton>}
              <label className="glass-btn glass-btn-light inline-flex items-center gap-2 px-4 font-inter text-xs cursor-pointer" style={{borderRadius:'10px',minHeight:'36px'}}>
                {uploading && <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />}
                {uploading?'Uploading…':'+ Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={e=>uploadPhoto(e.target.files[0])} disabled={uploading}/>
              </label>
            </div>
          </div>

          {photos.length===0?<p className={`text-center py-10 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No gallery photos yet.</p>:(
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((p,i)=>(
                <div key={p._id} className={`group relative aspect-square rounded-xl overflow-hidden ${photoDragIdx===i?'opacity-40 ring-2 ring-red-500':''} cursor-grab active:cursor-grabbing`}
                  draggable onDragStart={()=>handleDragStart(i)} onDragOver={e=>handleDragOver(e,i)} onDragEnd={()=>setPhotoDragIdx(null)}
                  onClick={()=>setPhotoLightboxIdx(i)}>
                  <ProgressiveImage src={p.imageUrl} className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={e=>{e.stopPropagation();setDeletePhotoConfirm(p._id)}} className="w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center text-xs">✕</button>
                  </div>
                  <div className="absolute top-1.5 left-1.5 font-inter text-[8px] text-white/60 bg-black/40 rounded px-1">{i+1}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANNOUNCEMENTS ── */}
      {activeTab==='announcements' && (
        <div className="tab-panel-sub">
          <ContextAnnouncementStudio
            contextType="event"
            contextId={event._id}
            canAnnounce={true}
            isPrivileged={true}
            coordCanAnnounce={event.coordCanAnnounce}
            onCoordToggle={async val => {
              await eventsApi.setCoordPerms(event._id, { coordCanAnnounce: val }).catch(() => {})
              setEvent(ev => ({ ...ev, coordCanAnnounce: val }))
            }}
            L={L}
          />
        </div>
      )}
      <DownloadingOverlay visible={mgrDlBusy} message={mgrDlMsg} />
      <ConfirmDialog
        open={!!deletePhotoConfirm}
        title="Delete Photo?"
        message="This photo will be permanently deleted and cannot be recovered."
        confirmLabel="Yes, Delete"
        onConfirm={() => { deletePhoto(deletePhotoConfirm); setDeletePhotoConfirm(null) }}
        onCancel={() => setDeletePhotoConfirm(null)}
      />
      {photoLightboxIdx !== null && (
        <Lightbox
          photos={photos.map(p => ({ url: p.imageUrl }))}
          startIndex={photoLightboxIdx}
          onClose={() => setPhotoLightboxIdx(null)}
        />
      )}
      <ConfirmDialog
        open={backConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them and leave, or go back to save?"
        confirmLabel="Discard Changes"
        cancelLabel="Save Changes"
        onConfirm={onBack}
        onCancel={() => setBackConfirm(false)}
      />
      <RouteBlockDialog blocker={routeBlocker} L={L} />
    </div>
  )
}

function CompetitionsAdminTab({ currentUser, L }) {
  const [comps,      setComps]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [creating,   setCreating]   = useState(false)
  const [form,       setForm]       = useState({
    name:'', description:'',
    startDate:'', eventDates:[], submissionDeadline:'', endDate:'',
    prizeDistributionDate:'', resultDate:'',
    showNewBadge: false,
    customDates: [],
    details: { themes:[], venue:'', prize:'', rules:'' },
  })
  const [banner,     setBanner]     = useState(null)
  const [compBanner, setCompBanner] = useState(null)
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState('')
  const [allMembers,    setAllMembers]    = useState([])
  const [compFilter,    setCompFilter]    = useState('all')
  const [compSessionFilter, setCompSessionFilter] = useState(() => currentSession())
  const [deleteCompConfirm, setDeleteCompConfirm] = useState(null)
  const [tabDlOpen, setTabDlOpen] = useState(false)
  const [tabDlBusy, setTabDlBusy] = useState(false)
  const [tabDlMsg,  setTabDlMsg]  = useState('')
  const [showPastSetting, setShowPastSetting] = useState(true)
  const [settingBusy, setSettingBusy] = useState(false)

  useEffect(() => {
    settingsApi.getSections().then(d => {
      setShowPastSetting(d?.sections?.['show-past-competitions'] !== false)
    }).catch(() => {})
  }, [])

  const toggleShowPast = async () => {
    const next = !showPastSetting
    setSettingBusy(true)
    try {
      await settingsApi.setSectionVisible('show-past-competitions', next)
      setShowPastSetting(next)
    } catch (e) { console.error(e) }
    finally { setSettingBusy(false) }
  }

  const fetch_ = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try { const d = await competitionsApi.list(); setComps(d.competitions) }
    finally { if (!silent) setLoading(false) }
  }, [])

  const doDeleteComp = async () => {
    if (!deleteCompConfirm) return
    try { await competitionsApi.delete(deleteCompConfirm._id) } catch (e) { console.error(e) }
    setDeleteCompConfirm(null); fetch_()
  }

  useEffect(() => {
    fetch_(false)
    membersApi.list().then(d => setAllMembers(d.members)).catch(() => {})
  }, [fetch_])

  // Live refresh of the list while browsing it (skip while inside a competition's manager view)
  useEffect(() => {
    const poll = setInterval(() => { if (!selected) fetch_(true) }, 15000)
    return () => clearInterval(poll)
  }, [fetch_, selected])

  const isCreateDirty = creating && !!(form.name.trim() || form.description.trim() || form.startDate || form.submissionDeadline || form.details.venue || form.details.rules)
  const createBlocker = useUnsavedGuard(isCreateDirty)

  const create = async () => {
    if (!form.name) return setMsg('Name is required.')
    setBusy(true); setMsg('')
    try {
      const body = {
        ...form,
        eventDate: form.eventDates?.[0] || undefined,
        bannerUrl:            banner?.publicUrl,    bannerS3Key:            banner?.key,
        competitionBannerUrl: compBanner?.publicUrl, competitionBannerS3Key: compBanner?.key,
      }
      const d = await competitionsApi.create(body)
      setCreating(false); setBanner(null); setCompBanner(null); fetch_()
      setSelected(d.competition)
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  if (selected) {
    return <CompetitionManager
      comp={selected}
      onBack={() => { setSelected(null); fetch_() }}
      currentUser={currentUser}
      L={L}
    />
  }

  const handleTabCompsDownload = async (fmt) => {
    setTabDlBusy(true); setTabDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      // volunteers are already populated on competitions
      const itemsArr = comps.filter(c => isCurrentSession(c)).map(c => ({
        item: c,
        members: (c.volunteers || []).map(v => ({ user: v.user, role: v.role || 'volunteer' })),
      }))
      if (fmt === 'csv') {
        await downloadAllItemsCSV({ items: itemsArr, itemType: 'competition' })
        setTabDlMsg('✓ Downloaded')
      } else {
        await downloadAllItemsPDF({ items: itemsArr, itemType: 'competition', onProgress: msg => setTabDlMsg(msg || 'Building PDF…') })
        setTabDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setTabDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setTabDlBusy(false), 1600) } else { setTabDlBusy(false) }
      setTimeout(() => { setTabDlMsg(''); setTabDlOpen(false) }, 3500)
    }
  }

  const STATUS_COLOR = {
    upcoming: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
    ongoing:  'text-green-400 bg-green-900/20 border-green-800/30',
    past:     'text-gray-400 bg-gray-800/30 border-gray-700/30',
  }

  const compCurSession    = currentSession()
  const compCurrentItems  = comps.filter(c => isCurrentSession(c))
  const compPastItems     = comps.filter(c => !isCurrentSession(c))
  const compPastBySession = compPastItems.reduce((acc, c) => {
    const s = getItemSession(getPrimaryItemDate(c)) || 'Older'
    ;(acc[s] = acc[s] || []).push(c)
    return acc
  }, {})
  const compPastSessions  = Object.keys(compPastBySession).sort((a, b) => b.localeCompare(a))
  const compAllSessions   = [compCurSession, ...compPastSessions]
  const compSessionItems  = compSessionFilter === compCurSession ? compCurrentItems : (compPastBySession[compSessionFilter] || [])
  const compIsPast        = compSessionFilter !== compCurSession
  const counts = { all: compSessionItems.length, upcoming: compSessionItems.filter(c=>c.status==='upcoming').length, ongoing: compSessionItems.filter(c=>c.status==='ongoing').length, past: compSessionItems.filter(c=>c.status==='past').length }
  const compFiltered = compFilter === 'all' ? compSessionItems : compSessionItems.filter(c => c.status === compFilter)

  const CompCard = ({ c, dim = false }) => (
    <div key={c._id}
      className={`group auth-glass rounded-2xl border overflow-hidden relative ${L?'border-black/8':'border-white/8'}`}
      style={{ filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
      onMouseEnter={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
      onMouseLeave={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
      <div className="cursor-pointer" onClick={() => setSelected(c)}>
        {c.bannerUrl
          ? <img src={c.bannerUrl} alt="" className="w-full h-32 sm:h-36 object-cover group-hover:opacity-90 transition-opacity" />
          : <div className="w-full h-32 sm:h-36 flex items-center justify-center" style={{ background:'linear-gradient(135deg,#1a0010,#3a0020)' }}>
              <span className="font-clash text-5xl font-black text-white opacity-10">{c.name[0]}</span>
            </div>}
        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className={`font-clash font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{c.name}</p>
              {c.showNewBadge && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-wider animate-pulse">NEW</span>}
              {c.details?.themes?.length > 0 && <p className="font-inter text-xs text-red-400 mt-0.5 truncate">{c.details.themes.slice(0,2).join(' · ')}</p>}
            </div>
            <span className={`font-inter text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${STATUS_COLOR[c.status]||''}`}>{c.status}</span>
          </div>
          <div className="flex gap-3 mt-2 font-inter text-xs text-gray-500">
            <span>{c.gallery?.length||0} photos</span>
            <span>{c.winners?.length||0} winners</span>
            {c.formPublished && <span className="text-emerald-400">Form live</span>}
          </div>
          <p className="font-inter text-xs text-gray-600 mt-1">Click to manage →</p>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} className={`px-3 sm:px-4 pb-3 flex items-center gap-2 border-t pt-2 ${L?'border-black/5':'border-white/5'}`}>
        <span className="font-inter text-[9px] text-gray-600 uppercase tracking-wider mr-1">Gallery</span>
        {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
          const active = val === null ? (c.showInGallery === null || c.showInGallery === undefined) : c.showInGallery === val
          return (
            <button key={lbl}
              onClick={async () => {
                await competitionsApi.setGalleryVisibility(c._id, val).catch(() => {})
                setComps(prev => prev.map(x => x._id === c._id ? { ...x, showInGallery: val } : x))
              }}
              className={`px-2 py-0.5 rounded font-inter text-[9px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
              {lbl}
            </button>
          )
        })}
      </div>
      <button
        onClick={e => { e.stopPropagation(); setDeleteCompConfirm(c) }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-900/70 hover:bg-red-600 text-white/70 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        title="Delete competition">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Tab-level download */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTabDlOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all border ${
            tabDlOpen
              ? 'bg-red-700/20 text-red-400 border-red-700/40'
              : `${L?'border-black/10 bg-black/5':'border-white/8 bg-white/5'} text-gray-400 hover:text-white`
          }`}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All Competitions Report
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            className={`transition-transform duration-200 ${tabDlOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      {tabDlOpen && (
        <div className={`p-4 rounded-xl border space-y-3 ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
          <div>
            <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>All Competitions Report</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">{comps.filter(c => isCurrentSession(c)).length} competitions this session · CSV exports one row per participation, PDF generates per-competition sections with volunteer cards</p>
          </div>
          {tabDlMsg && (
            <p className={`font-inter text-xs ${tabDlMsg.startsWith('✓') ? 'text-green-400' : tabDlMsg.startsWith('✗') ? 'text-red-400' : 'text-gray-400 animate-pulse'}`}>
              {tabDlMsg}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <GlassButton onClick={() => handleTabCompsDownload('csv')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-blue-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ Excel'}
            </GlassButton>
            <GlassButton onClick={() => handleTabCompsDownload('pdf')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-emerald-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ PDF Report'}
            </GlassButton>
            <GlassButton onClick={() => { setTabDlOpen(false); setTabDlMsg('') }} disabled={tabDlBusy}
              className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'32px' }}>
              Cancel
            </GlassButton>
          </div>
        </div>
      )}

      {/* Create form — triggered by the floating + button */}
      {creating && (
        <div className={`auth-glass rounded-2xl border p-5 space-y-4 ${L?'border-black/8':'border-white/8'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">New Competition</p>
            <button onClick={() => setCreating(false)} className="font-inter text-xs text-gray-500 hover:text-gray-300 transition-colors">✕ Cancel</button>
          </div>
            <div>
              <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Name *</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Competition 2026" />
            </div>
            <div className={`auth-glass rounded-xl p-3.5 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
              <div className="flex items-center justify-between">
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Themes</p>
                <button type="button" onClick={() => setForm(f=>({...f,details:{...f.details,themes:[...f.details.themes,'']}}))}
                  className="font-inter text-[10px] text-red-400 hover:text-red-300">+ Add</button>
              </div>
              {form.details.themes.length === 0
                ? <p className="font-inter text-[10px] text-gray-600">No themes yet.</p>
                : form.details.themes.map((t,i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={t} onChange={e => { const ts=[...form.details.themes]; ts[i]=e.target.value; setForm(f=>({...f,details:{...f.details,themes:ts}})) }}
                      className="glass-input flex-1 text-sm" style={{ borderRadius:'8px' }} placeholder={`Theme ${i+1}...`} />
                    <button type="button" onClick={() => setForm(f=>({...f,details:{...f.details,themes:f.details.themes.filter((_,j)=>j!==i)}}))}
                      className="text-gray-600 hover:text-red-400 px-1 text-sm">x</button>
                  </div>
                ))
              }
            </div>
            <div>
              <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Description</label>
              <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} placeholder="Brief description..." />
            </div>
            <div className={`auth-glass rounded-xl p-3.5 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Dates</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[['startDate','Start'],['submissionDeadline','Submit By'],['endDate','Reg. End'],['prizeDistributionDate','Prize Dist.'],['resultDate','Results']].map(([k,lbl]) => (
                  <div key={k}>
                    <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">{lbl}</label>
                    <input type="date" value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                      className="glass-input w-full text-xs" style={{ borderRadius:'8px', colorScheme:'dark' }} />
                  </div>
                ))}
              </div>
            </div>
            <EventDatesEditor L={L} value={form.eventDates}
              onChange={v => setForm(f=>({...f, eventDates:v}))} />
            <CustomDatesEditor L={L} value={form.customDates}
              onChange={v => setForm(f=>({...f, customDates:v}))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Venue</label>
                <input value={form.details.venue||''} onChange={e => setForm(f=>({...f,details:{...f.details,venue:e.target.value}}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Venue..." />
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Prize</label>
                <input value={form.details.prize||''} onChange={e => setForm(f=>({...f,details:{...f.details,prize:e.target.value}}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="e.g. Rs 5,000" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.showNewBadge} onChange={e => setForm(f=>({...f,showNewBadge:e.target.checked}))} className="accent-red-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show blinking NEW badge</span>
            </label>
            <div className={`auth-glass rounded-xl p-3.5 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Images</p>
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Logo / Card Image</label>
                <ImageUpload folder="competitions" onUpload={r => setBanner(r)} label="Upload logo" />
              </div>
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Competition Banner</label>
                <ImageUpload folder="competitions" onUpload={r => setCompBanner(r)} label="Upload banner" />
              </div>
            </div>
            {msg && <p className="font-inter text-xs text-red-400">{msg}</p>}
            <GlassButton onClick={create} variant="red" disabled={busy||!form.name}
              className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
              {busy ? 'Creating...' : 'Create Competition'}
            </GlassButton>
        </div>
      )}

      {/* Show Past Sessions toggle */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
        <div>
          <p className={`font-inter text-xs font-semibold ${L?'text-gray-700':'text-gray-300'}`}>Show previous years competitions to members</p>
          <p className="font-inter text-[10px] text-gray-500 mt-0.5">When off, past session competitions are hidden for members and coordinators. Admins and core always see them.</p>
        </div>
        <button
          onClick={toggleShowPast}
          disabled={settingBusy}
          className={`relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 ${
            showPastSetting
              ? 'bg-emerald-600 border-emerald-500'
              : L ? 'bg-black/10 border-black/15' : 'bg-white/10 border-white/15'
          } ${settingBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${showPastSetting ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Session filter */}
      {compAllSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="font-inter text-[10px] uppercase tracking-widest text-gray-400">Session</span>
          {compAllSessions.map(s => (
            <button key={s} onClick={() => { setCompSessionFilter(s); setCompFilter('all') }}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                compSessionFilter === s
                  ? 'bg-red-700 text-white border-red-700'
                  : L ? 'border-black/15 text-gray-600 hover:text-gray-900 hover:border-black/25'
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}>
              {s}{s === compCurSession ? ' · Current' : ''}
            </button>
          ))}
          {!showPastSetting && (
            <span className="font-inter text-[9px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/30 uppercase tracking-wider">Past hidden from members</span>
          )}
        </div>
      )}

      {/* Status filter */}
      {compSessionItems.length > 0 && (
        <div className={`flex flex-wrap gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
          {[['all','All'],['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past']].map(([id,label]) => (
            counts[id] > 0 || id === 'all' ? (
              <button key={id} onClick={() => setCompFilter(id)}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-inter text-[10px] sm:text-xs font-semibold capitalize transition-all ${
                  compFilter === id
                    ? {all:'bg-red-700',ongoing:'bg-green-700',upcoming:'bg-amber-700',past:'bg-gray-600'}[id] + ' text-white'
                    : 'text-gray-500 hover:text-white'
                }`}>
                {label} {counts[id] > 0 && <span className="opacity-70 text-[10px]">{counts[id]}</span>}
              </button>
            ) : null
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonGrid n={4} />
      ) : compSessionItems.length === 0 ? (
        <div className={`py-16 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold text-lg ${L?'text-gray-900':'text-white'}`}>No competitions{compIsPast ? ` in ${compSessionFilter}` : ' yet'}</p>
        </div>
      ) : compFiltered.length === 0 ? (
        <div className={`py-12 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold text-lg ${L?'text-gray-900':'text-white'}`}>No {compFilter} competitions</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4${compIsPast ? ' opacity-80' : ''}`}>
          {compFiltered.map(c => <CompCard key={c._id} c={c} dim={compIsPast} />)}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteCompConfirm}
        title="Delete Competition?"
        message={deleteCompConfirm ? `Are you sure you want to delete "${deleteCompConfirm.name}"? This will permanently delete all competition data, gallery photos, winner records, volunteer assignments, and all uploaded files from storage. This cannot be undone.` : ''}
        confirmLabel="Yes, Delete Everything"
        onConfirm={doDeleteComp}
        onCancel={() => setDeleteCompConfirm(null)}
      />

      <CreateFAB label="Create Competition" isActive={creating} onCreate={() => setCreating(c => !c)} />
      <DownloadingOverlay visible={tabDlBusy} message={tabDlMsg} />
      <RouteBlockDialog blocker={createBlocker} L={L} />
    </div>
  )
}

// ── Competition detail manager ─────────────────────────────────────────────────
function CompetitionManager({ comp: initial, onBack, currentUser, L }) {
  const [comp,        setComp]        = useState(initial)
  const [allMembers,  setAllMembers]  = useState([])
  const [tab,         setTab]         = useState('details')
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState('')
  const [mgrDlBusy, setMgrDlBusy] = useState(false)
  const [mgrDlMsg,  setMgrDlMsg]  = useState('')
  const [newAnnounce, setNewAnnounce] = useState('')
  const [newWinner,   setNewWinner]   = useState({ name:'', label:'1st Prize', position:1 })
  const [winPhoto,    setWinPhoto]    = useState(null)
  const [winningPhoto,setWinningPhoto]= useState(null)
  const [editWinner,  setEditWinner]  = useState(null) // { _id, name, label, photoUrl, winningPhotoUrl, _newPortrait, _newWinning }
  const [addingLink,  setAddingLink]  = useState(false)
  const [linkForm,    setLinkForm]    = useState({ name:'', url:'', type:'external' })

  const [galleryLightboxIdx, setGalleryLightboxIdx] = useState(null)
  const [logoBanner,  setLogoBanner]  = useState(null)
  const [compBanner,  setCompBanner]  = useState(null)
  const [form, setForm] = useState({
    name:                 initial.name || '',
    description:          initial.description || '',
    startDate:            initial.startDate             ? initial.startDate.slice(0,10)             : '',
    endDate:              initial.endDate               ? initial.endDate.slice(0,10)               : '',
    eventDates:           initial.eventDates?.map(d => d?.slice?.(0,10) || '') || (initial.eventDate ? [initial.eventDate.slice(0,10)] : []),
    submissionDeadline:   initial.submissionDeadline    ? initial.submissionDeadline.slice(0,10)    : '',
    resultDate:           initial.resultDate            ? initial.resultDate.slice(0,10)            : '',
    prizeDistributionDate:initial.prizeDistributionDate ? initial.prizeDistributionDate.slice(0,10) : '',
    showNewBadge:         initial.showNewBadge    || false,
    manualStatus:         initial.manualStatus    || false,
    status:               initial.manualStatus ? (initial.status || '') : '',
    googleFormUrl:        initial.googleFormUrl   || '',
    formPublished:        initial.formPublished   || false,
    prizeEnabled:         initial.prizeEnabled    !== false,
    allowVolunteersEdit:  initial.allowVolunteersEdit !== false,
    details: {
      themes: initial.details?.themes?.length ? initial.details.themes : [],
      venue:  initial.details?.venue  || '',
      prize:  initial.details?.prize  || '',
      rules:  initial.details?.rules  || '',
    },
    judges: initial.judges?.length
      ? initial.judges.map(j => ({ _id:j._id, name:j.name, bio:j.bio||'', photoUrl:j.photoUrl||'', _file:null, _preview:j.photoUrl||'' }))
      : [],
    customDates: initial.customDates?.map(cd => ({ ...cd, date: cd.date?.slice(0,10) || '' })) || [],
  })

  useEffect(() => {
    competitionsApi.get(comp._id).then(d => setComp(d.competition)).catch(() => {})
    membersApi.list().then(d => setAllMembers(d.members)).catch(() => {})
  }, [comp._id])

  const [backConfirm, setBackConfirm] = useState(false)
  const { toast } = useToast()

  const isDirty = useMemo(() => {
    const f = form, c = comp
    return f.name !== (c.name || '') ||
      f.description !== (c.description || '') ||
      f.manualStatus !== (c.manualStatus || false) ||
      f.status !== (c.manualStatus ? (c.status || '') : '') ||
      f.googleFormUrl !== (c.googleFormUrl || '') ||
      f.formPublished !== (c.formPublished || false)
  }, [form, comp])
  const routeBlocker = useUnsavedGuard(isDirty)

  const refresh = async () => { const d = await competitionsApi.get(comp._id); setComp(d.competition) }
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleCoordPerm = async (field) => {
    const newVal = !comp[field]
    try { await competitionsApi.setCoordPerms(comp._id, { [field]: newVal }) }
    catch (e) { console.error('toggleCoordPerm failed:', e.message); return }
    setComp(c => ({ ...c, [field]: newVal }))
  }
  const setDetail = (k, v) => setForm(f => ({ ...f, details: { ...f.details, [k]: v } }))

  const save = async () => {
    setBusy(true); setMsg('')
    try {
      const judgesSaved = await Promise.all(form.judges.map(async j => {
        if (j._file) {
          const { key, publicUrl } = await uploadFileToS3(j._file, 'competitions')
          return { name:j.name, bio:j.bio, photoUrl:publicUrl, s3Key:key }
        }
        return { name:j.name, bio:j.bio, photoUrl:j.photoUrl||'', s3Key:j.s3Key||'' }
      }))
      const body = { ...form, judges:judgesSaved, manualStatus:!!form.status, status:form.status||undefined, eventDate: form.eventDates?.[0] || undefined }
      if (logoBanner) { body.bannerUrl = logoBanner.publicUrl; body.bannerS3Key = logoBanner.key }
      if (compBanner) { body.competitionBannerUrl = compBanner.publicUrl; body.competitionBannerS3Key = compBanner.key }
      const d = await competitionsApi.update(comp._id, body)
      setComp(d.competition); toast.success('Saved', 'Competition details updated')
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const addWinner = async () => {
    if (!newWinner.name) return setMsg('Winner name required.')
    setBusy(true)
    try {
      await competitionsApi.addWinner(comp._id, {
        ...newWinner,
        photoUrl:        winPhoto?.publicUrl,     photoS3Key:        winPhoto?.key,
        winningPhotoUrl: winningPhoto?.publicUrl, winningPhotoS3Key: winningPhoto?.key,
      })
      setNewWinner({ name:'', label:'1st Prize', position:1 }); setWinPhoto(null); setWinningPhoto(null)
      refresh()
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const [uploadingGallery, setUploadingGallery] = useState(false)
  const uploadGalleryPhoto = async (file) => {
    setUploadingGallery(true)
    try {
      const { key, publicUrl } = await uploadFileToS3(file, 'competitions')
      await competitionsApi.addGalleryPhoto(comp._id, { imageUrl:publicUrl, s3Key:key })
      refresh()
    } catch(e) { setMsg(e.message) }
    finally { setUploadingGallery(false) }
  }

  const moveGallery = async (photos, fromIdx, toIdx) => {
    const reordered = [...photos]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await competitionsApi.reorderGallery(comp._id, reordered.map(p => p._id))
    refresh()
  }

  // ── Volunteer state (mirrors event member system) ─────────────────────────
  const [pendingVolAdds,  setPendingVolAdds]  = useState(new Set())
  const [volSearch,       setVolSearch]       = useState('')
  const [volSaving,       setVolSaving]       = useState(false)
  const [volMsg,          setVolMsg]          = useState('')
  const [removeVolConfirm,setRemoveVolConfirm]= useState(null)
  const [showVolFilters,  setShowVolFilters]  = useState(false)
  const [volFilter,       setVolFilter]       = useState({ year:'all', stream:'all', role:'all' })
  const [roleVolConfirm,  setRoleVolConfirm]  = useState(null)  // {uid,name,from,to,verb}

  const isAdmin = currentUser?.role === 'admin'

  // Cores excluded by admin — leave implicit list, appear in "Add Volunteers"
  const excludedVolCoreIds = new Set((comp.excludedCores || []).map(u =>
    (u && typeof u === 'object') ? u._id?.toString() : u?.toString()
  ).filter(Boolean))

  // Build display rows: non-excluded cores first (implicit), then explicit non-core volunteers
  const explicitVolByUid = new Map((comp.volunteers||[]).map(v => {
    const uid = (v.user && typeof v.user === 'object') ? v.user?._id?.toString() : v.user?.toString()
    return [uid, v]
  }))
  const coreMembers = allMembers.filter(m => m.role === 'core' && !excludedVolCoreIds.has(m._id?.toString()))
  const volDisplayRows = [
    // Non-excluded cores — default volRole='core'; admin can override via explicit assignment
    ...coreMembers.map(c => {
      const explicit = explicitVolByUid.get(c._id?.toString())
      return { user: c, volRole: explicit?.role || 'core', isImplicit: !explicit }
    }),
    // Explicit non-core volunteers
    ...(comp.volunteers||[])
      .filter(v => {
        const u = v.user
        if (!u || typeof u !== 'object') return false
        return u.role !== 'admin' && u.role !== 'core'
      })
      .map(v => ({ user: v.user, volRole: v.role, isImplicit: false })),
  ]
  // Sort: core → coordinator → volunteer; within each group, insertion order (newest last)
  const VOL_ROLE_RANK = { core: 0, coordinator: 1, volunteer: 2 }
  volDisplayRows.sort((a, b) => (VOL_ROLE_RANK[a.volRole] ?? 2) - (VOL_ROLE_RANK[b.volRole] ?? 2))

  // Filter + derived values (mirrors event member filter system)
  const uniqueVolYears   = [...new Set(volDisplayRows.map(r => { const u=r.user; return u?.startYear&&u?.endYear?(computeAcademicYear(u.startYear,u.endYear).label||null):null }).filter(Boolean))]
  const uniqueVolStreams  = [...new Set(volDisplayRows.map(r => r.user?.department).filter(Boolean))]
  const uniqueVolRoles   = [...new Set(volDisplayRows.map(r => r.volRole).filter(Boolean))]
  const filteredVolRows  = volDisplayRows.filter(row => {
    const u = row.user; if (!u || typeof u !== 'object') return false
    if (volFilter.year   !== 'all' && (computeAcademicYear(u.startYear, u.endYear).label||'—') !== volFilter.year)   return false
    if (volFilter.stream !== 'all' && u.department !== volFilter.stream) return false
    if (volFilter.role   !== 'all' && row.volRole  !== volFilter.role)   return false
    return true
  })
  const volFiltered = volFilter.year!=='all' || volFilter.stream!=='all' || volFilter.role!=='all'

  const volIds    = new Set(volDisplayRows.map(r => r.user?._id?.toString()).filter(Boolean))
  const notInComp = allMembers.filter(m => {
    if (m.role === 'admin') return false
    if (volIds.has(m._id?.toString())) return false
    if (m.role === 'core') return excludedVolCoreIds.has(m._id?.toString()) // excluded cores appear here
    return true
  })
  const filteredNotInComp = volSearch.trim()
    ? notInComp.filter(m => m.name?.toLowerCase().includes(volSearch.toLowerCase()) || m.department?.toLowerCase().includes(volSearch.toLowerCase()))
    : notInComp

  const canRemoveVol = (userObj, isCore, isImplicit) => {
    if (!userObj) return false
    if (isAdmin) return true                  // admin removes anyone (explicit or implicit cores)
    if (isCore || isImplicit) return false    // core users cannot remove other cores
    const uRole = typeof userObj === 'object' ? userObj.role : ''
    return currentUser?.role === 'core' && uRole !== 'admin' && uRole !== 'core'
  }

  const toggleVolPending = (uid) => setPendingVolAdds(prev => {
    const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next
  })

  const saveVolunteers = async () => {
    if (!pendingVolAdds.size) return
    setVolSaving(true); setVolMsg('')
    let added = 0
    try {
      for (const uid of pendingVolAdds) {
        await competitionsApi.addVolunteer(comp._id, uid)
        added++
      }
      setPendingVolAdds(new Set())
      toast.success('Added', `${added} volunteer${added>1?'s':''} notified by email`)
      setVolMsg(''); refresh()
    } catch (e) { setVolMsg(`✗ ${e.message}`) }
    finally { setVolSaving(false) }
  }

  const removeVol = async () => {
    await competitionsApi.removeVolunteer(comp._id, removeVolConfirm).catch(()=>{})
    setRemoveVolConfirm(null); refresh()
  }

  const setVolRole = async (uid, role) => {
    await competitionsApi.setVolunteerRole(comp._id, uid, role).catch(()=>{})
    refresh()
  }

  const handleMgrCompDownload = async (fmt) => {
    setMgrDlBusy(true); setMgrDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      const members = volDisplayRows.map(row => ({ user: row.user, role: row.volRole }))
      if (fmt === 'csv') {
        await downloadSingleItemCSV({ item: comp, itemType: 'competition', members })
        setMgrDlMsg('✓ Downloaded')
      } else {
        await downloadSingleItemPDF({ item: comp, itemType: 'competition', members, onProgress: msg => setMgrDlMsg(msg || 'Building PDF…') })
        setMgrDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setMgrDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setMgrDlBusy(false), 1600) } else { setMgrDlBusy(false) }
      setTimeout(() => setMgrDlMsg(''), 3500)
    }
  }

  const SUBTABS = ['details','gallery','winners','volunteers','announcements']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => isDirty ? setBackConfirm(true) : onBack()} className="text-gray-500 hover:text-white transition-colors">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className={`font-clash text-xl font-semibold flex items-center gap-2 ${L?'text-gray-900':'text-white'}`}>
          {comp.name}
          {comp.showNewBadge && <span className="font-inter text-[9px] px-1.5 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-wider animate-pulse">NEW</span>}
        </h2>
        {isDirty && <span className="font-inter text-xs text-amber-400/80 ml-1">Unsaved</span>}
      </div>

      <div className={`flex flex-wrap gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
        {SUBTABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg font-inter text-xs font-medium capitalize transition-all ${tab===t?'bg-red-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
            {t === 'volunteers' ? `Volunteers (${volDisplayRows.length})` : t}
          </button>
        ))}
      </div>

      {/* DETAILS */}
      {tab === 'details' && (
        <div className="space-y-4 tab-panel-sub">
          <CoordToggle L={L} label="edit competition details" value={comp.coordCanEditDetails !== false}
            onChange={() => toggleCoordPerm('coordCanEditDetails')} />
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Name *</label>
            <input value={form.name} onChange={e => setF('name',e.target.value)} className="glass-input w-full" style={{ borderRadius:'10px' }} />
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <div className="flex items-center justify-between">
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Themes</p>
              <button type="button" onClick={() => setDetail('themes',[...form.details.themes,''])}
                className="font-inter text-[10px] text-red-400 hover:text-red-300">+ Add Theme</button>
            </div>
            {form.details.themes.length === 0
              ? <p className="font-inter text-[10px] text-gray-600">No themes yet.</p>
              : form.details.themes.map((t,i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={t} onChange={e => { const ts=[...form.details.themes]; ts[i]=e.target.value; setDetail('themes',ts) }}
                    className="glass-input flex-1 text-sm" style={{ borderRadius:'9px' }} placeholder={`Theme ${i+1}...`} />
                  <button type="button" onClick={() => setDetail('themes',form.details.themes.filter((_,j)=>j!==i))}
                    className="text-gray-600 hover:text-red-400 px-1 text-sm">x</button>
                </div>
              ))
            }
          </div>

          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Description</label>
            <textarea value={form.description} onChange={e => setF('description',e.target.value)} rows={3} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} />
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Dates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['startDate',            'Start Date'],
                ['submissionDeadline',   'Submission Deadline'],
                ['endDate',              'Registration End'],
                ['prizeDistributionDate','Prize Distribution'],
                ['resultDate',           'Result Announcement'],
              ].map(([k,lbl]) => (
                <div key={k}>
                  <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">{lbl}</label>
                  <input type="date" value={form[k]} onChange={e => setF(k,e.target.value)}
                    className="glass-input w-full text-xs" style={{ borderRadius:'9px', colorScheme:'dark' }} />
                </div>
              ))}
            </div>
          </div>

          <EventDatesEditor L={L} value={form.eventDates}
            onChange={v => setF('eventDates', v)} />
          <CustomDatesEditor L={L} value={form.customDates}
            onChange={v => setF('customDates', v)} />

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Judges</p>
              <button type="button" onClick={() => setF('judges',[...form.judges,{name:'',bio:'',photoUrl:'',_file:null,_preview:''}])}
                className="font-inter text-[10px] text-red-400 hover:text-red-300">+ Add Judge</button>
            </div>
            {form.judges.map((j,i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-xl border ${L?'border-black/6':'border-white/6'} items-start`}>
                <label className="shrink-0 cursor-pointer">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-gray-800 flex items-center justify-center">
                    {j._preview ? <img src={j._preview} alt="" className="w-full h-full object-cover" /> : <span className="font-inter text-[9px] text-gray-600">Photo</span>}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files[0]; if (!file) return
                    const preview = URL.createObjectURL(file)
                    const js=[...form.judges]; js[i]={...js[i],_file:file,_preview:preview}; setF('judges',js)
                  }} />
                </label>
                <div className="flex-1 space-y-2 min-w-0">
                  <input value={j.name} onChange={e => { const js=[...form.judges]; js[i]={...js[i],name:e.target.value}; setF('judges',js) }}
                    className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="Judge name *" />
                  <input value={j.bio||''} onChange={e => { const js=[...form.judges]; js[i]={...js[i],bio:e.target.value}; setF('judges',js) }}
                    className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} placeholder="Bio / designation (optional)" />
                </div>
                <button type="button" onClick={() => setF('judges',form.judges.filter((_,k)=>k!==i))}
                  className="text-gray-600 hover:text-red-400 shrink-0 px-1 text-sm">x</button>
              </div>
            ))}
            {form.judges.length === 0 && <p className="font-inter text-[10px] text-gray-600">No judges added.</p>}
          </div>

          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Venue</label>
            <input value={form.details.venue||''} onChange={e => setDetail('venue',e.target.value)} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Venue..." />
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Prize</p>
              <button type="button" onClick={() => setF('prizeEnabled',!form.prizeEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${form.prizeEnabled?'bg-green-600':'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${form.prizeEnabled?'translate-x-4':'translate-x-0.5'}`} />
              </button>
            </div>
            {form.prizeEnabled && (
              <input value={form.details.prize||''} onChange={e => setDetail('prize',e.target.value)}
                className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="e.g. Rs 5,000 + Certificate" />
            )}
          </div>

          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Rules</label>
            <textarea value={form.details.rules||''} onChange={e => setDetail('rules',e.target.value)} rows={3} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} placeholder="Competition rules..." />
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Google Form Submission</p>
            <input value={form.googleFormUrl} onChange={e => setF('googleFormUrl',e.target.value)} className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} placeholder="https://forms.google.com/..." />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.formPublished} onChange={e => setF('formPublished',e.target.checked)} className="accent-red-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show form link publicly</span>
            </label>
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Visibility &amp; Permissions</p>
            <label className="flex items-center gap-3 cursor-pointer" onClick={async () => {
              const v = !comp.isOpenToAll
              await competitionsApi.setOpenToAll(comp._id, v).catch(() => {})
              setComp(c => ({ ...c, isOpenToAll: v }))
            }}>
              <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${comp.isOpenToAll?'bg-green-600':'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${comp.isOpenToAll?'translate-x-4':'translate-x-0.5'}`} />
              </div>
              <span className="font-inter text-xs text-gray-400">Open to all — anyone can view competition details (not just enrolled volunteers)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setF('allowVolunteersEdit',!form.allowVolunteersEdit)}>
              <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${form.allowVolunteersEdit?'bg-green-600':'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${form.allowVolunteersEdit?'translate-x-4':'translate-x-0.5'}`} />
              </div>
              <span className="font-inter text-xs text-gray-400">Allow coordinators/volunteers to edit this competition</span>
            </label>
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setForm(f=>({...f, manualStatus:false, status:''}))}
                className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                  !form.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                }`}>
                Auto
              </button>
              {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                <button key={lbl} type="button"
                  onClick={() => setForm(f=>({...f, manualStatus:true, status:val}))}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                    form.manualStatus && form.status===val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
            {!form.manualStatus && <p className="font-inter text-[10px] text-gray-500">Auto — computed from dates. Current: <span className="capitalize text-gray-400">{comp.status || 'upcoming'}</span></p>}
            {form.manualStatus && form.status === '' && <p className="font-inter text-[10px] text-yellow-500">No status badge shown on card</p>}
            {form.manualStatus && form.status !== '' && <p className="font-inter text-[10px] text-gray-500">Manually set to <span className="capitalize text-gray-400">{form.status}</span></p>}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.showNewBadge} onChange={e => setF('showNewBadge',e.target.checked)} className="accent-red-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show NEW badge</span>
            </label>
          </div>

          {/* Links */}
          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Links</p>
              <p className="font-inter text-[9px] text-gray-600">Certificate, result, resource links — shown publicly</p>
            </div>
            {comp.links?.map(lnk => (
              <div key={lnk._id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${L?'border-black/6':'border-white/6'}`}>
                <span className={`font-inter text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border ${lnk.type==='certificate'?'bg-amber-900/40 text-amber-400 border-amber-700/40':lnk.type==='resource'?'bg-blue-900/40 text-blue-400 border-blue-700/40':'bg-gray-800/40 text-gray-400 border-gray-700/30'}`}>{lnk.type}</span>
                <p className={'font-inter text-xs flex-1 truncate ' + (L?'text-gray-700':'text-gray-300')}>{lnk.name}</p>
                <p className="font-inter text-[10px] text-gray-600 truncate max-w-[100px] hidden sm:block">{lnk.url}</p>
                <button onClick={async () => { await competitionsApi.deleteLink(comp._id, lnk._id); refresh() }}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0">✕</button>
              </div>
            ))}
            {addingLink ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={linkForm.name} onChange={e=>setLinkForm(f=>({...f,name:e.target.value}))} className="glass-input text-sm" style={{ borderRadius:'8px' }} placeholder="Link name (e.g. Certificate)" />
                  <input value={linkForm.url} onChange={e=>setLinkForm(f=>({...f,url:e.target.value}))} className="glass-input text-sm sm:col-span-2" style={{ borderRadius:'8px' }} placeholder="https://..." />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {['certificate','external','resource'].map(t => (
                    <button key={t} type="button" onClick={() => setLinkForm(f=>({...f,type:t}))}
                      className={`font-inter text-[9px] px-2.5 py-1 rounded-lg border capitalize transition-all ${linkForm.type===t?'bg-red-700 text-white border-red-700':'text-gray-400 border-white/10 hover:text-white'}`}>{t}</button>
                  ))}
                  <div className="flex gap-2 ml-auto">
                    <GlassButton variant="red" disabled={!linkForm.name||!linkForm.url} onClick={async () => {
                      await competitionsApi.addLink(comp._id, linkForm)
                      setLinkForm({name:'',url:'',type:'external'}); setAddingLink(false); refresh()
                    }} className="font-inter text-xs px-3" style={{ borderRadius:'8px', minHeight:'28px' }}>Add</GlassButton>
                    <button onClick={() => setAddingLink(false)} className="font-inter text-[10px] text-gray-500 hover:text-white transition-colors">Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLink(true)} className="font-inter text-[10px] text-red-400 hover:text-red-300 transition-colors">+ Add Link</button>
            )}
          </div>

          {/* Banners */}
          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-4`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Images</p>
            <div>
              <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Logo / Card Image</label>
              <ImageUpload folder="competitions" onUpload={r => setLogoBanner(r)} label="Upload logo" currentUrl={comp.bannerUrl} />
            </div>
            <div>
              <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Competition Banner (shown on detail page)</label>
              <ImageUpload folder="competitions" onUpload={r => setCompBanner(r)} label="Upload competition banner" currentUrl={comp.competitionBannerUrl} />
            </div>
          </div>

          {msg && <p className={`font-inter text-xs ${msg.startsWith('Saved')?'text-green-400':'text-red-400'}`}>{msg}</p>}
          <GlassButton onClick={save} variant="red" disabled={busy} className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
            {busy ? 'Saving...' : 'Save Changes'}
          </GlassButton>
        </div>
      )}

      {/* GALLERY */}
      {tab === 'gallery' && (
        <div className="space-y-4 tab-panel-sub">
          {/* Show in Gallery toggle */}
          <div className={`flex items-center justify-between py-2 border-b ${L?'border-black/5':'border-white/5'}`}>
            <div>
              <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'}`}>Show in Public Gallery</p>
              <p className="font-inter text-[10px] text-gray-500 mt-0.5">Auto = visible when competition is past or active</p>
            </div>
            <div className="flex gap-1">
              {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
                const active = val === null ? (comp.showInGallery === null || comp.showInGallery === undefined) : comp.showInGallery === val
                return (
                  <button key={lbl}
                    onClick={async () => {
                      await competitionsApi.setGalleryVisibility(comp._id, val).catch(() => {})
                      setComp(c => ({ ...c, showInGallery: val }))
                    }}
                    className={`px-2.5 py-1 rounded-lg font-inter text-[10px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                    {lbl}
                  </button>
                )
              })}
            </div>
          </div>
          <CoordToggle L={L} label="upload & manage gallery" value={comp.coordCanManageGallery !== false}
            onChange={() => toggleCoordPerm('coordCanManageGallery')} />

          <DriveLinkSetting L={L} value={comp.driveLink} onSave={async link => {
            const d = await competitionsApi.update(comp._id, { driveLink: link }); setComp(d.competition)
          }} />

          <div className="flex items-center justify-between">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">{comp.gallery?.length||0} Photos</p>
            <label className="glass-btn glass-btn-light inline-flex items-center gap-2 px-4 font-inter text-xs cursor-pointer" style={{ borderRadius:'10px', minHeight:'36px' }}>
              {uploadingGallery && <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />}
              {uploadingGallery ? 'Uploading…' : '+ Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={e => uploadGalleryPhoto(e.target.files[0])} disabled={uploadingGallery} />
            </label>
          </div>
          {!comp.gallery?.length
            ? <p className={`text-center py-10 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No gallery photos yet.</p>
            : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {comp.gallery.map((p,i) => (
                  <div key={p._id} className="relative group rounded-xl overflow-hidden aspect-square cursor-pointer" onClick={() => setGalleryLightboxIdx(i)}>
                    <ProgressiveImage src={p.imageUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {i > 0 && (
                        <button onClick={e => { e.stopPropagation(); moveGallery(comp.gallery, i, i-1) }}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-xs">Prev</button>
                      )}
                      {i < comp.gallery.length-1 && (
                        <button onClick={e => { e.stopPropagation(); moveGallery(comp.gallery, i, i+1) }}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-xs">Next</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); competitionsApi.deleteGalleryPhoto(comp._id, p._id).then(() => refresh()) }}
                        className="w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center text-xs">Del</button>
                    </div>
                    <div className="absolute top-1.5 left-1.5 font-inter text-[8px] text-white/60 bg-black/40 rounded px-1">{i+1}</div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {galleryLightboxIdx !== null && (
        <Lightbox
          photos={(comp.gallery || []).map(p => ({ url: p.imageUrl }))}
          startIndex={galleryLightboxIdx}
          onClose={() => setGalleryLightboxIdx(null)}
        />
      )}

      {/* WINNERS */}
      {tab === 'winners' && (
        <div className="space-y-4 tab-panel-sub">
          <CoordToggle L={L} label="manage winners" value={comp.coordCanManageWinners === true}
            onChange={() => toggleCoordPerm('coordCanManageWinners')} />

          {/* Existing winners list */}
          {comp.winners?.length > 0 && (
            <div className="space-y-3">
              {comp.winners.map(w => (
                <div key={w._id}>
                  {editWinner?._id === w._id ? (
                    /* ── Inline edit form ── */
                    <div className={`auth-glass rounded-xl p-4 border ${L?'border-red-600/30 bg-red-900/5':'border-red-600/25 bg-red-900/5'} space-y-3`}>
                      <p className="font-inter text-[11px] text-red-400 uppercase tracking-widest">Editing Winner</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Name *</label>
                          <input value={editWinner.name} onChange={e => setEditWinner(v=>({...v,name:e.target.value}))}
                            className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} />
                        </div>
                        <div>
                          <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Prize Label</label>
                          <input value={editWinner.label} onChange={e => setEditWinner(v=>({...v,label:e.target.value}))}
                            className="glass-input w-full text-sm" style={{ borderRadius:'8px' }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Portrait</label>
                          {editWinner.photoUrl && <img src={editWinner._newPortrait?.publicUrl||editWinner.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mb-1.5 border border-white/10" />}
                          <ImageUpload folder="competitions" onUpload={r => setEditWinner(v=>({...v,_newPortrait:r}))} label="Replace portrait" preview />
                        </div>
                        <div>
                          <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Winning Photo</label>
                          {editWinner.winningPhotoUrl && <img src={editWinner._newWinning?.publicUrl||editWinner.winningPhotoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mb-1.5 border border-amber-600/30" />}
                          <ImageUpload folder="competitions" onUpload={r => setEditWinner(v=>({...v,_newWinning:r}))} label="Replace photo" preview />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <GlassButton variant="red" disabled={busy||!editWinner.name} onClick={async () => {
                          setBusy(true)
                          try {
                            const body = { name:editWinner.name, label:editWinner.label }
                            if (editWinner._newPortrait) { body.photoUrl=editWinner._newPortrait.publicUrl; body.photoS3Key=editWinner._newPortrait.key }
                            if (editWinner._newWinning)  { body.winningPhotoUrl=editWinner._newWinning.publicUrl; body.winningPhotoS3Key=editWinner._newWinning.key }
                            await competitionsApi.updateWinner(comp._id, editWinner._id, body)
                            setEditWinner(null); refresh()
                          } catch (e) { setMsg(e.message) }
                          finally { setBusy(false) }
                        }} className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'34px' }}>
                          {busy ? 'Saving…' : 'Save'}
                        </GlassButton>
                        <GlassButton onClick={() => setEditWinner(null)} className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'34px' }}>Cancel</GlassButton>
                      </div>
                    </div>
                  ) : (
                    /* ── Winner row ── */
                    <div className={`flex items-center gap-3 p-3 auth-glass rounded-xl border ${L?'border-black/8':'border-white/8'}`}>
                      <div className="flex gap-2 shrink-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 border border-white/10">
                          {w.photoUrl ? <img src={w.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-base">👤</div>}
                        </div>
                        {w.winningPhotoUrl && (
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 border border-amber-600/30">
                            <img src={w.winningPhotoUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-clash font-semibold truncate ${L?'text-gray-900':'text-white'}`}>{w.name}</p>
                        <p className="font-inter text-xs text-amber-400">{w.label}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setEditWinner({ _id:w._id, name:w.name, label:w.label, photoUrl:w.photoUrl||'', winningPhotoUrl:w.winningPhotoUrl||'', _newPortrait:null, _newWinning:null })}
                          className="font-inter text-[10px] px-2.5 py-1 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-all">Edit</button>
                        <button onClick={async () => { await competitionsApi.deleteWinner(comp._id, w._id); refresh() }}
                          className="font-inter text-[10px] px-2.5 py-1 rounded-lg border border-red-500/20 text-red-500/60 hover:text-red-400 hover:border-red-500/40 transition-all">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add winner */}
          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Add Winner</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Name *</label>
                <input value={newWinner.name} onChange={e => setNewWinner(w=>({...w,name:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'9px' }} placeholder="Winner name" />
              </div>
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Prize Label</label>
                <input value={newWinner.label} onChange={e => setNewWinner(w=>({...w,label:e.target.value}))} className="glass-input w-full text-sm" style={{ borderRadius:'9px' }} placeholder="1st Prize" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Winner Portrait</label>
                <ImageUpload folder="competitions" onUpload={r => setWinPhoto(r)} label="Upload portrait" preview />
              </div>
              <div>
                <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Winning Photo</label>
                <ImageUpload folder="competitions" onUpload={r => setWinningPhoto(r)} label="Upload winning photo" preview />
              </div>
            </div>
            <GlassButton onClick={addWinner} variant="red" disabled={busy||!newWinner.name} className="w-full font-inter text-xs" style={{ borderRadius:'10px', minHeight:'38px' }}>
              Add Winner
            </GlassButton>
          </div>
          {msg && <p className={`font-inter text-xs ${msg.startsWith('Saved')?'text-green-400':'text-red-400'}`}>{msg}</p>}
        </div>
      )}

      {/* VOLUNTEERS */}
      {tab === 'volunteers' && (
        <div className="space-y-5 tab-panel-sub">

          {/* ── Current volunteers table ── */}
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} space-y-2.5`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">
                  Volunteers ({volFiltered ? `${filteredVolRows.length} of ${volDisplayRows.length}` : volDisplayRows.length})
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-inter text-[9px] text-gray-600 hidden sm:block">Cores always participate</p>
                  {mgrDlMsg && <span className={`font-inter text-[9px] ${mgrDlMsg.startsWith('✓')?'text-green-400':mgrDlMsg.startsWith('✗')?'text-red-400':'text-gray-400 animate-pulse'}`}>{mgrDlMsg}</span>}
                  <button onClick={() => handleMgrCompDownload('csv')} disabled={mgrDlBusy}
                    title="Download Excel"
                    className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}>
                    ↓ Excel
                  </button>
                  <button onClick={() => handleMgrCompDownload('pdf')} disabled={mgrDlBusy}
                    title="Download PDF"
                    className="font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all text-emerald-400/70 border-emerald-800/30 hover:text-emerald-400">
                    ↓ PDF
                  </button>
                  <button onClick={()=>setShowVolFilters(v=>!v)} className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${showVolFilters?'bg-red-700/20 text-red-400 border-red-700/40':`${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}`}>
                    {showVolFilters?'✕ Filters':'⚙ Filter'}
                  </button>
                </div>
              </div>
              {showVolFilters && (
                <div className="flex gap-2 flex-wrap">
                  {[{key:'year',label:'Year',opts:uniqueVolYears},{key:'stream',label:'Stream',opts:uniqueVolStreams},{key:'role',label:'Role',opts:uniqueVolRoles}].map(f=>(
                    <select key={f.key} value={volFilter[f.key]} onChange={e=>setVolFilter(p=>({...p,[f.key]:e.target.value}))} className="glass-input text-[10px] appearance-none px-2 py-1" style={{borderRadius:8}}>
                      <option value="all">All {f.label}s</option>
                      {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                  {volFiltered && <button onClick={()=>setVolFilter({year:'all',stream:'all',role:'all'})} className="font-inter text-[10px] text-red-400 hover:text-red-300 px-2">✕ Clear</button>}
                </div>
              )}
            </div>

            {filteredVolRows.length === 0 ? (
              <p className="p-6 text-center font-inter text-sm text-gray-600">{volFiltered ? 'No volunteers match filters.' : 'No volunteers yet.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className={`border-b ${L?'border-black/5':'border-white/5'}`}>
                      {['Volunteer','Stream','Year','Role',''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-inter text-[9px] text-gray-500 uppercase tracking-[0.12em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVolRows.map((row, i) => {
                      const u      = row.user
                      const name   = u?.name       || '—'
                      const email  = u?.email      || ''
                      const dept   = u?.department || '—'
                      const yrObj  = u?.startYear ? computeAcademicYear(u.startYear, u.endYear) : null
                      const yr     = yrObj ? yrObj.label || '—' : '—'
                      const uid    = u?._id?.toString() || u
                      const isCore = u?.role === 'core'
                      const showRemove = isAdmin
                        ? (!row.isImplicit || isCore)
                        : canRemoveVol(u, isCore, row.isImplicit)
                      const volAccent = row.volRole==='core' ? 'rgba(245,158,11,0.55)' : row.volRole==='coordinator' ? 'rgba(99,179,237,0.45)' : 'transparent'
                      return (
                        <tr key={i} className={`border-b last:border-0 ${L?'border-black/5':'border-white/5'} hover:bg-white/[0.02] transition-colors`}
                          style={{ boxShadow:`inset 3px 0 0 ${volAccent}` }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0 flex items-center justify-center">
                                {u?.profilePhoto
                                  ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                                  : <span className="font-inter text-[10px] font-bold text-white">{name[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{name}</p>
                                {email && <p className="font-inter text-[9px] text-gray-500 truncate">{email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 truncate max-w-[120px]">{dept}</p></td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 whitespace-nowrap">{yr}</p></td>
                          {/* Role — admin sees dropdown; non-admin sees badge for cores */}
                          <td className="px-4 py-3">
                            {isCore && !isAdmin ? (
                              <span className="font-inter text-[10px] px-2 py-1 rounded-lg border border-amber-500/30 text-amber-400 bg-amber-900/10 capitalize">Core</span>
                            ) : (
                              <select value={row.volRole}
                                onChange={e => setRoleVolConfirm({ uid, name, from:row.volRole, to:e.target.value, verb: ['coordinator','core'].indexOf(e.target.value)>['coordinator','core'].indexOf(row.volRole)?'promote':'demote' })}
                                className="glass-input text-[10px] appearance-none px-2 py-1 capitalize"
                                style={{ borderRadius:8, minWidth:100 }}>
                                {(isCore ? ['core','coordinator','volunteer'] : ['volunteer','coordinator']).map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          {/* Actions — mirrors event member logic exactly */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end flex-wrap">
                              {/* Promote — admin: anyone incl. cores; core user: explicit non-cores only */}
                              {(isAdmin||(!isCore&&!row.isImplicit))&&(()=>{
                                const targets=[]
                                if(row.volRole==='volunteer') targets.push({label:'Coordinator',role:'coordinator'})
                                // Only admin can promote to core-level (admin sets actual user role elsewhere)
                                if(row.volRole==='coordinator'&&isAdmin) targets.push({label:'Core',role:'core'})
                                return targets.map(t=><button key={t.role} onClick={()=>setRoleVolConfirm({uid,name,from:row.volRole,to:t.role,verb:'promote'})} className="font-inter text-[9px] px-2 py-1 rounded-lg border border-green-500/25 text-green-400/70 hover:text-green-400 hover:border-green-500/50 transition-all">↑ {t.label}</button>)
                              })()}
                              {/* Demote — admin can demote anyone; core user can only demote explicit non-cores */}
                              {row.volRole!=='volunteer'&&(isAdmin||(!isCore&&!row.isImplicit))&&(
                                <button onClick={()=>setRoleVolConfirm({uid,name,from:row.volRole,to:'volunteer',verb:'demote'})}
                                  className="font-inter text-[9px] px-2 py-1 rounded-lg border border-yellow-500/25 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/50 transition-all">
                                  ↓ Volunteer
                                </button>
                              )}
                              {showRemove && (
                                <button onClick={() => setRemoveVolConfirm(uid)}
                                  className="font-inter text-[9px] px-2 py-1 rounded-lg border border-red-500/25 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-all">
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Add volunteers ── */}
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} flex items-center justify-between gap-3 flex-wrap`}>
              <div>
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Add Volunteers</p>
                <p className="font-inter text-[10px] text-gray-600 mt-0.5">
                  {pendingVolAdds.size > 0 ? `${pendingVolAdds.size} selected — click Save to add & notify` : 'Select members below to add them'}
                </p>
              </div>
              <GlassButton onClick={saveVolunteers} variant="red" disabled={volSaving || pendingVolAdds.size === 0}
                className="font-inter text-sm font-semibold px-5 shrink-0"
                style={{ borderRadius:'12px', minHeight:'40px', opacity: pendingVolAdds.size === 0 ? 0.35 : 1 }}>
                {volSaving ? 'Saving…' : pendingVolAdds.size > 0 ? `💌 Save & Notify ${pendingVolAdds.size}` : '💌 Save & Notify'}
              </GlassButton>
            </div>
            <div className="p-4 space-y-3">
              <input value={volSearch} onChange={e => setVolSearch(e.target.value)}
                placeholder="Search by name or department…"
                className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} />
              {filteredNotInComp.length === 0 ? (
                <p className={`text-center py-6 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
                  {volSearch ? 'No members match your search.' : 'All members are already in this competition.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto no-scrollbar pr-1">
                  {filteredNotInComp.map(m => {
                    const selected = pendingVolAdds.has(m._id)
                    return (
                      <button key={m._id} onClick={() => toggleVolPending(m._id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200 border ${
                          selected
                            ? 'border-red-600/60 bg-red-900/20 shadow-[0_0_12px_rgba(220,38,38,0.15)]'
                            : `${L?'border-black/8 hover:border-black/20':'border-white/8 hover:border-white/20'} auth-glass`
                        }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? 'bg-red-600 border-red-600' : 'border-white/25'}`}>
                          {selected && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-white/10 shrink-0">
                          {m.profilePhoto ? <img src={m.profilePhoto} alt="" className="w-full h-full object-cover rounded-full" /> : <span className="font-clash text-xs font-bold text-white">{m.name[0]}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-inter text-xs font-medium ${L?'text-gray-800':'text-gray-200'} truncate`}>{m.name}</p>
                          <p className="font-inter text-[10px] text-gray-500 truncate">{m.department} · {m.role}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {pendingVolAdds.size > 0 && (
                <div className={`flex items-center justify-between pt-2 border-t ${L?'border-black/5':'border-white/5'}`}>
                  <p className="font-inter text-xs text-gray-500">
                    <span className="text-white font-semibold">{pendingVolAdds.size}</span> member{pendingVolAdds.size>1?'s':''} selected
                  </p>
                  <button onClick={() => setPendingVolAdds(new Set())} className="font-inter text-[11px] text-gray-600 hover:text-white transition-colors">Clear</button>
                </div>
              )}
            </div>
          </div>

          {volMsg && <p className={`font-inter text-sm ${volMsg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{volMsg}</p>}

          {/* Remove confirm */}
          <ConfirmDialog
            open={!!removeVolConfirm}
            title="Remove Volunteer?"
            message="This person will be removed from the competition volunteers list."
            confirmLabel="Yes, Remove"
            onConfirm={removeVol}
            onCancel={() => setRemoveVolConfirm(null)}
          />

          {/* Role change confirm */}
          <ConfirmDialog
            open={!!roleVolConfirm}
            title={roleVolConfirm?.verb === 'promote' ? `Promote to Coordinator?` : `Demote to Volunteer?`}
            message={roleVolConfirm ? `${roleVolConfirm.name} will be ${roleVolConfirm.verb === 'promote' ? 'promoted' : 'demoted'} from ${roleVolConfirm.from} → ${roleVolConfirm.to}. They will receive a notification email.` : ''}
            confirmLabel={roleVolConfirm?.verb === 'promote' ? 'Yes, Promote' : 'Yes, Demote'}
            onConfirm={async () => {
              if (!roleVolConfirm) return
              await setVolRole(roleVolConfirm.uid, roleVolConfirm.to)
              setRoleVolConfirm(null)
            }}
            onCancel={() => setRoleVolConfirm(null)}
          />
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <div className="tab-panel-sub">
          <ContextAnnouncementStudio
            contextType="competition"
            contextId={comp._id}
            canAnnounce={true}
            isPrivileged={true}
            coordCanAnnounce={comp.coordCanAnnounce}
            onCoordToggle={async val => {
              await competitionsApi.setCoordPerms(comp._id, { coordCanAnnounce: val }).catch(() => {})
              setComp(c => ({ ...c, coordCanAnnounce: val }))
            }}
            L={L}
          />
        </div>
      )}
      <DownloadingOverlay visible={mgrDlBusy} message={mgrDlMsg} />
      <ConfirmDialog
        open={backConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them and leave, or go back to save?"
        confirmLabel="Discard Changes"
        cancelLabel="Save Changes"
        onConfirm={onBack}
        onCancel={() => setBackConfirm(false)}
      />
      <RouteBlockDialog blocker={routeBlocker} L={L} />
    </div>
  )
}

// ── CLUB GALLERY ADMIN TAB ────────────────────────────────────────────────────
function GalleryTab({ L }) {
  const { toast }     = useToast()
  const [photos,      setPhotos]      = useState([])
  const [sections,    setSections]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeSection, setActiveSection] = useState('all')
  const [newSection,  setNewSection]  = useState('')
  const [creating,    setCreating]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadSect,  setUploadSect]  = useState('')
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadPhotographer, setUploadPhotographer] = useState({ name: 'anonymous' })
  const [photogKey,   setPhotogKey]   = useState(0)
  const [uploadFiles,   setUploadFiles]   = useState([])
  const [uploadPreviews, setUploadPreviews] = useState([])
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [dragIdx,     setDragIdx]     = useState(null)
  const [orderChanged,setOrderChanged]= useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [msg,         setMsg]         = useState('')
  const [confirm,     setConfirm]     = useState(null)
  const [sectionToDelete, setSectionToDelete] = useState(null)   // { id, name }
  const [busy,        setBusy]        = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([galleryApi.getSections(), galleryApi.getPhotos({ type: 'club' })])
      setSections(s.sections || []); setPhotos(p.photos || [])
    } catch (e) { setMsg(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const generalCount = photos.filter(p => !p.section?._id && !p.section).length
  const filtered = activeSection === 'all'
    ? photos
    : activeSection === 'general'
      ? photos.filter(p => !p.section?._id && !p.section)
      : photos.filter(p => (p.section?._id || p.section) === activeSection)

  const createSection = async () => {
    if (!newSection.trim()) return; setBusy(true)
    try { await galleryApi.createSection({ name: newSection }); setNewSection(''); setCreating(false); fetchAll() }
    catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  const uploadPhoto = async (e) => {
    e.preventDefault(); if (!uploadFiles.length) return
    if (!uploadPhotographer?.name?.trim()) { setMsg('Photographer name is required.'); return }
    setUploading(true); setMsg('')
    const count = uploadFiles.length
    try {
      for (let i = 0; i < count; i++) {
        setUploadProgress({ current: i + 1, total: count })
        const { key, publicUrl } = await uploadFileToS3(uploadFiles[i], 'gallery')
        await galleryApi.addPhoto({ imageUrl: publicUrl, s3Key: key, caption: uploadCaption, photographer: uploadPhotographer, section: uploadSect || undefined, type: 'club', order: photos.length + i })
      }
      setUploadFiles([]); setUploadPreviews([]); setUploadCaption('')
      setUploadPhotographer({ name: 'anonymous' }); setPhotogKey(k => k + 1)
      toast.success('Uploaded', `${count} photo${count > 1 ? 's' : ''} added to gallery`); fetchAll()
    } catch (err) { setMsg(err.message) } finally { setUploading(false); setUploadProgress({ current: 0, total: 0 }) }
  }

  const deletePhoto = async () => {
    if (!confirm) return
    try { await galleryApi.deletePhoto(confirm._id) } catch (e) { console.error(e) }
    setConfirm(null); fetchAll()
  }

  const doDeleteSection = async () => {
    if (!sectionToDelete) return
    try { await galleryApi.deleteSection(sectionToDelete.id) } catch (e) { console.error(e) }
    if (activeSection === sectionToDelete.id) setActiveSection('general')
    setSectionToDelete(null); fetchAll()
  }

  const handleDragStart = i => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const reordered = [...filtered]; const [moved] = reordered.splice(dragIdx, 1); reordered.splice(i, 0, moved)
    setPhotos(prev => {
      const other = prev.filter(p => activeSection === 'all' ? false : p.section?._id !== activeSection)
      return activeSection === 'all' ? reordered : [...other, ...reordered]
    })
    setDragIdx(i); setOrderChanged(true)
  }
  const saveOrder = async () => {
    setSavingOrder(true)
    try { await galleryApi.reorderPhotos(filtered.map(p => p._id), null); setOrderChanged(false); toast.success('Saved', 'Photo order updated') }
    catch (e) { setMsg(e.message) } finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-5">
      {/* Section management */}
      <div className={`auth-glass rounded-2xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
        <div className="flex items-center justify-between">
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Sections ({sections.length})</p>
          <GlassButton onClick={() => setCreating(c=>!c)} className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'30px' }}>+ New Section</GlassButton>
        </div>
        {creating && (
          <div className="space-y-2">
            <input value={newSection} onChange={e=>setNewSection(e.target.value)} className="glass-input w-full text-sm" placeholder="Section name…" style={{ borderRadius:'9px' }} />
            <div className="flex gap-2">
              <GlassButton onClick={createSection} variant="red" disabled={busy||!newSection.trim()} className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'32px' }}>Create</GlassButton>
              <GlassButton onClick={()=>{setCreating(false);setNewSection('')}} className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'32px' }}>Cancel</GlassButton>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setActiveSection('all')} className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection==='all'?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
            All ({photos.length})
          </button>
          <button onClick={()=>setActiveSection('general')} className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection==='general'?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
            General ({generalCount})
          </button>
          {sections.map(s => (
            <div key={s._id} className="flex items-center gap-1">
              <button onClick={()=>setActiveSection(s._id)} className={`font-inter text-[11px] px-3 py-1 rounded-lg transition-all ${activeSection===s._id?'bg-red-700 text-white':'text-gray-400 hover:text-white auth-glass border border-white/8'}`}>
                {s.name} ({photos.filter(p=>(p.section?._id||p.section)===s._id).length})
              </button>
              <button onClick={()=>setSectionToDelete({id:s._id,name:s.name})} className="text-gray-700 hover:text-red-400 text-xs ml-0.5">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className={`auth-glass rounded-2xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Upload Photo</p>
        <form onSubmit={uploadPhoto} className="space-y-3">
          {uploadPreviews.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {uploadPreviews.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden aspect-square">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <button type="button" onClick={()=>{setUploadFiles([]);setUploadPreviews([])}} className={`font-inter text-xs transition-colors ${L?'text-gray-500 hover:text-red-600':'text-gray-500 hover:text-red-400'}`}>
                Remove all ({uploadFiles.length})
              </button>
            </div>
          ) : (
            <label className={`block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ${L?'border-black/12 hover:border-red-600/30':'border-white/10 hover:border-red-600/30'}`}>
              <div className="flex items-center justify-center py-5 text-gray-500"><p className="font-inter text-sm">Click to choose photos</p></div>
              <input type="file" accept="image/*" className="hidden" multiple onChange={e=>{const fs=Array.from(e.target.files);if(!fs.length)return;setUploadFiles(fs);setUploadPreviews(fs.map(f=>URL.createObjectURL(f)))}} />
            </label>
          )}
          {/* Photographer — required, defaults to "anonymous", searchable dropdown */}
          <div>
            <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              Photographer <span className="text-red-400">*</span>
              <span className="normal-case text-gray-600 font-normal">(search or type name)</span>
            </label>
            <PhotographerSearch key={photogKey} value={uploadPhotographer} onSelect={v=>setUploadPhotographer(v)} required L={L} />
          </div>
          <input value={uploadCaption} onChange={e=>setUploadCaption(e.target.value)} className="glass-input w-full text-sm" style={{ borderRadius:'9px' }} placeholder="Caption (optional)" />
          <select value={uploadSect} onChange={e=>setUploadSect(e.target.value)} className="glass-input w-full text-sm appearance-none" style={{ borderRadius:'9px' }}>
            <option value="">General</option>
            {sections.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
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
          <GlassButton type="submit" variant="red" disabled={uploading||!uploadFiles.length} className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'42px' }}>
            {uploading?'Uploading…':`Upload Photo${uploadFiles.length > 1 ? 's' : ''}${uploadFiles.length > 1 ? ` (${uploadFiles.length})` : ''}`}
          </GlassButton>
        </form>
      </div>

      {/* Photos grid */}
      {loading ? (
        <SkeletonGrid n={4} />
      ) : filtered.length === 0 ? (
        <p className={`text-center py-8 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No photos {activeSection !== 'all' ? 'in this section' : 'yet'}.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">{filtered.length} Photos — drag to reorder</p>
            {orderChanged && <GlassButton variant="red" disabled={savingOrder} onClick={saveOrder} className="font-inter text-xs" style={{ borderRadius:8, minHeight:28, padding:'0 12px' }}>{savingOrder?'Saving…':'Save Order'}</GlassButton>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {filtered.map((p, i) => (
              <div key={p._id} className={`group relative aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing ${dragIdx===i?'opacity-40 ring-2 ring-red-500':''}`}
                draggable onDragStart={()=>handleDragStart(i)} onDragOver={e=>handleDragOver(e,i)} onDragEnd={()=>setDragIdx(null)}
                onClick={()=>setLightboxIdx(i)}>
                <ProgressiveImage src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                <button onClick={e=>{e.stopPropagation();setConfirm(p)}}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs items-center justify-center hidden group-hover:flex">✕</button>
                {/* Photographer attribution — always visible over a soft vignette */}
                {p.photographer?.name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pt-5 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      {p.photographer?.userId?.profilePhoto
                        ? <img src={p.photographer.userId.profilePhoto} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" style={{boxShadow:'0 0 0 1px rgba(255,255,255,0.35)'}}/>
                        : <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'#dc2626'}}>
                            <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </div>}
                      <p className="font-inter text-[10px] font-semibold text-white truncate">{p.photographer.name}</p>
                    </div>
                    {p.caption && <p className="font-inter text-[9px] text-white/55 italic truncate mt-0.5">{p.caption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={filtered.map(p => ({
            url: p.imageUrl,
            caption: p.caption,
            photographer: p.photographer?.name
              ? { name: p.photographer.name, photoUrl: p.photographer.userId?.profilePhoto }
              : undefined
          }))}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      <ConfirmDialog open={!!confirm} title="Delete Photo?" message={confirm?`Delete this photo? This cannot be undone.`:''} confirmLabel="Yes, Delete" onConfirm={deletePhoto} onCancel={()=>setConfirm(null)} />
      <ConfirmDialog open={!!sectionToDelete} title={`Delete "${sectionToDelete?.name}"?`}
        message={`All photos in this section will be moved to General. The section itself will be permanently deleted.`}
        confirmLabel="Delete Section" onConfirm={doDeleteSection} onCancel={()=>setSectionToDelete(null)} />
    </div>
  )
}

// ── MAGAZINES ADMIN TAB ───────────────────────────────────────────────────────
const MAG_COVER_W = 90
const MAG_COVER_H = Math.round(MAG_COVER_W * 560 / 420)   // ≈ 120px
const MAG_PAGE_W  = 420
const MAG_PAGE_H  = 560

function MagazinesAdminTab({ currentUser, L }) {
  const [magazines,     setMagazines]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [confirm,       setConfirm]       = useState(null)
  const [viewing,       setViewing]       = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [pdfMag,        setPdfMag]        = useState(null)
  const [copiedId,      setCopiedId]      = useState(null)   // magazine _id whose link was just copied

  const copyShareLink = (mag) => {
    const url = `${window.location.origin}/magazine/${mag._id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(mag._id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }
  const [pdfCapIdx,     setPdfCapIdx]     = useState(-1)     // which single page is in DOM for capture
  const isAdmin = currentUser?.role === 'admin'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try { const d = await magazineApi.adminListAll(); setMagazines(d.magazines || []) }
    catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const doDelete = async () => {
    if (!confirm) return
    try { await magazineApi.adminDelete(confirm._id) }
    catch (e) { console.error('Reset failed:', e) }
    setConfirm(null)
    fetchAll()
  }

  // Proxy an S3 image URL through our server to avoid CORS taint in html2canvas
  const proxyToDataUrl = async (url) => {
    if (!url || url.startsWith('data:')) return url
    try {
      const res  = await fetch(`/api/proxy/image?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      return await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve(r.result)
        r.onerror   = reject
        r.readAsDataURL(blob)
      })
    } catch(e) { console.warn('Proxy failed', url, e.message); return url }
  }

  const downloadPDF = async (mag) => {
    const pages = mag.pages || []
    if (pages.length === 0) return alert('This magazine has no pages.')
    const tpl = getTemplateById(mag.templateId)
    if (!tpl) return alert('Template not found.')

    setDownloadingId(mag._id)

    try {
      // 1. Pre-fetch all images as same-origin data URLs FIRST
      const urlSet = new Set()
      pages.forEach(p => (p.images || []).forEach(im => { if (im.imageUrl) urlSet.add(im.imageUrl) }))
      const dataUrlMap = {}
      await Promise.all([...urlSet].map(async (url) => { dataUrlMap[url] = await proxyToDataUrl(url) }))

      // 2. Build pages with data URLs already injected so imgNat loads immediately on render
      const pagesWithData = pages.map(p => ({
        ...p,
        images: (p.images || []).map(im => ({
          ...im,
          imageUrl: dataUrlMap[im.imageUrl] || im.imageUrl,
        }))
      }))

      // 3. Store pages with data URLs; render one at a time via pdfCapIdx
      setPdfMag({ ...mag, pages: pagesWithData })

      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF }       = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [MAG_PAGE_W, MAG_PAGE_H] })
      const bg  = tpl?.colors?.bg || '#ffffff'

      // Wait for ALL fonts to load so text renders with correct metrics in html2canvas
      await document.fonts.ready
      await Promise.all(
        [tpl?.fonts?.heading, tpl?.fonts?.body, 'Oswald', 'Cormorant Garamond', 'Inter']
          .filter(Boolean)
          .flatMap(f => [
            document.fonts.load(`400 16px "${f}"`).catch(()=>{}),
            document.fonts.load(`700 16px "${f}"`).catch(()=>{}),
          ])
      )

      // Collect @font-face CSS to inject into html2canvas clone
      const fontCSS = (() => {
        const parts = []
        for (const sheet of document.styleSheets) {
          try { for (const r of sheet.cssRules||[]) { if (r.cssText?.startsWith('@font-face')) parts.push(r.cssText) } } catch {}
        }
        for (const el of document.querySelectorAll('style')) {
          if (el.textContent.includes('@font-face')) parts.push(el.textContent)
        }
        return [...new Set(parts)].join('\n')
      })()

      let added = 0
      for (let i = 0; i < pagesWithData.length; i++) {
        setPdfCapIdx(i)
        await new Promise(r => setTimeout(r, 500))
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

        const el = document.getElementById('admin-pdf-page')
        if (!el) continue
        const canvas = await html2canvas(el, {
          scale: 3, useCORS: false, allowTaint: false, logging: false,
          backgroundColor: bg, width: MAG_PAGE_W, height: MAG_PAGE_H,
          onclone: (clonedDoc) => {
            if (!fontCSS) return
            const s = clonedDoc.createElement('style')
            s.textContent = fontCSS
            clonedDoc.head.appendChild(s)
          },
        })
        if (added > 0) pdf.addPage([MAG_PAGE_W, MAG_PAGE_H], 'portrait')
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, MAG_PAGE_W, MAG_PAGE_H)
        added++
      }

      if (added === 0) return alert('No pages captured.')
      const fname = (mag.name || 'magazine').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'magazine'
      pdf.save(`${fname}.pdf`)
    } catch(e) {
      console.error('PDF error:', e)
      alert('PDF generation failed: ' + e.message)
    } finally {
      setDownloadingId(null)
      setPdfMag(null)
      setPdfCapIdx(-1)
    }
  }

  const filtered = (filter === 'all' || filter === 'my') ? magazines : magazines.filter(m => m.status === filter)

  return (
    <div className="space-y-4">
      {/* Sub-tabs for core: My Magazine | All Magazines */}
      {!isAdmin && (
        <>
          <div className={`flex gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
            <button onClick={()=>setFilter('my')}
              className={`px-3 py-1.5 rounded-lg font-inter text-xs font-medium transition-all ${filter==='my'?'bg-red-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
              My Magazine
            </button>
            <button onClick={()=>setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-inter text-xs font-medium transition-all ${filter==='all'?'bg-red-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
              All Magazines
            </button>
          </div>
          {filter === 'my' && <MagazineTabForCore user={currentUser} />}
        </>
      )}

      {/* Admin list — show for admin, or core when 'all' tab selected */}
      {(isAdmin || filter === 'all') && filter !== 'my' && (
      <>
        {isAdmin && (
          <div className="flex gap-1">
            {['all','published','draft'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={'font-inter text-xs px-3 py-1.5 rounded-lg border capitalize transition-all '+(
                  filter===f?'bg-red-700 text-white border-red-700':'text-gray-400 border-white/10 hover:text-white'
                )}>{f} {f!=='all'?`(${magazines.filter(m=>m.status===f).length})`:''}</button>
            ))}
          </div>
        )}

      {/* MagazineViewer overlay */}
      {viewing && <MagazineViewer magazine={viewing} onClose={() => setViewing(null)} />}

      {/* Single-page PDF capture — renders ONE page at a time at a fixed position */}
      {pdfMag && pdfCapIdx >= 0 && pdfCapIdx < (pdfMag.pages||[]).length && (() => {
        const tpl = getTemplateById(pdfMag.templateId)
        const p   = pdfMag.pages[pdfCapIdx]
        return tpl ? (
          <div id="admin-pdf-page"
            style={{ position:'fixed', top:0, left:`-${MAG_PAGE_W+10}px`,
                     width:MAG_PAGE_W, height:MAG_PAGE_H, overflow:'hidden',
                     zIndex:-1, pointerEvents:'none' }}>
            <TemplatePage template={tpl} layoutId={p?.layoutId} pageData={p}
              editMode={false} showSamples={false} width={MAG_PAGE_W} height={MAG_PAGE_H}/>
          </div>
        ) : null
      })()}

      {loading ? <SkeletonGrid n={4} />
      : filtered.length === 0 ? <p className={`text-center py-8 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No magazines found.</p>
      : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(m => {
            const tpl = getTemplateById(m.templateId)
            return (
              <div key={m._id} className={`auth-glass rounded-xl border overflow-hidden flex ${L?'border-black/8':'border-white/8'}`}>

                {/* ── Left: details + actions ── */}
                <div className="flex-1 p-3.5 flex flex-col justify-between gap-2 min-w-0">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-inter font-semibold text-sm leading-tight truncate ${L?'text-gray-900':'text-white'}`}>
                        {m.name || m.templateId}
                      </p>
                      <span className={'font-inter text-[9px] uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full '+(m.status==='published'?'bg-green-900/30 text-green-400':'bg-gray-800/50 text-gray-500')}>
                        {m.status}
                      </span>
                    </div>
                    {m.user?.name && (
                      <p className="font-inter text-xs text-gray-500">
                        By: <span className={L?'text-gray-700':'text-gray-300'}>{m.user.name}</span>
                      </p>
                    )}
                    <p className="font-inter text-[10px] text-gray-600">
                      {m.pages?.length||0} pages · {m.templateId}
                    </p>
                    {m.updatedAt && (
                      <p className="font-inter text-[10px] text-gray-700">
                        {new Date(m.updatedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <button onClick={() => setViewing(m)}
                      className="font-inter text-[10px] px-2.5 py-1.5 rounded-lg border border-blue-500/25 text-blue-400/80 hover:text-blue-400 hover:border-blue-500/50 transition-all">
                      View
                    </button>

                    {/* Download PDF */}
                    <button
                      onClick={() => downloadPDF(m)}
                      disabled={downloadingId === m._id || (m.pages?.length || 0) === 0}
                      title={(m.pages?.length || 0) === 0 ? 'No pages to export' : 'Download as PDF'}
                      className="flex items-center gap-1 font-inter text-[10px] px-2.5 py-1.5 rounded-lg border border-green-500/20 text-green-400/70 hover:text-green-400 hover:border-green-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                      {downloadingId === m._id ? (
                        <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <circle cx="12" cy="12" r="9" strokeOpacity=".25"/>
                          <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      )}
                      {downloadingId === m._id ? 'Exporting…' : 'PDF'}
                    </button>

                    {/* Share link — only published */}
                    {m.status === 'published' && (
                      <button
                        onClick={() => copyShareLink(m)}
                        title={`${window.location.origin}/magazine/${m._id}`}
                        className="flex items-center gap-1 font-inter text-[10px] px-2.5 py-1.5 rounded-lg border transition-all"
                        style={{
                          borderColor: copiedId===m._id ? 'rgba(74,222,128,0.4)' : 'rgba(99,102,241,0.25)',
                          color:       copiedId===m._id ? '#4ade80' : 'rgba(167,139,250,0.8)',
                          background:  copiedId===m._id ? 'rgba(74,222,128,0.08)' : 'transparent',
                        }}>
                        {copiedId===m._id ? (
                          <><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        ) : (
                          <><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Share</>
                        )}
                      </button>
                    )}

                    <button onClick={() => setConfirm(m)}
                      className="font-inter text-[10px] px-2.5 py-1.5 rounded-lg border border-yellow-500/20 text-yellow-400/70 hover:text-yellow-400 hover:border-yellow-500/40 transition-all">
                      Reset &amp; Unpublish
                    </button>
                  </div>
                </div>

                {/* ── Right: magazine cover thumbnail ── */}
                <div className="shrink-0 border-l border-white/5" style={{ width: MAG_COVER_W, height: MAG_COVER_H }}>
                  {tpl ? (
                    <div style={{ width: MAG_COVER_W, height: MAG_COVER_H, overflow:'hidden', position:'relative' }}>
                      <div style={{
                        transform: `scale(${MAG_COVER_W / MAG_PAGE_W})`,
                        transformOrigin: 'top left',
                        width: MAG_PAGE_W, height: MAG_PAGE_H,
                      }}>
                        <TemplatePage
                          template={tpl}
                          layoutId={m.pages?.[0]?.layoutId || tpl.pages[0] || 'cover'}
                          pageData={m.pages?.[0]} editMode={false} showSamples={false}
                          width={MAG_PAGE_W} height={MAG_PAGE_H}/>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background:'#111' }}>
                      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.2}>
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      </>
      )}

      <ConfirmDialog open={!!confirm}
        title="Reset & Unpublish Magazine?"
        message={confirm
          ? `This will unpublish "${confirm.name||'this magazine'}" by ${confirm.user?.name||'unknown'} and clear all uploaded photos. The user's magazine record is kept — they can rebuild from scratch. This cannot be undone.`
          : ''}
        confirmLabel="Yes, Reset & Unpublish"
        onConfirm={doDelete}
        onCancel={()=>setConfirm(null)}/>
    </div>
  )
}

// ── GLOBAL ANNOUNCEMENTS TAB ──────────────────────────────────────────────────
const STREAMS  = ['BBA','BTECH','MTECH','BCA','LLB','MBA','OTHER']
const ROLES_OPT= ['photographer','coordinator','core']

function AnnouncementsTab({ L }) {
  const [subject,    setSubject]    = useState('')
  const [content,    setContent]    = useState('')
  const [recipType,  setRecipType]  = useState('all')
  const [filterStream, setFStream]  = useState('')
  const [filterYear,   setFYear]    = useState('')
  const [filterRole,   setFRole]    = useState('')
  const [preview,    setPreview]    = useState(null)    // { count, names }
  const [history,    setHistory]    = useState([])
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState('')

  const fetch_ = useCallback(async () => {
    try { const d = await announceApi.history(); setHistory(d.announcements) }
    catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // Live refresh — picks up announcements sent from another admin session
  useEffect(() => {
    const poll = setInterval(fetch_, 15000)
    return () => clearInterval(poll)
  }, [fetch_])

  const filters = recipType === 'stream' ? { stream: filterStream }
                : recipType === 'year'   ? { year:   Number(filterYear) }
                : recipType === 'role'   ? { role:   filterRole }
                : {}

  const doPreview = async () => {
    try { const d = await announceApi.preview({ recipientType: recipType, filters }); setPreview(d) }
    catch (e) { setMsg(e.message) }
  }

  const send = async () => {
    if (!subject.trim()) return setMsg('Subject is required.')
    if (!content.trim()) return setMsg('Content is required.')
    if (recipType === 'stream' && !filterStream) return setMsg('Select a stream.')
    if (recipType === 'year'   && !filterYear)   return setMsg('Select a year.')
    if (recipType === 'role'   && !filterRole)   return setMsg('Select a role.')
    setBusy(true); setMsg('')
    try {
      const d = await announceApi.send({ subject, content, recipientType: recipType, filters })
      setMsg(`✓ ${d.message}`)
      setSubject(''); setContent(''); setPreview(null)
      fetch_()
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className={`auth-glass rounded-2xl border ${L?'border-black/8':'border-white/8'} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${L?'border-black/5':'border-white/5'}`}>
          <p className="font-clash font-semibold text-red-500 uppercase tracking-wider text-sm">Compose Announcement</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Subject */}
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Subject *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="e.g. Photography Walk – This Weekend!" />
          </div>

          {/* Content */}
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">
              Content * <span className="normal-case font-normal text-gray-600">(HTML supported — paste links as: &lt;a href="url"&gt;text&lt;/a&gt;)</span>
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              rows={5} placeholder="Write your announcement here. You can include links like: <a href='https://…'>Click here</a>"
              className="glass-input w-full resize-none font-mono text-sm" style={{ borderRadius:'10px' }} />
          </div>

          {/* Recipients */}
          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/7':'border-white/7'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Recipients</p>
            <div className="flex flex-wrap gap-2">
              {[['all','All Members'],['stream','By Stream'],['year','By Year'],['role','By Role']].map(([v,l]) => (
                <button key={v} onClick={() => { setRecipType(v); setPreview(null) }}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all ${recipType===v?'bg-red-700 text-white':'auth-glass border border-white/10 text-gray-400 hover:text-white'}`}>
                  {l}
                </button>
              ))}
            </div>

            {recipType === 'stream' && (
              <select value={filterStream} onChange={e => { setFStream(e.target.value); setPreview(null) }}
                className="glass-input w-full sm:w-56 appearance-none text-sm" style={{ borderRadius:'9px' }}>
                <option value="">Select stream…</option>
                {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {recipType === 'year' && (
              <select value={filterYear} onChange={e => { setFYear(e.target.value); setPreview(null) }}
                className="glass-input w-full sm:w-48 appearance-none text-sm" style={{ borderRadius:'9px' }}>
                <option value="">Select year…</option>
                {[1,2,3,4].map(y => <option key={y} value={y}>{['1st','2nd','3rd','4th'][y-1]} Year</option>)}
              </select>
            )}
            {recipType === 'role' && (
              <select value={filterRole} onChange={e => { setFRole(e.target.value); setPreview(null) }}
                className="glass-input w-full sm:w-48 appearance-none text-sm" style={{ borderRadius:'9px' }}>
                <option value="">Select role…</option>
                {ROLES_OPT.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {/* Preview button */}
            <div className="flex gap-3 items-center">
              <GlassButton onClick={doPreview} className="font-inter text-xs px-4" style={{ borderRadius:'9px', minHeight:'32px' }}>
                Preview Recipients
              </GlassButton>
              {preview && (
                <div className="font-inter text-xs text-gray-400">
                  <span className={`font-semibold ${L?'text-gray-900':'text-white'}`}>{preview.count}</span> member{preview.count!==1?'s':''} will receive this
                  {preview.names?.length > 0 && <span className="text-gray-600 ml-1">({preview.names.slice(0,3).join(', ')}{preview.count>3?` +${preview.count-3} more`:''})</span>}
                </div>
              )}
            </div>
          </div>

          {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}

          <GlassButton onClick={send} variant="red" disabled={busy}
            className="w-full font-inter text-sm tracking-[0.06em] uppercase"
            style={{ borderRadius:'12px', minHeight:'48px' }}>
            {busy ? 'Sending Emails…' : 'Send Announcement'}
          </GlassButton>
        </div>
      </div>

      {/* History */}
      <div>
        <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-4">Sent History</p>
        {history.length === 0 ? (
          <p className={`font-inter text-sm text-center py-8 ${L?'text-gray-400':'text-gray-600'}`}>No announcements sent yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map(a => (
              <div key={a._id} className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-clash font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{a.subject}</p>
                    <p className={`font-inter text-xs mt-0.5 ${L?'text-gray-500':'text-gray-500'} line-clamp-1`}>{a.preview}…</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-inter text-[10px] text-red-400 font-semibold">{a.recipientCount} sent</p>
                    <p className="font-inter text-[9px] text-gray-600 capitalize">{a.recipientType}{a.filters?.stream?` · ${a.filters.stream}`:''}{a.filters?.year?` · ${a.filters.year}yr`:''}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-inter text-[10px] text-gray-600">{a.sentBy?.name} · {new Date(a.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SOCIALS ADMIN TAB ─────────────────────────────────────────────────────────
// Platform icons using SVG — no emojis
const PLATFORM_ICONS = {
  instagram: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  facebook:  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  twitter:   <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>,
  youtube:   <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>,
  whatsapp:  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  email:     <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  linkedin:  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
  telegram:  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  discord:   <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.09.239-.183.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>,
  website:   <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  other:     <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
}

function SocialsTab({ L }) {
  const { toast } = useToast()
  const [links,         setLinks]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [creating,      setCreating]      = useState(false)
  const [editId,        setEditId]        = useState(null)
  const [form,          setForm]          = useState({ platform:'instagram', label:'', url:'', active:true, order:0 })
  const [busy,          setBusy]          = useState(false)
  const [msg,           setMsg]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try { const d = await socialApi.all(); setLinks(d.links) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const save = async () => {
    if (!form.label || !form.url) return setMsg('Label and URL required.')
    setBusy(true); setMsg('')
    try {
      const payload = { ...form, icon: form.platform }
      if (editId) await socialApi.update(editId, payload)
      else        await socialApi.create(payload)
      setCreating(false); setEditId(null); setForm({ platform:'instagram', label:'', url:'', active:true, order:0 })
      fetch_()
      toast.success(editId ? 'Link Updated' : 'Link Added', editId ? 'Social link saved' : 'New social link created')
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const remove = async (id) => {
    await socialApi.delete(id)
    fetch_()
    toast.success('Deleted', 'Social link removed')
    setDeleteConfirm(null)
  }

  const toggleActive = async (id, active) => {
    await socialApi.update(id, { active }).catch(() => {})
    fetch_()
  }

  const startEdit = (l) => {
    setForm({ platform:l.platform, label:l.label, url:l.url, active:l.active, order:l.order||0 })
    setEditId(l._id); setCreating(true)
  }

  return (
    <div className="space-y-5">
      {/* Add/Edit form */}
      <div className={`auth-glass rounded-2xl border ${L?'border-black/8':'border-white/8'}`}>
        <button onClick={() => { setCreating(c=>!c); setEditId(null); setForm({ platform:'instagram', label:'', url:'', active:true, order:0 }) }}
          className={`w-full p-4 flex items-center justify-between font-inter text-sm ${L?'text-gray-700':'text-gray-300'}`}>
          <span>{editId ? 'Edit Link' : '+ Add Social Link'}</span>
          <span className={`transition-transform ${creating?'rotate-180':''}`}>▾</span>
        </button>
        {creating && (
          <div className="px-4 pb-4 border-t border-white/8 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Platform</label>
                <select value={form.platform}
                  onChange={e => setForm(f=>({...f, platform:e.target.value}))}
                  className="glass-input w-full appearance-none text-sm" style={{ borderRadius:'10px' }}>
                  {Object.keys(PLATFORM_ICONS).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Display Label</label>
                <input value={form.label} onChange={e => setForm(f=>({...f,label:e.target.value}))}
                  className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} placeholder="Instagram" />
              </div>
            </div>
            <div>
              <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">URL *</label>
              <input value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))}
                className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} placeholder="https://…" />
            </div>
            <div className="flex items-center gap-3">
              {/* Platform icon preview */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-inter ${L?'border-black/8 text-gray-600':'border-white/8 text-gray-400'}`}>
                <span className="shrink-0">{PLATFORM_ICONS[form.platform]}</span>
                <span>Icon auto-set from platform</span>
              </div>
              <div className="flex-1">
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Display Order</label>
                <input type="number" value={form.order} onChange={e => setForm(f=>({...f,order:Number(e.target.value)}))}
                  className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} min={0} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f=>({...f,active:e.target.checked}))} className="accent-red-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show publicly on website</span>
            </label>
            {msg && <p className="font-inter text-xs text-red-400">{msg}</p>}
            <div className="flex gap-2">
              <GlassButton onClick={save} variant="red" disabled={busy}
                className="flex-1 font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
                {busy ? 'Saving…' : editId ? 'Save Changes' : 'Add Link'}
              </GlassButton>
              <GlassButton onClick={() => { setCreating(false); setEditId(null) }}
                className="font-inter text-sm px-5" style={{ borderRadius:'12px', minHeight:'44px' }}>
                Cancel
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      {/* Links list */}
      {loading ? (
        <SkeletonList n={4} />
      ) : links.length === 0 ? (
        <p className={`text-center py-8 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>No social links yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {links.map(l => (
            <div key={l._id}
              className={`flex items-center gap-3 p-4 auth-glass rounded-2xl border ${l.active?L?'border-black/8':'border-white/8':L?'border-black/4 opacity-60':'border-white/4 opacity-60'}`}>
              <span className="shrink-0 opacity-80">{PLATFORM_ICONS[l.platform] || PLATFORM_ICONS.other}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-clash font-semibold text-sm ${L?'text-gray-900':'text-white'}`}>{l.label}</p>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="font-inter text-[10px] text-red-400 hover:underline truncate block">{l.url}</a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(l._id, !l.active)}
                  className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${l.active?'text-green-400 border-green-800/40 bg-green-900/20':'text-gray-500 border-gray-700/40'}`}>
                  {l.active ? 'Live' : 'Hidden'}
                </button>
                <button onClick={() => startEdit(l)} className="text-gray-500 hover:text-white transition-colors px-1" title="Edit">
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => setDeleteConfirm(l._id)} className="text-gray-600 hover:text-red-400 transition-colors px-1" title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Social Link?"
        message="This social link will be permanently removed from the website."
        confirmLabel="Yes, Delete"
        onConfirm={() => remove(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

// ── PERMISSIONS TAB ───────────────────────────────────────────────────────────
function PermissionsTab({ L }) {
  const { toast }  = useToast()
  const [settings, setSettings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState({})
  const [msg,      setMsg]      = useState('')
  const [galleryEnabled,   setGalleryEnabled]   = useState(true)
  const [galleryMax,       setGalleryMax]        = useState(0)   // 0 = unlimited
  const [galleryMaxInput,  setGalleryMaxInput]   = useState('0')
  const [gallerySaving,    setGallerySaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      settingsApi.list(),
      settingsApi.getGallerySettings(),
    ])
      .then(([d, g]) => {
        setSettings(d.settings)
        setGalleryEnabled(g.gallery?.enabled !== false)
        const max = g.gallery?.maxPhotos ?? 0
        setGalleryMax(max)
        setGalleryMaxInput(max === 0 ? '0' : String(max))
      })
      .catch(e => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (key, newVal) => {
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await settingsApi.patch(key, newVal)
      setSettings(s => s.map(x => x.key === key ? { ...x, value: newVal } : x))
      toast.success('Updated', 'Permission saved')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(s => ({ ...s, [key]: false })) }
  }

  const saveGallerySettings = async () => {
    setGallerySaving(true)
    try {
      const maxVal = parseInt(galleryMaxInput, 10)
      const safeMax = isNaN(maxVal) || maxVal < 0 ? 0 : maxVal
      await Promise.all([
        settingsApi.patch('member.gallery.enabled', galleryEnabled),
        settingsApi.patch('member.gallery.maxPhotos', safeMax),
      ])
      setGalleryMax(safeMax)
      setGalleryMaxInput(String(safeMax))
      toast.success('Saved', 'Gallery settings updated')
    } catch (e) { setMsg(e.message) }
    finally { setGallerySaving(false) }
  }

  const coordinatorSettings = settings.filter(s => s.key.startsWith('coordinator.'))

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className={`auth-glass rounded-2xl p-5 border ${L?'border-black/8':'border-white/8'}`}>
        <p className="font-clash font-semibold text-red-500 uppercase tracking-wider text-sm mb-3">Role Reference</p>
        <div className="space-y-3 font-inter text-sm">
          {[
            { role:'Admin', color:'text-red-400', perms:'Full access to everything — users, events, gallery, announcements, settings.' },
            { role:'Core', color:'text-amber-400', perms:'Manage events, gallery, postcards, send announcements, approve/reject members.' },
            { role:'Coordinator', color:'text-blue-400', perms:'Limited upload rights (controlled below). Cannot manage users. Can optionally send global announcements if the toggle is enabled.' },
            { role:'Photographer', color:'text-emerald-400', perms:'Can upload postcards and posts. Can view all club content.' },
          ].map(r => (
            <div key={r.role} className={`flex gap-3 items-start py-2.5 border-b last:border-0 ${L?'border-black/5':'border-white/5'}`}>
              <span className={`font-clash font-bold w-28 shrink-0 ${r.color}`}>{r.role}</span>
              <span className={L?'text-gray-600':'text-gray-400'}>{r.perms}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coordinator permission toggles */}
      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className={`px-5 py-4 border-b ${L?'border-black/5':'border-white/5'}`}>
          <p className="font-clash font-semibold text-blue-400 uppercase tracking-wider text-sm">Coordinator Permissions</p>
          <p className={`font-inter text-xs mt-1 ${L?'text-gray-500':'text-gray-500'}`}>
            Toggle what Coordinators can do. Applies globally to all Coordinator-role members.
          </p>
        </div>
        <div className="divide-y divide-white/5">
          {loading ? (
            <div className="p-5"><SkeletonList n={3} /></div>
          ) : coordinatorSettings.map(s => (
            <div key={s.key} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="flex-1 min-w-0">
                <p className={`font-inter text-sm font-medium ${L?'text-gray-900':'text-white'}`}>{s.label}</p>
                <p className={`font-inter text-[10px] ${L?'text-gray-400':'text-gray-600'} mt-0.5`}>{s.key.replace('coordinator.','')}</p>
              </div>
              {/* Clean toggle using CSS classes — avoids Tailwind transform conflicts */}
              <div
                onClick={() => !saving[s.key] && toggle(s.key, !s.value)}
                className={`toggle-track shrink-0 ${s.value ? 'on' : 'off'} ${saving[s.key] ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="toggle-thumb" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member gallery settings */}
      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className={`px-5 py-4 border-b ${L?'border-black/5':'border-white/5'}`}>
          <p className="font-clash font-semibold text-emerald-400 uppercase tracking-wider text-sm">Member Gallery</p>
          <p className={`font-inter text-xs mt-1 ${L?'text-gray-500':'text-gray-500'}`}>
            Control whether members can use the My Gallery feature and set an upload limit.
          </p>
        </div>
        <div className={`divide-y ${L?'divide-black/5':'divide-white/5'}`}>
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="flex-1 min-w-0">
              <p className={`font-inter text-sm font-medium ${L?'text-gray-900':'text-white'}`}>Enable My Gallery</p>
              <p className={`font-inter text-[10px] mt-0.5 ${L?'text-gray-400':'text-gray-600'}`}>
                Allow all members (photographer, coordinator, core) to upload a personal gallery.
              </p>
            </div>
            <div
              onClick={() => !gallerySaving && setGalleryEnabled(v => !v)}
              className={`toggle-track shrink-0 ${galleryEnabled ? 'on' : 'off'} ${gallerySaving ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="toggle-thumb" />
            </div>
          </div>

          {/* Max photos */}
          <div className="px-5 py-4 space-y-3">
            <p className={`font-inter text-sm font-medium ${L?'text-gray-900':'text-white'}`}>
              Maximum Photos per Member
            </p>
            <p className={`font-inter text-[10px] ${L?'text-gray-400':'text-gray-600'}`}>
              Set how many photos each member can upload. 0 means no limit.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {/* No limit radio */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={galleryMaxInput === '0' || parseInt(galleryMaxInput) === 0}
                  onChange={() => setGalleryMaxInput('0')}
                  className="accent-emerald-500" />
                <span className={`font-inter text-sm ${L?'text-gray-700':'text-gray-300'}`}>No Limit</span>
              </label>
              {/* Custom number */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={parseInt(galleryMaxInput) > 0}
                  onChange={() => setGalleryMaxInput(galleryMax > 0 ? String(galleryMax) : '20')}
                  className="accent-emerald-500" />
                <span className={`font-inter text-sm ${L?'text-gray-700':'text-gray-300'}`}>Limit to</span>
              </label>
              <input
                type="number" min={1} max={999}
                value={parseInt(galleryMaxInput) > 0 ? galleryMaxInput : ''}
                placeholder="e.g. 20"
                disabled={parseInt(galleryMaxInput) === 0 || galleryMaxInput === '0'}
                onChange={e => setGalleryMaxInput(e.target.value)}
                className="glass-input w-20 text-center font-inter text-sm py-1.5 px-2 disabled:opacity-40"
                style={{ borderRadius: 10 }}
              />
              <span className={`font-inter text-xs ${L?'text-gray-500':'text-gray-600'}`}>photos</span>
            </div>
          </div>

          {/* Save button */}
          <div className="px-5 py-4">
            <button
              onClick={saveGallerySettings}
              disabled={gallerySaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-inter text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50 active:scale-95">
              {gallerySaving && <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
              {gallerySaving ? 'Saving…' : 'Save Gallery Settings'}
            </button>
          </div>
        </div>
      </div>

      {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
    </div>
  )
}

// ── CORE COMMITTEE TAB ───────────────────────────────────────────────────────
function CoreTab({ L }) {
  const [members,         setMembers]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [creating,        setCreating]        = useState(false)
  const [form,            setForm]            = useState({ name:'', year:'', designation:'Core', stream:'' })
  const [photo,           setPhoto]           = useState(null)
  const [coverImg,        setCoverImg]        = useState(null)
  const [busy,            setBusy]            = useState(false)
  const [editId,          setEditId]          = useState(null)
  const [editOpen,        setEditOpen]        = useState(false)
  const [msg,             setMsg]             = useState('')
  const [customDesig,     setCustomDesig]     = useState(false)
  const [deleteConfirm,   setDeleteConfirm]   = useState(null)
  const [editGallery,     setEditGallery]     = useState([])
  const [galleryUploading,setGalleryUploading]= useState(false)
  const { toast } = useToast()
  const galleryInputRef = useRef(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try { const d = await coreApi.list(); setMembers(d.members) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const save = async () => {
    if (!form.name || !form.year) return setMsg('Name and year are required.')
    setBusy(true); setMsg('')
    try {
      const body = {
        ...form,
        photoUrl: photo?.publicUrl, s3Key: photo?.key,
        coverPhoto: coverImg?.publicUrl, coverPhotoS3Key: coverImg?.key,
      }
      if (editId) await coreApi.update(editId, body)
      else        await coreApi.create(body)
      setCreating(false); setEditOpen(false)
      setForm({ name:'', year:'', designation:'Core', stream:'' })
      setPhoto(null); setCoverImg(null); setEditId(null); setEditGallery([])
      fetch_()
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const closeEditDialog = () => {
    setEditOpen(false); setEditId(null)
    setForm({ name:'', year:'', designation:'Core', stream:'' })
    setPhoto(null); setCoverImg(null); setCustomDesig(false); setMsg(''); setEditGallery([])
  }

  const uploadGalleryPhotos = async (files) => {
    if (!editId) return
    setGalleryUploading(true)
    try {
      const results = []
      for (const file of Array.from(files)) {
        const r = await uploadFileToS3(file, 'core-gallery')
        results.push({ url: r.publicUrl, s3Key: r.key })
      }
      const d = await coreApi.addGalleryPhotos(editId, { photos: results })
      setEditGallery(d.gallery || [])
      toast.success('Uploaded', `${results.length} photo${results.length !== 1 ? 's' : ''} added`)
    } catch (e) { toast.error('Upload failed', e.message) }
    finally { setGalleryUploading(false); if (galleryInputRef.current) galleryInputRef.current.value = '' }
  }

  const removeGalleryPhoto = async (photoId) => {
    try {
      await coreApi.deleteGalleryPhoto(editId, photoId)
      setEditGallery(g => g.filter(p => (p._id || p.id) !== photoId))
    } catch (e) { toast.error('Delete failed', e.message) }
  }

  const remove = async (id) => {
    await coreApi.delete(id).catch(() => {})
    setDeleteConfirm(null)
    fetch_()
  }

  const startEdit = (m) => {
    const desig = m.designation || 'Core'
    setForm({ name: m.name, year: m.year, designation: desig, stream: m.stream || '' })
    setCustomDesig(desig !== 'Core')
    setPhoto(m.photoUrl ? { publicUrl: m.photoUrl, key: m.s3Key } : null)
    setCoverImg(m.coverPhoto ? { publicUrl: m.coverPhoto, key: m.coverPhotoS3Key } : null)
    setEditGallery((m.gallery || []).sort((a, b) => a.order - b.order))
    setMsg('')
    setEditId(m._id); setEditOpen(true)
  }

  // Group by year descending; within each year: Core first, then others by name
  const byYear = members.reduce((acc, m) => {
    ;(acc[m.year] = acc[m.year] || []).push(m)
    return acc
  }, {})
  const years = Object.keys(byYear).sort((a,b) => b.localeCompare(a))
  const sortMembers = arr => [...arr].sort((a, b) => {
    const aIsCore = (a.designation || '').toLowerCase() === 'core'
    const bIsCore = (b.designation || '').toLowerCase() === 'core'
    if (aIsCore !== bIsCore) return aIsCore ? -1 : 1
    return (a.name || '').localeCompare(b.name || '')
  })

  return (
    <div className="space-y-6">
      {/* Add form — opened by FAB */}
      {creating && (
        <div className={`auth-glass rounded-2xl border ${L?'border-black/8':'border-white/8'} px-4 pb-4 pt-4`}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                  className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Name" />
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Year * (e.g. 2023-24)</label>
                <input value={form.year} onChange={e => setForm(f=>({...f,year:e.target.value}))}
                  className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="2023-24" />
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Designation</label>
                <select value={customDesig ? '__custom' : form.designation}
                  onChange={e => {
                    if (e.target.value === '__custom') {
                      setCustomDesig(true)
                      setForm(f => ({...f, designation:''}))
                    } else {
                      setCustomDesig(false)
                      setForm(f => ({...f, designation: e.target.value}))
                    }
                  }}
                  className="glass-input w-full mb-2" style={{ borderRadius:'10px' }}>
                  <option value="Core">Core</option>
                  <option value="__custom">Other (type below)</option>
                </select>
                {customDesig && (
                  <input value={form.designation}
                    onChange={e => setForm(f => ({...f, designation: e.target.value}))}
                    className="glass-input w-full" style={{ borderRadius:'10px' }}
                    placeholder="e.g. Secretary, Treasurer…"
                    autoFocus />
                )}
              </div>
            </div>
            <div>
              <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Stream <span className="text-gray-600 normal-case">(optional — e.g. Landscape, Portrait)</span></label>
              <input value={form.stream} onChange={e => setForm(f=>({...f,stream:e.target.value}))}
                className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="e.g. Landscape Photography" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Profile Photo</label>
                <ImageUpload folder="core" onUpload={r => setPhoto(r)} label="Upload photo" currentUrl={photo?.publicUrl} />
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Cover Photo <span className="text-gray-600 normal-case">(optional)</span></label>
                <ImageUpload folder="core-covers" onUpload={r => setCoverImg(r)} label="Upload cover" currentUrl={coverImg?.publicUrl} />
              </div>
            </div>
            {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
            <div className="flex gap-2">
              <GlassButton onClick={save} variant="red" disabled={busy}
                className="flex-1 font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
                {busy ? 'Saving…' : editId ? 'Save Changes' : 'Add Member'}
              </GlassButton>
              <GlassButton onClick={() => { setCreating(false); setEditId(null) }}
                className="font-inter text-sm px-5" style={{ borderRadius:'12px', minHeight:'44px' }}>
                Cancel
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Year-wise listing */}
      {loading ? (
        <SkeletonGrid n={4} />
      ) : years.length === 0 ? (
        <div className={`py-16 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold ${L?'text-gray-900':'text-white'}`}>No core members listed yet</p>
          <p className={`font-inter text-sm mt-1 ${L?'text-gray-500':'text-gray-500'}`}>Use the + button to add members.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {years.map(year => (
            <div key={year}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px flex-1 bg-red-600/30" />
                <h3 className={`font-clash text-xl font-bold ${L?'text-gray-900':'text-white'}`}>{year}</h3>
                <div className="h-px flex-1 bg-red-600/30" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortMembers(byYear[year]).map(m => (
                  <div key={m._id} className={`auth-glass rounded-2xl border p-4 text-center group relative ${L?'border-black/7':'border-white/7'}`}>
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-3 bg-gray-800 border-2 border-white/10">
                      {m.photoUrl
                        ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-clash text-2xl font-black text-white opacity-20">{m.name[0]}</div>}
                    </div>
                    <p className={`font-clash font-semibold text-sm ${L?'text-gray-900':'text-white'} leading-tight`}>{m.name}</p>
                    <p className={`font-inter text-[10px] mt-0.5 ${m.designation==='Core'||m.designation==='Admin'?'text-red-400':L?'text-gray-500':'text-gray-500'}`}>
                      {m.designation || 'Core'}
                    </p>
                    {/* Delete confirmation overlay */}
                    {deleteConfirm === m._id && (
                      <div className="absolute inset-0 bg-black/85 rounded-2xl flex flex-col items-center justify-center gap-2.5 p-3 z-10">
                        <p className="font-inter text-[11px] text-white text-center leading-snug">Delete {m.name}?</p>
                        <div className="flex gap-2">
                          <button onClick={() => remove(m._id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-inter text-[10px] font-semibold rounded-lg transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-inter text-[10px] font-semibold rounded-lg transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {/* View profile — left side, on hover */}
                    <Link to={`/core-member/${m._id}`}
                      className="absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                      style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.18)' }}
                      title="View profile"
                      onClick={e => e.stopPropagation()}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 20a6 6 0 0 0-12 0"/>
                        <circle cx="12" cy="10" r="4"/>
                      </svg>
                    </Link>
                    {/* Edit + Delete — right side, on hover */}
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button onClick={() => startEdit(m)}
                        className="w-7 h-7 rounded-lg text-white flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(59,130,246,0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.18)' }}
                        title="Edit">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(m._id)}
                        className="w-7 h-7 rounded-lg text-white flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(220,38,38,0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.18)' }}
                        title="Delete">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateFAB
        label="Create Core Member"
        isActive={creating}
        onCreate={() => {
          setCreating(c => !c)
          setEditId(null)
          setForm({ name:'', year:'', designation:'Core' })
          setPhoto(null)
          setCustomDesig(false)
          setMsg('')
        }}
      />

      {/* ── Edit member dialog (portal so it always centers on viewport) ── */}
      {editOpen && createPortal(
        <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeEditDialog} />
          <div className="relative auth-glass w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col"
            style={{ maxHeight:'92vh' }}>
            {/* Mobile handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 bg-white/20 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-5 pt-4 sm:pt-5 pb-4 border-b border-white/8 flex items-center justify-between shrink-0">
              <h3 className="font-clash text-lg font-semibold text-white">Edit Core Member</h3>
              <button onClick={closeEditDialog} className="text-gray-500 hover:text-white transition-colors p-1">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Body */}
            <div className="overflow-y-auto no-scrollbar px-5 py-5 space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                    className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Name" />
                </div>
                <div>
                  <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Year *</label>
                  <input value={form.year} onChange={e => setForm(f=>({...f,year:e.target.value}))}
                    className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="2023-24" />
                </div>
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Designation</label>
                <select value={customDesig ? '__custom' : form.designation}
                  onChange={e => {
                    if (e.target.value === '__custom') { setCustomDesig(true); setForm(f=>({...f,designation:''})) }
                    else { setCustomDesig(false); setForm(f=>({...f,designation:e.target.value})) }
                  }}
                  className="glass-input w-full mb-2" style={{ borderRadius:'10px' }}>
                  <option value="Core">Core</option>
                  <option value="__custom">Other (type below)</option>
                </select>
                {customDesig && (
                  <input value={form.designation} onChange={e => setForm(f=>({...f,designation:e.target.value}))}
                    className="glass-input w-full" style={{ borderRadius:'10px' }}
                    placeholder="e.g. Secretary, Treasurer…" autoFocus />
                )}
              </div>
              <div>
                <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Stream <span className="text-gray-600 normal-case">(optional)</span></label>
                <input value={form.stream} onChange={e => setForm(f=>({...f,stream:e.target.value}))}
                  className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="e.g. Landscape Photography, Portraiture…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Profile Photo</label>
                  <ImageUpload folder="core" onUpload={r => setPhoto(r)} label="Change photo" currentUrl={photo?.publicUrl} />
                </div>
                <div>
                  <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Cover Photo <span className="text-gray-600 normal-case">(optional)</span></label>
                  <ImageUpload folder="core-covers" onUpload={r => setCoverImg(r)} label="Set cover" currentUrl={coverImg?.publicUrl} />
                  {coverImg && (
                    <button type="button" onClick={() => setCoverImg(null)}
                      className="mt-1 font-inter text-[10px] text-red-400 hover:text-red-300 transition-colors">
                      Remove cover
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">
                    Gallery Photos · {editGallery.length}
                  </label>
                  <button type="button" onClick={() => galleryInputRef.current?.click()}
                    disabled={galleryUploading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-inter text-[10px] font-semibold text-white transition-all disabled:opacity-40"
                    style={{ background: 'rgba(220,38,38,0.8)' }}>
                    {galleryUploading
                      ? <><div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
                      : <><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Photos</>}
                  </button>
                  <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden"
                    onChange={e => uploadGalleryPhotos(e.target.files)} />
                </div>
                {editGallery.length > 0 ? (
                  <div className="columns-2 sm:columns-3 gap-2">
                    {editGallery.map(p => (
                      <div key={p._id} className="break-inside-avoid mb-2 relative group rounded-xl overflow-hidden">
                        <img src={p.url} alt={p.caption || ''} className="w-full h-auto block rounded-xl" />
                        <button type="button" onClick={() => removeGalleryPhoto(p._id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(220,38,38,0.88)' }}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`py-6 text-center rounded-xl border border-dashed ${L?'border-black/10':'border-white/8'}`}>
                    <p className="font-inter text-[10px] text-gray-600">No photos yet · Click "Add Photos" to upload</p>
                  </div>
                )}
              </div>

              {msg && <p className={`font-inter text-xs ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}
            </div>
            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-white/8 flex gap-2 shrink-0"
              style={{ paddingBottom:'max(20px, env(safe-area-inset-bottom, 20px))' }}>
              <GlassButton onClick={save} variant="red" disabled={busy}
                className="flex-1 font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
                {busy ? 'Saving…' : 'Save Changes'}
              </GlassButton>
              <GlassButton onClick={closeEditDialog}
                className="font-inter text-sm px-5" style={{ borderRadius:'12px', minHeight:'44px' }}>
                Cancel
              </GlassButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── MAIN ADMIN DASHBOARD ──────────────────────────────────────────────────────
// SVG icon paths for admin tabs
const TAB_ICONS = {
  users:        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  postcards:    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  gallery:      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  events:       <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  competitions: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  activities:   <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  magazines:    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  core:         <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  announce:     <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>,
  socials:      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  themes:       <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  permissions:  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  profile:      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

// ── ACTIVITIES ADMIN TAB ──────────────────────────────────────────────────────
function ActivitiesAdminTab({ currentUser, L }) {
  const [activities,       setActivities]       = useState([])
  const [selected,         setSelected]         = useState(null)
  const [creating,         setCreating]         = useState(false)
  const [newForm,          setNewForm]          = useState({ name:'', subject:'', description:'', venue:'', status:'', manualStatus:false })
  const [busy,             setBusy]             = useState(false)
  const [msg,              setMsg]              = useState('')
  const [actFilter,        setActFilter]        = useState('all')
  const [actSessionFilter, setActSessionFilter] = useState(() => currentSession())
  const [deleteActConfirm, setDeleteActConfirm] = useState(null)
  const [tabDlOpen, setTabDlOpen] = useState(false)
  const [tabDlBusy, setTabDlBusy] = useState(false)
  const [tabDlMsg,  setTabDlMsg]  = useState('')
  const [showPastSetting, setShowPastSetting] = useState(true)
  const [settingBusy, setSettingBusy] = useState(false)

  useEffect(() => {
    settingsApi.getSections().then(d => {
      setShowPastSetting(d?.sections?.['show-past-activities'] !== false)
    }).catch(() => {})
  }, [])

  const toggleShowPast = async () => {
    const next = !showPastSetting
    setSettingBusy(true)
    try {
      await settingsApi.setSectionVisible('show-past-activities', next)
      setShowPastSetting(next)
    } catch (e) { console.error(e) }
    finally { setSettingBusy(false) }
  }

  const load = useCallback(async (silent) => {
    if (!silent) {}
    try { const d = await activitiesApi.list(); setActivities(d.activities || []) } catch {}
  }, [])
  useEffect(() => { load(false) }, [load])

  // Live refresh of the list while browsing it (skip while inside an activity's manager view)
  useEffect(() => {
    const poll = setInterval(() => { if (!selected) load(true) }, 15000)
    return () => clearInterval(poll)
  }, [load, selected])

  const isCreateDirty = creating && !!(newForm.name.trim() || newForm.subject.trim() || newForm.description.trim() || newForm.venue.trim())
  const createBlocker = useUnsavedGuard(isCreateDirty)

  const doDeleteAct = async () => {
    if (!deleteActConfirm) return
    try { await activitiesApi.delete(deleteActConfirm._id) } catch (e) { console.error(e) }
    setDeleteActConfirm(null); load(false)
  }

  const handleTabActsDownload = async (fmt) => {
    setTabDlBusy(true); setTabDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      const itemsArr = activities.filter(a => isCurrentSession(a)).map(a => ({
        item: a,
        members: (a.volunteers || []).map(v => ({ user: v.user, role: v.role || 'volunteer' })),
      }))
      if (fmt === 'csv') {
        await downloadAllItemsCSV({ items: itemsArr, itemType: 'activity' })
        setTabDlMsg('✓ Downloaded')
      } else {
        await downloadAllItemsPDF({ items: itemsArr, itemType: 'activity', onProgress: msg => setTabDlMsg(msg || 'Building PDF…') })
        setTabDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setTabDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setTabDlBusy(false), 1600) } else { setTabDlBusy(false) }
      setTimeout(() => { setTabDlMsg(''); setTabDlOpen(false) }, 3500)
    }
  }

  if (selected) return <ActivityAdminDetail act={selected} onBack={() => { setSelected(null); load() }} currentUser={currentUser} L={L} />

  const actCurSession    = currentSession()
  const actCurrentItems  = activities.filter(a => isCurrentSession(a))
  const actPastItems     = activities.filter(a => !isCurrentSession(a))
  const actPastBySession = actPastItems.reduce((acc, a) => {
    const s = getItemSession(getPrimaryItemDate(a)) || 'Older'
    ;(acc[s] = acc[s] || []).push(a)
    return acc
  }, {})
  const actPastSessions  = Object.keys(actPastBySession).sort((a, b) => b.localeCompare(a))
  const actAllSessions   = [actCurSession, ...actPastSessions]
  const actSessionItems  = actSessionFilter === actCurSession ? actCurrentItems : (actPastBySession[actSessionFilter] || [])
  const actIsPast        = actSessionFilter !== actCurSession
  const ACT_STATUS_CLS   = { ongoing:'text-emerald-400 bg-emerald-900/20 border-emerald-800/30', upcoming:'text-violet-400 bg-violet-900/20 border-violet-800/30', past:'text-gray-400 bg-gray-800/30 border-gray-700/30' }
  const ac = { all: actSessionItems.length, upcoming: actSessionItems.filter(a=>a.status==='upcoming').length, ongoing: actSessionItems.filter(a=>a.status==='ongoing').length, past: actSessionItems.filter(a=>a.status==='past').length }
  const actFiltered = actFilter === 'all' ? actSessionItems : actSessionItems.filter(a => a.status === actFilter)

  const ActCard = ({ a, dim = false }) => (
    <div key={a._id} className={`group auth-glass rounded-2xl border overflow-hidden relative ${L?'border-black/8':'border-white/8'}`}
      style={{ filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined, transition:'filter 300ms' }}
      onMouseEnter={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
      onMouseLeave={dim ? ev => { ev.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>
      <div className="cursor-pointer" onClick={() => setSelected(a)}>
        {a.bannerUrl
          ? <img src={a.bannerUrl} alt="" className="w-full h-28 sm:h-32 object-cover group-hover:opacity-90 transition-opacity" />
          : <div className="w-full h-28 sm:h-32 flex items-center justify-center" style={{ background: L ? 'linear-gradient(135deg,#e2e6f0,#d8dde8)' : 'linear-gradient(135deg,#0d0720,#0a0a1e)' }}>
              <span className="font-clash text-5xl font-black" style={{ color: L ? 'rgba(163,177,200,0.22)' : 'rgba(255,255,255,0.10)' }}>{a.name?.[0]}</span>
            </div>}
        <div className="p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className={`font-clash font-semibold text-sm ${L?'text-gray-900':'text-white'} truncate`}>{a.name}</p>
              {a.subject && <p className="font-inter text-xs text-violet-400 mt-0.5 truncate">{a.subject}</p>}
              {a.showNewBadge && <span className="font-inter text-[8px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse">NEW</span>}
            </div>
            <span className={`font-inter text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${ACT_STATUS_CLS[a.status]||''}`}>{a.status}</span>
          </div>
          <div className="flex gap-3 mt-1 font-inter text-xs text-gray-500">
            <span>{a.memberIds?.length||0} members</span>
            <span>{a.gallery?.length||0} photos</span>
          </div>
          <p className="font-inter text-xs text-gray-600 mt-1">Click to manage →</p>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} className={`px-3 sm:px-3.5 pb-3 flex items-center gap-2 border-t pt-2 ${L?'border-black/5':'border-white/5'}`}>
        <span className="font-inter text-[9px] text-gray-600 uppercase tracking-wider mr-1">Gallery</span>
        {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
          const active = val === null ? (a.showInGallery === null || a.showInGallery === undefined) : a.showInGallery === val
          return (
            <button key={lbl}
              onClick={async () => {
                await activitiesApi.setGalleryVisibility(a._id, val).catch(() => {})
                setActivities(prev => prev.map(x => x._id === a._id ? { ...x, showInGallery: val } : x))
              }}
              className={`px-2 py-0.5 rounded font-inter text-[9px] border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
              {lbl}
            </button>
          )
        })}
      </div>
      <button
        onClick={e => { e.stopPropagation(); setDeleteActConfirm(a) }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-900/70 hover:bg-red-600 text-white/70 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        title="Delete activity">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Tab-level download */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTabDlOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs font-medium transition-all border ${
            tabDlOpen
              ? 'bg-red-700/20 text-red-400 border-red-700/40'
              : `${L?'border-black/10 bg-black/5':'border-white/8 bg-white/5'} text-gray-400 hover:text-white`
          }`}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All Activities Report
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            className={`transition-transform duration-200 ${tabDlOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      {tabDlOpen && (
        <div className={`p-4 rounded-xl border space-y-3 ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
          <div>
            <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>All Activities Report</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">{activities.filter(a => isCurrentSession(a)).length} activities this session · CSV exports one row per participation, PDF generates per-activity sections with volunteer cards</p>
          </div>
          {tabDlMsg && (
            <p className={`font-inter text-xs ${tabDlMsg.startsWith('✓') ? 'text-green-400' : tabDlMsg.startsWith('✗') ? 'text-red-400' : 'text-gray-400 animate-pulse'}`}>
              {tabDlMsg}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <GlassButton onClick={() => handleTabActsDownload('csv')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-blue-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ Excel'}
            </GlassButton>
            <GlassButton onClick={() => handleTabActsDownload('pdf')} disabled={tabDlBusy}
              className="font-inter text-xs px-4 text-emerald-400" style={{ borderRadius:'9px', minHeight:'32px' }}>
              {tabDlBusy ? '…' : '↓ PDF Report'}
            </GlassButton>
            <GlassButton onClick={() => { setTabDlOpen(false); setTabDlMsg('') }} disabled={tabDlBusy}
              className="font-inter text-xs px-3" style={{ borderRadius:'9px', minHeight:'32px' }}>
              Cancel
            </GlassButton>
          </div>
        </div>
      )}

      <p className={'font-inter text-[11px] text-gray-500 uppercase tracking-widest'}>Activities ({activities.length})</p>

      {/* Show Past Sessions toggle */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${L?'border-black/8 bg-black/[0.02]':'border-white/8 bg-white/[0.02]'}`}>
        <div>
          <p className={`font-inter text-xs font-semibold ${L?'text-gray-700':'text-gray-300'}`}>Show previous years activities to members</p>
          <p className="font-inter text-[10px] text-gray-500 mt-0.5">When off, past session activities are hidden for members and coordinators. Admins and core always see them.</p>
        </div>
        <button
          onClick={toggleShowPast}
          disabled={settingBusy}
          className={`relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 ${
            showPastSetting
              ? 'bg-emerald-600 border-emerald-500'
              : L ? 'bg-black/10 border-black/15' : 'bg-white/10 border-white/15'
          } ${settingBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${showPastSetting ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {creating && (
        <div className={`auth-glass rounded-2xl border p-5 space-y-3 ${L?'border-black/8':'border-white/8'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">New Activity</p>
            <button onClick={() => setCreating(false)} className="font-inter text-xs text-gray-500 hover:text-gray-300 transition-colors">✕ Cancel</button>
          </div>
          <input value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Activity name *" />
          <input value={newForm.subject} onChange={e=>setNewForm(f=>({...f,subject:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Subject (optional)" />
          <textarea value={newForm.description} onChange={e=>setNewForm(f=>({...f,description:e.target.value}))} rows={2} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} placeholder="Description / Content (optional)" />
          <input value={newForm.venue} onChange={e=>setNewForm(f=>({...f,venue:e.target.value}))} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Venue (optional)" />

          {/* Status */}
          <div className="space-y-1.5">
            <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setNewForm(f=>({...f,manualStatus:false,status:''}))}
                className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${!newForm.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                Auto
              </button>
              {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                <button key={lbl} type="button"
                  onClick={() => setNewForm(f=>({...f,manualStatus:true,status:val}))}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${newForm.manualStatus && newForm.status===val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <p className="font-inter text-[10px] text-gray-500">
              {!newForm.manualStatus ? 'Auto — computed from start/end dates on save'
                : newForm.status === '' ? 'No status badge shown on card'
                : <span>Manually set to <span className="capitalize text-gray-400">{newForm.status}</span></span>}
            </p>
          </div>

          {msg && <p className={'font-inter text-xs ' + (msg.startsWith('✓')?'text-green-400':'text-red-400')}>{msg}</p>}
          <GlassButton variant="red" disabled={busy||!newForm.name.trim()} onClick={async () => {
            setBusy(true); setMsg('')
            try {
              const d = await activitiesApi.create(newForm)
              setActivities(prev => [d.activity, ...prev])
              setCreating(false); setNewForm({ name:'', subject:'', description:'', venue:'', status:'', manualStatus:false })
            } catch (e) { setMsg(e.message) }
            finally { setBusy(false) }
          }} className="w-full font-inter text-sm" style={{ borderRadius:'10px', minHeight:'40px' }}>
            {busy ? 'Creating...' : 'Create Activity'}
          </GlassButton>
        </div>
      )}

      {/* Session filter */}
      {actAllSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="font-inter text-[10px] uppercase tracking-widest text-gray-400">Session</span>
          {actAllSessions.map(s => (
            <button key={s} onClick={() => { setActSessionFilter(s); setActFilter('all') }}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                actSessionFilter === s
                  ? 'bg-violet-700 text-white border-violet-700'
                  : L ? 'border-black/15 text-gray-600 hover:text-gray-900 hover:border-black/25'
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}>
              {s}{s === actCurSession ? ' · Current' : ''}
            </button>
          ))}
          {!showPastSetting && (
            <span className="font-inter text-[9px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/30 uppercase tracking-wider">Past hidden from members</span>
          )}
        </div>
      )}

      {/* Status filter */}
      {actSessionItems.length > 0 && (
        <div className={`flex flex-wrap gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
          {[['all','All'],['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past']].map(([id,label]) => (
            ac[id] > 0 || id === 'all' ? (
              <button key={id} onClick={() => setActFilter(id)}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-inter text-[10px] sm:text-xs font-semibold capitalize transition-all ${
                  actFilter === id
                    ? {all:'bg-red-700',upcoming:'bg-violet-700',ongoing:'bg-emerald-700',past:'bg-gray-600'}[id] + ' text-white'
                    : 'text-gray-500 hover:text-white'
                }`}>
                {label} {ac[id] > 0 && <span className="opacity-70 text-[10px]">{ac[id]}</span>}
              </button>
            ) : null
          ))}
        </div>
      )}

      {actSessionItems.length === 0 && !creating ? (
        <div className={`py-14 text-center rounded-2xl border ${L?'border-black/6':'border-white/6'}`}>
          <p className="font-inter text-sm text-gray-500">
            {actIsPast ? `No activities in ${actSessionFilter}` : `No ${actFilter === 'all' ? '' : actFilter + ' '}activities yet. Use the + button to create one.`}
          </p>
        </div>
      ) : actFiltered.length === 0 && !creating ? (
        <div className={`py-12 text-center auth-glass rounded-2xl border ${L?'border-black/7':'border-white/7'}`}>
          <p className={`font-clash font-semibold text-lg ${L?'text-gray-900':'text-white'}`}>No {actFilter} activities</p>
        </div>
      ) : actFiltered.length > 0 ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4${actIsPast ? ' opacity-80' : ''}`}>
          {actFiltered.map(a => <ActCard key={a._id} a={a} dim={actIsPast} />)}
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteActConfirm}
        title="Delete Activity?"
        message={deleteActConfirm ? `Are you sure you want to delete "${deleteActConfirm.name}"? This will permanently delete all activity data, gallery photos, volunteer assignments, and all uploaded files. This cannot be undone.` : ''}
        confirmLabel="Yes, Delete Everything"
        onConfirm={doDeleteAct}
        onCancel={() => setDeleteActConfirm(null)}
      />

      <CreateFAB label="Create Activity" isActive={creating} onCreate={() => setCreating(c => !c)} />
      <DownloadingOverlay visible={tabDlBusy} message={tabDlMsg} />
      <RouteBlockDialog blocker={createBlocker} L={L} />
    </div>
  )
}

// ── Activity admin detail/edit view ───────────────────────────────────────────
function ActivityAdminDetail({ act: initialAct, onBack, currentUser, L }) {
  const [act,  setAct]  = useState(initialAct)
  const [tab,  setTab]  = useState('details')
  const [busy, setBusy] = useState(false)
  const [msg,  setMsg]  = useState('')
  const [mgrDlBusy, setMgrDlBusy] = useState(false)
  const [mgrDlMsg,  setMgrDlMsg]  = useState('')
  const [logoBanner, setLogoBanner] = useState(null)
  const [actBanner,  setActBanner]  = useState(null)
  const [allMembers, setAllMembers] = useState([])
  const [pendingVolAdds,  setPendingVolAdds]  = useState(new Set())
  const [volSearch,       setVolSearch]       = useState('')
  const [volSaving,       setVolSaving]       = useState(false)
  const [volMsg,          setVolMsg]          = useState('')
  const [removeVolConfirm,       setRemoveVolConfirm]       = useState(null)
  const [showVolFilters,         setShowVolFilters]         = useState(false)
  const [volFilter,              setVolFilter]              = useState({ year:'all', stream:'all', role:'all' })
  const [roleVolConfirm,         setRoleVolConfirm]         = useState(null)
  const [actGalleryDeleteConfirm,setActGalleryDeleteConfirm]= useState(null)
  const [actLightboxIdx,     setActLightboxIdx]     = useState(null)
  const [actUploading,       setActUploading]       = useState(false)
  const [actUploadProgress,  setActUploadProgress]  = useState({ current: 0, total: 0 })
  const [addingLink, setAddingLink] = useState(false)
  const [newLink, setNewLink] = useState({ name:'', url:'', type:'external' })
  const [annBody, setAnnBody] = useState('')
  const [annSending, setAnnSending] = useState(false)

  const [form, setForm] = useState({
    name:        act.name        || '',
    subject:     act.subject     || '',
    description: act.description || '',
    venue:       act.venue       || '',
    startDate:   act.startDate  ? act.startDate.slice(0,10)  : '',
    endDate:     act.endDate    ? act.endDate.slice(0,10)    : '',
    eventDates:  act.eventDates?.map(d => d?.slice?.(0,10) || '') || (act.eventDate ? [act.eventDate.slice(0,10)] : []),
    showNewBadge:       act.showNewBadge       || false,
    manualStatus:       act.manualStatus       || false,
    status:             act.manualStatus ? (act.status || '') : '',
    googleFormUrl:      act.googleFormUrl      || '',
    formPublished:      act.formPublished      || false,
    allowVolunteersEdit: act.allowVolunteersEdit !== false,
    isOpenToAll:         act.isOpenToAll         || false,
    customDates: act.customDates?.map(cd => ({ ...cd, date: cd.date?.slice(0,10) || '' })) || [],
  })

  useEffect(() => {
    activitiesApi.get(act._id).then(d => setAct(d.activity)).catch(() => {})
    membersApi.list().then(d => setAllMembers(d.members)).catch(() => {})
  }, [act._id])

  const [backConfirm, setBackConfirm] = useState(false)
  const { toast } = useToast()

  const isDirty = useMemo(() => {
    const f = form, a = act
    return f.name !== (a.name || '') ||
      f.description !== (a.description || '') ||
      f.venue !== (a.venue || '') ||
      f.manualStatus !== (a.manualStatus || false) ||
      f.status !== (a.manualStatus ? (a.status || '') : '') ||
      f.isOpenToAll !== (a.isOpenToAll || false)
  }, [form, act])
  const routeBlocker = useUnsavedGuard(isDirty)

  const refresh = async () => { const d = await activitiesApi.get(act._id); setAct(d.activity) }
  const setF  = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleCoordPerm = async (field) => {
    const newVal = !act[field]
    try { await activitiesApi.setCoordPerms(act._id, { [field]: newVal }) }
    catch (e) { console.error(e.message); return }
    setAct(a => ({ ...a, [field]: newVal }))
  }

  const save = async () => {
    setBusy(true); setMsg('')
    try {
      const actIsPast = (form.manualStatus && form.status === 'past') || (!form.manualStatus && act.status === 'past')
      const body = { ...form, manualStatus:!!form.status, status:form.status||undefined, eventDate: form.eventDates?.[0] || undefined, isOpenToAll: actIsPast ? true : form.isOpenToAll }
      if (logoBanner) { body.bannerUrl = logoBanner.publicUrl; body.bannerS3Key = logoBanner.key }
      if (actBanner)  { body.activityBannerUrl = actBanner.publicUrl; body.activityBannerS3Key = actBanner.key }
      const d = await activitiesApi.update(act._id, body)
      setAct(d.activity); toast.success('Saved', 'Activity details updated')
    } catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const isAdmin = currentUser?.role === 'admin'
  const excludedIds = new Set((act.excludedCores || []).map(u => (u && typeof u === 'object') ? u._id?.toString() : u?.toString()).filter(Boolean))
  const explicitVolByUid = new Map((act.volunteers||[]).map(v => {
    const uid = (v.user && typeof v.user === 'object') ? v.user?._id?.toString() : v.user?.toString()
    return [uid, v]
  }))
  const coreMembers = allMembers.filter(m => m.role === 'core' && !excludedIds.has(m._id?.toString()))
  const volDisplayRows = [
    ...coreMembers.map(c => {
      const explicit = explicitVolByUid.get(c._id?.toString())
      return { user: c, volRole: explicit?.role || 'core', isImplicit: !explicit }
    }),
    ...(act.volunteers||[])
      .filter(v => { const u = v.user; return u && typeof u === 'object' && u.role !== 'admin' && u.role !== 'core' })
      .map(v => ({ user: v.user, volRole: v.role, isImplicit: false })),
  ]
  const VOL_ROLE_RANK = { core: 0, coordinator: 1, volunteer: 2 }
  volDisplayRows.sort((a, b) => (VOL_ROLE_RANK[a.volRole] ?? 2) - (VOL_ROLE_RANK[b.volRole] ?? 2))

  const uniqueVolYears   = [...new Set(volDisplayRows.map(r => { const u=r.user; return u?.startYear&&u?.endYear?(computeAcademicYear(u.startYear,u.endYear).label||null):null }).filter(Boolean))]
  const uniqueVolStreams  = [...new Set(volDisplayRows.map(r => r.user?.department).filter(Boolean))]
  const uniqueVolRoles   = [...new Set(volDisplayRows.map(r => r.volRole).filter(Boolean))]
  const filteredVolRows  = volDisplayRows.filter(row => {
    const u = row.user; if (!u || typeof u !== 'object') return false
    if (volFilter.year   !== 'all' && (computeAcademicYear(u.startYear,u.endYear).label||'—') !== volFilter.year)   return false
    if (volFilter.stream !== 'all' && u.department !== volFilter.stream) return false
    if (volFilter.role   !== 'all' && row.volRole  !== volFilter.role)   return false
    return true
  })
  const volFiltered = volFilter.year!=='all' || volFilter.stream!=='all' || volFilter.role!=='all'

  const volIds = new Set(volDisplayRows.map(r => r.user?._id?.toString()).filter(Boolean))
  const notInAct = allMembers.filter(m => {
    if (m.role === 'admin') return false
    if (volIds.has(m._id?.toString())) return false
    if (m.role === 'core') return excludedIds.has(m._id?.toString())
    return true
  })
  const filteredNotInAct = volSearch.trim()
    ? notInAct.filter(m => m.name?.toLowerCase().includes(volSearch.toLowerCase()) || m.department?.toLowerCase().includes(volSearch.toLowerCase()))
    : notInAct

  const canRemoveVol = (userObj, isCore, isImplicit) => {
    if (!userObj) return false
    if (isAdmin) return true
    if (isCore || isImplicit) return false
    const uRole = typeof userObj === 'object' ? userObj.role : ''
    return currentUser?.role === 'core' && uRole !== 'admin' && uRole !== 'core'
  }
  const toggleVolPending = (uid) => setPendingVolAdds(prev => {
    const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next
  })
  const saveVolunteers = async () => {
    if (!pendingVolAdds.size) return
    setVolSaving(true); setVolMsg('')
    let added = 0
    try {
      for (const uid of pendingVolAdds) { await activitiesApi.addVolunteer(act._id, uid); added++ }
      setPendingVolAdds(new Set())
      toast.success('Added', `${added} volunteer${added>1?'s':''} notified by email`)
      setVolMsg(''); refresh()
    } catch (e) { setVolMsg(`✗ ${e.message}`) }
    finally { setVolSaving(false) }
  }
  const removeVol = async () => {
    await activitiesApi.removeVolunteer(act._id, removeVolConfirm).catch(()=>{})
    setRemoveVolConfirm(null); refresh()
  }
  const setVolRole = async (uid, role) => {
    await activitiesApi.setVolunteerRole(act._id, uid, role).catch(()=>{})
    refresh()
  }

  const handleMgrActDownload = async (fmt) => {
    setMgrDlBusy(true); setMgrDlMsg(fmt === 'csv' ? 'Building CSV…' : 'Loading images…')
    try {
      const members = volDisplayRows.map(row => ({ user: row.user, role: row.volRole }))
      if (fmt === 'csv') {
        await downloadSingleItemCSV({ item: act, itemType: 'activity', members })
        setMgrDlMsg('✓ Downloaded')
      } else {
        await downloadSingleItemPDF({ item: act, itemType: 'activity', members, onProgress: msg => setMgrDlMsg(msg || 'Building PDF…') })
        setMgrDlMsg('✓ Downloaded')
      }
    } catch (e) {
      setMgrDlMsg(`✗ ${e.message}`)
    } finally {
      if (fmt === 'csv') { setTimeout(() => setMgrDlBusy(false), 1600) } else { setMgrDlBusy(false) }
      setTimeout(() => setMgrDlMsg(''), 3500)
    }
  }

  const SUBTABS = ['details','gallery','volunteers','announcements']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => isDirty ? setBackConfirm(true) : onBack()} className="text-gray-500 hover:text-white transition-colors">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className={`font-clash text-xl font-semibold flex items-center gap-2 ${L?'text-gray-900':'text-white'}`}>
          {act.name}
          {act.showNewBadge && <span className="font-inter text-[9px] px-1.5 py-0.5 bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse">NEW</span>}
        </h2>
        {isDirty && <span className="font-inter text-xs text-amber-400/80 ml-1">Unsaved</span>}
      </div>

      <div className={`flex flex-wrap gap-1 p-1 rounded-xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
        {SUBTABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg font-inter text-xs font-medium capitalize transition-all ${tab===t?'bg-violet-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
            {t === 'volunteers' ? `Volunteers (${volDisplayRows.length})` : t}
          </button>
        ))}
      </div>

      {/* DETAILS TAB */}
      {tab === 'details' && (
        <div className="space-y-4 tab-panel-sub">
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Activity Name *</label>
            <input value={form.name} onChange={e=>setF('name',e.target.value)} className="glass-input w-full" style={{ borderRadius:'10px' }} />
          </div>
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Subject</label>
            <input value={form.subject} onChange={e=>setF('subject',e.target.value)} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Subject / theme of this activity..." />
          </div>
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Description / Content</label>
            <textarea value={form.description} onChange={e=>setF('description',e.target.value)} rows={4} className="glass-input w-full resize-none" style={{ borderRadius:'10px' }} placeholder="Full description of the activity..." />
          </div>
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Venue</label>
            <input value={form.venue} onChange={e=>setF('venue',e.target.value)} className="glass-input w-full" style={{ borderRadius:'10px' }} placeholder="Venue..." />
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Dates</p>
            <div className="grid grid-cols-2 gap-3">
              {[['startDate','Start Date'],['endDate','End Date']].map(([k,lbl]) => (
                <div key={k}>
                  <label className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">{lbl}</label>
                  <input type="date" value={form[k]} onChange={e=>setF(k,e.target.value)}
                    className="glass-input w-full text-xs" style={{ borderRadius:'9px', colorScheme:'dark' }} />
                </div>
              ))}
            </div>
          </div>

          <EventDatesEditor L={L} value={form.eventDates}
            onChange={v => setF('eventDates', v)} />
          <CustomDatesEditor L={L} value={form.customDates}
            onChange={v => setF('customDates', v)} />

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Google Form (optional)</p>
            <input value={form.googleFormUrl} onChange={e=>setF('googleFormUrl',e.target.value)} className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} placeholder="https://forms.google.com/..." />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.formPublished} onChange={e=>setF('formPublished',e.target.checked)} className="accent-violet-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show registration form publicly</span>
            </label>
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setForm(f=>({...f, manualStatus:false, status:''}))}
                className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                  !form.manualStatus ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                }`}>
                Auto
              </button>
              {[['upcoming','Upcoming'],['ongoing','Ongoing'],['past','Past'],['','No Status']].map(([val,lbl]) => (
                <button key={lbl} type="button"
                  onClick={() => setForm(f=>({...f, manualStatus:true, status:val}))}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${
                    form.manualStatus && form.status===val ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
            {!form.manualStatus && <p className="font-inter text-[10px] text-gray-500">Auto — computed from dates. Current: <span className="capitalize text-gray-400">{act.status || 'upcoming'}</span></p>}
            {form.manualStatus && form.status === '' && <p className="font-inter text-[10px] text-yellow-500">No status badge shown on card</p>}
            {form.manualStatus && form.status !== '' && <p className="font-inter text-[10px] text-gray-500">Manually set to <span className="capitalize text-gray-400">{form.status}</span></p>}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.showNewBadge} onChange={e=>setF('showNewBadge',e.target.checked)} className="accent-violet-600 w-4 h-4" />
              <span className="font-inter text-xs text-gray-400">Show NEW badge</span>
            </label>
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Banners</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-inter text-[10px] text-gray-600 mb-1.5">Card Logo (small)</p>
                <ImageUpload folder="activities" onUpload={r=>setLogoBanner(r)} label="Upload card logo" currentUrl={logoBanner?.publicUrl||act.bannerUrl} preview />
              </div>
              <div>
                <p className="font-inter text-[10px] text-gray-600 mb-1.5">Full Activity Banner</p>
                <ImageUpload folder="activities" onUpload={r=>setActBanner(r)} label="Upload activity banner" currentUrl={actBanner?.publicUrl||act.activityBannerUrl} preview />
              </div>
            </div>
          </div>

          {/* Links */}
          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Links</p>
              <p className="font-inter text-[9px] text-gray-600">Resource links — shown publicly</p>
            </div>
            {act.links?.map(lnk => (
              <div key={lnk._id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${L?'border-black/6':'border-white/6'}`}>
                <span className={`font-inter text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border ${lnk.type==='resource'?'bg-blue-900/40 text-blue-400 border-blue-700/40':'bg-gray-800/40 text-gray-400 border-gray-700/30'}`}>{lnk.type}</span>
                <p className={'font-inter text-xs flex-1 truncate ' + (L?'text-gray-700':'text-gray-300')}>{lnk.name}</p>
                <button onClick={async () => { await activitiesApi.deleteLink(act._id, lnk._id); refresh() }}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0">✕</button>
              </div>
            ))}
            {addingLink ? (
              <div className="space-y-2">
                <input value={newLink.name} onChange={e=>setNewLink(l=>({...l,name:e.target.value}))} className="glass-input w-full text-xs" style={{ borderRadius:'8px' }} placeholder="Link name" />
                <input value={newLink.url}  onChange={e=>setNewLink(l=>({...l,url:e.target.value}))}  className="glass-input w-full text-xs" style={{ borderRadius:'8px' }} placeholder="https://..." />
                <select value={newLink.type} onChange={e=>setNewLink(l=>({...l,type:e.target.value}))} className="glass-input w-full text-xs" style={{ borderRadius:'8px' }}>
                  <option value="external">External</option>
                  <option value="resource">Resource</option>
                </select>
                <div className="flex gap-2">
                  <GlassButton variant="red" disabled={!newLink.name||!newLink.url} onClick={async () => { await activitiesApi.addLink(act._id, newLink); setAddingLink(false); setNewLink({name:'',url:'',type:'external'}); refresh() }}
                    className="font-inter text-xs" style={{ borderRadius:'8px', minHeight:'30px', padding:'0 12px' }}>Add</GlassButton>
                  <GlassButton onClick={() => setAddingLink(false)} className="font-inter text-xs" style={{ borderRadius:'8px', minHeight:'30px', padding:'0 12px' }}>Cancel</GlassButton>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLink(true)} className="font-inter text-[10px] text-violet-400 hover:text-violet-300">+ Add Link</button>
            )}
          </div>

          <div className={`auth-glass rounded-xl p-4 border ${L?'border-black/8':'border-white/8'} space-y-2`}>
            <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Coordinator Permissions</p>
            {[
              ['coordCanEditDetails',   'Can edit activity details'],
              ['coordCanManageGallery', 'Can manage gallery'],
              ['coordCanAnnounce',      'Can post announcements'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleCoordPerm(field)}>
                <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${act[field]!==false?'bg-green-600':'bg-gray-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${act[field]!==false?'translate-x-4':'translate-x-0.5'}`} />
                </div>
                <span className="font-inter text-xs text-gray-400">{label}</span>
              </label>
            ))}
          </div>

          {(() => {
            const isPast = (form.manualStatus && form.status === 'past') || (!form.manualStatus && act.status === 'past')
            return (
              <label className={`flex items-center gap-2 ${isPast ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>
                <input type="checkbox"
                  checked={isPast ? true : form.isOpenToAll}
                  disabled={isPast}
                  onChange={e => !isPast && setF('isOpenToAll', e.target.checked)}
                  className="accent-violet-600 w-4 h-4" />
                <span className="font-inter text-xs text-gray-400">
                  Open to all members (no individual enrolment needed)
                  {isPast && <span className="ml-1 text-gray-500">— always on for past activities</span>}
                </span>
              </label>
            )
          })()}
          {msg && <p className={'font-inter text-sm ' + (msg==='Saved'?'text-green-400':'text-red-400')}>{msg}</p>}
          <GlassButton variant="red" disabled={busy} onClick={save}
            className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'44px' }}>
            {busy ? 'Saving…' : 'Save Changes'}
          </GlassButton>
        </div>
      )}

      {/* GALLERY TAB */}
      {tab === 'gallery' && (
        <div className="space-y-4 tab-panel-sub">
          <DriveLinkSetting L={L} value={act.driveLink} onSave={async link => {
            const d = await activitiesApi.update(act._id, { driveLink: link }); setAct(d.activity)
          }} />

          {/* Show in Public Gallery toggle */}
          <div className={`auth-glass rounded-xl border p-3 ${L?'border-black/8':'border-white/8'}`}>
            <p className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-2">Show in Public Gallery</p>
            <div className="flex gap-2">
              {[[null,'Auto'],[true,'On'],[false,'Off']].map(([val,lbl]) => {
                const active = val === null ? (act.showInGallery === null || act.showInGallery === undefined) : act.showInGallery === val
                return (
                  <button key={lbl}
                    onClick={async () => {
                      await activitiesApi.setGalleryVisibility(act._id, val).catch(() => {})
                      setAct(a => ({ ...a, showInGallery: val }))
                    }}
                    className={`px-3 py-1.5 rounded-xl font-inter text-xs font-bold border transition-all ${active ? 'bg-red-700 text-white border-red-700' : 'text-gray-500 border-white/10 hover:text-white'}`}>
                    {lbl}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Activity Gallery ({act.gallery?.length||0})</p>
          <label className={'block w-full rounded-xl cursor-pointer border-2 border-dashed transition-colors ' + (L?'border-black/12 hover:border-violet-600/30':'border-white/10 hover:border-violet-600/30')}>
            <div className={'flex flex-col items-center justify-center py-8 ' + (L?'text-gray-400':'text-gray-600')}>
              {actUploading ? (
                <div className="flex flex-col items-center gap-3 w-full px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="font-inter text-xs text-gray-400">
                      Uploading {actUploadProgress.current} of {actUploadProgress.total}…
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${actUploadProgress.total ? Math.round(actUploadProgress.current / actUploadProgress.total * 100) : 0}%` }} />
                  </div>
                </div>
              ) : (
                <p className="font-inter text-sm">Choose photos to upload</p>
              )}
            </div>
            <input type="file" accept="image/*" multiple className="hidden" disabled={actUploading} onChange={async e => {
              const picked = Array.from(e.target.files); if (!picked.length) return
              setActUploading(true); setActUploadProgress({ current: 0, total: picked.length })
              for (let i = 0; i < picked.length; i++) {
                setActUploadProgress({ current: i + 1, total: picked.length })
                const { key, publicUrl } = await uploadFileToS3(picked[i], 'activities').catch(() => ({ key:'', publicUrl:'' }))
                if (publicUrl) await activitiesApi.addGalleryPhoto(act._id, { imageUrl: publicUrl, s3Key: key }).catch(() => {})
              }
              setActUploading(false); setActUploadProgress({ current: 0, total: 0 })
              refresh()
            }} />
          </label>
          {(act.gallery?.length||0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[...(act.gallery||[])].sort((a,b)=>(a.order||0)-(b.order||0)).map((p, i) => (
                <div key={p._id} className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer" onClick={() => setActLightboxIdx(i)}>
                  <ProgressiveImage src={p.imageUrl} className="w-full h-full object-cover" />
                  <button onClick={e => { e.stopPropagation(); setActGalleryDeleteConfirm(p._id) }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs items-center justify-center hidden group-hover:flex">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {actLightboxIdx !== null && (
        <Lightbox
          photos={[...(act.gallery||[])].sort((a,b)=>(a.order||0)-(b.order||0)).map(p => ({ url: p.imageUrl }))}
          startIndex={actLightboxIdx}
          onClose={() => setActLightboxIdx(null)}
        />
      )}

      {/* VOLUNTEERS TAB */}
      {tab === 'volunteers' && (
        <div className="space-y-5 tab-panel-sub">

          {/* ── Current volunteers table ── */}
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} space-y-2.5`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">
                  Volunteers ({volFiltered ? `${filteredVolRows.length} of ${volDisplayRows.length}` : volDisplayRows.length})
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-inter text-[9px] text-gray-600 hidden sm:block">Cores always participate</p>
                  {mgrDlMsg && <span className={`font-inter text-[9px] ${mgrDlMsg.startsWith('✓')?'text-green-400':mgrDlMsg.startsWith('✗')?'text-red-400':'text-gray-400 animate-pulse'}`}>{mgrDlMsg}</span>}
                  <button onClick={() => handleMgrActDownload('csv')} disabled={mgrDlBusy}
                    title="Download Excel"
                    className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}>
                    ↓ Excel
                  </button>
                  <button onClick={() => handleMgrActDownload('pdf')} disabled={mgrDlBusy}
                    title="Download PDF"
                    className="font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all text-emerald-400/70 border-emerald-800/30 hover:text-emerald-400">
                    ↓ PDF
                  </button>
                  <button onClick={()=>setShowVolFilters(v=>!v)} className={`font-inter text-[10px] px-2.5 py-1 rounded-lg border transition-all ${showVolFilters?'bg-violet-700/20 text-violet-400 border-violet-700/40':`${L?'text-gray-500':'text-gray-500'} border-white/10 hover:text-white`}`}>
                    {showVolFilters?'✕ Filters':'⚙ Filter'}
                  </button>
                </div>
              </div>
              {showVolFilters && (
                <div className="flex gap-2 flex-wrap">
                  {[{key:'year',label:'Year',opts:uniqueVolYears},{key:'stream',label:'Stream',opts:uniqueVolStreams},{key:'role',label:'Role',opts:uniqueVolRoles}].map(f=>(
                    <select key={f.key} value={volFilter[f.key]} onChange={e=>setVolFilter(p=>({...p,[f.key]:e.target.value}))} className="glass-input text-[10px] appearance-none px-2 py-1" style={{borderRadius:8}}>
                      <option value="all">All {f.label}s</option>
                      {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                  {volFiltered && <button onClick={()=>setVolFilter({year:'all',stream:'all',role:'all'})} className="font-inter text-[10px] text-violet-400 hover:text-violet-300 px-2">✕ Clear</button>}
                </div>
              )}
            </div>

            {filteredVolRows.length === 0 ? (
              <p className="p-6 text-center font-inter text-sm text-gray-600">{volFiltered ? 'No volunteers match filters.' : 'No volunteers yet.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className={`border-b ${L?'border-black/5':'border-white/5'}`}>
                      {['Volunteer','Stream','Year','Role',''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-inter text-[9px] text-gray-500 uppercase tracking-[0.12em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVolRows.map((row, i) => {
                      const u      = row.user
                      const name   = u?.name       || '—'
                      const email  = u?.email      || ''
                      const dept   = u?.department || '—'
                      const yrObj  = u?.startYear ? computeAcademicYear(u.startYear, u.endYear) : null
                      const yr     = yrObj ? yrObj.label || '—' : '—'
                      const uid    = u?._id?.toString() || u
                      const isCore = u?.role === 'core'
                      const showRemove = isAdmin
                        ? (!row.isImplicit || isCore)
                        : canRemoveVol(u, isCore, row.isImplicit)
                      const volAccent = row.volRole==='core' ? 'rgba(245,158,11,0.55)' : row.volRole==='coordinator' ? 'rgba(99,179,237,0.45)' : 'transparent'
                      return (
                        <tr key={i} className={`border-b last:border-0 ${L?'border-black/5':'border-white/5'} hover:bg-white/[0.02] transition-colors`}
                          style={{ boxShadow:`inset 3px 0 0 ${volAccent}` }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0 flex items-center justify-center">
                                {u?.profilePhoto
                                  ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                                  : <span className="font-inter text-[10px] font-bold text-white">{name[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{name}</p>
                                {email && <p className="font-inter text-[9px] text-gray-500 truncate">{email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 truncate max-w-[120px]">{dept}</p></td>
                          <td className="px-4 py-3"><p className="font-inter text-[11px] text-gray-400 whitespace-nowrap">{yr}</p></td>
                          <td className="px-4 py-3">
                            {isCore && !isAdmin ? (
                              <span className="font-inter text-[10px] px-2 py-1 rounded-lg border border-amber-500/30 text-amber-400 bg-amber-900/10 capitalize">Core</span>
                            ) : (
                              <select value={row.volRole}
                                onChange={e => setRoleVolConfirm({ uid, name, from:row.volRole, to:e.target.value, verb: ['coordinator','core'].indexOf(e.target.value)>['coordinator','core'].indexOf(row.volRole)?'promote':'demote' })}
                                className="glass-input text-[10px] appearance-none px-2 py-1 capitalize"
                                style={{ borderRadius:8, minWidth:100 }}>
                                {(isCore ? ['core','coordinator','volunteer'] : ['volunteer','coordinator']).map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end flex-wrap">
                              {(isAdmin||(!isCore&&!row.isImplicit))&&(()=>{
                                const targets=[]
                                if(row.volRole==='volunteer') targets.push({label:'Coordinator',role:'coordinator'})
                                if(row.volRole==='coordinator'&&isAdmin) targets.push({label:'Core',role:'core'})
                                return targets.map(t=><button key={t.role} onClick={()=>setRoleVolConfirm({uid,name,from:row.volRole,to:t.role,verb:'promote'})} className="font-inter text-[9px] px-2 py-1 rounded-lg border border-green-500/25 text-green-400/70 hover:text-green-400 hover:border-green-500/50 transition-all">↑ {t.label}</button>)
                              })()}
                              {row.volRole!=='volunteer'&&(isAdmin||(!isCore&&!row.isImplicit))&&(
                                <button onClick={()=>setRoleVolConfirm({uid,name,from:row.volRole,to:'volunteer',verb:'demote'})}
                                  className="font-inter text-[9px] px-2 py-1 rounded-lg border border-yellow-500/25 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/50 transition-all">
                                  ↓ Volunteer
                                </button>
                              )}
                              {showRemove && (
                                <button onClick={() => setRemoveVolConfirm(uid)}
                                  className="font-inter text-[9px] px-2 py-1 rounded-lg border border-red-500/25 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-all">
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Add volunteers ── */}
          <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
            <div className={`px-4 py-3 border-b ${L?'border-black/5':'border-white/5'} flex items-center justify-between gap-3 flex-wrap`}>
              <div>
                <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Add Volunteers</p>
                <p className="font-inter text-[10px] text-gray-600 mt-0.5">
                  {pendingVolAdds.size > 0 ? `${pendingVolAdds.size} selected — click Save to add & notify` : 'Select members below to add them'}
                </p>
              </div>
              <GlassButton onClick={saveVolunteers} variant="red" disabled={volSaving || pendingVolAdds.size === 0}
                className="font-inter text-sm font-semibold px-5 shrink-0"
                style={{ borderRadius:'12px', minHeight:'40px', opacity: pendingVolAdds.size === 0 ? 0.35 : 1 }}>
                {volSaving ? 'Saving…' : pendingVolAdds.size > 0 ? `💌 Save & Notify ${pendingVolAdds.size}` : '💌 Save & Notify'}
              </GlassButton>
            </div>
            <div className="p-4 space-y-3">
              <input value={volSearch} onChange={e => setVolSearch(e.target.value)}
                placeholder="Search by name or department…"
                className="glass-input w-full text-sm" style={{ borderRadius:'10px' }} />
              {filteredNotInAct.length === 0 ? (
                <p className={`text-center py-6 font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
                  {volSearch ? 'No members match your search.' : 'All members are already in this activity.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto no-scrollbar pr-1">
                  {filteredNotInAct.map(m => {
                    const selected = pendingVolAdds.has(m._id)
                    return (
                      <button key={m._id} onClick={() => toggleVolPending(m._id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200 border ${
                          selected
                            ? 'border-red-600/60 bg-red-900/20 shadow-[0_0_12px_rgba(220,38,38,0.15)]'
                            : `${L?'border-black/8 hover:border-black/20':'border-white/8 hover:border-white/20'} auth-glass`
                        }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? 'bg-red-600 border-red-600' : 'border-white/25'}`}>
                          {selected && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-white/10 shrink-0">
                          {m.profilePhoto ? <img src={m.profilePhoto} alt="" className="w-full h-full object-cover rounded-full" /> : <span className="font-clash text-xs font-bold text-white">{m.name[0]}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-inter text-xs font-medium ${L?'text-gray-800':'text-gray-200'} truncate`}>{m.name}</p>
                          <p className="font-inter text-[10px] text-gray-500 truncate">{m.department} · {m.role}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {pendingVolAdds.size > 0 && (
                <div className={`flex items-center justify-between pt-2 border-t ${L?'border-black/5':'border-white/5'}`}>
                  <p className="font-inter text-xs text-gray-500">
                    <span className="text-white font-semibold">{pendingVolAdds.size}</span> member{pendingVolAdds.size>1?'s':''} selected
                  </p>
                  <button onClick={() => setPendingVolAdds(new Set())} className="font-inter text-[11px] text-gray-600 hover:text-white transition-colors">Clear</button>
                </div>
              )}
            </div>
          </div>

          {volMsg && <p className={`font-inter text-sm ${volMsg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{volMsg}</p>}

          <ConfirmDialog
            open={!!removeVolConfirm}
            title="Remove Volunteer?"
            message="This person will be removed from the activity volunteers list."
            confirmLabel="Yes, Remove"
            onConfirm={removeVol}
            onCancel={() => setRemoveVolConfirm(null)}
          />
          <ConfirmDialog
            open={!!roleVolConfirm}
            title={roleVolConfirm?.verb === 'promote' ? 'Promote to Coordinator?' : 'Demote to Volunteer?'}
            message={roleVolConfirm ? `${roleVolConfirm.name} will be ${roleVolConfirm.verb === 'promote' ? 'promoted' : 'demoted'} from ${roleVolConfirm.from} → ${roleVolConfirm.to}. They will receive a notification email.` : ''}
            confirmLabel={roleVolConfirm?.verb === 'promote' ? 'Yes, Promote' : 'Yes, Demote'}
            onConfirm={async () => {
              if (!roleVolConfirm) return
              await setVolRole(roleVolConfirm.uid, roleVolConfirm.to)
              setRoleVolConfirm(null)
            }}
            onCancel={() => setRoleVolConfirm(null)}
          />
        </div>
      )}

      {/* ANNOUNCEMENTS TAB */}
      {tab === 'announcements' && (
        <div className="tab-panel-sub">
          <ContextAnnouncementStudio
            contextType="activity"
            contextId={act._id}
            canAnnounce={true}
            isPrivileged={true}
            coordCanAnnounce={act.coordCanAnnounce}
            onCoordToggle={async val => {
              await activitiesApi.setCoordPerms(act._id, { coordCanAnnounce: val }).catch(() => {})
              setAct(a => ({ ...a, coordCanAnnounce: val }))
            }}
            L={L}
          />
        </div>
      )}
      <DownloadingOverlay visible={mgrDlBusy} message={mgrDlMsg} />
      <ConfirmDialog
        open={!!actGalleryDeleteConfirm}
        title="Delete Photo?"
        message="This photo will be permanently deleted and cannot be recovered."
        confirmLabel="Yes, Delete"
        onConfirm={async () => { await activitiesApi.deleteGalleryPhoto(act._id, actGalleryDeleteConfirm).catch(()=>{}); setActGalleryDeleteConfirm(null); refresh() }}
        onCancel={() => setActGalleryDeleteConfirm(null)}
      />
      <ConfirmDialog
        open={backConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them and leave, or go back to save?"
        confirmLabel="Discard Changes"
        cancelLabel="Save Changes"
        onConfirm={onBack}
        onCancel={() => setBackConfirm(false)}
      />
      <RouteBlockDialog blocker={routeBlocker} L={L} />
    </div>
  )
}

const TABS = [
  { id:'users',         label:'Users'        },
  { id:'themes',        label:'Themes'       },
  { id:'postcards',     label:'Postcards'    },
  { id:'gallery',       label:'Club Gallery' },
  { id:'events',        label:'Events'       },
  { id:'competitions',  label:'Competitions' },
  { id:'activities',    label:'Activities'   },
  { id:'magazines',     label:'Magazines'    },
  { id:'core',          label:'Core'         },
  { id:'announce',      label:'Announce'     },
  { id:'socials',       label:'Socials'      },
  { id:'permissions',   label:'Permissions'  },
  { id:'profile',       label:'My Profile'   },
]

// ── ADMIN PROFILE TAB ─────────────────────────────────────────────────────────
function AdminProfileTab({ L }) {
  const { user, setUser }   = useAuth()
  const { toast }           = useToast()
  const [bio,    setBio]    = useState(user?.bio || '')
  const [insta,  setInsta]  = useState(user?.instagramHandle || '')
  const [photo,  setPhoto]  = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState('')

  if (!user) return null

  const save = async (e) => {
    e.preventDefault(); setMsg(''); setSaving(true)
    try {
      const body = { bio, instagramHandle: insta }
      if (photo) { body.profilePhoto = photo.publicUrl; body.profilePhotoS3Key = photo.key }
      const { user: updated } = await membersApi.updateMe(body)
      setUser(updated); toast.success('Saved', 'Profile updated')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  const initials = user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="max-w-xl space-y-5">
      {/* Profile card */}
      <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
        <div className="p-6 flex items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 ${L?'border-black/12':'border-white/15'} bg-gray-800 flex items-center justify-center shrink-0`}>
            {(photo?.publicUrl || user.profilePhoto)
              ? <img src={photo?.publicUrl || user.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="font-clash text-2xl font-black text-white opacity-40">{initials}</span>}
          </div>
          <div>
            <p className={`font-clash text-xl font-bold ${L?'text-gray-900':'text-white'}`}>{user.name}</p>
            <p className="font-inter text-sm text-red-400">Admin</p>
            <p className="font-inter text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        {/* Photo */}
        <div className={`auth-glass rounded-2xl border p-5 ${L?'border-black/8':'border-white/8'}`}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Profile Photo</p>
          <ImageUpload folder="profiles" onUpload={r => setPhoto(r)} label="Upload new photo" currentUrl={photo?.publicUrl || user.profilePhoto} />
        </div>

        {/* Bio */}
        <div className={`auth-glass rounded-2xl border p-5 ${L?'border-black/8':'border-white/8'} space-y-4`}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">Bio & Links</p>
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">
              Bio <span className="normal-case font-normal">({bio.length}/500)</span>
            </label>
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0,500))} maxLength={500}
              rows={4} placeholder="Tell the club about yourself…"
              className="glass-input w-full resize-none" style={{ borderRadius:'12px' }} />
          </div>
          <div>
            <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Instagram Handle</label>
            <div className="flex items-center glass-input overflow-hidden" style={{ borderRadius:'12px', padding:'0' }}>
              <span className="px-4 font-inter text-sm text-gray-500 border-r border-white/10 py-3">@</span>
              <input value={insta} onChange={e => setInsta(e.target.value.replace('@',''))}
                placeholder="yourhandle" className="flex-1 bg-transparent border-0 outline-none py-3 px-4 font-inter text-sm text-white" />
            </div>
          </div>
        </div>

        {/* Account info (read-only) */}
        <div className={`auth-glass rounded-2xl border p-5 ${L?'border-black/8':'border-white/8'}`}>
          <p className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-3">Account Info (read-only)</p>
          <div className="space-y-2">
            {[['Email', user.email], ['Role', user.role], ['Status', user.status]].map(([k,v]) => (
              <div key={k} className={`flex justify-between py-2 border-b last:border-0 ${L?'border-black/5':'border-white/5'}`}>
                <span className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">{k}</span>
                <span className={`font-inter text-sm ${L?'text-gray-900':'text-white'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {msg && <p className={`font-inter text-sm ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}

        <GlassButton type="submit" variant="red" disabled={saving}
          className="w-full font-inter text-sm tracking-[0.06em] uppercase"
          style={{ borderRadius:'14px', minHeight:'52px' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </GlassButton>
      </form>
    </div>
  )
}

export default function AdminDashboard() {
  const { theme, toggleTheme } = useTheme()
  const { user }               = useAuth()
  const isCore = user?.role === 'core'
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawer]         = useState(false)
  const [leaveDialog,   setLeaveDialog]   = useState(false)
  const [pendingTabId,  setPendingTabId]  = useState(null)
  // Tab is URL-driven so it survives refresh. Validate against TABS to reject invalid values.
  const _defaultTab = isCore ? 'profile' : 'users'
  const _rawTab     = searchParams.get('tab')
  const activeTab   = (_rawTab && TABS.some(t => t.id === _rawTab)) ? _rawTab : _defaultTab
  const setActiveTab = (tabId) => {
    if (_adminDirty) { setPendingTabId(tabId); setLeaveDialog(true); return }
    setSearchParams({ tab: tabId }, { replace: true })
  }
  const L = theme === 'light'

  // Mobile-only compaction: shrink the root font while the admin panel is mounted so
  // every rem-based size (text, padding, gaps, radii) tightens into an app-like feel.
  // Scoped to <1024px via CSS media query — desktop is completely unaffected.
  useEffect(() => {
    document.documentElement.classList.add('dash-compact')
    return () => document.documentElement.classList.remove('dash-compact')
  }, [])

  const { data: _pendingData } = useData(() => adminApi.getPending(), 8000)
  const pendingCount = _pendingData?.users?.length || 0

  if (!user || !['admin','core'].includes(user.role)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${L ? 'bg-gray-50' : 'bg-[#050505]'}`}>
        <p className="font-inter text-gray-500">Access denied.</p>
      </div>
    )
  }

  // Core sees My Profile first; admin keeps the original order
  const visibleTabs = isCore
    ? [{ id:'profile', label:'My Profile' }, ...TABS.filter(t => t.id !== 'profile')]
    : TABS

  const activeLabel = visibleTabs.find(t => t.id === activeTab)?.label || ''

  // Primary tabs shown on mobile bottom bar (most used)
  const PRIMARY_TABS = isCore
    ? ['profile','events','gallery','announce','users']
    : ['users','events','gallery','announce','profile']
  const primaryTabs  = visibleTabs.filter(t => PRIMARY_TABS.includes(t.id))

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${L ? 'bg-[#e8ecf3]' : 'bg-[#060608]'}`}>

      {/* ── Glassmorphic backdrop when drawer open on mobile ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[200]"
          style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}
          onClick={() => setDrawer(false)} />
      )}

      {/* ── DESKTOP: Floating glassmorphic left sidebar ── */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-screen z-[201] w-64 flex-col transition-all duration-300
        ${drawerOpen ? 'translate-x-0' : 'translate-x-0'}`}
        style={{
          background: L ? 'rgba(238,241,247,0.97)' : 'rgba(8,8,10,0.82)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRight: L ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.07)',
          boxShadow: L
            ? '8px 0 24px rgba(163,177,200,0.30), inset -1px 0 0 rgba(255,255,255,0.60)'
            : '4px 0 32px rgba(0,0,0,0.4)',
        }}>

        {/* Logo + user */}
        <div className="p-5 shrink-0">
          <Link to="/" className="flex items-center gap-3 mb-5 group">
            <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-9 h-9 rounded-full"
              style={{ boxShadow:'0 0 0 2px rgba(220,38,38,0.4)' }} />
            <div>
              <p className={`font-inter text-xs font-black uppercase tracking-[0.14em] ${L?'text-gray-800':'text-white'}`}>IEM Photography</p>
              <p className="font-inter text-[9px] text-gray-500 uppercase tracking-widest">{user.role === 'admin' ? 'Admin Panel' : 'Core Panel'}</p>
            </div>
          </Link>

          {/* User card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl"
            style={{
              background: L ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.05)',
              border:     L ? '1px solid rgba(255,255,255,0.88)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow:  L ? '4px 4px 10px rgba(163,177,200,0.32), -2px -2px 6px rgba(255,255,255,0.80)' : undefined,
            }}>
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background:'#1a1a20', border:'2px solid rgba(220,38,38,0.4)' }}>
              {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="font-inter text-sm font-bold text-white">{user.name[0]}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-inter text-xs font-semibold truncate ${L?'text-gray-900':'text-white'}`}>{user.name}</p>
              <Badge style={ROLE_BADGE[user.role]||ROLE_BADGE.photographer}>{user.role}</Badge>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-3">
          {visibleTabs.map(t => {
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-inter text-xs font-medium transition-all duration-200 active:scale-[0.97] group neo-interactive"
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
                <span className="shrink-0" style={{ opacity: active ? 1 : 0.6 }}>{TAB_ICONS[t.id]}</span>
                <span className="truncate">{t.label}</span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  {t.id === 'users' && pendingCount > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-red-600 text-white font-inter text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {active && <div className="w-1.5 h-1.5 rounded-full" style={{background:'#dc2626',boxShadow:'0 0 6px rgba(220,38,38,0.8)'}} />}
                </div>
              </button>
            )
          })}
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
          <button onClick={()=>{clearToken();window.location.href='/'}}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-inter text-xs text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-all active:scale-95">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE: Bottom sheet drawer (all tabs) ── */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-[202] transition-all duration-350 ease-in-out ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '80vh' }}>
        <div className="rounded-t-3xl overflow-hidden flex flex-col"
          style={{
            background: L ? 'rgba(236,240,248,0.96)' : 'rgba(8,8,12,0.94)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: L ? '1px solid rgba(255,255,255,0.90)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: L
              ? '-12px -12px 30px rgba(255,255,255,0.80), 0 -8px 24px rgba(163,177,200,0.35), inset 0 1px 0 rgba(255,255,255,0.96)'
              : '0 -8px 40px rgba(0,0,0,0.4)',
            maxHeight: '80vh',
          }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: L?'rgba(174,185,210,0.55)':'rgba(255,255,255,0.2)' }} />
          </div>
          {/* User */}
          <div className="px-5 pb-3 shrink-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden" style={{ border:'2px solid rgba(220,38,38,0.4)' }}>
              {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-inter font-bold text-white" style={{background:'#1a1a20'}}>{user.name[0]}</div>}
            </div>
            <div>
              <p className={`font-inter text-sm font-bold ${L?'text-gray-900':'text-white'}`}>{user.name}</p>
              <p className="font-inter text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</p>
            </div>
            <button onClick={()=>setDrawer(false)} className="ml-auto text-gray-500 p-2">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* All tabs */}
          <div className="overflow-y-auto px-3 pb-6 space-y-1">
            {visibleTabs.map(t => {
              const active = activeTab === t.id
              return (
                <button key={t.id} onClick={()=>{setActiveTab(t.id);setDrawer(false)}}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm font-medium transition-all active:scale-[0.97] neo-interactive"
                  style={{
                    background: active
                      ? L ? 'rgba(255,242,242,0.88)' : 'rgba(220,38,38,0.12)'
                      : 'transparent',
                    color: active ? '#dc2626' : L?'#334155':'#d1d5db',
                    boxShadow: active
                      ? L ? '4px 4px 10px rgba(163,177,200,0.32), -2px -2px 6px rgba(255,255,255,0.78)'
                          : 'inset 2px 2px 5px rgba(0,0,0,0.15)'
                      : 'none',
                  }}>
                  <span className="shrink-0">{TAB_ICONS[t.id]}</span>
                  <span>{t.label}</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {t.id === 'users' && pendingCount > 0 && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-red-600 text-white font-inter text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                    {active && <div className="w-2 h-2 rounded-full" style={{background:'#dc2626'}} />}
                  </div>
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
              <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm text-gray-500">
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
                Back to Website
              </Link>
              <button onClick={()=>{clearToken();window.location.href='/'}}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-inter text-sm text-red-400">
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div id="admin-main" className="flex-1 min-w-0 lg:ml-64">

        {/* Mobile floating header */}
        <header className="lg:hidden sticky top-0 z-50 px-3 pt-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: L ? 'rgba(236,240,248,0.92)' : 'rgba(10,10,14,0.82)',
              backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
              border: L?'1px solid rgba(255,255,255,0.88)':'1px solid rgba(255,255,255,0.07)',
              boxShadow: L
                ? '8px 8px 20px rgba(163,177,200,0.38), -5px -5px 12px rgba(255,255,255,0.85), inset 0 1px 0 rgba(255,255,255,0.96)'
                : '0 4px 20px rgba(0,0,0,0.5)',
            }}>
            <div className="flex-1 min-w-0">
              <p className={`font-inter text-sm font-bold truncate ${L?'text-gray-900':'text-white'}`}>{activeLabel}</p>
              <p className="font-inter text-[9px] text-gray-500 uppercase tracking-wider">{isCore ? 'Core Panel' : 'Admin Panel'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0" style={{border:'1.5px solid rgba(220,38,38,0.4)'}}>
                {user.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-inter font-bold text-xs text-white" style={{background:'#1a1a20'}}>{user.name[0]}</div>}
              </div>
              {/* Theme toggle */}
              <button onClick={toggleTheme}
                className="flex items-center justify-center p-2 rounded-xl active:scale-90 transition-all"
                style={{background:L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.07)',boxShadow:L?'-1px -1px 3px rgba(255,255,255,0.8),2px 2px 4px rgba(0,0,0,0.07)':'-1px -1px 2px rgba(255,255,255,0.02),2px 2px 4px rgba(0,0,0,0.6)',color:L?'#6b7280':'#9ca3af'}}>
                {L
                  ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
              </button>
              {/* 3-dots trigger in header */}
              <button onClick={()=>setDrawer(true)}
                className="flex flex-col items-center justify-center gap-[3px] p-2 rounded-xl active:scale-90 transition-all"
                style={{background:L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.07)',boxShadow:L?'-1px -1px 3px rgba(255,255,255,0.8),2px 2px 4px rgba(0,0,0,0.07)':'-1px -1px 2px rgba(255,255,255,0.02),2px 2px 4px rgba(0,0,0,0.6)'}}>
                {[0,1,2].map(i=><div key={i} className="w-1 h-1 rounded-full" style={{background:L?'#6b7280':'#9ca3af'}}/>)}
              </button>
            </div>
          </div>
        </header>

        {/* Desktop page title */}
        <div id="admin-tab-title" className="hidden lg:flex items-center gap-4 px-8 pt-7 pb-3">
          <div className="w-1 h-7 rounded-full" style={{background:'#dc2626'}} />
          <p className={`font-inter text-4xl font-bold ${L?'text-gray-900':'text-white'}`}>{activeLabel}</p>
        </div>

        {/* Tab content */}
        <div className="px-3 sm:px-5 lg:px-8 py-4 pb-28 lg:pb-8">
          <div key={activeTab} className="tab-panel">
            {activeTab === 'users'        && <UsersTab            currentUserRole={user.role} L={L} />}
            {activeTab === 'postcards'    && <PostcardsTab         L={L} />}
            {activeTab === 'gallery'      && <GalleryTab           L={L} />}
            {activeTab === 'events'       && <EventsTab            currentUser={user} L={L} />}
            {activeTab === 'competitions' && <CompetitionsAdminTab currentUser={user} L={L} />}
            {activeTab === 'activities'  && <ActivitiesAdminTab  currentUser={user} L={L} />}
            {activeTab === 'magazines'   && <MagazinesAdminTab   currentUser={user} L={L} />}
            {activeTab === 'core'         && <CoreTab              L={L} />}
            {activeTab === 'announce'     && <AnnouncementStudio    L={L} isAdmin={true} />}
            {activeTab === 'socials'      && <SocialsTab           L={L} />}
            {activeTab === 'themes'       && <HeroThemesTab        L={L} />}
            {activeTab === 'permissions'  && <PermissionsTab       L={L} />}
            {activeTab === 'profile'      && (isCore ? <MemberProfileTab user={user} L={L} /> : <AdminProfileTab L={L} />)}
          </div>
        </div>
      </div>

      {/* ── Back to Website — single button: bottom-right mobile, top-right desktop ── */}
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

      <ConfirmDialog
        open={leaveDialog}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them and leave, or go back to save?"
        confirmLabel="Discard Changes"
        cancelLabel="Save Changes"
        onConfirm={() => {
          _adminDirty = false
          setLeaveDialog(false)
          setSearchParams({ tab: pendingTabId }, { replace: true })
          setPendingTabId(null)
        }}
        onCancel={() => { setLeaveDialog(false); setPendingTabId(null) }}
      />
    </div>
  )
}