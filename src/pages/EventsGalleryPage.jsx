import { useState } from 'react'
import { Link }       from 'react-router-dom'
import PageLayout     from '../components/PageLayout.jsx'
import { useData }    from '../hooks/useData.js'
import { galleryApi, settingsApi } from '../api/api.js'
import { useTheme, useAuth }   from '../App.jsx'
import { isCurrentSession, getItemSession, getPrimaryItemDate } from '../utils/yearCalc.js'

// ── Glass neomorphic event card ──────────────────────────────────────────────
function EventCard({ ev, L, index, dim = false }) {
  const [hovered,  setHovered]  = useState(false)
  const [pressed,  setPressed]  = useState(false)
  const photoCount = ev.photos?.length || 0
  const banner     = ev.logoUrl || ev.coverUrl
  const dateStr    = ev.dates?.[0]
    ? new Date(ev.dates[0]).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    : null

  const STATUS_COLOR = {
    ongoing: { bg:'rgba(34,197,94,0.15)',  border:'rgba(34,197,94,0.3)',  text:'#86efac', dot:'#22c55e' },
    past:    { bg:'rgba(100,100,120,0.12)', border:'rgba(100,100,120,0.25)', text:'#9ca3af', dot:'#6b7280' },
  }
  const sc = STATUS_COLOR[ev.status] || STATUS_COLOR.past

  return (
    <Link to={`/events-gallery/${ev._id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setTimeout(() => setPressed(false), 200)}
      className="block relative overflow-hidden rounded-2xl"
      style={{
        background: L
          ? 'rgba(255,255,255,0.65)'
          : 'rgba(18,18,24,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${L ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: pressed
          ? L ? 'inset 2px 2px 8px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' : 'inset 2px 2px 10px rgba(0,0,0,0.8), 0 0 0 1px rgba(220,38,38,0.2)'
          : hovered
          ? L ? '-4px -4px 12px rgba(255,255,255,0.9), 5px 5px 16px rgba(0,0,0,0.14), 0 0 0 1.5px rgba(220,38,38,0.35), 0 0 24px 4px rgba(220,38,38,0.1)' : '-3px -3px 10px rgba(255,255,255,0.04), 6px 6px 20px rgba(0,0,0,0.97), 0 0 0 1px rgba(220,38,38,0.35), 0 0 30px 6px rgba(220,38,38,0.12)'
          : L ? '-2px -2px 7px rgba(255,255,255,0.85), 3px 3px 10px rgba(0,0,0,0.1)' : '-2px -2px 6px rgba(255,255,255,0.025), 4px 4px 14px rgba(0,0,0,0.88)',
        transform: pressed
          ? 'scale(0.975) translateY(2px)'
          : hovered ? 'translateY(-6px) scale(1.015)' : 'translateY(0) scale(1)',
        transition: pressed
          ? 'all 120ms cubic-bezier(0.4,0,1,1)'
          : 'all 420ms cubic-bezier(0.22,1,0.36,1)',
        animation: `quickZoom 500ms cubic-bezier(0.22,1,0.36,1) ${index * 65}ms both`,
        cursor: 'pointer',
        filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined,
      }}>

      {/* Shine sweep on hover */}
      {hovered && !pressed && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',
            animation:'glassShimmer 0.7s ease-out forwards',
          }} />
        </div>
      )}

      {/* Click ripple */}
      {pressed && (
        <div className="absolute inset-0 pointer-events-none z-10 rounded-2xl"
          style={{ background:'rgba(220,38,38,0.06)', transition:'opacity 200ms ease' }} />
      )}

      {/* Banner image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {banner ? (
          <img src={banner} alt={ev.name}
            className="w-full h-full object-cover"
            style={{
              transform: pressed ? 'scale(1.02)' : hovered ? 'scale(1.08)' : 'scale(1)',
              transition: pressed ? 'transform 120ms ease' : 'transform 520ms cubic-bezier(0.22,1,0.36,1)',
            }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#0c0c24 0%,#18183a 50%,#0c0c24 100%)' }}>
            <span className="font-inter text-7xl font-black text-white/[0.07] select-none">{ev.name?.[0]}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
          opacity: hovered ? 0.85 : 0.6,
          transition: 'opacity 420ms ease',
        }} />

        {/* Top-left status */}
        <div className="absolute top-3 left-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: sc.bg, border:`1px solid ${sc.border}`, backdropFilter:'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot, boxShadow:`0 0 5px ${sc.dot}` }} />
            <span className="font-inter text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: sc.text }}>
              {ev.status}
            </span>
          </div>
        </div>

        {/* Photo count — bottom right */}
        {photoCount > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span className="font-inter text-[9px] text-white/65 font-medium">{photoCount}</span>
          </div>
        )}

        {/* Hover CTA */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: hovered ? 1 : 0, transition:'opacity 300ms ease' }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background:'rgba(220,38,38,0.85)', backdropFilter:'blur(8px)', boxShadow:'0 4px 20px rgba(220,38,38,0.4)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="font-inter text-xs font-semibold text-white">View Gallery</span>
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="px-4 py-3.5">
        <p className={`font-inter font-bold text-[15px] leading-tight truncate mb-1 ${L?'text-gray-900':'text-white'}`}>
          {ev.name}
        </p>
        <div className="flex items-center justify-between">
          {dateStr && (
            <div className="flex items-center gap-1.5">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={L?'#9ca3af':'#6b7280'} strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p className={`font-inter text-[10px] ${L?'text-gray-500':'text-gray-500'}`}>{dateStr}</p>
            </div>
          )}
          {!photoCount && (
            <p className="font-inter text-[9px] text-gray-600 italic">No photos yet</p>
          )}
        </div>
      </div>

      {/* Bottom edge accent line */}
      <div className="absolute bottom-0 left-4 right-4 h-px rounded-full"
        style={{
          background: hovered
            ? 'linear-gradient(90deg,transparent,rgba(220,38,38,0.6),transparent)'
            : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)',
          transition:'background 400ms ease',
        }} />
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const EG_SUBTITLE_DEFAULT = 'Explore moments captured at every event — through the lens of our photographers.'

export default function EventsGalleryPage() {
  const { theme } = useTheme()
  const { user }  = useAuth()
  const L = theme === 'light'
  const [search,       setSearch]       = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [pastOpen,     setPastOpen]     = useState(false)

  const { data, loading }      = useData(() => galleryApi.getEventCinema(), 5000)
  const { data: sectData }     = useData(() => settingsApi.getSections(), 5000)
  const { data: contentData }  = useData(() => settingsApi.getContent(), 30000)
  const isAdminOrCore = user && ['admin','core'].includes(user.role)

  const content = contentData?.content || {}
  const [subtitleLocal,   setSubtitleLocal]   = useState(null)
  const [subtitleEditing, setSubtitleEditing] = useState(false)
  const [subtitleDraft,   setSubtitleDraft]   = useState('')
  const [subtitleSaving,  setSubtitleSaving]  = useState(false)

  const resolvedSubtitle = subtitleLocal ?? content['subtitle-event-gallery'] ?? EG_SUBTITLE_DEFAULT

  const saveSubtitle = async () => {
    setSubtitleSaving(true)
    try {
      await settingsApi.patch('subtitle-event-gallery', subtitleDraft)
      setSubtitleLocal(subtitleDraft)
      setSubtitleEditing(false)
    } catch {} finally { setSubtitleSaving(false) }
  }
  const showPast = isAdminOrCore || (sectData?.sections?.['show-past-events'] !== false)

  const allEvents    = data?.events || []
  const currentItems = allEvents.filter(ev => isCurrentSession(ev))
  const pastItems    = allEvents.filter(ev => !isCurrentSession(ev))

  const pastBySession = pastItems.reduce((acc, ev) => {
    const s = getItemSession(getPrimaryItemDate(ev)) || 'Older'
    ;(acc[s] = acc[s] || []).push(ev)
    return acc
  }, {})
  const pastSessions = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))

  const filtered = currentItems.filter(ev => {
    const matchSearch = !search.trim() || ev.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = activeStatus === 'all' || ev.status === activeStatus
    return matchSearch && matchStatus
  })

  const statuses = ['all', ...new Set(currentItems.map(e => e.status).filter(Boolean))]

  return (
    <PageLayout title="Events Gallery" subtitle={resolvedSubtitle}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-16">

        {/* Subtitle edit controls — admin/core only */}
        {isAdminOrCore && !subtitleEditing && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => { setSubtitleDraft(resolvedSubtitle); setSubtitleEditing(true) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs border transition-all ${L?'text-gray-500 border-black/10 hover:text-gray-800':'text-gray-500 border-white/10 hover:text-white'}`}
            >
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit subtitle
            </button>
          </div>
        )}
        {isAdminOrCore && subtitleEditing && (
          <div className="max-w-xl mx-auto mb-6 space-y-2 p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
            <p className={`font-inter text-[10px] uppercase tracking-widest mb-1 ${L?'text-gray-400':'text-gray-500'}`}>Edit subtitle</p>
            <textarea
              rows={2}
              value={subtitleDraft}
              onChange={e => setSubtitleDraft(e.target.value)}
              className="glass-input w-full text-sm resize-none"
              style={{ borderRadius:'10px' }}
            />
            <div className="flex gap-2">
              <button onClick={saveSubtitle} disabled={subtitleSaving}
                className="flex-1 py-2 rounded-xl font-inter text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60">
                {subtitleSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setSubtitleEditing(false)}
                className={`px-4 py-2 rounded-xl font-inter text-sm border transition-colors ${L?'text-gray-600 border-black/10':'text-gray-400 border-white/10'}`}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search + Filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${L?'text-gray-400':'text-gray-600'} pointer-events-none`}
              width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full pl-10 pr-4 py-2.5 font-inter text-sm outline-none transition-all"
              style={{
                borderRadius: 14,
                background: L ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,28,0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: L ? 'inset 2px 2px 5px rgba(0,0,0,0.05), inset -1px -1px 3px rgba(255,255,255,0.7)' : 'inset 2px 2px 6px rgba(0,0,0,0.8), inset -1px -1px 3px rgba(255,255,255,0.02)',
                color: L ? '#111' : '#e5e7eb',
              }} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {statuses.map(s => {
              const active = activeStatus === s
              return (
                <button key={s} onClick={() => setActiveStatus(s)}
                  className="font-inter text-[10px] uppercase tracking-[0.14em] font-semibold px-3 py-2 rounded-xl transition-all capitalize"
                  style={{
                    background: active ? '#dc2626' : L ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,28,0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: active ? '1px solid rgba(220,38,38,0.5)' : `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: active ? '0 0 14px rgba(220,38,38,0.25)' : L ? 'inset 1px 1px 3px rgba(0,0,0,0.06), inset -1px -1px 2px rgba(255,255,255,0.7)' : 'inset 1px 1px 4px rgba(0,0,0,0.7), inset -1px -1px 2px rgba(255,255,255,0.02)',
                    color: active ? '#fff' : L ? '#6b7280' : '#6b7280',
                    transform: active ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 250ms cubic-bezier(0.22,1,0.36,1)',
                  }}>
                  {s === 'all' ? 'All' : s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Event count */}
        {!loading && currentItems.length > 0 && (
          <p className={`font-inter text-[10px] uppercase tracking-[0.18em] mb-5 ${L?'text-gray-400':'text-gray-600'}`}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            {activeStatus !== 'all' ? ` · ${activeStatus}` : ''}
          </p>
        )}

        {/* Current session grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
                style={{ aspectRatio:'16/9', background: L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.03)' }}>
                <div style={{ paddingBottom:'62.5%' }} />
                <div className={`h-14 ${L?'bg-black/3':'bg-white/2'}`} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && !search && activeStatus === 'all' && pastSessions.length === 0 ? (
          <div className="py-24 text-center rounded-3xl"
            style={{
              background: L ? 'rgba(255,255,255,0.5)' : 'rgba(15,15,20,0.6)',
              backdropFilter:'blur(12px)',
              border:`1px solid ${L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}`,
            }}>
            <p className="text-4xl mb-4">📷</p>
            <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>No event galleries available yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center rounded-3xl"
            style={{
              background: L ? 'rgba(255,255,255,0.5)' : 'rgba(15,15,20,0.6)',
              backdropFilter:'blur(12px)',
              border:`1px solid ${L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}`,
            }}>
            <p className="text-3xl mb-3">📷</p>
            <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>
              {search ? `No events match "${search}"` : `No ${activeStatus} events with gallery photos`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map((ev, i) => <EventCard key={ev._id} ev={ev} L={L} index={i} />)}
          </div>
        )}

        {/* Past sessions — collapsed, respects showPast toggle */}
        {!loading && activeStatus === 'all' && !search && pastSessions.length > 0 && showPast && (
          <div className={`mt-12 pt-8 border-t ${L ? 'border-black/8' : 'border-white/8'}`}>
            <PastSessionsToggle
              open={pastOpen}
              onToggle={() => setPastOpen(v => !v)}
              count={pastItems.length}
              sessionCount={pastSessions.length}
              label="event"
              L={L}
            />

            {pastOpen && (
              <div className="mt-6 space-y-10">
                {pastSessions.map(session => (
                  <div key={session} className="space-y-4">
                    <SessionDivider session={session} count={pastBySession[session].length} L={L} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
                      {pastBySession[session].map((ev, i) => (
                        <EventCard key={ev._id} ev={ev} L={L} index={i} dim />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function SessionDivider({ session, count, L }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
      <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
        {session} · {count} event{count !== 1 ? 's' : ''}
      </span>
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
    </div>
  )
}

function PastSessionsToggle({ open, onToggle, count, sessionCount, label, L }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border-2 transition-all duration-200 ${
        open
          ? 'border-red-800/40 bg-red-950/10'
          : L
            ? 'border-black/10 bg-black/[0.03] hover:border-black/18 hover:bg-black/[0.05]'
            : 'border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]'
      }`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`font-inter font-bold text-base ${L ? 'text-gray-700' : 'text-gray-200'}`}>
          Past Sessions
        </span>
        <span className={`font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-500'}`}>
          · {count} {label}{count !== 1 ? 's' : ''} across {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
        open
          ? 'bg-red-700 text-white shadow-[0_0_12px_rgba(220,38,38,0.4)]'
          : L ? 'bg-black/8 text-gray-500' : 'bg-white/10 text-gray-400'
      }`}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}
          className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </button>
  )
}
