import { useState, useEffect, useRef } from 'react'
import { Link }       from 'react-router-dom'
import PageLayout     from '../components/PageLayout.jsx'
import { membersApi } from '../api/api.js'
import { useTheme }   from '../App.jsx'
import { useData }    from '../hooks/useData.js'

function sortByName(arr) {
  return [...arr].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Border beam (same technique used throughout the site) ─────────────────────
function BorderBeam({ speed = 12, c1 = 'rgba(160,150,130,0.35)', c2 = 'rgba(210,200,175,0.6)', delay = '0s' }) {
  return (
    <div className="absolute inset-0 rounded-[inherit] overflow-hidden" aria-hidden style={{ pointerEvents:'none' }}>
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:'200%', height:'200%',
        marginLeft:'-100%', marginTop:'-100%',
        background:`conic-gradient(from 0deg,transparent 0%,transparent 86%,${c1} 91%,${c2} 95%,rgba(235,220,185,0.9) 97%,${c2} 98.5%,${c1} 99.5%,transparent 100%)`,
        animation:`borderBeamRotate ${speed}s linear infinite`,
        animationDelay: delay,
      }} />
    </div>
  )
}

// ── Simple reveal wrapper — fades in children when scrolled into view ─────────
function Reveal({ children, delay = 0 }) {
  const ref  = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el  = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity:   vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(22px)',
      transition: `opacity 0.55s ease ${delay}s, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
    }}>
      {children}
    </div>
  )
}

// ── Alumni portrait card — always B&W, role badge preserved ──────────────────
function AlumniCard({ member, index = 0 }) {
  const { theme } = useTheme()
  const L         = theme === 'light'
  const isCore  = member.role === 'core'
  const isCoord = member.role === 'coordinator'
  const initials = member.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = isCore ? 'Core' : isCoord ? 'Coordinator' : ''

  const beamSpeed = 13 + (index % 5) * 1.3
  const delay     = `${(index % 7) * 0.38}s`
  const floatDur  = `${5.5 + (index % 5) * 0.55}s`

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Float wrapper */}
      <div className="w-full" style={{ animation:`memberCircleFloat ${floatDur} ease-in-out infinite`, animationDelay: delay }}>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ padding:'1.5px' }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)'
            e.currentTarget.style.transition = 'transform 270ms cubic-bezier(0.22,1,0.36,1)'
          }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}>
          <BorderBeam speed={beamSpeed} delay={delay} />

          {/* Portrait */}
          <div className="group relative rounded-[10px] overflow-hidden"
            style={{ aspectRatio:'3/4',
              background: L ? 'linear-gradient(145deg,#dce1ec,#e8ecf3)' : 'linear-gradient(145deg,#0c0c0c,#060608)' }}>
            {member.profilePhoto
              ? <img src={member.profilePhoto} alt={member.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  style={{ animation:'passoutBw 14s ease-in-out infinite' }} />
              : <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`font-clash font-black ${L ? 'text-black/8' : 'text-white/8'}`}
                    style={{ fontSize:'clamp(1.4rem,4.5vw,2.8rem)' }}>{initials}</span>
                </div>}

            {/* Cinematic overlay */}
            <div className="absolute inset-0"
              style={{ background: L
                ? 'linear-gradient(180deg,rgba(0,0,0,0.03) 0%,transparent 38%,rgba(0,0,0,0.26) 100%)'
                : 'linear-gradient(180deg,rgba(0,0,0,0.12) 0%,transparent 38%,rgba(0,0,0,0.65) 100%)' }} />

            {/* Role badge — preserved for core/coordinator */}
            {(isCore || isCoord) && (
              <>
                <div className="absolute inset-x-0 bottom-0 to-transparent" style={{ height:'42%',
                  background: L ? 'linear-gradient(to top,rgba(220,225,236,0.88),transparent)' : 'linear-gradient(to top,rgba(0,0,0,0.80),transparent)' }} />
                <div className="absolute bottom-2 left-0 right-0 flex justify-center px-1">
                  <span className="font-inter font-bold uppercase"
                    style={{ fontSize:'clamp(6px,1vw,9px)', letterSpacing:'0.12em',
                      color: L ? (isCore ? 'rgba(120,90,50,0.80)' : 'rgba(60,80,130,0.80)') : 'rgba(195,185,155,0.72)' }}>
                    {roleLabel}
                  </span>
                </div>
              </>
            )}

            {/* Subtle sepia vignette on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
              style={{ background:'radial-gradient(ellipse at center,transparent 40%,rgba(20,15,5,0.35) 100%)' }} />
          </div>
        </div>
      </div>

      {/* Name */}
      <p className="font-inter font-semibold text-center leading-snug w-full px-0.5"
        style={{ fontSize:'clamp(9px,1.4vw,12px)', color:'rgba(148,138,118,0.88)', wordBreak:'break-word', hyphens:'auto' }}>
        {member.name}
      </p>
    </div>
  )
}

// ── Year divider ──────────────────────────────────────────────────────────────
function YearDivider({ year, count }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="flex-1 h-px" style={{ background:'linear-gradient(to right,transparent,rgba(180,140,60,0.22))' }} />
      <span className="font-inter font-semibold uppercase shrink-0 whitespace-nowrap"
        style={{ fontSize:'clamp(9px,1.6vw,10px)', letterSpacing:'0.2em', color:'rgba(180,140,60,0.58)' }}>
        {year} Passouts · {count}
      </span>
      <div className="flex-1 h-px" style={{ background:'linear-gradient(to right,rgba(180,140,60,0.22),transparent)' }} />
    </div>
  )
}

// ── Stats chip ────────────────────────────────────────────────────────────────
function StatChip({ val, label }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-inter font-bold leading-none"
        style={{ fontSize:'1.15rem', color:'rgba(200,165,65,0.85)' }}>{val}</span>
      <span className="font-inter text-[10px] uppercase tracking-[0.14em] text-gray-600">{label}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AlumniPage() {
  const { theme }          = useTheme()
  const [search, setSearch] = useState('')
  const L = theme === 'light'

  const { data, loading } = useData(() => membersApi.listPassout(), 20000)
  const all = data?.members || []

  const q        = search.toLowerCase().trim()
  const filtered = q
    ? all.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q)
      )
    : all

  // Group by endYear descending
  const byYear = filtered.reduce((acc, m) => {
    const k = m.endYear || 0
    ;(acc[k] = acc[k] || []).push(m)
    return acc
  }, {})
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Total unfiltered stats
  const allByYear = all.reduce((acc, m) => {
    const k = m.endYear || 0
    ;(acc[k] = acc[k] || []).push(m)
    return acc
  }, {})
  const totalYears = Object.keys(allByYear).length

  return (
    <PageLayout>
      {/* ── Hero ── */}
      <div className={`relative px-5 sm:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10 overflow-hidden
        ${L ? 'bg-white' : 'bg-[#06060a]'}`}>

        {/* Subtle film-grain texture overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
            backgroundSize:'200px 200px', opacity:0.6 }} />

        <div className="relative max-w-5xl mx-auto">
          {/* Back nav */}
          <Link to="/members"
            className={`inline-flex items-center gap-1.5 mb-7 font-inter text-[10px] uppercase tracking-[0.22em] transition-colors
              ${L ? 'text-gray-400 hover:text-gray-600' : 'text-gray-600 hover:text-gray-400'}`}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Members
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              {/* Eyebrow */}
              <p className="font-inter text-[10px] uppercase tracking-[0.32em] mb-2"
                style={{ color:'rgba(180,140,60,0.6)' }}>
                Alumni
              </p>

              {/* Title */}
              <h1 className={`font-breathing italic font-semibold leading-[1.0] mb-3 ${L ? 'text-gray-900' : 'text-white'}`}
                style={{ fontSize:'clamp(1.7rem,5vw,3rem)' }}>
                Past Members
              </h1>

              <p className={`font-inter text-sm max-w-xs sm:max-w-sm leading-relaxed ${L ? 'text-gray-500' : 'text-gray-500'}`}>
                The frames they captured live on forever.
              </p>

              {/* Stats */}
              {!loading && all.length > 0 && (
                <div className="flex items-center gap-5 sm:gap-6 mt-4">
                  <StatChip val={all.length} label="Alumni" />
                  <StatChip val={totalYears} label={totalYears === 1 ? 'Batch' : 'Batches'} />
                </div>
              )}
            </div>

            {/* Search */}
            {!loading && all.length > 5 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border self-start
                ${L ? 'border-black/10 bg-white shadow-sm' : 'border-white/8 bg-white/5'}`}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={L ? 'text-gray-400 shrink-0' : 'text-gray-600 shrink-0'}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search alumni…"
                  className={`w-32 sm:w-44 bg-transparent border-0 outline-none font-inter text-sm
                    ${L ? 'text-gray-700 placeholder-gray-400' : 'text-gray-200 placeholder-gray-600'}`}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className={`font-inter text-xs transition-colors ${L ? 'text-gray-400 hover:text-gray-700' : 'text-gray-600 hover:text-gray-300'}`}>✕</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Golden border + traveling shrine light */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height:'1px', overflow:'hidden' }}>
          {/* Permanent golden border line */}
          <div className="absolute inset-0" style={{
            background:'linear-gradient(90deg,transparent 0%,rgba(200,155,50,0.45) 12%,rgba(212,170,60,0.7) 40%,rgba(218,175,62,0.72) 60%,rgba(200,155,50,0.45) 88%,transparent 100%)',
          }} />
          {/* Thin traveling light — narrow streak, no opacity animation */}
          <div style={{
            position:'absolute', top:0, bottom:0,
            width:'8%',
            background:'linear-gradient(90deg,transparent,rgba(255,230,90,0.6) 30%,rgba(255,248,160,1) 50%,rgba(255,230,90,0.6) 70%,transparent)',
            animation:'shrineTravel 4.5s linear infinite',
          }} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className={L ? 'bg-gray-50' : 'bg-[#060608]'}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-14">

          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-3 rounded-full animate-pulse ${L ? 'bg-gray-200' : 'bg-white/6'}`}
                  style={{ width:`${[70, 50, 60][i]}%`, animationDelay:`${i * 0.15}s` }} />
              ))}
            </div>
          ) : all.length === 0 ? (
            <div className="py-24 text-center">
              <div className="text-5xl mb-5" style={{ opacity:0.2, filter:'grayscale(1)' }}>◎</div>
              <p className={`font-breathing italic text-lg ${L ? 'text-gray-400' : 'text-gray-600'}`}>No alumni records yet.</p>
              <p className={`font-inter text-xs mt-2 ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                Members who pass out will appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className={`font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>No results for "{search}".</p>
              <button onClick={() => setSearch('')}
                className="mt-3 font-inter text-xs transition-colors"
                style={{ color:'rgba(180,140,60,0.65)' }}>
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-10 sm:space-y-16">
              {years.map((year, yi) => {
                const group = sortByName(byYear[year])
                return (
                  <Reveal key={year} delay={yi * 0.07}>
                    <div className="space-y-5 sm:space-y-6">
                      <YearDivider year={year} count={group.length} />
                      {/* Mobile: 3 cols | sm: 4 | md: 5 | lg: 6 | xl: 7 */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-4 md:gap-5">
                        {group.map((m, i) => (
                          <AlumniCard key={m._id} member={m} index={i + yi * 12} />
                        ))}
                      </div>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
