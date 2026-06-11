import { createPortal } from 'react-dom'

export default function DownloadingOverlay({ visible, message }) {
  if (!visible) return null

  const isError = typeof message === 'string' && message.startsWith('✗')

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'dl-backdrop-in 0.22s ease-out',
    }}>
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }} />

      {/* Glass card */}
      <div style={{
        position: 'relative', width: 296,
        padding: '38px 30px 32px',
        borderRadius: 28, overflow: 'hidden',
        background: 'rgba(10,3,16,0.9)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 0 0 1px rgba(220,38,38,0.08) inset, 0 32px 96px rgba(0,0,0,0.9)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
        animation: 'dl-card-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Morphing blobs */}
        <div style={{
          position: 'absolute', width: 220, height: 220, top: -70, left: -70,
          background: 'radial-gradient(circle, rgba(220,38,38,0.28) 0%, transparent 65%)',
          animation: 'dl-blob-1 5s ease-in-out infinite',
          borderRadius: '60% 40% 30% 70%/60% 30% 70% 40%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 170, height: 170, top: 10, right: -55,
          background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 65%)',
          animation: 'dl-blob-2 7s ease-in-out infinite',
          borderRadius: '30% 70% 60% 40%/50% 40% 70% 50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 190, height: 190, bottom: -55, right: -20,
          background: 'radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 65%)',
          animation: 'dl-blob-3 6.5s ease-in-out infinite',
          borderRadius: '50% 60% 30% 70%/40% 60% 50% 60%',
          pointerEvents: 'none',
        }} />

        {/* Shimmer highlight on glass edge */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Icon box */}
        <div style={{
          width: 68, height: 68, borderRadius: 20, flexShrink: 0,
          background: 'rgba(220,38,38,0.1)',
          border: '1px solid rgba(220,38,38,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'dl-icon-glow 2.2s ease-in-out infinite',
          zIndex: 1,
        }}>
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none"
            stroke={isError ? '#f87171' : '#f87171'} strokeWidth={1.7}
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <g style={{ animation: 'dl-arrow-drop 1.1s ease-in-out infinite' }}>
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </g>
          </svg>
        </div>

        {/* Text block */}
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <p style={{
            fontFamily: "'Clash Display', 'Inter', sans-serif",
            fontSize: 21, fontWeight: 600, color: '#fff',
            letterSpacing: '0.01em', lineHeight: 1.25,
          }}>
            Downloading
            <span style={{ display: 'inline-block', letterSpacing: 1 }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <span key={i} style={{
                  animation: `dl-dot 1.4s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                  opacity: 0.2,
                  display: 'inline-block',
                }}>.</span>
              ))}
            </span>
          </p>

          {message && (
            <p key={message} style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12, color: isError ? 'rgba(248,113,113,0.9)' : 'rgba(160,155,178,1)',
              marginTop: 8,
              animation: 'dl-fade-in 0.25s ease-out',
              letterSpacing: '0.01em',
              lineHeight: 1.5,
              maxWidth: 220,
            }}>
              {message}
            </p>
          )}
        </div>

        {/* Liquid progress bar */}
        <div style={{
          width: '100%', height: 2.5, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden', zIndex: 1,
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, rgba(220,38,38,0) 0%, rgba(220,38,38,0.9) 20%, rgba(124,58,237,0.7) 50%, rgba(220,38,38,0.9) 80%, rgba(220,38,38,0) 100%)',
            backgroundSize: '300% 100%',
            animation: 'dl-wave 2.2s linear infinite',
          }} />
        </div>
      </div>
    </div>,
    document.body
  )
}
