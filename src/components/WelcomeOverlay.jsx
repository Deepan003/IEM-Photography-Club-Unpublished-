import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

const IcCamera = () => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
    <circle cx="12" cy="13" r="1.5" fill="rgba(248,113,113,0.35)" stroke="none" />
  </svg>
)

const bullets = [
  {
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    text: 'We expect great dedication and creativity from you.',
  },
  {
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    text: 'Show up, contribute, and grow alongside your fellow members.',
  },
  {
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    text: 'Your lens has a story to tell — make every shot count.',
  },
]

export default function WelcomeOverlay({ user, onClose }) {
  const [out, setOut] = useState(false)

  const dismiss = () => {
    localStorage.setItem(`welcome_seen_${user._id}`, '1')
    setOut(true)
    setTimeout(onClose, 380)
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const firstName = user.name?.split(' ')[0] || 'there'

  return createPortal(
    <div
      className={`fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-3 sm:p-6 welcome-wl-root ${out ? 'welcome-wl-out' : ''}`}
      style={{ background: 'rgba(3,1,7,0.86)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="absolute inset-0" onClick={dismiss} />

      <div className="relative w-full max-w-md welcome-wl-card">

        {/* X button */}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute -top-3 -right-1 sm:-right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(18,8,22,0.96)', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 4px 18px rgba(0,0,0,0.55)' }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="rgba(200,195,215,0.85)" strokeWidth={2.6} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center absolute -top-8 left-0 right-0">
          <div className="w-9 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Card */}
        <div
          className="auth-glass rounded-t-3xl sm:rounded-3xl overflow-hidden relative"
          style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(220,38,38,0.07) inset', maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Top red accent line */}
          <div style={{ height: 3, flexShrink: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.0) 5%, rgba(220,38,38,0.85) 25%, rgba(248,113,113,1) 50%, rgba(220,38,38,0.85) 75%, rgba(220,38,38,0.0) 95%, transparent 100%)' }} />

          {/* Blobs */}
          <div style={{ position: 'absolute', width: 260, height: 260, top: -80, right: -70, background: 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 65%)', borderRadius: '60% 40% 30% 70%/60% 30% 70% 40%', pointerEvents: 'none', zIndex: 0, animation: 'wl-blob1 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 190, height: 190, bottom: -50, left: -40, background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 65%)', borderRadius: '40% 60% 70% 30%/50% 60% 40% 50%', pointerEvents: 'none', zIndex: 0, animation: 'wl-blob2 11s ease-in-out infinite' }} />

          <div className="relative px-5 sm:px-7 pt-6 sm:pt-8 pb-6 sm:pb-8 z-[1]">

            {/* Camera icon */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.28)', boxShadow: '0 0 36px rgba(220,38,38,0.2)', animation: 'wl-icon-pulse 3s ease-in-out infinite' }} />
                <IcCamera />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-4 sm:mb-6 space-y-1.5">
              <p className="font-inter text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgba(248,113,113,0.6)' }}>
                Welcome to the
              </p>
              <h2 className="font-clash font-black text-white leading-[1.1]" style={{ fontSize: 'clamp(21px, 5vw, 26px)', letterSpacing: '-0.01em' }}>
                IEM Photography Club
              </h2>
              <p className="font-inter text-[13px] sm:text-sm leading-relaxed pt-0.5" style={{ color: 'rgba(180,175,200,0.85)' }}>
                Hey <span className="font-semibold text-white">{firstName}</span> — glad to have you with us.
              </p>
            </div>

            {/* Divider */}
            <div className="mb-4 sm:mb-5" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* Bullets */}
            <div className="space-y-2.5 sm:space-y-3">
              {bullets.map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3 px-3 sm:px-3.5 py-2.5 sm:py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.055)' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.22)' }}>
                    {icon}
                  </div>
                  <p className="font-inter text-[12px] sm:text-[13px] leading-relaxed" style={{ color: 'rgba(200,196,215,0.9)' }}>{text}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={dismiss}
              className="mt-5 sm:mt-6 w-full py-3 sm:py-3.5 rounded-2xl font-inter font-bold text-sm text-white transition-all active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.92) 0%, rgba(180,24,24,0.97) 100%)', boxShadow: '0 6px 24px rgba(220,38,38,0.28), inset 0 1px 0 rgba(255,255,255,0.14)', border: '1px solid rgba(220,38,38,0.5)', letterSpacing: '0.02em' }}
            >
              <span>Let&apos;s Go</span>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <p className="text-center font-inter text-[10px] mt-2.5 hidden sm:block" style={{ color: 'rgba(110,105,130,0.65)' }}>
              Press Esc or click outside to dismiss
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .welcome-wl-root  { animation: wl-bg-in   0.38s ease-out both; }
        .welcome-wl-card  { animation: wl-card-in  0.46s cubic-bezier(0.34,1.56,0.64,1) 0.06s both; }
        .welcome-wl-out   { animation: wl-bg-out   0.34s ease-in forwards !important; }
        .welcome-wl-out .welcome-wl-card { animation: wl-card-out 0.28s ease-in forwards !important; }

        @media (max-width: 639px) {
          .welcome-wl-card  { animation: wl-card-in-m  0.44s cubic-bezier(0.34,1.56,0.64,1) 0.06s both; }
          .welcome-wl-out .welcome-wl-card { animation: wl-card-out-m 0.26s ease-in forwards !important; }
        }

        @keyframes wl-bg-in      { from { opacity:0 } to { opacity:1 } }
        @keyframes wl-bg-out     { from { opacity:1 } to { opacity:0 } }
        @keyframes wl-card-in    { from { opacity:0; transform:scale(0.88) translateY(18px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes wl-card-out   { from { opacity:1; transform:scale(1) translateY(0) }       to { opacity:0; transform:scale(0.93) translateY(12px) } }
        @keyframes wl-card-in-m  { from { opacity:0; transform:translateY(40px) }             to { opacity:1; transform:translateY(0) } }
        @keyframes wl-card-out-m { from { opacity:1; transform:translateY(0) }                to { opacity:0; transform:translateY(30px) } }
        @keyframes wl-blob1      { 0%,100% { transform:scale(1) rotate(0deg) } 50% { transform:scale(1.08) rotate(6deg) } }
        @keyframes wl-blob2      { 0%,100% { transform:scale(1) rotate(0deg) } 50% { transform:scale(1.06) rotate(-8deg) } }
        @keyframes wl-icon-pulse { 0%,100% { box-shadow:0 0 26px rgba(220,38,38,0.18) } 50% { box-shadow:0 0 42px rgba(220,38,38,0.36) } }
      `}</style>
    </div>,
    document.body
  )
}
