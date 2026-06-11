import { useState, useEffect, useRef } from 'react'

const EASING = 'cubic-bezier(0.22,1,0.36,1)'

const VARIANTS = {
  up:    { from: 'opacity:0;transform:translateY(32px)',  to: 'opacity:1;transform:translateY(0)' },
  down:  { from: 'opacity:0;transform:translateY(-24px)', to: 'opacity:1;transform:translateY(0)' },
  left:  { from: 'opacity:0;transform:translateX(-28px)', to: 'opacity:1;transform:translateX(0)' },
  right: { from: 'opacity:0;transform:translateX(28px)',  to: 'opacity:1;transform:translateX(0)' },
  scale: { from: 'opacity:0;transform:scale(0.94)',       to: 'opacity:1;transform:scale(1)' },
  fade:  { from: 'opacity:0',                             to: 'opacity:1' },
}

function parseStyle(str) {
  return Object.fromEntries(str.split(';').filter(Boolean).map(p => {
    const [k, ...v] = p.trim().split(':')
    return [k.trim(), v.join(':').trim()]
  }))
}

export default function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  variant = 'up',
  duration = 680,
  threshold = 0.07,
  margin = '0px 0px -36px 0px',
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Already in viewport — trigger immediately, no delay
    if (el.getBoundingClientRect().top < window.innerHeight * 0.98) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el) } },
      { threshold, rootMargin: margin }
    )
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [])

  const v = VARIANTS[variant] || VARIANTS.up
  const fromStyle = parseStyle(v.from)
  const toStyle   = parseStyle(v.to)

  const current = visible ? toStyle : fromStyle
  const hasTransform = v.from.includes('transform')

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...current,
        transition: visible
          ? [
              `opacity ${duration}ms ${EASING} ${delay}ms`,
              hasTransform ? `transform ${duration}ms ${EASING} ${delay}ms` : '',
            ].filter(Boolean).join(', ')
          : 'none',
        willChange: visible ? 'auto' : (hasTransform ? 'opacity, transform' : 'opacity'),
      }}
    >
      {children}
    </div>
  )
}
