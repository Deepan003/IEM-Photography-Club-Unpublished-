import { useState }       from 'react'
import { Link }           from 'react-router-dom'
import PageLayout         from '../components/PageLayout.jsx'
import { useData }        from '../hooks/useData.js'
import { eventsApi, settingsApi } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import { isCurrentSession, getItemSession, getPrimaryItemDate, currentSession } from '../utils/yearCalc.js'

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  upcoming: 'bg-yellow-900/60 text-yellow-300 border-yellow-800/60',
  ongoing:  'bg-green-900/60 text-green-300 border-green-800/60',
  past:     'bg-gray-900/60 text-gray-400 border-gray-800/60',
}

// ── Single event card ─────────────────────────────────────────────────────────
function EventCard({ event, participating, userRole, L, dim = false }) {
  const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const primaryDate = event.eventDate || event.startDate || (event.dates||[])[0]
  const dates = primaryDate ? fmtD(primaryDate) : 'TBD'

  return (
    <Link to={`/events/${event._id}`}
      className={`relative block rounded-3xl overflow-hidden group transition-all duration-300
        ${participating
          ? `border-2 ${L?'border-red-400/50':'border-red-600/50'} shadow-[0_0_24px_rgba(220,38,38,0.12)]`
          : `border ${L?'border-black/8':'border-white/8'}`
        } auth-glass glass-card-hover`}
      style={{
        filter: dim ? 'grayscale(0.72) brightness(0.82)' : undefined,
        transition: 'filter 300ms',
      }}
      onMouseEnter={dim ? e => { e.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' } : undefined}
      onMouseLeave={dim ? e => { e.currentTarget.style.filter = 'grayscale(0.72) brightness(0.82)' } : undefined}>

      {/* Participating ribbon */}
      {participating && (
        <div className="absolute top-0 left-0 right-0 z-10 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      )}

      {/* Event image / banner */}
      <div className="relative h-44 overflow-hidden">
        {event.logoUrl
          ? <img src={event.logoUrl} alt={event.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          : <div className="w-full h-full flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}>
              <span className="font-clash text-7xl font-black text-white opacity-10">{event.name[0]}</span>
            </div>}
        <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%)' }} />

        {/* Status + Participating badges */}
        <div className="absolute top-3 left-3 flex gap-2 items-center">
          <span className={`font-inter text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${STATUS_STYLE[event.status]||''}`}>
            {event.status}
          </span>
          {participating && (
            <span className="flex items-center gap-1 font-inter text-[10px] px-2.5 py-0.5 rounded-full bg-red-600 text-white font-semibold">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
              You're in
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-clash font-bold text-lg text-white leading-tight">{event.name}</h3>
        </div>
      </div>

      {/* Info */}
      <div className={`p-4 space-y-2 ${participating ? L?'bg-red-50/30':'bg-red-950/10' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">📅</span>
              <span className={`font-inter text-xs ${L?'text-gray-600':'text-gray-400'}`}>{dates}</span>
            </div>
            {event.venue && (
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span>
                <span className={`font-inter text-xs ${L?'text-gray-600':'text-gray-400'}`}>{event.venue}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm">👥</span>
              <span className={`font-inter text-xs ${L?'text-gray-600':'text-gray-400'}`}>
                {event.members?.length||0} member{(event.members?.length||0)!==1?'s':''}
              </span>
            </div>
          </div>

          {/* Participation role badge */}
          {participating && userRole && (
            <div className="shrink-0 text-center">
              <div className={`px-3 py-1.5 rounded-xl border text-center ${
                userRole === 'core'        ? 'bg-amber-900/40 text-amber-400 border-amber-800/50' :
                userRole === 'coordinator' ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' :
                'bg-emerald-900/30 text-emerald-400 border-emerald-800/40'
              }`}>
                <p className="font-inter text-[9px] uppercase tracking-wider">Your Role</p>
                <p className="font-inter text-xs font-semibold capitalize mt-0.5">{userRole}</p>
              </div>
            </div>
          )}
        </div>

        {event.description && (
          <p className={`font-inter text-xs leading-relaxed line-clamp-2 ${L?'text-gray-500':'text-gray-500'}`}>
            {event.description}
          </p>
        )}

        {!participating && (
          <div className={`flex items-center gap-1.5 pt-1 font-inter text-[10px] ${L?'text-gray-400':'text-gray-600'}`}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Not participating
          </div>
        )}
      </div>
    </Link>
  )
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

// ── Main user events page ─────────────────────────────────────────────────────
export default function UserEventsPage() {
  const { theme }   = useTheme()
  const { user }    = useAuth()
  const [filter,        setFilter]        = useState('all')
  const [sessionFilter, setSessionFilter] = useState(() => currentSession())
  const L = theme === 'light'

  const { data, loading }  = useData(() => eventsApi.list(), 5000)
  const { data: sectData } = useData(() => settingsApi.getSections(), 5000)
  const isAdminOrCore = user && ['admin','core'].includes(user.role)
  const showPast = isAdminOrCore || (sectData?.sections?.['show-past-events'] !== false)

  const allEvents = data?.events || []

  // Build a map: eventId → user's membership info
  const myEventMap = {}
  if (user) {
    allEvents.forEach(e => {
      const membership = e.members?.find(m => {
        const uid = typeof m.user === 'object' ? m.user?._id : m.user
        return uid?.toString() === user._id?.toString()
      })
      if (membership) {
        myEventMap[e._id] = membership.eventRole || 'photographer'
      } else if (user.role === 'core' && (e.memberIds || []).includes(user._id?.toString())) {
        myEventMap[e._id] = 'core'
      }
    })
  }

  const curSession    = currentSession()

  // Split into current session and past sessions
  const currentItems  = allEvents.filter(e => isCurrentSession(e))
  const pastItems     = allEvents.filter(e => !isCurrentSession(e))

  // Group past items by session, descending
  const pastBySession = pastItems.reduce((acc, e) => {
    const s = getItemSession(getPrimaryItemDate(e)) || 'Older'
    ;(acc[s] = acc[s] || []).push(e)
    return acc
  }, {})
  const pastSessions  = Object.keys(pastBySession).sort((a, b) => b.localeCompare(a))
  const allSessions   = [curSession, ...pastSessions]
  const sessionItems  = sessionFilter === curSession ? currentItems : (pastBySession[sessionFilter] || [])
  const isPastSession = sessionFilter !== curSession

  // Derived counts for selected session
  const upcoming = sessionItems.filter(e => ['upcoming','ongoing'].includes(e.status))
  const past     = sessionItems.filter(e => e.status === 'past')
  const mine     = sessionItems.filter(e => myEventMap[e._id])

  // Filter tabs apply to selected session items
  const filtered = filter === 'mine'     ? mine
                 : filter === 'upcoming' ? upcoming
                 : filter === 'past'     ? past
                 : sessionItems

  const myUpcoming = upcoming.filter(e => myEventMap[e._id])

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen pt-14 transition-colors ${L?'bg-gray-50':'bg-[#050505]'}`}>

        {/* Hero stats for logged-in users */}
        {user && (
          <div className={`border-b py-6 px-4 transition-colors ${L?'bg-white border-black/8':'bg-[#080808] border-white/5'}`}>
            <div className="max-w-5xl mx-auto">
              <h1 className={`font-breathing text-3xl sm:text-4xl font-semibold mb-4 ${L?'text-gray-900':'text-white'}`}>
                Club Events
              </h1>
              <div className="grid grid-cols-3 gap-3 max-w-sm">
                {[
                  { label:'This Session', val: currentItems.length, color:'text-white'      },
                  { label:'Your Events',  val: mine.length,         color:'text-red-400'    },
                  { label:'Upcoming',     val: myUpcoming.length,   color:'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className={`auth-glass rounded-2xl p-3 text-center border ${L?'border-black/7':'border-white/7'}`}>
                    <p className={`font-clash text-2xl font-bold ${s.color}`}>{s.val}</p>
                    <p className="font-inter text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Session year selector */}
          {!loading && (showPast ? allSessions : [curSession]).filter(s => s === curSession || (pastBySession[s]?.length > 0)).length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <span className={`font-inter text-[10px] uppercase tracking-widest ${L ? 'text-gray-400' : 'text-gray-600'}`}>Session</span>
              {(showPast ? allSessions : [curSession]).map(s => {
                const isAct = sessionFilter === s
                const isCur = s === curSession
                return (
                  <button key={s} onClick={() => { setSessionFilter(s); setFilter('all') }}
                    className={`px-3 py-1.5 rounded-xl font-inter text-xs font-semibold border transition-all ${
                      isAct
                        ? 'bg-red-700 text-white border-red-700'
                        : L ? 'border-black/10 text-gray-600 hover:text-gray-900 hover:border-black/20' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}>
                    {s}{isCur ? ' · Current' : ''}
                  </button>
                )
              })}
            </div>
          )}

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap mb-8">
            {[
              { id:'all',      label:`All (${sessionItems.length})` },
              ...(user ? [{ id:'mine', label:`My Events (${mine.length})` }] : []),
              { id:'upcoming', label:`Upcoming (${upcoming.length})` },
              { id:'past',     label:`Past (${past.length})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-xl font-inter text-sm font-medium transition-all ${
                  filter === f.id ? 'bg-red-700 text-white' : `auth-glass border ${L?'border-black/8 text-gray-600 hover:text-gray-900':'border-white/8 text-gray-400 hover:text-white'}`
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className={`text-center py-20 font-inter text-sm animate-pulse ${L?'text-gray-400':'text-gray-600'}`}>Loading events…</p>
          ) : (
            <>
              {filtered.length === 0 && filter !== 'all' ? (
                <div className={`py-20 text-center auth-glass rounded-3xl border ${L?'border-black/7':'border-white/7'}`}>
                  <p className="text-5xl mb-3">📅</p>
                  <p className={`font-clash font-bold text-xl ${L?'text-gray-900':'text-white'}`}>
                    {filter === 'mine' ? "You haven't participated in any events yet" : 'No events found'}
                  </p>
                  <p className={`font-inter text-sm mt-2 ${L?'text-gray-500':'text-gray-500'}`}>
                    {filter === 'mine' ? 'Events you join will appear here.' : 'Check back soon.'}
                  </p>
                </div>
              ) : filtered.length > 0 ? (
                <>
                  {isPastSession && (
                    <div className="mb-4">
                      <SessionDivider session={sessionFilter} count={sessionItems.length} L={L} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map(e => (
                      <EventCard
                        key={e._id}
                        event={e}
                        participating={!!myEventMap[e._id]}
                        userRole={myEventMap[e._id]}
                        L={L}
                        dim={isPastSession}
                      />
                    ))}
                  </div>
                </>
              ) : null}

            </>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
