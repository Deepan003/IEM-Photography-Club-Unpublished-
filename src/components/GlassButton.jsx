import { useState, useCallback, useRef } from 'react'

/**
 * GlassButton — iOS-style glass button with JavaScript-driven full glow on press.
 *
 * Why JS and not CSS :active?
 * On desktop, :active is only held while the mouse button is down. A fast click
 * (< 80ms) removes :active before the animation even starts. JS mousedown/touchstart
 * triggers the glow on press and guarantees it plays for the full duration.
 *
 * variants: 'default' | 'red' | 'light' | 'pill-red' | 'pill-light'
 */
export default function GlassButton({
  children,
  variant = 'default',
  className = '',
  style = {},
  disabled = false,
  onClick,
  type = 'button',
  ...rest
}) {
  const [glowing, setGlowing] = useState(false)
  const timerRef = useRef(null)

  const handlePress = useCallback((e) => {
    if (disabled) return
    // Reset in case of rapid taps
    clearTimeout(timerRef.current)
    setGlowing(false)
    // Next frame: set glowing so React re-mounts the overlay (re-triggers animation)
    requestAnimationFrame(() => {
      setGlowing(true)
      timerRef.current = setTimeout(() => setGlowing(false), 400)
    })
  }, [disabled])

  const variantClass = {
    default:      'glass-btn',
    red:          'glass-btn glass-btn-red',
    light:        'glass-btn glass-btn-light',
    'pill-red':   'glass-btn glass-btn-red glass-pill',
    'pill-light': 'glass-btn glass-btn-light glass-pill',
  }[variant] ?? 'glass-btn'

  // Glow colour matches button accent colour
  const glowColor = variant.includes('red')
    ? 'rgba(255,100,100,0.72)'
    : 'rgba(255,255,255,0.62)'

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={handlePress}
      onTouchStart={handlePress}
      className={`${variantClass} ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      style={style}
      {...rest}
    >
      {/* Full-button glow overlay — above background, below content */}
      {glowing && (
        <span
          key={Date.now()}           /* force remount so animation restarts on rapid clicks */
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 'inherit',
            background: glowColor,
            animation: 'btnGlow 0.38s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
            zIndex: 1,
          }}
        />
      )}
      {/* Content stays above glow */}
      <span className="relative inline-flex items-center justify-center gap-[inherit] w-full" style={{ zIndex: 2 }}>
        {children}
      </span>
    </button>
  )
}
