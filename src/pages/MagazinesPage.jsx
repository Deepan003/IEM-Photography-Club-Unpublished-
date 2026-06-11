import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout.jsx'
import { magazineApi } from '../api/api.js'
import { getTemplateById } from '../components/magazine/templates.js'
import TemplatePage from '../components/magazine/TemplatePage.jsx'
import MagazineViewer from '../components/magazine/MagazineViewer.jsx'
import { useTheme } from '../App.jsx'

const SPINE_W = 11
const PAGES_W = 4
const PAGE_W  = 420
const PAGE_H  = 560

// ── Responsive book card — cover scales to whatever the grid gives it ─────────
function BookCard({ mag, tpl, onClick }) {
  const [hov,    setHov]    = useState(false)
  const [coverW, setCoverW] = useState(140)
  const coverRef            = useRef(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      if (w > 0) setCoverW(Math.round(w))
    })
    if (coverRef.current) ro.observe(coverRef.current)
    return () => ro.disconnect()
  }, [])

  const coverH = Math.round(coverW * PAGE_H / PAGE_W)
  const scale  = coverW / PAGE_W

  const spineBg = tpl.colors?.bg?.startsWith('#0') || tpl.colors?.text === '#ffffff'
    ? '#111111' : '#1c1c1c'

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>

      <div style={{ perspective: 700, cursor:'pointer' }}
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}>

        {/* Book — spine + cover + page edge, all flex */}
        <div style={{
          display:'flex', height: coverH,
          transform: hov ? 'translateY(-7px) rotateY(-5deg) rotateX(1deg)' : 'none',
          transition:'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)',
          filter: hov
            ? 'drop-shadow(6px 12px 16px rgba(0,0,0,0.7))'
            : 'drop-shadow(2px 5px 10px rgba(0,0,0,0.5))',
          transformStyle:'preserve-3d',
        }}>

          {/* Left spine */}
          <div style={{
            width: SPINE_W, flexShrink:0, height:'100%',
            background:`linear-gradient(to right,${spineBg},#333)`,
            boxShadow:'inset -2px 0 4px rgba(0,0,0,0.55),inset 1px 0 0 rgba(255,255,255,0.04)',
            zIndex:3,
          }}/>

          {/* Cover */}
          <div ref={coverRef} style={{
            flex:1, overflow:'hidden', height:'100%', position:'relative',
            boxShadow:'inset 4px 0 8px rgba(0,0,0,0.35)',
            zIndex:2,
          }}>
            <div style={{
              position:'absolute', top:0, left:0,
              transform:`scale(${scale})`, transformOrigin:'top left',
              width:PAGE_W, height:PAGE_H,
            }}>
              <TemplatePage
                template={tpl} layoutId={mag.pages?.[0]?.layoutId || tpl.pages[0] || 'cover'}
                pageData={mag.pages?.[0]} editMode={false} showSamples={false}
                width={PAGE_W} height={PAGE_H}/>
            </div>

            {/* Hover "Read" overlay */}
            <div style={{
              position:'absolute', inset:0,
              background:'rgba(0,0,0,0.45)',
              opacity: hov ? 1 : 0,
              transition:'opacity 0.22s ease',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{
                fontFamily:'inherit', fontSize:9, fontWeight:700,
                letterSpacing:'0.15em', textTransform:'uppercase',
                color:'#fff', background:'rgba(220,38,38,0.85)',
                padding:'4px 10px', borderRadius:20,
              }}>Read</span>
            </div>

            {/* Gloss sheen */}
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(130deg,rgba(255,255,255,0.07) 0%,transparent 45%)',
            }}/>
          </div>

          {/* Right page-edge lines */}
          <div style={{
            width:PAGES_W, flexShrink:0, height:'100%', zIndex:1,
            background:'repeating-linear-gradient(to bottom,#c8c8c8,#c8c8c8 1px,#e4e4e4 1px,#e4e4e4 3px)',
          }}/>
        </div>

        {/* Bottom page-edge strip */}
        <div style={{
          height:3, marginLeft:SPINE_W, marginRight:PAGES_W, opacity:0.6,
          background:'repeating-linear-gradient(to right,#c8c8c8,#c8c8c8 1px,#e4e4e4 1px,#e4e4e4 3px)',
        }}/>
      </div>

      {/* Labels */}
      <div style={{ marginTop:7, paddingLeft:SPINE_W }}>
        <p style={{
          fontFamily:'inherit', fontSize:11, fontWeight:600,
          color:'#e0e0e0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          letterSpacing:'0.01em',
        }}>
          {mag.name || tpl.name}
        </p>
        {mag.user?.name && (
          <p style={{
            fontFamily:'inherit', fontSize:10, fontWeight:400,
            color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            marginTop:2, fontStyle:'italic',
          }}>
            By {mag.user.name}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MagazinesPage() {
  const { theme } = useTheme()
  const L = theme === 'light'
  const [magazines, setMagazines] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [viewing,   setViewing]   = useState(null)
  const [search,    setSearch]    = useState('')
  const [searchParams]            = useSearchParams()

  useEffect(() => {
    let initial = true
    const load = () => magazineApi.getPublished()
      .then(d => {
        const list = d.magazines || []
        setMagazines(list)
        if (initial) {
          const openId = searchParams.get('open')
          if (openId) {
            const target = list.find(m => m._id === openId)
            if (target) setViewing(target)
          }
          initial = false
        }
      })
      .catch(e => setError(e.message || 'Could not load magazines'))
      .finally(() => setLoading(false))
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  const filtered = magazines.filter(m =>
    !search.trim() ||
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.user?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (viewing) return <MagazineViewer magazine={viewing} onClose={() => setViewing(null)} />

  return (
    <PageLayout title={null}>
      {/* PageLayout already adds pt-[60px] via <main> — no extra offset needed */}
      <div className={L ? 'bg-gray-50' : 'bg-[#060608]'}>

        {/* ── Compact header ── */}
        <div className={'px-5 sm:px-8 pt-3 pb-4 text-center border-b '
          + (L ? 'bg-white border-black/5' : 'bg-[#08080c] border-white/5')}>

          <h1 className={'font-breathing italic font-semibold ' + (L ? 'text-gray-900' : 'text-white')}
            style={{ fontSize:'clamp(2.2rem,5vw,3.8rem)', paddingBottom:'2.2rem' }}>
            Magazines
          </h1>

          <p className={'font-inter ' + (L ? 'text-gray-500' : 'text-gray-500')}
            style={{ fontSize:12, marginBottom:10 }}>
            Stories crafted by our community
          </p>

          {/* Compact search bar */}
          <div className="mx-auto" style={{ maxWidth:200 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className={'glass-input w-full text-center '
                + (L ? '' : 'bg-white/5 border-white/8')}
              style={{ borderRadius:9, fontSize:12, padding:'5px 12px' }}/>
          </div>
        </div>

        {/* ── Grid — 6 cols PC, 2 cols mobile ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {loading ? (
            <p className={'text-center py-16 font-inter text-sm animate-pulse '
              + (L ? 'text-gray-400' : 'text-gray-600')}>
              Loading magazines…
            </p>
          ) : error ? (
            <p className="text-center py-16 font-inter text-sm text-red-400">{error}</p>
          ) : filtered.length === 0 ? (
            <div className={'py-20 text-center rounded-2xl border '
              + (L ? 'border-black/7 bg-white/40' : 'border-white/7 bg-white/[0.02]')}>
              <p className="text-5xl mb-3">📖</p>
              <p className={'font-inter font-semibold ' + (L ? 'text-gray-700' : 'text-gray-300')}>
                {search ? 'No magazines match your search.' : 'No published magazines yet.'}
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-6"
              style={{ gap:'28px 14px' }}>
              {filtered.map(mag => {
                const tpl = getTemplateById(mag.templateId)
                if (!tpl) return null
                return (
                  <BookCard
                    key={mag._id}
                    mag={mag}
                    tpl={tpl}
                    onClick={() => setViewing(mag)}/>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
