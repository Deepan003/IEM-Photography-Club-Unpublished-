import { useState }     from 'react'
import { Link }         from 'react-router-dom'
import PageLayout       from '../components/PageLayout.jsx'
import GlassButton      from '../components/GlassButton.jsx'
import { eventsApi, settingsApi } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import { useData }      from '../hooks/useData.js'
import { isCurrentSession, getItemSession, getPrimaryItemDate, currentSession } from '../utils/yearCalc.js'
import ProgressiveImage from '../components/ProgressiveImage.jsx'
import { SkeletonCardGrid } from '../components/Skeleton.jsx'

const STATUS_COLOR = {
  upcoming: { text:'text-yellow-400', bg:'bg-yellow-900/25 border-yellow-700/40' },
  ongoing:  { text:'text-emerald-400', bg:'bg-emerald-900/25 border-emerald-700/40' },
  past:     { text:'text-gray-500',   bg:'bg-gray-800/30 border-gray-700/30' },
}

const ROLE_CFG = {
  coordinator: { text:'text-red-300',     bg:'bg-red-900/80 border-red-600/50',     label:'Coordinator' },
  core:        { text:'text-red-300',     bg:'bg-red-900/80 border-red-600/50',     label:'Core' },
  photographer:{ text:'text-emerald-300', bg:'bg-emerald-900/80 border-emerald-600/50', label:'Photographer' },
}

function EventCard({ event, userId, userRole, L, dim = false }) {
  const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const primaryDate = event.eventDate || event.startDate || (event.dates||[])[0]
  const dates  = primaryDate ? fmtD(primaryDate) : 'TBD'
  const sc     = STATUS_COLOR[event.status] || STATUS_COLOR.past
  const enrolled = userId && (event.memberIds || []).includes(userId)
  // Past session items are always accessible — the session ending unlocks them for all
  const canView  = enrolled || event.isOpenToAll || !isCurrentSession(event)
  const roleCfg  = userRole ? (ROLE_CFG[userRole] || { text:'text-emerald-300', bg:'bg-emerald-900/80 border-emerald-600/50', label: userRole }) : null

  const card = (
    <div className={`group relative rounded-2xl overflow-hidden border transition-all duration-400 hover:scale-[1.02] hover:-translate-y-1.5 cursor-pointer
      ${L ? 'border-black/8 bg-white' : 'border-white/8 bg-[#0d0d0d]'}
      ${enrolled ? 'shadow-[0_4px_24px_rgba(220,38,38,0.12)]' : ''}`}
      style={{
        boxShadow: enrolled ? '0 4px 24px rgba(220,38,38,0.1), 0 0 0 1px rgba(220,38,38,0.2)' : undefined,
        filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined,
        transition: 'filter 300ms',
      }}
      onMouseEnter={dim ? e => { e.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
      onMouseLeave={dim ? e => { e.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>

      {/* Banner */}
      <div className="relative overflow-hidden" style={{ height:'clamp(140px,18vw,200px)' }}>
        {event.logoUrl
          ? <ProgressiveImage src={event.logoUrl} alt={event.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
              <span className="font-clash text-6xl font-bold text-white opacity-15">{event.name.charAt(0)}</span>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {userId && (
          <div className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-inter text-[10px] font-bold uppercase tracking-wider border ${
            roleCfg ? roleCfg.bg : 'bg-black/50 text-gray-400 border-white/15'
          } ${roleCfg ? roleCfg.text : ''}`} style={{ backdropFilter:'blur(8px)' }}>
            {roleCfg ? (
              <><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>{roleCfg.label}</>
            ) : 'Not Enrolled'}
          </div>
        )}

        <div className={`absolute bottom-2.5 left-2.5 font-inter text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${sc.bg} ${sc.text}`}>
          {event.status}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className={`font-clash font-semibold text-base leading-tight mb-2 ${L ? 'text-gray-900' : 'text-white'}`}>
          {event.name}
        </h3>
        <div className="space-y-1">
          <p className={`font-inter text-xs flex items-center gap-1.5 ${L ? 'text-gray-500' : 'text-gray-500'}`}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {dates}
          </p>
          {event.venue && (
            <p className={`font-inter text-xs flex items-center gap-1.5 ${L ? 'text-gray-500' : 'text-gray-500'}`}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {event.venue}
            </p>
          )}
          {event.description && (
            <p className={`font-inter text-xs mt-2 line-clamp-2 ${L ? 'text-gray-600' : 'text-gray-400'}`}>
              {event.description}
            </p>
          )}
        </div>
        {event.memberIds?.length > 0 && (
          <p className={`font-inter text-[10px] mt-3 ${L?'text-gray-400':'text-gray-600'}`}>
            {event.memberIds.length} member{event.memberIds.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )

  if (!canView && !enrolled) return <div className="opacity-60 cursor-not-allowed">{card}</div>
  return <Link to={`/events/${event._id}`}>{card}</Link>
}

// ── Session divider ───────────────────────────────────────────────────────────
function SessionDivider({ session, count, L }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
      <span className={`font-inter font-semibold uppercase tracking-[0.2em] shrink-0 whitespace-nowrap text-[10px] ${L ? 'text-gray-400' : 'text-gray-600'}`}>
        {session} · {count} event{count !== 1 ? 's' : ''}
      </span>
      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
    </div>
  )
}

export default function EventsPage() {
  const { theme }              = useTheme()
  const { user }               = useAuth()
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const L = theme === 'light'

  const isAdminOrCore = user && ['admin','core'].includes(user.role)
  const curSession    = currentSession()

  const { data: eventsData, loading } = useData(() => eventsApi.list(), 5000)
  const { data: sectData }            = useData(() => settingsApi.getSections(), 5000)
  const showPast = isAdminOrCore || (sectData?.sections?.['show-past-events'] !== false)

  const events = eventsData?.events || []

  const getUserRole = (event) => {
    if (!user) return null
    if (user.role === 'core') return 'core'
    const m = event.members?.find(m => {
      const uid = typeof m.user === 'object' ? m.user?._id?.toString() : m.user?.toString()
      return uid === user._id?.toString()
    })
    return m?.eventRole || null
  }

  const currentItems = events.filter(e => isCurrentSession(e))
  const pastItems    = events.filter(e => !isCurrentSession(e))

  const pastBySession = pastItems.reduce((acc, e) => {
    const s = getItemSession(getPrimaryItemDate(e)) || 'Older'
    ;(acc[s] = acc[s] || []).push(e)
    return acc
  }, {})
  const pastSessions = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))

  // All sessions available (for the session selector row)
  const allSessions = [curSession, ...pastSessions]

  // Items for the currently selected session
  const sessionItems = sessionFilter === curSession
    ? currentItems
    : (pastBySession[sessionFilter] || [])
  const isPastSession = sessionFilter !== curSession

  // Status filter applies within the selected session
  const filtered = filter === 'all' ? sessionItems : sessionItems.filter(e => e.status === filter)

  return (
    <PageLayout title="Events" subtitle="From shoots to workshops, every event is a new chapter in our story.">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Session year selector — only shown if past sessions exist and showPast is on */}
        {!loading && (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0)).length > 1 && (
          <div className="flex gap-2 mb-5 flex-wrap items-center">
            <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
            {(showPast ? allSessions : [curSession]).map(s => {
              const isActive = sessionFilter === s
              const isCur = s === curSession
              return (
                <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                  className={`px-3 py-1.5 rounded-xl font-inter text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-red-700 text-white border-red-700'
                      : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}>
                  {s}{isCur ? ' · Current' : ''}
                </button>
              )
            })}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {['upcoming','ongoing','past'].map(f => (
            <GlassButton key={f} variant={filter === f ? 'red' : 'default'}
              onClick={() => setFilter(prev => prev === f ? 'all' : f)}
              className="px-4 font-inter text-xs capitalize" style={{ borderRadius:'20px', minHeight:'34px' }}>
              {f}{filter === f && <span className="ml-1.5 opacity-60">✕</span>}
            </GlassButton>
          ))}
        </div>

        {isPastSession && (
          <div className="mb-4">
            <SessionDivider session={sessionFilter} count={sessionItems.length} L={L} />
          </div>
        )}

        {loading ? (
          <SkeletonCardGrid n={6} ratio="16/9" />
        ) : filtered.length === 0 ? (
          <p className={`py-16 text-center font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>
            {filter !== 'all' ? `No ${filter} events in ${sessionFilter}.` : `No events in ${sessionFilter}.`}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(e => (
              <EventCard key={e._id} event={e} userId={user?._id} userRole={getUserRole(e)} L={L} dim={isPastSession} />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
