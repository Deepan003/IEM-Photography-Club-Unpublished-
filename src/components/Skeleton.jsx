// Skeleton shimmer primitives for loading states.
// Usage:
//   <Skeleton w="100%" h={20} r={8} />           — single bar
//   <SkeletonCard />                              — generic card block
//   <SkeletonList n={4} />                        — list of rows
//   <SkeletonGrid n={6} />                        — grid of cards (activities, events…)

function Sk({ w = '100%', h = 14, r = 6, className = '', style }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }}
    />
  )
}

export default Sk

// ── Card skeleton (generic glass card shape) ──────────────────────────────────
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`auth-glass rounded-2xl border border-white/5 p-4 space-y-3 ${className}`}>
      <Sk w="55%" h={14} r={7} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Sk key={i} w={i % 2 === 0 ? '80%' : '65%'} h={11} r={5} />
      ))}
    </div>
  )
}

// ── Row list skeleton (announcements, members…) ───────────────────────────────
export function SkeletonList({ n = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="auth-glass rounded-xl border border-white/5 px-4 py-3 flex items-center gap-3">
          <Sk w={36} h={36} r={18} style={{ flexShrink: 0 }} />
          <div className="flex-1 space-y-2">
            <Sk w="50%" h={12} r={5} />
            <Sk w="30%" h={10} r={4} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Grid skeleton (event/activity/competition cards) ─────────────────────────
export function SkeletonGrid({ n = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="auth-glass rounded-2xl border border-white/5 overflow-hidden">
          <Sk w="100%" h={140} r={0} />
          <div className="p-3 space-y-2">
            <Sk w="65%" h={13} r={5} />
            <Sk w="40%" h={10} r={4} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Profile header skeleton ───────────────────────────────────────────────────
export function SkeletonProfile({ className = '' }) {
  return (
    <div className={`space-y-5 ${className}`}>
      {/* avatar + name row */}
      <div className="flex items-center gap-4">
        <Sk w={72} h={72} r={36} />
        <div className="space-y-2 flex-1">
          <Sk w="45%" h={16} r={7} />
          <Sk w="30%" h={11} r={5} />
        </div>
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </div>
  )
}

// ── Photo grid skeleton (Postcards / Club Gallery) ────────────────────────────
export function SkeletonPhotoGrid({ n = 8, ratio = '4/5', className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton-shimmer rounded-2xl" style={{ aspectRatio: ratio }} />
      ))}
    </div>
  )
}

// ── Banner card grid skeleton (Events / Competitions / Activities) ─────────────
export function SkeletonCardGrid({ n = 8, ratio = '16/9', className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="auth-glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="skeleton-shimmer" style={{ aspectRatio: ratio }} />
          <div className="p-3 sm:p-3.5 space-y-2">
            <div className="skeleton-shimmer rounded-lg" style={{ height: 13, width: '72%' }} />
            <div className="skeleton-shimmer rounded" style={{ height: 10, width: '48%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Masonry skeleton (Club Gallery) ──────────────────────────────────────────
export function SkeletonMasonryGrid({ n = 9, className = '' }) {
  const H = [195, 275, 215, 315, 175, 255, 235, 295, 205]
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-1 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton-shimmer rounded-xl" style={{ height: H[i % H.length] }} />
      ))}
    </div>
  )
}

// ── Book / magazine grid skeleton ─────────────────────────────────────────────
export function SkeletonBookGrid({ n = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton-shimmer rounded-xl" style={{ aspectRatio: '3/4' }} />
      ))}
    </div>
  )
}

// ── Feed post skeleton (social post card shape) ───────────────────────────────
export function SkeletonFeedPost({ n = 3, L = false, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`auth-glass rounded-3xl overflow-hidden border ${L ? 'border-black/8' : 'border-white/8'}`}>
          {/* Header: avatar + name/time */}
          <div className="p-3 flex gap-2.5">
            <Sk w={36} h={36} r={18} style={{ flexShrink: 0 }} />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Sk w="40%" h={11} r={5} />
              <Sk w="25%" h={9} r={4} />
            </div>
          </div>
          {/* Square image placeholder */}
          <Sk w="100%" h={280} r={0} />
          {/* Footer: likes + caption */}
          <div className="p-4 space-y-2">
            <Sk w="18%" h={11} r={5} />
            <Sk w="65%" h={10} r={4} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`auth-glass rounded-2xl border border-white/5 overflow-hidden ${className}`}>
      {/* header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-white/5">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} w={`${100 / cols}%`} h={10} r={4} />
        ))}
      </div>
      {/* data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-white/5 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Sk key={j} w={j === 0 ? '40%' : `${60 / (cols - 1)}%`} h={11} r={4} />
          ))}
        </div>
      ))}
    </div>
  )
}
