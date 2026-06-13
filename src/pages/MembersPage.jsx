import { useState }     from 'react'
import { Link }         from 'react-router-dom'
import PageLayout       from '../components/PageLayout.jsx'
import { membersApi }   from '../api/api.js'
import { useTheme }     from '../App.jsx'
import { useData }      from '../hooks/useData.js'
import { currentSession } from '../utils/yearCalc.js'
import { SkeletonPhotoGrid } from '../components/Skeleton.jsx'
import ProgressiveImage from '../components/ProgressiveImage.jsx'

// Sort: seniors (lowest endYear) first, then alphabetical
function sortByYearThenName(arr) {
  return [...arr].sort((a, b) => {
    const ya = a.endYear || 9999, yb = b.endYear || 9999
    if (ya !== yb) return ya - yb
    return a.name.localeCompare(b.name)
  })
}

// ── Travelling border beam ────────────────────────────────────────────────────
function BorderBeam({ speed = 8, c1 = 'rgba(255,255,255,0.5)', c2 = 'rgba(255,255,255,0.9)', delay = '0s' }) {
  return (
    <div className="absolute inset-0 rounded-[inherit] overflow-hidden" aria-hidden style={{ pointerEvents:'none' }}>
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:'200%', height:'200%',
        marginLeft:'-100%', marginTop:'-100%',
        background:`conic-gradient(from 0deg,transparent 0%,transparent 87%,${c1} 91%,${c2} 95%,rgba(255,255,255,0.95) 97%,${c2} 98.5%,${c1} 99.5%,transparent 100%)`,
        animation:`borderBeamRotate ${speed}s linear infinite`,
        animationDelay:delay,
      }} />
    </div>
  )
}

// ── Unified portrait card ─────────────────────────────────────────────────────
function MemberPortraitCard({ member, index = 0, L, isAlumni = false }) {
  const isCore  = member.role === 'core'
  const isCoord = member.role === 'coordinator'
  const initials = member.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  const roleLabel = isCore ? 'Core' : isCoord ? 'Coordinator' : 'Photographer'
  const beamC1    = isCore ? 'rgba(220,38,38,0.65)' : isCoord ? 'rgba(37,99,235,0.6)' : 'rgba(140,140,180,0.45)'
  const beamC2    = isCore ? 'rgba(255,100,100,1)'  : isCoord ? 'rgba(80,140,255,1)'  : 'rgba(190,190,220,0.8)'
  const floatKf   = isCore ? 'memberCoreFloat'       : isCoord ? 'memberCoordFloat'    : 'memberCircleFloat'
  const floatDur  = `${3.2 + (index % 4) * 0.5}s`
  const beamSpeed = isCore ? 4 + (index % 3) : isCoord ? 5.5 + (index % 3) : 9 + (index % 4)
  const delay     = `${(index % 5) * 0.48}s`
  const cardBg    = L
    ? isCore  ? 'linear-gradient(145deg,#fff0f0,#fde8e8)'
    : isCoord ? 'linear-gradient(145deg,#eff4ff,#e8efff)'
    :           'linear-gradient(145deg,#f2f5fa,#eaecf3)'
    : isCore  ? 'linear-gradient(145deg,#1a0005,#060608)'
    : isCoord ? 'linear-gradient(145deg,#00001a,#060608)'
    :           'linear-gradient(145deg,#0d0d0d,#060608)'
  const nameColor = isCore
    ? L ? '#b91c1c' : 'rgba(252,165,165,0.92)'
    : isCoord
    ? L ? '#1d4ed8' : 'rgba(147,197,253,0.92)'
    : L ? 'rgba(31,41,55,0.95)' : 'rgba(209,213,219,0.92)'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full" style={{ animation:`${floatKf} ${floatDur} ease-in-out infinite`, animationDelay:delay }}>
        <div className="relative w-full rounded-xl overflow-hidden"
          style={{
            padding:'1.5px',
            ...(L ? {
              boxShadow: '5px 5px 14px rgba(163,177,200,0.42), -3px -3px 8px rgba(255,255,255,0.88)',
              border: isCore  ? '1px solid rgba(220,38,38,0.18)'
                    : isCoord ? '1px solid rgba(37,99,235,0.16)'
                    : '1px solid rgba(174,185,210,0.35)',
            } : {}),
            ...(isAlumni ? { filter:'grayscale(0.82) brightness(0.72)', transition:'filter 300ms ease' } : {})
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = isCore ? 'scale(1.07) translateY(-4px)' : 'scale(1.05) translateY(-3px)'
            e.currentTarget.style.transition = 'transform 280ms cubic-bezier(0.22,1,0.36,1)'
            if (isAlumni) e.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = ''
            if (isAlumni) e.currentTarget.style.filter = 'grayscale(0.82) brightness(0.72)'
          }}>
          <BorderBeam speed={beamSpeed} c1={beamC1} c2={beamC2} delay={delay} />
          <div className="group relative rounded-[10px] overflow-hidden" style={{ aspectRatio:'3/4', background: cardBg }}>
            {member.profilePhoto
              ? <ProgressiveImage src={member.profilePhoto} alt={member.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              : <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-clash font-black"
                    style={{
                      fontSize: 'clamp(1.5rem,5vw,3rem)',
                      color: L
                        ? isCore  ? 'rgba(220,38,38,0.18)'
                        : isCoord ? 'rgba(37,99,235,0.16)'
                        : 'rgba(100,116,139,0.20)'
                        : 'rgba(255,255,255,0.08)',
                    }}>{initials}</span>
                </div>}
            <div className="absolute inset-0" style={{
              background: L
                ? 'linear-gradient(180deg,rgba(0,0,0,0.04) 0%,transparent 40%,rgba(0,0,0,0.10) 100%)'
                : 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,transparent 40%,rgba(0,0,0,0.6) 100%)',
            }} />
            {(isCore || isCoord || isAlumni) && (
              <>
                <div className="absolute inset-x-0 bottom-0" style={{
                  height: '40%',
                  background: L
                    ? isCore  ? 'linear-gradient(to top,rgba(254,226,226,0.92),transparent)'
                    : isCoord ? 'linear-gradient(to top,rgba(219,234,254,0.92),transparent)'
                    : 'linear-gradient(to top,rgba(232,236,243,0.85),transparent)'
                    : 'linear-gradient(to top,rgba(0,0,0,0.82),transparent)',
                }} />
                <div className="absolute bottom-2 left-0 right-0 flex justify-center px-1">
                  <span className="font-inter font-bold uppercase"
                    style={{
                      fontSize: 'clamp(7px,1.1vw,10px)',
                      letterSpacing: '0.13em',
                      color: L
                        ? isCore  ? 'rgba(185,28,28,0.90)'
                        : isCoord ? 'rgba(29,78,216,0.90)'
                        : 'rgba(71,85,105,0.85)'
                        : 'rgba(255,255,255,0.82)',
                    }}>
                    {roleLabel}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="font-inter font-semibold text-center leading-snug w-full px-1"
        style={{ fontSize:'clamp(10px,1.5vw,13px)', color: nameColor, wordBreak:'break-word', hyphens:'auto' }}>
        {member.name}
      </p>
      {isAlumni && (
        <p className="font-inter uppercase tracking-[0.18em] text-center -mt-1"
          style={{ fontSize:'clamp(7px,1vw,9px)', color:'rgba(160,160,160,0.65)' }}>
          Alumni
        </p>
      )}
    </div>
  )
}

// ── Role section label ────────────────────────────────────────────────────────
function RoleSection({ label, color, count, children, L }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <span className="font-inter font-bold uppercase tracking-[0.28em] shrink-0"
          style={{ fontSize:'clamp(9px,1.2vw,11px)', color }}>
          {label}
        </span>
        <span className={`font-inter text-[10px] sm:text-xs shrink-0 ${L?'text-gray-400':'text-gray-600'}`}>· {count}</span>
        <div className="flex-1 h-px" style={{ background:`linear-gradient(to right,${color}55,transparent)` }} />
      </div>
      {children}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { theme }                          = useTheme()
  const [search, setSearch]                = useState('')
  const [sessionFilter, setSessionFilter]  = useState(() => currentSession())
  const L = theme === 'light'

  const { data: membersData,  loading }               = useData(() => membersApi.list(),        5000)
  const { data: passoutData,  loading: passoutLoading } = useData(() => membersApi.listPassout(), 20000)
  const members        = membersData?.members || []
  const passoutMembers = passoutData?.members || (Array.isArray(passoutData) ? passoutData : [])

  const curSession    = currentSession()
  const isCurrentSess = sessionFilter === curSession

  // Current (active) members from the regular endpoint
  const currentMems = members.filter(m => m.role !== 'admin')

  // Alumni grouped by passout year — from the separate passout endpoint
  const endYToSess    = y => `${y - 1}-${String(y).slice(-2)}`
  const passoutByEndY = passoutMembers.reduce((acc, m) => { (acc[m.endYear] = acc[m.endYear] || []).push(m); return acc }, {})
  const pastEndYrs    = Object.keys(passoutByEndY).map(Number).sort((a, b) => b - a)
  const allSessions   = [curSession, ...pastEndYrs.map(endYToSess)]

  // Members for selected session
  const active = isCurrentSess
    ? currentMems
    : (passoutByEndY[pastEndYrs.find(y => endYToSess(y) === sessionFilter)] || [])

  const q        = search.toLowerCase().trim()
  const filtered = q
    ? active.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q)
      )
    : active

  const core          = sortByYearThenName(filtered.filter(m => m.role === 'core'))
  const coordinators  = sortByYearThenName(filtered.filter(m => m.role === 'coordinator'))
  const photographers = sortByYearThenName(filtered.filter(m => m.role === 'photographer'))

  const totalCore  = sortByYearThenName(active.filter(m => m.role === 'core')).length
  const totalCoord = active.filter(m => m.role === 'coordinator').length
  const totalPhoto = active.filter(m => m.role === 'photographer').length

  const coordOffset = core.length
  const photoOffset = core.length + coordinators.length

  return (
    <PageLayout>
      {/* ── Hero ── */}
      <div className={`relative px-5 sm:px-8 pt-10 sm:pt-12 pb-6 sm:pb-8 border-b ${L?'bg-white border-black/5':'bg-[#06060a] border-white/5'}`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4">

            <div>
              <h1 className={`pl-heading-in font-breathing italic font-semibold leading-[1.05] mb-1 ${L?'text-gray-900':'text-white'}`}
                style={{ fontSize:'clamp(1.6rem,4.5vw,2.8rem)' }}>
                Club Members
              </h1>
              <span className={`font-inter text-xs sm:text-sm uppercase tracking-[0.18em] mt-1.5 mb-3 block ${L?'text-gray-500':'text-gray-400'}`}>
                {isCurrentSess ? `${curSession} · Current` : sessionFilter}
              </span>
              <p className={`font-inter text-sm max-w-sm leading-relaxed mb-4 ${L?'text-gray-500':'text-gray-500'}`}>
                The passionate photographers behind every frame.
              </p>

              {/* Stats — active members only */}
              {!loading && active.length > 0 && (
                <div className="flex items-center gap-5 sm:gap-7">
                  {[
                    { label:'Core',         count:totalCore,  color:'#f87171' },
                    { label:'Coordinators', count:totalCoord, color:'#60a5fa' },
                    { label:'Photographers',count:totalPhoto, color:'#34d399' },
                  ].filter(x => x.count > 0).map(x => (
                    <div key={x.label} className="flex items-baseline gap-1.5">
                      <span className="font-inter font-bold leading-none" style={{ fontSize:'1.25rem', color:x.color }}>{x.count}</span>
                      <span className={`font-inter text-[10px] uppercase tracking-[0.14em] ${L?'text-gray-400':'text-gray-500'}`}>{x.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            {!loading && active.length > 5 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${L?'border-black/10 bg-white shadow-sm':'border-white/8 bg-white/5'}`}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={L?'text-gray-400 shrink-0':'text-gray-600 shrink-0'}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className={`w-32 sm:w-44 bg-transparent border-0 outline-none font-inter text-sm ${L?'text-gray-700 placeholder-gray-400':'text-gray-200 placeholder-gray-600'}`}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className={`font-inter text-xs ${L?'text-gray-400 hover:text-gray-700':'text-gray-600 hover:text-gray-300'}`}>✕</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Member grids ── */}
      <div className={L?'bg-gray-50':'bg-[#060608]'}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-5 sm:py-14">

          {/* Session pills — appear once passout data loads */}
          {allSessions.length > 1 && (
            <div className="flex gap-2 flex-wrap items-center mb-6 sm:mb-8">
              <span className={`font-inter text-[10px] uppercase tracking-widest ${L?'text-gray-400':'text-gray-600'}`}>Session</span>
              {allSessions.map(s => (
                <button key={s} onClick={() => { setSessionFilter(s); setSearch('') }}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                    sessionFilter === s
                      ? 'bg-red-700 text-white border-red-700'
                      : L ? 'border-black/15 text-gray-600 hover:text-gray-900 hover:border-black/25'
                          : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}>
                  {s}{s === curSession ? ' · Current' : ''}
                </button>
              ))}
            </div>
          )}

          {(loading || (!isCurrentSess && passoutLoading)) ? (
            <SkeletonPhotoGrid n={12} ratio="1" className="pl-section-in" />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>
                {search ? `No results for "${search}".` : 'No members yet.'}
              </p>
              {search && (
                <button onClick={() => setSearch('')}
                  className="mt-3 font-inter text-xs text-red-400 hover:text-red-300 transition-colors">Clear search</button>
              )}
            </div>
          ) : (
            <div className="pl-section-in space-y-6 sm:space-y-20">

              {core.length > 0 && (
                <RoleSection label="Core" color="#ef4444" count={core.length} L={L}>
                  <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-4 md:gap-5">
                    {core.map((m, i) => (
                      <Link key={m._id} to={`/members/${m._id}`} className="block">
                        <MemberPortraitCard member={m} index={i} L={L} isAlumni={!isCurrentSess} />
                      </Link>
                    ))}
                  </div>
                </RoleSection>
              )}

              {coordinators.length > 0 && (
                <RoleSection label="Coordinators" color="#3b82f6" count={coordinators.length} L={L}>
                  <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-4 md:gap-5">
                    {coordinators.map((m, i) => (
                      <Link key={m._id} to={`/members/${m._id}`} className="block">
                        <MemberPortraitCard member={m} index={coordOffset + i} L={L} isAlumni={!isCurrentSess} />
                      </Link>
                    ))}
                  </div>
                </RoleSection>
              )}

              {photographers.length > 0 && (
                <RoleSection label="Photographers" color={L?'#6b7280':'#9ca3af'} count={photographers.length} L={L}>
                  <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-4 md:gap-5">
                    {photographers.map((m, i) => (
                      <Link key={m._id} to={`/members/${m._id}`} className="block">
                        <MemberPortraitCard member={m} index={photoOffset + i} L={L} isAlumni={!isCurrentSess} />
                      </Link>
                    ))}
                  </div>
                </RoleSection>
              )}

            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
