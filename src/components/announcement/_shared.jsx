import { useState } from 'react'
import DOMPurify from 'dompurify'
import { Ic } from './_icons.jsx'
import { fmt, fmtShort } from './_tokens.js'

// ── Shared modal components ───────────────────────────────────────────────────

function Checkmark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <polyline points="1.8,5.2 4,7.6 8.2,2.4" stroke="white" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PreviewRecipientsModal({ recipients, onConfirm, onClose, L }) {
  const [checked, setChecked] = useState(() => new Set(recipients.map(r => r.email)))

  const toggle = email => setChecked(s => {
    const n = new Set(s)
    if (n.has(email)) n.delete(email); else n.add(email)
    return n
  })

  const allSelected = checked.size === recipients.length
  const toggleAll = () => setChecked(allSelected ? new Set() : new Set(recipients.map(r => r.email)))
  const excluded = recipients.length - checked.size

  const modalBg = L ? 'rgba(252,250,250,0.92)' : 'rgba(10,4,4,0.94)'
  const modalShadow = L
    ? '0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)'
    : '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(220,38,38,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 flex flex-col w-full max-w-md sm:max-w-lg max-h-[88vh] rounded-3xl overflow-hidden"
        style={{ background: modalBg, boxShadow: modalShadow }}>

        {/* Accent bar */}
        <div className="h-[2px] w-full shrink-0"
          style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(220,38,38,0.7) 30%,rgba(248,113,113,0.9) 50%,rgba(220,38,38,0.7) 70%,transparent 100%)' }} />

        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.32)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.12),0 2px 8px rgba(220,38,38,0.12)' }}>
                <Ic.Users width={16} height={16} className="text-red-400" />
              </div>
              <div className="min-w-0">
                <p className={`font-inter font-bold text-[15px] leading-tight ${L ? 'text-gray-900' : 'text-white'}`}>
                  Preview Recipients
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full font-inter text-[11px] font-bold"
                    style={{ background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.35)', color:'#f87171' }}>
                    {recipients.length} total
                  </span>
                  <span className={`font-inter text-[11px] ${L ? 'text-gray-400' : 'text-gray-500'}`}>
                    {checked.size} selected
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-[0.94] mt-0.5 ${
                L ? 'bg-black/6 hover:bg-black/12 text-gray-500' : 'bg-white/8 hover:bg-white/14 text-gray-400'
              }`}
              style={{ border:`1px solid ${L?'rgba(0,0,0,0.09)':'rgba(255,255,255,0.09)'}` }}>
              <Ic.X width={13} height={13} />
            </button>
          </div>

          {/* Select-all row */}
          <div className="mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl"
            style={{ background: L?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)', border:`1px solid ${L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)'}`, boxShadow:'inset 0 2px 4px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: excluded>0?'#f59e0b':'#34d399', boxShadow: excluded>0?'0 0 6px rgba(245,158,11,0.5)':'0 0 6px rgba(52,211,153,0.5)' }} />
              <span className={`font-inter text-[12px] font-medium ${L?'text-gray-600':'text-gray-400'}`}>
                {excluded > 0 ? excluded + ' excluded' : 'All recipients included'}
              </span>
            </div>
            <button onClick={toggleAll}
              className="flex items-center gap-1.5 font-inter text-[12px] font-semibold px-3 py-1 rounded-lg transition-all active:scale-[0.95]"
              style={allSelected
                ? { background:'rgba(220,38,38,0.14)', border:'1px solid rgba(220,38,38,0.32)', color:'#fca5a5' }
                : { background:L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.07)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'}`, color:L?'#6b7280':'#9ca3af' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 shrink-0" style={{ height:'1px', background:L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)' }} />

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(220,38,38,0.3) transparent' }}>
          {recipients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background:'rgba(220,38,38,0.09)', border:'1px solid rgba(220,38,38,0.18)' }}>
                <Ic.Users width={16} height={16} className="text-red-400 opacity-50" />
              </div>
              <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-500'}`}>No recipients.</p>
            </div>
          )}
          {recipients.map((r, i) => {
            const isChecked = checked.has(r.email)
            const initials  = (r.name||'?').split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()
            return (
              <label key={r.email || i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 mb-0.5 ${
                  isChecked ? '' : 'opacity-35'
                } ${L?'hover:bg-black/5':'hover:bg-white/5'}`}>
                <div className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150"
                  onClick={e => { e.preventDefault(); toggle(r.email) }}
                  style={isChecked
                    ? { background:'rgba(220,38,38,0.88)', border:'1.5px solid rgba(220,38,38,1)', boxShadow:'0 2px 8px rgba(220,38,38,0.4),inset 0 1px 0 rgba(255,255,255,0.15)' }
                    : { background:'transparent', border:`1.5px solid ${L?'rgba(0,0,0,0.22)':'rgba(255,255,255,0.22)'}` }
                  }>
                  {isChecked && <Checkmark />}
                </div>
                <input type="checkbox" checked={isChecked} onChange={() => toggle(r.email)} className="hidden" />
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-inter font-bold text-white"
                  style={{ background:'linear-gradient(135deg,#dc2626 0%,#7f1d1d 100%)', fontSize:'11px', boxShadow:'0 2px 8px rgba(220,38,38,0.25)' }}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-inter text-[13px] font-semibold truncate ${L?'text-gray-800':'text-white'}`}>{r.name}</p>
                  {r.email && r.email !== r.name && (
                    <p className="font-inter text-[11px] text-gray-500 truncate">{r.email}</p>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer divider */}
        <div className="mx-5 shrink-0" style={{ height:'1px', background:L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)' }} />

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <p className={`font-inter text-[12px] ${L?'text-gray-500':'text-gray-400'}`}>
            <span className={`font-bold ${L?'text-gray-800':'text-white'}`}>{checked.size}</span>
            {' recipient' + (checked.size !== 1 ? 's' : '') + ' will receive this'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className={`px-4 py-2.5 rounded-xl font-inter text-xs font-semibold transition-all active:scale-[0.96] ${
                L ? 'bg-black/6 text-gray-600 hover:bg-black/10 border border-black/10'
                  : 'bg-white/6 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}>
              Cancel
            </button>
            <button onClick={() => onConfirm(checked)} disabled={checked.size === 0}
              className="px-5 py-2.5 rounded-xl font-inter text-xs font-bold text-white disabled:opacity-40 active:scale-[0.97] transition-all"
              style={{
                background: 'linear-gradient(135deg,rgba(220,38,38,0.92) 0%,rgba(185,28,28,0.88) 100%)',
                border: '1px solid rgba(220,38,38,0.55)',
                boxShadow: checked.size > 0 ? '0 4px 18px rgba(220,38,38,0.35),inset 0 1px 0 rgba(255,255,255,0.14)' : 'none',
              }}>
              {'Confirm (' + checked.size + ')'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Avatar({ name='?', photo, size=28 }) {
  const safe = (name || '?').trim() || '?'
  const ini = safe.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  return photo
    ? <img src={photo} alt={name} className="rounded-full object-cover shrink-0" style={{width:size,height:size}} />
    : <div className="rounded-full flex items-center justify-center shrink-0 font-inter font-bold text-white"
        style={{width:size,height:size,background:'linear-gradient(135deg,#dc2626,#7f1d1d)',fontSize:size*0.38}}>
        {ini}
      </div>
}

export function SectionLabel({ icon: Icon, title, subtitle, L }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 border-b ${L?'border-black/8':'border-white/8'}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)'}}>
        <Icon width={16} height={16} className="text-red-400" />
      </div>
      <div className="min-w-0">
        <p className={`font-inter font-semibold text-sm ${L?'text-gray-900':'text-white'}`}>{title}</p>
        {subtitle && <p className={`font-inter text-[11px] mt-0.5 ${L?'text-gray-500':'text-gray-400'}`}>{subtitle}</p>}
      </div>
    </div>
  )
}

export function PaneTabs({ tabs, active, onChange, L }) {
  return (
    <div className="flex gap-1.5">
      {tabs.map(t => {
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl font-inter text-[12px] font-semibold border transition-all duration-200 active:scale-[0.97] min-w-0 ${
              isActive
                ? 'bg-red-600/20 text-red-400 border-red-600/40'
                : L ? 'bg-black/5 text-gray-500 border-black/10 hover:border-black/20' : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
            }`}>
            {t.icon && <t.icon width={12} height={12} className="shrink-0" />}
            <span className="truncate">{t.label}</span>
            {t.badge > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white"
                style={{background:'rgba(220,38,38,0.85)'}}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function AttachmentPill({ att, onRemove, L }) {
  const isImg = att.mime?.includes('image')
  const isPdf = att.mime?.includes('pdf')
  const size  = att.size < 1024*1024 ? `${(att.size/1024).toFixed(0)} KB` : `${(att.size/1024/1024).toFixed(1)} MB`
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-inter text-[12px]"
      style={{background: L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'}`}}>
      {isImg ? <Ic.Eye width={12} height={12} className="text-red-400 shrink-0" />
             : isPdf ? <Ic.Draft width={12} height={12} className="text-red-400 shrink-0" />
             : <Ic.Attach width={12} height={12} className="text-gray-400 shrink-0" />}
      <a href={att.url} target="_blank" rel="noreferrer"
        className="max-w-[120px] truncate text-red-400 hover:text-red-300 transition-colors">{att.name}</a>
      <span className="text-gray-400">{size}</span>
      {onRemove && (
        <button onClick={onRemove} className={`transition-colors ${L?'text-gray-400 hover:text-red-500':'text-gray-600 hover:text-red-400'}`}>
          <Ic.X width={10} height={10} />
        </button>
      )}
    </div>
  )
}

const PRESET_LABELS = { all:'All Members', cores:'All Core', coordinators:'Coordinators', custom:'Custom list', stream:'By Stream', year:'By Year', role:'By Role' }

function sentToLabel(a) {
  if (a.kind === 'compose') {
    const recipients = a.toRecipients || []
    if (!recipients.length) return null
    const names = recipients.map(r => r.name && r.name !== r.email ? r.name.split(' ')[0] : r.email)
    return names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) + ' more' : '')
  }
  let label = PRESET_LABELS[a.recipientPreset] || a.recipientPreset
  if (a.recipientPreset === 'stream' && a.filters?.stream) label = 'Stream: ' + a.filters.stream
  if (a.recipientPreset === 'year'   && a.filters?.year)   label = 'Year ' + a.filters.year
  return label
}

export function SentItem({ a, L, onReuse, onDelete }) {
  const [open, setOpen] = useState(false)
  const toLabel = sentToLabel(a)
  return (
    <div className={`auth-glass rounded-2xl border overflow-hidden transition-all duration-200 ${L?'border-black/8':'border-white/8'}`}>
      <div className="flex items-start gap-3 px-4 py-3.5 cursor-pointer select-none" onClick={() => setOpen(o=>!o)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{background:'rgba(220,38,38,0.14)',border:'1px solid rgba(220,38,38,0.25)'}}>
          {a.kind==='compose'
            ? <Ic.Mail width={14} height={14} className="text-red-400" />
            : <Ic.Broadcast width={14} height={14} className="text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-inter font-semibold text-[14px] truncate ${L?'text-gray-900':'text-white'}`}>{a.subject}</p>
          {/* Recipient line — always visible */}
          {toLabel && (
            <div className="flex items-center gap-1.5 mt-1">
              <Ic.Users width={10} height={10} className="text-red-400 shrink-0" />
              <p className="font-inter text-[11px] text-red-400 font-medium truncate">{toLabel}</p>
            </div>
          )}
          <p className={`font-inter text-[12px] mt-0.5 line-clamp-1 ${L?'text-gray-500':'text-gray-400'}`}>{a.preview}</p>
        </div>

        <div className="shrink-0 text-right ml-2">
          <p className="font-inter text-[12px] font-bold text-red-400">{a.recipientCount} sent</p>
          <p className={`font-inter text-[10px] mt-0.5 ${L?'text-gray-400':'text-gray-500'}`}>{fmtShort(a.createdAt)}</p>
        </div>
        <Ic.ChevDown width={14} height={14}
          className={`shrink-0 text-gray-500 transition-transform duration-200 mt-1 ${open?'rotate-180':''}`} />
      </div>

      {open && (
        <div className={`px-4 pb-4 border-t ${L?'border-black/8':'border-white/8'}`}>
          <div className={`mt-3 rounded-xl px-4 py-3 font-inter text-[13px] leading-relaxed ${L?'text-gray-700':'text-gray-300'}`}
            style={{background: L?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)', border:`1px solid ${L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.06)'}`}}
            dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(a.content)}} />
          {a.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {a.attachments.map((att,i) => <AttachmentPill key={i} att={att} L={L} />)}
            </div>
          )}
          {/* Full recipient list */}
          {(() => {
            const list = a.kind === 'compose'
              ? (a.toRecipients || [])
              : (a.resolvedRecipients?.length ? a.resolvedRecipients : a.customRecipients || [])
            if (!list.length) return null
            return (
              <div className="mt-3">
                <p className={`font-inter text-[11px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5 ${L?'text-gray-400':'text-gray-500'}`}>
                  <Ic.Users width={10} height={10} /> Recipients ({list.length})
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1" style={{scrollbarWidth:'thin'}}>
                  {list.map((r, i) => (
                    <span key={i}
                      className="inline-flex items-center gap-1 font-inter text-[11px] px-2.5 py-1 rounded-full"
                      style={{background:'rgba(220,38,38,0.12)',border:'1px solid rgba(220,38,38,0.25)',color:'#f87171'}}>
                      <span className="font-semibold">{r.name && r.name !== r.email ? r.name : ''}</span>
                      {r.name && r.name !== r.email && <span className="opacity-60">·</span>}
                      <span className="opacity-80">{r.email}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Footer row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className={`font-inter text-[11px] ${L?'text-gray-400':'text-gray-500'}`}>{fmt(a.createdAt)}</span>
            <button onClick={() => onReuse(a)}
              className="ml-auto flex items-center gap-1.5 font-inter text-[12px] px-3 py-1.5 rounded-lg transition-all active:scale-[0.96]"
              style={{background:'rgba(220,38,38,0.14)',border:'1px solid rgba(220,38,38,0.3)',color:'#f87171'}}>
              <Ic.Reuse width={11} height={11} />
              Reuse
            </button>
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(a._id) }}
                className={`flex items-center gap-1.5 font-inter text-[12px] px-3 py-1.5 rounded-lg transition-all active:scale-[0.96] ${L?'text-gray-400 hover:text-red-500':'text-gray-500 hover:text-red-400'}`}
                title="Move to bin">
                <Ic.Trash width={11} height={11} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DraftItem({ d, onEdit, onDelete, L }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 auth-glass rounded-2xl border ${L?'border-black/8':'border-white/8'}`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.25)'}}>
        <Ic.Draft width={14} height={14} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-inter font-semibold text-[14px] truncate ${L?'text-gray-900':'text-white'}`}>{d.subject}</p>
        <p className={`font-inter text-[11px] mt-0.5 ${L?'text-gray-400':'text-gray-500'}`}>{fmtShort(d.updatedAt)}</p>
      </div>
      <button onClick={() => onEdit(d)}
        className="flex items-center gap-1.5 font-inter text-[12px] px-3 py-1.5 rounded-lg shrink-0 transition-all active:scale-[0.96]"
        style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.24)',color:'#f87171'}}>
        <Ic.Draft width={11} height={11} />
        Edit
      </button>
      <button onClick={() => onDelete(d._id)}
        className={`transition-colors shrink-0 ${L?'text-gray-400 hover:text-red-500':'text-gray-600 hover:text-red-400'}`}>
        <Ic.Trash width={14} height={14} />
      </button>
    </div>
  )
}

export function Empty({ Icon, text, L }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 auth-glass rounded-2xl border ${L?'border-black/8':'border-white/8'}`}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{background:'rgba(220,38,38,0.09)',border:'1px solid rgba(220,38,38,0.18)'}}>
        <Icon width={20} height={20} className="text-red-500 opacity-60" />
      </div>
      <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-500'}`}>{text}</p>
    </div>
  )
}

export function MailSendOverlay({ phase, leaving, recipientCount, L }) {
  if (!phase) return null
  const sending = phase === 'sending'
  return (
    <div className={`absolute inset-0 z-[60] flex items-center justify-center rounded-2xl mail-overlay ${leaving ? 'is-leaving' : ''}`}
      style={{ background: L ? 'rgba(255,255,255,0.74)' : 'rgba(4,2,2,0.76)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full mail-ring" style={{border:'1.5px solid rgba(220,38,38,0.45)'}} />
          <span className="absolute inset-0 rounded-full mail-ring" style={{border:'1.5px solid rgba(220,38,38,0.45)', animationDelay:'.55s'}} />
          <div className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.34)', boxShadow:'0 6px 28px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
            {sending ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mail-plane-icon">
                <path d="M3 11.5 L21 4 L13.8 21 L11.2 13 Z" stroke="#f87171" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(248,113,113,0.12)" className="mail-plane-trail" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mail-check-pop">
                <polyline points="5 12.5 10 17.5 19 7" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mail-check-draw" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 mail-sent-text">
          <p className={`font-clash font-semibold text-[15px] tracking-wide ${L?'text-gray-800':'text-white'}`}>
            {sending ? 'Sending email' : 'Email sent'}
          </p>
          {sending ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full mail-dot" style={{background:'#f87171'}} />
              <span className="w-1.5 h-1.5 rounded-full mail-dot" style={{background:'#f87171'}} />
              <span className="w-1.5 h-1.5 rounded-full mail-dot" style={{background:'#f87171'}} />
            </div>
          ) : (
            <p className="font-inter text-[12px] text-gray-400">
              {recipientCount ? `Delivered to ${recipientCount} recipient${recipientCount!==1?'s':''}` : 'Delivered successfully'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function SendBtn({ onClick, busy, label }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center justify-center gap-2 px-6 py-3 font-inter text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 active:scale-[0.97] rounded-xl w-full sm:w-auto"
      style={{
        background: 'rgba(220,38,38,0.18)',
        border: '1px solid rgba(220,38,38,0.4)',
        boxShadow: busy ? 'none' : '0 2px 16px rgba(220,38,38,0.18)',
        minWidth: '160px',
      }}>
      <Ic.Send width={14} height={14} />
      {busy ? 'Sending…' : label}
    </button>
  )
}

export function SaveDraftBtn({ onClick, busy, L }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex items-center justify-center gap-2 px-5 py-3 font-inter text-sm font-medium transition-all duration-200 disabled:opacity-50 active:scale-[0.97] rounded-xl w-full sm:w-auto ${
        L ? 'bg-black/5 border border-black/10 text-gray-600' : 'bg-white/5 border border-white/10 text-gray-400'
      }`}>
      <Ic.Save width={14} height={14} />
      {busy ? 'Saving…' : 'Save Draft'}
    </button>
  )
}

export function RateLimitNotice({ L }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.22)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(234,179,8,0.16)', border: '1px solid rgba(234,179,8,0.32)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div className="min-w-0">
        <p className="font-inter text-[12px] font-semibold text-amber-400 mb-1">Sending limits apply</p>
        <p className={`font-inter text-[11px] leading-relaxed ${L ? 'text-gray-600' : 'text-gray-400'}`}>
          Our SMTP service supports up to{' '}
          <span className="font-semibold text-amber-400">500 emails per day</span>.
          {' '}Keep each broadcast to a maximum of{' '}
          <span className="font-semibold text-amber-300">200 recipients</span>{' '}
          and{' '}
          <span className="font-semibold text-amber-300">100 at a time</span>{' '}
          is ideal for reliable delivery. For large campaigns, spread sends across multiple days to stay within the daily cap.
        </p>
      </div>
    </div>
  )
}
