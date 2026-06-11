import { useEffect, useState } from 'react'

/**
 * Minimal neomorphic login success screen.
 * Fast: 1.8s total. Smooth fade-in → brief hold → fade-out → onDone().
 * No useNavigate — navigation handled externally via onDone().
 */
export default function LoginSuccess({ user, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Frame 1: mount invisible, then fade in
    const t0 = requestAnimationFrame(() => setVisible(true))
    // Frame 2: start fade-out at 1.3s
    const t1 = setTimeout(() => setVisible(false), 1300)
    // Frame 3: call onDone at 1.8s (after fade-out completes)
    const t2 = setTimeout(() => onDone?.(), 1800)
    return () => { cancelAnimationFrame(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const initials = user?.name?.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          500,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      '#0f0f0f',
        opacity:         visible ? 1 : 0,
        transform:       visible ? 'scale(1)' : 'scale(1.03)',
        transition:      'opacity 0.42s ease, transform 0.42s ease',
        pointerEvents:   'none',
        userSelect:      'none',
      }}
    >
      {/* Neomorphic card */}
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            '20px',
          padding:        '48px 40px',
          borderRadius:   '28px',
          background:     '#161616',
          boxShadow:      '-8px -8px 20px rgba(255,255,255,0.03), 8px 8px 28px rgba(0,0,0,0.7)',
          minWidth:       '280px',
          opacity:         visible ? 1 : 0,
          transform:       visible ? 'translateY(0)' : 'translateY(12px)',
          transition:     'opacity 0.5s ease 0.1s, transform 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s',
        }}
      >
        {/* Neomorphic checkmark circle */}
        <div
          style={{
            width:       '72px',
            height:      '72px',
            borderRadius:'50%',
            background:  '#161616',
            boxShadow:   '-5px -5px 12px rgba(255,255,255,0.04), 5px 5px 16px rgba(0,0,0,0.8), inset 0 0 0 1.5px rgba(220,38,38,0.35)',
            display:     'flex',
            alignItems:  'center',
            justifyContent:'center',
            opacity:     visible ? 1 : 0,
            transform:   visible ? 'scale(1)' : 'scale(0.7)',
            transition: 'opacity 0.4s ease 0.25s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s',
          }}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <polyline
              points="20 6 9 17 4 12"
              stroke="#dc2626"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: visible ? 0 : 30,
                transition: 'stroke-dashoffset 0.45s ease 0.55s',
              }}
            />
          </svg>
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily:    "'Inter', sans-serif",
              fontSize:      '11px',
              fontWeight:    500,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color:         'rgba(255,255,255,0.3)',
              marginBottom:  '6px',
              opacity:       visible ? 1 : 0,
              transform:     visible ? 'translateY(0)' : 'translateY(8px)',
              transition:    'opacity 0.4s ease 0.4s, transform 0.4s ease 0.4s',
            }}>
            Logged in
          </p>
          <p
            style={{
              fontFamily:  "'Inter', sans-serif",
              fontSize:    '22px',
              fontWeight:  600,
              color:       '#ffffff',
              letterSpacing:'-0.01em',
              opacity:     visible ? 1 : 0,
              transform:   visible ? 'translateY(0)' : 'translateY(8px)',
              transition:  'opacity 0.4s ease 0.48s, transform 0.4s ease 0.48s',
            }}>
            {user?.name?.split(' ')[0]}
          </p>
        </div>

        {/* Thin red progress bar */}
        <div
          style={{
            width:        '100%',
            height:       '2px',
            borderRadius: '2px',
            background:   'rgba(255,255,255,0.06)',
            overflow:     'hidden',
            opacity:      visible ? 1 : 0,
            transition:   'opacity 0.3s ease 0.7s',
          }}
        >
          <div
            style={{
              height:     '100%',
              background: '#dc2626',
              borderRadius: '2px',
              width:       visible ? '100%' : '0%',
              transition:  'width 1s linear 0.8s',
            }}
          />
        </div>
      </div>
    </div>
  )
}
