import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastCtx = createContext({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

// ── Type config ───────────────────────────────────────────────────────────────
const CFG = {
  success: {
    accent:   '#10b981',
    accentDim:'rgba(16,185,129,0.12)',
    glow:     'rgba(16,185,129,0.35)',
    border:   'rgba(16,185,129,0.25)',
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  error: {
    accent:   '#ef4444',
    accentDim:'rgba(239,68,68,0.12)',
    glow:     'rgba(239,68,68,0.35)',
    border:   'rgba(239,68,68,0.25)',
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  },
  loading: {
    accent:   '#3b82f6',
    accentDim:'rgba(59,130,246,0.12)',
    glow:     'rgba(59,130,246,0.35)',
    border:   'rgba(59,130,246,0.25)',
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5}
        style={{ animation:'toast-spin 0.7s linear infinite' }}>
        <circle cx="12" cy="12" r="9" strokeOpacity={0.2}/>
        <path d="M12 3a9 9 0 0 1 9 9"/>
      </svg>
    ),
  },
  info: {
    accent:   '#a78bfa',
    accentDim:'rgba(167,139,250,0.12)',
    glow:     'rgba(167,139,250,0.35)',
    border:   'rgba(167,139,250,0.25)',
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="16" r="0.7" fill="#a78bfa"/>
      </svg>
    ),
  },
}

// ── Toast card ────────────────────────────────────────────────────────────────
function ToastItem({ t, onDismiss }) {
  const c = CFG[t.type] || CFG.info

  return (
    <div
      className="toast-item"
      style={{
        /* Glass card */
        background: `linear-gradient(135deg, rgba(28,28,36,0.82) 0%, rgba(18,18,24,0.92) 100%)`,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderRadius: 24,
        border: `1px solid ${c.border}`,
        boxShadow: [
          /* Neomorphic outer glow */
          `0 0 0 1px rgba(255,255,255,0.06)`,
          `0 32px 64px rgba(0,0,0,0.6)`,
          `0 16px 32px rgba(0,0,0,0.4)`,
          `0 4px 12px rgba(0,0,0,0.3)`,
          /* Inset top highlight */
          `inset 0 1px 0 rgba(255,255,255,0.12)`,
          `inset 0 -1px 0 rgba(0,0,0,0.3)`,
          /* Colored type glow */
          `0 0 60px ${c.glow}`,
          `0 0 120px ${c.glow.replace('0.35','0.12')}`,
        ].join(', '),

        /* Layout */
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '20px 22px 20px 20px',
        minWidth: 'min(380px, calc(100vw - 40px))',
        maxWidth: 'min(460px, calc(100vw - 32px))',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        willChange: 'transform, opacity',
      }}
    >
      {/* Top glass sheen */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
        borderRadius: '24px 24px 0 0',
        pointerEvents: 'none',
      }}/>

      {/* Left accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${c.accent}, ${c.accent}55)`,
        borderRadius: '24px 0 0 24px',
        boxShadow: `2px 0 12px ${c.glow}`,
      }}/>

      {/* Progress bar */}
      {t.duration > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 4, right: 0, height: 2,
          background: `linear-gradient(90deg, ${c.accent}, ${c.accent}22)`,
          transformOrigin: 'left center',
          borderRadius: '0 0 24px 0',
          animation: `toast-progress ${t.duration}ms linear forwards`,
        }}/>
      )}

      {/* Icon bubble */}
      <div style={{
        flexShrink: 0,
        width: 50, height: 50,
        borderRadius: 16,
        background: `linear-gradient(135deg, ${c.accentDim}, rgba(0,0,0,0.2))`,
        border: `1px solid ${c.border}`,
        boxShadow: [
          `inset 0 1px 0 rgba(255,255,255,0.1)`,
          `0 4px 16px ${c.glow}`,
          `0 0 24px ${c.accentDim}`,
        ].join(', '),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
      }}>
        {c.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#f8f8fa',
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
          }}>
            {t.title}
          </p>
        )}
        {t.message && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            color: 'rgba(255,255,255,0.48)',
            margin: t.title ? '4px 0 0' : 0,
            lineHeight: 1.5,
            fontWeight: 400,
          }}>
            {t.message}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(t.id) }}
        style={{
          flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.3)',
          width: 28, height: 28,
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
          fontSize: 11,
          transition: 'all 0.15s ease',
          marginLeft: 4,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(({
    type     = 'info',
    title,
    message,
    duration = 1500,
  } = {}) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, duration }])
    if (duration > 0) timers.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  toast.success = (title, message, opts) => toast({ type:'success', title, message, ...opts })
  toast.error   = (title, message, opts) => toast({ type:'error',   title, message, ...opts })
  toast.loading = (title, message, opts) => toast({ type:'loading', title, message, duration:0, ...opts })
  toast.info    = (title, message, opts) => toast({ type:'info',    title, message, ...opts })
  toast.dismiss = dismiss

  const visible = toasts.length > 0

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {createPortal(
        <>
          {/* Blur scrim — blurs entire page behind the toast */}
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            backdropFilter: visible ? 'blur(8px) brightness(0.6)' : 'none',
            WebkitBackdropFilter: visible ? 'blur(8px) brightness(0.6)' : 'none',
            background: visible ? 'rgba(0,0,0,0.35)' : 'transparent',
            pointerEvents: 'none',
            transition: 'backdrop-filter 0.25s ease, background 0.25s ease',
          }}/>

          {/* Toast stack — centered in dashboard content area */}
          <div
            className="toast-container"
            style={{ pointerEvents: visible ? 'auto' : 'none' }}
          >
            {toasts.map(t => (
              <ToastItem key={t.id} t={t} onDismiss={dismiss} />
            ))}
          </div>
        </>,
        document.body
      )}
    </ToastCtx.Provider>
  )
}
