import { useState, useEffect, useRef } from 'react'

// ── Wave layers ───────────────────────────────────────────────────────────────
// Returns two clip-path polygons:
//   poly1 — the solid fill (bottom of image up to the main wave)
//   poly2 — a semi-transparent crest strip sitting just above the main wave,
//            giving a second wave layer that oscillates independently
function computeWaveLayers(fillPct, phase) {
  const waterline = 100 - fillPct

  // Main wave — large, dramatic
  const a1 = 5.0, a2 = 2.4
  // Upper crest — sits above the main wave, slightly different phase
  const crестOffset = 4.5   // % above waterline
  const b1 = 3.5, b2 = 1.8

  const N = 28
  const w1 = [], w2 = []

  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = +(t * 100).toFixed(1)

    const y1 = waterline
      + a1 * Math.sin(4 * Math.PI * t + phase)
      + a2 * Math.sin(7 * Math.PI * t + phase * 1.5 + 1.1)

    const y2 = (waterline - crестOffset)
      + b1 * Math.sin(4 * Math.PI * t + phase + 0.9)
      + b2 * Math.sin(7 * Math.PI * t + phase * 1.5 + 2.4)

    w1.push([x, Math.min(112, Math.max(-12, y1))])
    w2.push([x, Math.min(112, Math.max(-12, y2))])
  }

  const fmt = ([x, y]) => `${x}% ${y.toFixed(2)}%`

  // Polygon 1: solid body — covers from bottom up to main wave
  const poly1 = `polygon(0% 100%, ${w1.map(fmt).join(', ')}, 100% 100%)`

  // Polygon 2: crest strip — between upper wave and main wave
  // (forward along w2, backward along w1)
  const fwd = w2.map(fmt).join(', ')
  const bwd = [...w1].reverse().map(fmt).join(', ')
  const poly2 = `polygon(${fwd}, ${bwd})`

  return { poly1, poly2 }
}

// ── Liquid Fill Loader ────────────────────────────────────────────────────────
// Used by ImageUpload.jsx for upload progress. A true bottom-up liquid fill:
// the body rises with progress, two offset wave crests ripple across the surface,
// bubbles drift upward, and a live percentage sits in the centre.
//
// Seamless wave: the SVG path repeats its shape every 600 units across a
// 1200-wide viewBox, so translating it by -50% loops with no visible seam.
const WAVE_PATH = 'M0,30 C150,4 450,4 600,30 C750,4 1050,4 1200,30 L1200,60 L0,60 Z'

export function LiquidLoader({ progress = 40, label = null }) {
  const fillPct = Math.max(0, Math.min(100, progress))
  const shown   = Math.round(fillPct)
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #060610 0%, #0d0d1c 100%)' }}
    >
      {/* Rising bubbles — sit behind the liquid body, drift upward */}
      {[12, 28, 46, 63, 80, 91].map((leftPct, i) => (
        <span key={i} style={{
          position: 'absolute', bottom: '-8%', left: `${leftPct}%`,
          width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
          borderRadius: '50%', background: 'rgba(255,180,180,0.45)',
          animation: `liq-bubble ${3 + (i % 4) * 0.7}s ease-in ${i * 0.45}s infinite`,
          opacity: fillPct > 4 ? 1 : 0,
        }} />
      ))}

      {/* Liquid body — height tracks progress */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: `${fillPct}%`,
        background: 'linear-gradient(180deg, rgba(220,38,38,0.70) 0%, rgba(165,14,14,0.90) 55%, rgba(110,6,6,0.95) 100%)',
        transition: 'height 0.45s cubic-bezier(0.25,0.46,0.45,0.94)',
        boxShadow: 'inset 0 8px 18px rgba(255,90,90,0.12)',
      }}>
        {/* Back wave — slower, darker shadow layer */}
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: -32, width: '200%', height: 42,
            animation: 'liq-wave 4.4s linear infinite' }}>
          <path d={WAVE_PATH} fill="rgba(185,18,18,0.82)" />
        </svg>
        {/* Front wave — faster, bright highlight edge */}
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: -26, width: '200%', height: 42,
            animation: 'liq-wave 2.8s linear infinite reverse' }}>
          <path d={WAVE_PATH} fill="rgba(248,80,80,0.97)" />
        </svg>
      </div>

      {/* Diagonal shimmer sweep across the whole well */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(108deg, transparent 18%, rgba(255,255,255,0.06) 50%, transparent 82%)',
        animation: 'liq-shimmer 2.6s ease-in-out infinite',
      }} />

      {/* Vignette for depth */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Centre readout — percentage + optional label */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2, pointerEvents: 'none' }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 800,
          color: 'rgba(255,255,255,0.92)', letterSpacing: '0.02em',
          textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}>
          {shown}%
        </span>
        {label && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 600,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Error placeholder ─────────────────────────────────────────────────────────
function ErrorPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#06060e' }}>
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.4}>
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
  )
}

// ── ProgressiveImage ──────────────────────────────────────────────────────────
// Loading phases:
//   1. Downloading  → dark shimmer placeholder
//   2. Pour reveal  → TWO wave layers rise from the bottom: a solid image fill
//                     plus a semi-transparent crest strip that oscillates above it.
//                     The image itself is the liquid. Min 2s before reveal.
//   3. Done         → image fully visible, no clips
//
// masonry=false (default): `absolute inset-0` inside a positioned parent.
// masonry=true: block wrapper that grows to the image's natural height.
export default function ProgressiveImage({
  src,
  alt = '',
  className = '',
  style,
  masonry = false,
  wrapperClassName = '',
  onLoad: extOnLoad,
  ...props
}) {
  // pour: { pct: null|number|'done', poly1: string|null, poly2: string|null }
  const [pour,  setPour]  = useState({ pct: null, poly1: null, poly2: null })
  const [error, setError] = useState(false)
  const startRef = useRef(Date.now())
  const rafRef   = useRef(null)

  useEffect(() => {
    startRef.current = Date.now()
    setPour({ pct: null, poly1: null, poly2: null })
    setError(false)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [src])

  const handleLoad = () => {
    const elapsed  = Date.now() - startRef.current
    const wait     = Math.max(0, 600 - elapsed)   // 600ms max wait (was 2000ms)
    const DURATION = 1200

    setTimeout(() => {
      const pourStart = Date.now()
      const tick = () => {
        const now   = Date.now()
        const pct   = Math.min(100, ((now - pourStart) / DURATION) * 100)
        const phase = now * 0.005
        if (pct < 100) {
          const { poly1, poly2 } = computeWaveLayers(pct, phase)
          setPour({ pct, poly1, poly2 })
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setPour({ pct: 'done', poly1: null, poly2: null })
          extOnLoad?.()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }, wait)
  }

  const handleError = () => setError(true)

  if (!src) return null

  const isPouring = pour.pct !== null && pour.pct !== 'done'
  const isDone    = pour.pct === 'done'

  // Shared placeholder background — no animation (removed scan sweep)
  const bgStyle = { background: '#07070f' }
  const shimmer = {
    position: 'absolute', inset: 0,
    background: '#08080f',
  }

  // ── Masonry variant ──────────────────────────────────────────────────────
  if (masonry) {
    return (
      <div
        className={`relative block overflow-hidden ${wrapperClassName}`}
        style={{ minHeight: isDone ? 0 : 80, ...(!isDone ? bgStyle : {}) }}
      >
        {!isDone && !error && <div style={{ ...shimmer, minHeight: 80 }} />}
        {error && <ErrorPlaceholder />}

        {/* Layer 1: solid fill */}
        <img
          src={src} alt={alt}
          className={`block w-full ${className}`}
          style={{
            ...style,
            height: 'auto',
            visibility: isDone || isPouring ? 'visible' : 'hidden',
            clipPath: pour.poly1 ?? undefined,
          }}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />

        {/* Layer 2: translucent crest strip */}
        {isPouring && pour.poly2 && (
          <img
            src={src} alt="" aria-hidden="true"
            className="block w-full"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              clipPath: pour.poly2,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    )
  }

  // ── Fixed-fill variant (default) ─────────────────────────────────────────
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${wrapperClassName}`}
      style={!isDone ? bgStyle : undefined}
    >
      {!isDone && !error && <div style={shimmer} />}
      {error && <ErrorPlaceholder />}

      {/* Layer 1: solid fill */}
      <img
        src={src} alt={alt}
        className={className}
        style={{
          ...style,
          visibility: isDone || isPouring ? 'visible' : 'hidden',
          clipPath: pour.poly1 ?? undefined,
        }}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />

      {/* Layer 2: translucent crest strip */}
      {isPouring && pour.poly2 && (
        <img
          src={src} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            clipPath: pour.poly2,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
