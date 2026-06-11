import { useState } from 'react'
import { Link }     from 'react-router-dom'

export default function PastMembersBtn() {
  const [pressed, setPressed] = useState(false)

  return (
    <Link
      to="/alumni"
      onMouseDown={() => setPressed(true)}
      onMouseUp={()   => setTimeout(() => setPressed(false), 280)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display:        'inline-flex',
        position:       'relative',
        padding:        '1px',
        borderRadius:   '50px',
        textDecoration: 'none',
        /* Permanent golden border — shown through the 1px padding gap */
        background:     'rgba(188,145,45,0.55)',
        transform:      pressed ? 'scale(0.92)' : 'scale(1)',
        transition:     'transform 170ms cubic-bezier(0.22,1,0.36,1)',
      }}>

      {/* Thin traveling light on top of the golden border */}
      <div style={{ position:'absolute', inset:0, borderRadius:'inherit', overflow:'hidden', pointerEvents:'none' }}>
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          width:'200%', height:'200%',
          marginLeft:'-100%', marginTop:'-100%',
          background:'conic-gradient(from 0deg,transparent 0%,transparent 84%,rgba(255,220,80,0.4) 88%,rgba(255,245,140,1) 91%,rgba(255,245,140,1) 93%,rgba(255,220,80,0.4) 96%,transparent 100%)',
          animation:'borderBeamRotate 4.5s linear infinite',
        }} />
      </div>

      {/* Click flash ring */}
      {pressed && (
        <div style={{
          position:'absolute', inset:'-3px',
          borderRadius:'inherit',
          border:'1.5px solid rgba(255,215,60,0.55)',
          boxShadow:'0 0 10px 1px rgba(255,200,60,0.2)',
          pointerEvents:'none',
        }} />
      )}

      {/* Inner glass pill */}
      <div style={{
        position:       'relative',
        overflow:       'hidden',
        display:        'flex',
        alignItems:     'center',
        gap:            '7px',
        padding:        '7px 20px',
        borderRadius:   '50px',
        fontFamily:     'Inter, sans-serif',
        fontSize:       'clamp(9px,1.1vw,11px)',
        fontWeight:     600,
        letterSpacing:  '0.14em',
        textTransform:  'uppercase',
        color:          pressed ? 'rgba(255,238,100,1)' : 'rgba(222,180,72,0.92)',
        background:     pressed ? 'rgba(28,20,4,0.88)' : 'rgba(12,10,3,0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: pressed
          ? 'inset 0 2px 10px rgba(0,0,0,0.55), inset 0 1px 3px rgba(0,0,0,0.4)'
          : 'none',
        transition: 'color 180ms, background 180ms, box-shadow 140ms',
      }}>
        {/* Occasional diagonal shine sweep */}
        <div aria-hidden style={{
          position:   'absolute',
          top: '-20%', bottom: '-20%',
          width:      '38%',
          background: 'linear-gradient(90deg,transparent,rgba(255,240,140,0.13) 30%,rgba(255,252,200,0.32) 50%,rgba(255,240,140,0.13) 70%,transparent)',
          animation:  'btnShine 5.5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        <span style={{
          display:   'inline-block',
          fontSize:  'clamp(8px,1vw,10px)',
          animation: 'pastStarPulse 2.8s ease-in-out infinite',
        }}>✦</span>
        <span style={{ position:'relative' }}>Show Past Members</span>
      </div>
    </Link>
  )
}
