import { useState }  from 'react'
import PageLayout    from '../components/PageLayout.jsx'
import { coreApi, settingsApi }   from '../api/api.js'
import { useTheme, useAuth }  from '../App.jsx'
import { useData }   from '../hooks/useData.js'

// Same threshold as main page:
// Academic year "2025-26" (endYear=2026):
//   In May 2026 (month<6)  → Current
//   In June 2026 (month≥6) → Past
// "2026-27" (endYear=2027): always Current in 2026
function isCurrent(yearStr) {
  const endYear = parseInt(yearStr.split('-')[0]) + 1
  const now = new Date(), yr = now.getFullYear(), mo = now.getMonth() + 1
  return endYear > yr || (endYear === yr && mo < 6)
}

// Portrait card — same design as main page CoreCard
function CorePortraitCard({ m, isCurrentBatch }) {
  const { theme } = useTheme()
  const L         = theme === 'light'
  const initials  = m.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const desig     = m.designation || 'Core'

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 cursor-default"
      style={{
        aspectRatio: '3/4',
        background: L
          ? (isCurrentBatch ? 'linear-gradient(145deg,#e8dce0,#dce1ec)' : 'linear-gradient(145deg,#dce1ec,#e8ecf3)')
          : 'linear-gradient(145deg,#1a0005,#060608)',
        boxShadow: isCurrentBatch
          ? '0 6px 28px rgba(220,38,38,0.18), 0 0 0 1.5px rgba(220,38,38,0.4)'
          : L ? '6px 6px 16px rgba(163,177,200,0.45), -4px -4px 10px rgba(255,255,255,0.88)'
              : '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
      {/* Photo */}
      {m.photoUrl
        ? <img src={m.photoUrl} alt={m.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-600" />
        : <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-clash font-black ${L ? 'text-black/8' : 'text-white/8'}`} style={{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
              {initials}
            </span>
          </div>}
      {/* Cinematic overlay */}
      <div className="absolute inset-0"
        style={{ background: L
          ? 'linear-gradient(180deg,rgba(0,0,0,0.03) 0%,transparent 38%,rgba(0,0,0,0.28) 100%)'
          : 'linear-gradient(180deg,rgba(0,0,0,0.12) 0%,transparent 38%,rgba(0,0,0,0.72) 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 to-transparent" style={{ height:'48%',
        background: L ? 'linear-gradient(to top,rgba(220,225,236,0.92),transparent)' : 'linear-gradient(to top,rgba(0,0,0,0.90),transparent)' }} />
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${isCurrentBatch ? 'via-red-500/80' : L ? 'via-black/10' : 'via-white/20'} to-transparent`} />
      {/* Name + designation */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="font-inter font-semibold leading-tight"
          style={{ fontSize: 'clamp(11px,1.4vw,14px)', wordBreak: 'break-word',
            color: L ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,1)',
            textShadow: L ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}>
          {m.name}
        </p>
        <p className="font-inter font-bold uppercase tracking-wider mt-0.5"
          style={{ fontSize: 'clamp(8px,0.85vw,10px)',
            color: L ? (isCurrentBatch ? '#dc2626' : '#64748b') : (isCurrentBatch ? '#f87171' : '#9ca3af'),
            textShadow: L ? 'none' : undefined }}>
          {desig}
        </p>
      </div>
    </div>
  )
}

const CORE_SUBTITLE_DEFAULT = 'Honouring the leaders who built the legacy of IEM Photography Club.'

export default function CoreCommitteePage() {
  const { theme }             = useTheme()
  const { user }              = useAuth()
  const L = theme === 'light'
  const isAdminOrCore = user && ['admin','core'].includes(user.role)

  const { data: coreData, loading }    = useData(() => coreApi.list(), 5000)
  const { data: contentData }          = useData(() => settingsApi.getContent(), 30000)
  const members = coreData?.members || []

  const content = contentData?.content || {}
  const [subtitleLocal, setSubtitleLocal] = useState(null)
  const [subtitleEditing, setSubtitleEditing] = useState(false)
  const [subtitleDraft,   setSubtitleDraft]   = useState('')
  const [subtitleSaving,  setSubtitleSaving]  = useState(false)

  const resolvedSubtitle = subtitleLocal ?? content['subtitle-core'] ?? CORE_SUBTITLE_DEFAULT

  const saveSubtitle = async () => {
    setSubtitleSaving(true)
    try {
      await settingsApi.patch('subtitle-core', subtitleDraft)
      setSubtitleLocal(subtitleDraft)
      setSubtitleEditing(false)
    } catch {} finally { setSubtitleSaving(false) }
  }

  // Group by year, sort descending
  const byYear = members.reduce((acc, m) => {
    ;(acc[m.year] = acc[m.year] || []).push(m)
    return acc
  }, {})
  const years      = Object.keys(byYear).sort((a, b) => b.localeCompare(a))
  const currentYr  = years.find(y => isCurrent(y)) || null
  const pastYears  = years.filter(y => y !== currentYr)
  const sortCore = arr => [...arr].sort((a, b) => {
    const aC = (a.designation || '').toLowerCase() === 'core'
    const bC = (b.designation || '').toLowerCase() === 'core'
    if (aC !== bC) return aC ? -1 : 1
    return (a.name || '').localeCompare(b.name || '')
  })

  return (
    <PageLayout title="Core Committee" subtitle={resolvedSubtitle}>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-3 sm:pt-4 pb-8 sm:pb-12">

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
        {loading ? (
          <p className={`py-20 text-center font-inter text-sm animate-pulse ${L ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading…
          </p>
        ) : years.length === 0 ? (
          <p className={`py-20 text-center font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>
            No core members listed yet.
          </p>
        ) : (
          <div className="space-y-14 sm:space-y-20">

            {/* ── CURRENT BATCH ── */}
            {currentYr && (
              <section>
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <h2 className={`font-clash font-bold text-lg sm:text-xl ${L ? 'text-gray-900' : 'text-white'}`}>
                    {currentYr}
                  </h2>
                  <span className={`font-inter text-[10px] px-2.5 py-0.5 rounded-full shrink-0 ${
                    L ? 'bg-red-50 text-red-600' : 'bg-red-900/30 text-red-400'}`}>
                    Current
                  </span>
                  <div className={`flex-1 h-px ${L ? 'bg-red-200/60' : 'bg-red-900/30'}`} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {sortCore(byYear[currentYr]).map(m => (
                    <CorePortraitCard key={m._id} m={m} isCurrentBatch={true} />
                  ))}
                </div>
              </section>
            )}

            {/* ── PAST YEARS ── */}
            {pastYears.length > 0 && (
              <div className="space-y-12 sm:space-y-16">
                {/* "Past Core" section label only if there's also a current section */}
                {currentYr && (
                  <div className="flex items-center gap-3">
                    <p className={`font-inter text-[10px] uppercase tracking-[0.28em] shrink-0 ${L ? 'text-gray-400' : 'text-gray-600'}`}>
                      Past Core
                    </p>
                    <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
                  </div>
                )}

                {pastYears.map(year => (
                  <section key={year}>
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className={`font-clash font-semibold text-base sm:text-lg ${L ? 'text-gray-700' : 'text-gray-300'}`}>
                        {year}
                      </h2>
                      <div className={`flex-1 h-px ${L ? 'bg-black/8' : 'bg-white/8'}`} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                      {sortCore(byYear[year]).map(m => (
                        <CorePortraitCard key={m._id} m={m} isCurrentBatch={false} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </PageLayout>
  )
}
