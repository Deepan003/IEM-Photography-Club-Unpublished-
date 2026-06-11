import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { magazineApi } from '../api/api.js'
import { getTemplateById } from '../components/magazine/templates.js'
import TemplatePage from '../components/magazine/TemplatePage.jsx'
import MagazineViewer from '../components/magazine/MagazineViewer.jsx'

const PAGE_W = 420
const PAGE_H = 560

// ── Live magazine cover — scales TemplatePage to fit ─────────────────────────
function MagCover({ magazine, size = 280 }) {
  const tpl = getTemplateById(magazine?.templateId)
  const page = magazine?.pages?.[0]
  if (!tpl) return null

  const h = Math.round(size * PAGE_H / PAGE_W)
  const sc = size / PAGE_W

  return (
    <div style={{
      width: size, height: h, borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 8px 24px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
    }}>
      <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left',
                    width: PAGE_W, height: PAGE_H }}>
        <TemplatePage template={tpl} layoutId={page?.layoutId || tpl.pages[0]}
          pageData={page} editMode={false} showSamples={false}
          width={PAGE_W} height={PAGE_H}/>
      </div>
    </div>
  )
}

// ── Not found ─────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#050508', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, fontFamily: 'system-ui,sans-serif', padding: 24, textAlign: 'center',
    }}>
      <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club"
        style={{ width: 60, height: 60, borderRadius: '50%',
                 boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}/>
      <div>
        <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Magazine not available
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
          This magazine has been removed or is no longer published.
        </p>
      </div>
      <a href="/" style={{
        padding: '10px 24px', borderRadius: 10, textDecoration: 'none',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
      }}>
        Visit IEM Photography Club
      </a>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MagazinePublicPage() {
  const { id } = useParams()
  const [magazine, setMagazine] = useState(null)
  const [status,   setStatus]   = useState('loading')   // 'loading' | 'ok' | 'error'
  const [viewing,  setViewing]  = useState(false)
  const [copied,   setCopied]   = useState(false)

  // Responsive cover size
  const coverSize = typeof window !== 'undefined'
    ? Math.min(Math.round(window.innerWidth * 0.55), 300)
    : 260

  useEffect(() => {
    magazineApi.getPublic(id)
      .then(d => {
        const mag = d.magazine
        setMagazine(mag)
        setStatus('ok')
        // Dynamic meta tags for OG / share preview
        const name   = mag?.name || 'Magazine'
        const author = mag?.user?.name || 'IEM Photography Club'
        document.title = `${name} — IEM Photography Club`
        setMeta('og:title',       `${name} — IEM Photography Club`)
        setMeta('og:description', `A magazine by ${author} · IEM Photography Club`)
        setMeta('og:url',         window.location.href)
        setMeta('og:type',        'article')
        setMeta('twitter:card',   'summary_large_image')
        if (mag?.thumbnailUrl) {
          setMeta('og:image',      mag.thumbnailUrl)
          setMeta('twitter:image', mag.thumbnailUrl)
        }
      })
      .catch(() => setStatus('error'))
  }, [id]) // eslint-disable-line

  if (status === 'error') return <NotFound/>

  // ── Full-screen viewer ───────────────────────────────────────────────────────
  if (viewing && magazine) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050508',
                    display: 'flex', flexDirection: 'column' }}>
        {/* Branded viewer header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', flexShrink: 0,
          background: 'rgba(5,5,8,0.9)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club"
            style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {magazine.name || 'Magazine'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: 0 }}>
              IEM Photography Club
            </p>
          </div>
          <button onClick={() => setViewing(false)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
              padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
            }}>
            ✕ Close
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MagazineViewer magazine={magazine} onClose={() => setViewing(false)} isPublicView/>
        </div>
      </div>
    )
  }

  // ── Cover landing ────────────────────────────────────────────────────────────
  const author    = magazine?.user?.name || 'IEM Photography Club'
  const pages     = magazine?.pages || []
  const pageCount = pages.length

  return (
    <div style={{
      minHeight: '100dvh', background: '#050508',
      fontFamily: 'system-ui,-apple-system,sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Top bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      }}>
        <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club"
          style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                   boxShadow: '0 2px 12px rgba(220,38,38,0.35)' }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            IEM Photography Club
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: 0 }}>
            Institute of Engineering &amp; Management
          </p>
        </div>
        <a href="/" style={{
          textDecoration: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600,
          padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          Visit Website
        </a>
      </header>

      {/* ── Main content: cover + info side by side on desktop, stacked on mobile ── */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}>
        {status === 'loading' ? (
          /* Minimal spinner — no heavy skeleton */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.08)',
              borderTopColor: '#dc2626',
              animation: 'spin 0.8s linear infinite',
            }}/>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 28, width: '100%', maxWidth: 560,
            animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1)',
          }}>

            {/* Cover */}
            <MagCover magazine={magazine} size={coverSize}/>

            {/* Info block */}
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h1 style={{
                color: '#fff', margin: '0 0 8px',
                fontSize: 'clamp(20px, 5vw, 30px)', fontWeight: 800, lineHeight: 1.2,
              }}>
                {magazine?.name || 'Untitled Magazine'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 4px' }}>
                By <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{author}</span>
              </p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, margin: '0 0 24px' }}>
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                {magazine?.publishedAt &&
                  ` · Published ${new Date(magazine.publishedAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}`}
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setViewing(true)} style={{
                  padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                  color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.03em',
                  boxShadow: '0 6px 20px rgba(220,38,38,0.4)', transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(220,38,38,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 6px 20px rgba(220,38,38,0.4)' }}>
                  📖 Read Magazine
                </button>

                {/* Copy share link */}
                <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                  style={{
                    padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${copied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                    color: copied ? '#4ade80' : 'rgba(255,255,255,0.6)',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                  }}>
                  {copied ? (
                    <><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Link Copied!</>
                  ) : (
                    <><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px', textAlign: 'center', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club"
            style={{ width: 18, height: 18, borderRadius: '50%', opacity: 0.6 }}/>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600,
                         letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            IEM Photography Club
          </span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10, margin: 0 }}>
          All rights reserved · Institute of Engineering &amp; Management
        </p>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px) }
          to   { opacity:1; transform:none }
        }
      `}</style>
    </div>
  )
}

function setMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`)
             || document.querySelector(`meta[name="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(property.startsWith('twitter') ? 'name' : 'property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
