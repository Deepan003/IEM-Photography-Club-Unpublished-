import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar            from './components/Navbar'
import RevealOnScroll    from './components/RevealOnScroll'
// AuthModal is global in App.jsx — trigger via: document.dispatchEvent(new CustomEvent('open-auth'))
import { useTheme, useAuth } from './App.jsx'
import { useData }       from './hooks/useData.js'
import { postcardsApi, galleryApi, membersApi, coreApi, socialApi, competitionsApi, magazineApi, activitiesApi, settingsApi, heroThemesApi } from './api/api.js'
import { computeAcademicYear, isCurrentSession, currentSession } from './utils/yearCalc.js'
import GlassButton from './components/GlassButton.jsx'
import { Crosshair, ArrowRight, ChevronLeft, ChevronRight, Instagram, Facebook, Mail } from './components/Icons'
import { PhotoFactCard, CompetitionSlots } from './components/CompetitionSection.jsx'

import { ActivityCarousel } from './components/ActivitySection.jsx'
import MagazineCovers from './components/magazine/MagazineCovers.jsx'

// ── Full-screen section wrapper ───────────────────────────────────────────────
function FullSection({ id, children, bg, className = '' }) {
  const ref = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Already in viewport on mount — reveal instantly without animation
    if (el.getBoundingClientRect().top < window.innerHeight * 0.82) { setVis(true); return }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } },
      // Fire when section is meaningfully in view so user actually sees the animation
      { threshold: 0.07, rootMargin: '0px 0px -50px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <section id={id} ref={ref}
      className={`relative min-h-screen flex flex-col justify-center overflow-hidden ${bg} ${className} ${vis ? 'sec-vis' : 'sec-hidden'}`}>
      {children}
    </section>
  )
}

// ── Professional section header — editorial, left-aligned ────────────────────
function SectionToggle({ visible, onToggle, L }) {
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
      title={visible ? 'Visible to all — click to hide' : 'Hidden from public — click to show'}
      className="shrink-0 flex items-center gap-1.5 sm:gap-2 select-none group"
      style={{ marginTop: '1px' }}>

      {/* ── Track — responsive via CSS class ── */}
      <span className="sec-toggle-track" style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        background: visible
          ? L
            ? 'linear-gradient(145deg,#16a34a,#22c55e)'
            : 'linear-gradient(145deg,#14532d,#166534)'
          : L
            ? 'linear-gradient(145deg,#d1d5db,#e5e7eb)'
            : 'linear-gradient(145deg,#111113,#1c1c21)',
        boxShadow: visible
          ? L
            ? 'inset 2px 2px 5px rgba(0,0,0,0.18), inset -1px -1px 3px rgba(255,255,255,0.15), 0 0 14px rgba(34,197,94,0.45), 0 2px 8px rgba(22,163,74,0.3)'
            : 'inset 2px 2px 6px rgba(0,0,0,0.55), inset -1px -1px 2px rgba(255,255,255,0.04), 0 0 16px rgba(34,197,94,0.35), 0 2px 10px rgba(0,0,0,0.6)'
          : L
            ? 'inset 3px 3px 7px rgba(0,0,0,0.13), inset -3px -3px 7px rgba(255,255,255,0.75)'
            : 'inset 3px 3px 7px rgba(0,0,0,0.75), inset -2px -2px 4px rgba(255,255,255,0.04)',
      }}>
        {/* Glow pulse when live */}
        {visible && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '999px',
            background: L ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.08)',
            animation: 'pulse 2.2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        {/* ── Thumb — position via CSS class ── */}
        <span
          className={`sec-toggle-thumb ${visible ? 'sec-toggle-thumb-on' : 'sec-toggle-thumb-off'}`}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            transition: 'all 0.38s cubic-bezier(0.34,1.56,0.64,1)',
            background: visible
              ? L ? 'linear-gradient(145deg,#ffffff,#f0fdf4)' : 'linear-gradient(145deg,#dcfce7,#bbf7d0)'
              : L ? 'linear-gradient(145deg,#ffffff,#f3f4f6)' : 'linear-gradient(145deg,#3f3f46,#52525b)',
            boxShadow: visible
              ? L
                ? '3px 3px 7px rgba(0,0,0,0.2), -2px -2px 5px rgba(255,255,255,0.9)'
                : '3px 3px 8px rgba(0,0,0,0.65), -1px -1px 3px rgba(255,255,255,0.12), 0 0 6px rgba(187,247,208,0.3)'
              : L
                ? '3px 3px 7px rgba(0,0,0,0.14), -2px -2px 5px rgba(255,255,255,0.95)'
                : '3px 3px 8px rgba(0,0,0,0.8), -1px -1px 3px rgba(255,255,255,0.07)',
          }} />
      </span>

      {/* ── Label — hidden on mobile ── */}
      <span className="sec-toggle-label" style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        transition: 'color 0.35s, text-shadow 0.35s',
        color: visible ? (L ? '#16a34a' : '#4ade80') : (L ? '#9ca3af' : '#3f3f46'),
        textShadow: visible && !L ? '0 0 10px rgba(74,222,128,0.5)' : 'none',
      }}>
        {visible ? 'Live' : 'Off'}
      </span>
    </button>
  )
}

function SectionHeader({ tag, title, subtitle, href, L, center = false, sectionVisible, onToggleSection, settingKey, isEditable, onSave }) {
  const len = title?.length || 0
  const fontSize = len >= 12
    ? 'clamp(1.85rem, 5.5vw, 3.2rem)'
    : len >= 9
    ? 'clamp(2.4rem, 6.5vw, 3.6rem)'
    : 'clamp(2.9rem, 8vw, 4.2rem)'

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const startEdit = () => { setDraft(subtitle || ''); setEditing(true) }
  const cancel    = () => setEditing(false)
  const save      = async () => {
    if (!settingKey) return
    setSaving(true)
    try {
      await settingsApi.patch(settingKey, draft)
      onSave?.(draft)
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className={`mb-8 sm:mb-7 ${center ? 'text-center' : ''}`}>
      <div className={`flex items-start ${center?'justify-center flex-col items-center gap-4':'justify-between gap-6'}`}>
        <h2 className={`sh-heading font-breathing leading-[1.0] ${L?'text-gray-900':'text-white'} font-semibold italic`}
          style={{ fontSize, paddingBottom: '2.2rem' }}>
          {title}
        </h2>
        <div className="sh-actions flex items-center gap-2 shrink-0 mt-1">
          {onToggleSection && (
            <SectionToggle visible={sectionVisible} onToggle={onToggleSection} L={L} />
          )}
          {href && (
            <>
              <span className="sm:hidden">
                <Link to={href} className="glass-btn glass-pill inline-flex items-center gap-1 font-inter text-[8px] uppercase tracking-[0.18em]"
                  style={{ borderRadius: '50px', minHeight: '22px', padding: '0 10px' }}>
                  See more <ArrowRight size={7} />
                </Link>
              </span>
              <span className="hidden sm:inline">
                <Link to={href} className="glass-btn glass-pill inline-flex items-center gap-1.5 font-inter text-[10px] uppercase tracking-[0.18em]"
                  style={{ borderRadius: '50px', minHeight: '28px', padding: '0 14px' }}>
                  See more <ArrowRight size={9} />
                </Link>
              </span>
            </>
          )}
        </div>
      </div>
      {!editing && subtitle && (
        <div className={`sh-subtitle flex items-start gap-1.5 ${center ? 'justify-center' : ''}`}>
          <p className={`font-inter text-sm leading-relaxed break-words ${L?'text-gray-500':'text-gray-400'} max-w-lg ${center?'mx-auto':''}`}>
            {subtitle}
          </p>
          {isEditable && settingKey && (
            <button
              onClick={startEdit}
              className={`shrink-0 mt-0.5 p-1.5 rounded-lg transition-colors ${L?'text-gray-400 hover:text-gray-700':'text-gray-600 hover:text-gray-400'}`}
              title="Edit subtitle"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
        </div>
      )}
      {editing && (
        <div className={`max-w-lg mt-2 space-y-2 ${center ? 'mx-auto' : ''}`}>
          <textarea
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="glass-input w-full text-sm resize-none"
            style={{ borderRadius:'10px' }}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl font-inter text-xs font-semibold ${L?'bg-gray-900 text-white hover:bg-gray-700':'bg-red-600 hover:bg-red-500 text-white'} transition-colors disabled:opacity-60`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className={`px-3 py-1.5 rounded-xl font-inter text-xs ${L?'text-gray-600 border border-black/10':'text-gray-400 border border-white/10'} hover:opacity-80 transition-opacity`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reusable inline editable subtitle (single paragraph, with pencil icon) ──
function EditableInlineSubtitle({ text, settingKey, isEditable, onSave, L, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await settingsApi.patch(settingKey, draft)
      onSave?.(draft)
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  if (editing) return (
    <div className="max-w-md mb-5 sm:mb-6 space-y-2">
      <textarea
        rows={2}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="glass-input w-full text-sm resize-none"
        style={{ borderRadius:'10px' }}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className={`px-3 py-1.5 rounded-xl font-inter text-xs font-semibold ${L?'bg-gray-900 text-white hover:bg-gray-700':'bg-red-600 hover:bg-red-500 text-white'} transition-colors disabled:opacity-60`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)}
          className={`px-3 py-1.5 rounded-xl font-inter text-xs ${L?'text-gray-600 border border-black/10':'text-gray-400 border border-white/10'} hover:opacity-80 transition-opacity`}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className={`flex items-start gap-1.5 ${className.includes('mb-') ? '' : 'mb-5 sm:mb-6'}`}>
      <p className={`break-words ${className}`}>{text}</p>
      {isEditable && settingKey && (
        <button onClick={() => { setDraft(text); setEditing(true) }}
          className={`shrink-0 mt-0.5 p-1.5 rounded-lg transition-colors ${L?'text-gray-400 hover:text-gray-700':'text-gray-600 hover:text-gray-400'}`}
          title="Edit subtitle">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Social platform icons (large, animated, for Connect section) ─────────────
const CONNECT_ICON_CFG = {
  instagram: { color: '#E1306C', glow: 'rgba(225,48,108,0.55)', bg: 'linear-gradient(135deg,rgba(240,148,51,0.15),rgba(220,39,67,0.14),rgba(188,24,136,0.15))', border: 'rgba(225,48,108,0.32)' },
  facebook:  { color: '#1877F2', glow: 'rgba(24,119,242,0.52)',  bg: 'rgba(24,119,242,0.13)',  border: 'rgba(24,119,242,0.30)'  },
  twitter:   { color: '#1DA1F2', glow: 'rgba(29,161,242,0.52)',  bg: 'rgba(29,161,242,0.13)',  border: 'rgba(29,161,242,0.30)'  },
  youtube:   { color: '#FF0000', glow: 'rgba(255,0,0,0.50)',     bg: 'rgba(255,0,0,0.12)',     border: 'rgba(255,0,0,0.28)'     },
  whatsapp:  { color: '#25D366', glow: 'rgba(37,211,102,0.50)',  bg: 'rgba(37,211,102,0.12)',  border: 'rgba(37,211,102,0.28)'  },
  linkedin:  { color: '#0077B5', glow: 'rgba(0,119,181,0.50)',   bg: 'rgba(0,119,181,0.12)',   border: 'rgba(0,119,181,0.28)'   },
  telegram:  { color: '#0088CC', glow: 'rgba(0,136,204,0.50)',   bg: 'rgba(0,136,204,0.12)',   border: 'rgba(0,136,204,0.28)'   },
  discord:   { color: '#5865F2', glow: 'rgba(88,101,242,0.52)',  bg: 'rgba(88,101,242,0.12)',  border: 'rgba(88,101,242,0.28)'  },
  email:     { color: '#a78bfa', glow: 'rgba(167,139,250,0.45)', bg: 'rgba(167,139,250,0.11)', border: 'rgba(167,139,250,0.26)' },
  website:   { color: '#64748b', glow: 'rgba(100,116,139,0.40)', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.24)' },
  other:     { color: '#64748b', glow: 'rgba(100,116,139,0.40)', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.24)' },
}

function ConnectPlatformIcon({ platform, size = 30 }) {
  const cfg = CONNECT_ICON_CFG[platform] || CONNECT_ICON_CFG.other
  const c   = cfg.color
  const sw  = 1.8
  const base = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (platform) {
    case 'instagram': return (
      <svg {...base}>
        <defs>
          <linearGradient id="ig-g" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f09433"/>
            <stop offset="40%"  stopColor="#dc2743"/>
            <stop offset="100%" stopColor="#bc1888"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-g)" strokeWidth={sw}/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="url(#ig-g)" strokeWidth={sw}/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="url(#ig-g)" strokeWidth={2.6}/>
      </svg>)
    case 'facebook': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>)
    case 'twitter': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
      </svg>)
    case 'youtube': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon fill={c} fillOpacity={0.3} stroke={c} strokeWidth={sw * 0.6} points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
      </svg>)
    case 'whatsapp': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>)
    case 'linkedin': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>)
    case 'telegram': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon fill={c} fillOpacity={0.2} stroke={c} strokeWidth={sw * 0.8} points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>)
    case 'discord': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        <circle cx="8.5"  cy="13" r="1.5" fill={c} stroke="none"/>
        <circle cx="15.5" cy="13" r="1.5" fill={c} stroke="none"/>
      </svg>)
    case 'email': return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>)
    default: return (
      <svg {...base} stroke={c} strokeWidth={sw}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>)
  }
}

const ICON_ANIMS = {
  instagram: 'iconSpin  0.75s cubic-bezier(0.22,1,0.36,1)',
  facebook:  'iconBounce 0.55s ease',
  twitter:   'iconFly    0.55s ease',
  youtube:   'iconPulse  0.50s ease',
  whatsapp:  'iconBounce 0.55s ease',
  linkedin:  'iconBounce 0.50s ease',
  telegram:  'iconFly    0.50s ease',
  discord:   'iconWiggle 0.55s ease',
  email:     'iconShake  0.50s ease',
  website:   'iconSpin   0.90s linear',
  other:     'iconBounce 0.55s ease',
}

function SocialIconCard({ link, index, L }) {
  const [hov,      setHov]      = useState(false)
  const [iconAnim, setIconAnim] = useState('')
  const cfg = CONNECT_ICON_CFG[link.platform] || CONNECT_ICON_CFG.other

  const triggerAnim = () => {
    setIconAnim('')
    // force re-trigger via rAF even if already set
    requestAnimationFrame(() => setIconAnim(ICON_ANIMS[link.platform] || ICON_ANIMS.other))
  }

  const shineDelay = `${index * 0.9}s`
  const shineDur   = `${3.8 + (index % 3) * 0.6}s`

  return (
    <a
      href={link.url} target="_blank" rel="noopener noreferrer"
      className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer select-none"
      onMouseEnter={() => { setHov(true);  triggerAnim() }}
      onMouseLeave={() => { setHov(false) }}
      onClick={triggerAnim}
      style={{ animation: `socialCardIn 0.55s cubic-bezier(0.22,1,0.36,1) ${index * 90}ms both`, textDecoration: 'none' }}>

      {/* Glassmorphic card — overflow hidden so shine stays inside */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        width: 'clamp(46px,10vw,80px)',
        height: 'clamp(46px,10vw,80px)',
        borderRadius: 'clamp(14px,2.5vw,22px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        background: hov
          ? L ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.11)'
          : L ? 'rgba(242,245,250,0.82)' : 'rgba(255,255,255,0.058)',
        border: `1px solid ${hov
          ? L ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.24)'
          : L ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.10)'}`,
        boxShadow: hov
          ? L ? '8px 8px 20px rgba(163,177,200,0.50), -5px -5px 12px rgba(255,255,255,0.90), inset 0 1px 0 rgba(255,255,255,0.98)'
              : '0 8px 28px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.13)'
          : L ? '5px 5px 14px rgba(163,177,200,0.38), -3px -3px 8px rgba(255,255,255,0.85), inset 0 1px 0 rgba(255,255,255,0.90)'
              : '0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
        transform: hov ? 'scale(1.10) translateY(-4px)' : 'scale(1) translateY(0)',
        transition: 'all 0.28s cubic-bezier(0.22,1,0.36,1)',
      }}>

        {/* Continuous shine sweep */}
        <div aria-hidden style={{
          position: 'absolute', top: 0, bottom: 0,
          left: 0, width: '55%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
          animation: `socialGlassShine ${shineDur} ease-in-out ${shineDelay} infinite`,
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* Icon — plays platform-specific animation on hover/click */}
        <div
          style={{ position: 'relative', zIndex: 3, animation: iconAnim, display: 'flex' }}
          onAnimationEnd={() => setIconAnim('')}>
          <ConnectPlatformIcon platform={link.platform} size={Math.round(80 * 0.42)} />
        </div>
      </div>

      {/* Label */}
      <span className="font-inter font-medium tracking-wide text-center"
        style={{
          fontSize: 'clamp(9px,1.4vw,12px)',
          color: hov ? cfg.color : L ? 'rgba(55,65,81,0.65)' : 'rgba(156,163,175,0.70)',
          transition: 'color 0.22s ease',
          maxWidth: '72px',
          lineHeight: 1.25,
        }}>
        {link.label}
      </span>
    </a>
  )
}

// ── Members section helpers ───────────────────────────────────────────────────
// Sort: most senior first (lowest endYear), then alphabetical
function sortByYearThenName(arr) {
  return [...arr].sort((a, b) => {
    const ya = a.endYear || 9999, yb = b.endYear || 9999
    if (ya !== yb) return ya - yb
    return a.name.localeCompare(b.name)
  })
}

// Helper: border beam rotating div (clipped by 1.5px padding parent)
function BorderBeam({ speed = 8, color1 = 'rgba(255,255,255,0.5)', color2 = 'rgba(255,255,255,0.9)', delay = '0s' }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden style={{ pointerEvents:'none' }}>
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:'200%', height:'200%',
        marginLeft:'-100%', marginTop:'-100%',
        background:`conic-gradient(from 0deg,transparent 0%,transparent 86%,${color1} 91%,${color2} 95%,rgba(255,255,255,0.95) 97%,${color2} 98.5%,${color1} 99.5%,transparent 100%)`,
        animation:`borderBeamRotate ${speed}s linear infinite`,
        animationDelay:delay,
      }} />
    </div>
  )
}

// Square card: designation badge at top, full name below card
function MemberRoleCard({ m, accent, index = 0, L }) {
  const initials  = m.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const roleLabel = m.role === 'core' ? 'Core' : 'Coordinator'
  const isRed     = accent === 'red'
  const tc        = isRed ? '#fca5a5' : '#93c5fd'
  const beamC1    = isRed ? 'rgba(220,38,38,0.92)'  : 'rgba(37,99,235,0.88)'
  const beamC2    = isRed ? 'rgba(255,60,60,1)'    : 'rgba(70,140,255,1)'
  const floatKf   = isRed ? 'memberCoreFloat'       : 'memberCoordFloat'
  const floatDur  = `${3.0 + (index % 4) * 0.5}s`
  const beamSpeed = isRed ? 4 + (index % 3) : 5.5 + (index % 3)
  const delay     = `${(index % 5) * 0.5}s`

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      {/* Float wrapper */}
      <div className="w-full" style={{ animation:`${floatKf} ${floatDur} ease-in-out infinite`, animationDelay:delay }}>
        {/* 1.5px padding = visible "border" area for the beam */}
        <div className="relative w-full rounded-xl overflow-hidden" style={{ padding:'1.5px', cursor:'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.transform = isRed ? 'scale(1.08) translateY(-4px)' : 'scale(1.06) translateY(-3px)'; e.currentTarget.style.transition = 'transform 280ms cubic-bezier(0.22,1,0.36,1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
          <BorderBeam speed={beamSpeed} color1={beamC1} color2={beamC2} delay={delay} />
          {/* Inner card */}
          <div className="group relative rounded-[10px] overflow-hidden" style={{ aspectRatio:'1/1',
            background: L
              ? (isRed ? 'linear-gradient(145deg,#f0d5d8,#dce1ec)' : 'linear-gradient(145deg,#d5dff0,#dce1ec)')
              : (isRed ? 'linear-gradient(145deg,#1a0005,#060608)'  : 'linear-gradient(145deg,#00001a,#060608)') }}>
            {m.profilePhoto
              ? <img src={m.profilePhoto} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              : <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`font-clash text-2xl font-black ${L ? 'text-black/8' : 'text-white/8'}`}>{initials}</span>
                </div>}
            {/* Subtle gradient over photo — gives cinematic depth */}
            <div className="absolute inset-0" style={{ background: L
              ? 'linear-gradient(180deg,rgba(0,0,0,0.04) 0%,transparent 40%,rgba(0,0,0,0.32) 100%)'
              : 'linear-gradient(180deg,rgba(0,0,0,0.18) 0%,transparent 40%,rgba(0,0,0,0.55) 100%)' }} />
            {/* Focused gradient behind the label */}
            <div className="absolute inset-x-0 bottom-0 to-transparent" style={{ height:'38%',
              background: L ? 'linear-gradient(to top,rgba(220,225,236,0.85),transparent)' : 'linear-gradient(to top,rgba(0,0,0,0.80),transparent)' }} />
            {/* Designation label */}
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center px-1">
              <span className="font-inter font-bold uppercase"
                style={{ fontSize:'clamp(6px,1.1vw,9px)', letterSpacing:'0.12em',
                  color: L ? (isRed ? 'rgba(180,50,50,0.80)' : 'rgba(37,99,235,0.80)') : 'rgba(255,255,255,0.82)' }}>
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Full name below */}
      <p className="font-inter font-semibold text-center leading-tight w-full px-0.5 truncate"
        style={{ fontSize:'clamp(8px,1.5vw,11px)', color: L ? 'rgba(31,41,55,0.90)' : 'rgba(255,255,255,0.88)' }}>
        {m.name}
      </p>
    </div>
  )
}


// ── Core Committee card ───────────────────────────────────────────────────────
// Current: red border beam, no float, full name + desig overlaid inside
// Past:    golden border beam (slower, slightly thicker), vignette, full name below
function CoreCard({ m, isCurr, index = 0, L }) {
  const initials  = m.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const desig     = m.designation || 'Core'
  const delay     = `${(index % 5) * 0.5}s`
  const beamSpeed = isCurr ? 4 + (index % 3) : 7 + (index % 4)  // past = slower beam

  // Beam colours: current = red, past = golden
  const bC1 = isCurr ? 'rgba(220,38,38,0.85)'   : 'rgba(201,168,76,0.82)'
  const bC2 = isCurr ? 'rgba(255,70,70,1)'       : 'rgba(255,215,80,1)'
  const bW  = isCurr ? '1.5px'                   : '2px'      // past has slightly thicker border
  const bR  = isCurr ? 'rounded-xl'              : 'rounded-2xl'  // past slightly more rounded
  const iR  = isCurr ? 'rounded-[10px]'          : 'rounded-[14px]'

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width:'clamp(82px,10.5vw,132px)' }}>
      {/* Border beam wrapper — no float, just beam */}
      <div className={`relative w-full ${bR} overflow-hidden`} style={{ padding: bW }}
        onMouseEnter={e => { e.currentTarget.style.transform = isCurr ? 'scale(1.07) translateY(-5px)' : 'scale(1.06) translateY(-4px)'; e.currentTarget.style.transition='transform 280ms cubic-bezier(0.22,1,0.36,1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = '' }}>
        {/* Rotating conic-gradient beam */}
        <div className={`absolute inset-0 overflow-hidden ${bR}`} aria-hidden style={{ pointerEvents:'none' }}>
          <div style={{
            position:'absolute', top:'50%', left:'50%', width:'200%', height:'200%',
            marginLeft:'-100%', marginTop:'-100%',
            background:`conic-gradient(from 0deg,transparent 0%,transparent 87%,${bC1} 91%,${bC2} 95%,rgba(255,255,255,0.92) 97%,${bC2} 98.5%,${bC1} 99.5%,transparent 100%)`,
            animation:`borderBeamRotate ${beamSpeed}s linear infinite`, animationDelay:delay,
          }} />
        </div>
        {/* Card inner */}
        <div className={`group relative ${iR} overflow-hidden`}
          style={{
            aspectRatio: '3/4',
            background: L
              ? (isCurr ? 'linear-gradient(145deg,#e8dce0,#dce1ec)' : 'linear-gradient(145deg,#e8e2d4,#dce1ec)')
              : (isCurr ? 'linear-gradient(145deg,#1a0005,#060608)'  : 'linear-gradient(145deg,#0a0805,#060608)'),
            boxShadow: isCurr ? '0 4px 20px rgba(220,38,38,0.18)' : '0 4px 18px rgba(201,168,76,0.12)',
          }}>
          {m.photoUrl
            ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="absolute inset-0 flex items-center justify-center">
                <span className={`font-clash font-black ${L ? 'text-black/10' : 'text-white/10'} text-lg`}>{initials}</span>
              </div>}
          {/* Cinematic gradient */}
          <div className="absolute inset-0" style={{ background: L
            ? 'linear-gradient(180deg,rgba(0,0,0,0.03) 0%,transparent 36%,rgba(0,0,0,0.28) 100%)'
            : 'linear-gradient(180deg,rgba(0,0,0,0.10) 0%,transparent 36%,rgba(0,0,0,0.82) 100%)' }} />
          {/* Past: extra vignette */}
          {!isCurr && !L && <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,0.5) 100%)' }} />}
          <div className="absolute inset-x-0 bottom-0 to-transparent" style={{ height:'52%',
            background: L ? 'linear-gradient(to top,rgba(220,225,236,0.92),transparent)' : 'linear-gradient(to top,rgba(0,0,0,0.95),transparent)' }} />
          {/* Name + designation */}
          <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 text-center">
            <p className="font-inter font-semibold leading-snug"
              style={{ fontSize:'clamp(8px,1.05vw,11px)', wordBreak:'break-word',
                color: L ? 'rgba(15,23,42,0.90)' : 'rgba(255,255,255,1)',
                textShadow: L ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}>
              {m.name}
            </p>
            <p className="font-inter font-bold uppercase tracking-wider mt-0.5"
              style={{ fontSize:'clamp(7px,0.8vw,9px)',
                color: L ? (isCurr ? '#dc2626' : '#92400e') : (isCurr ? '#f87171' : '#c9a84c'),
                textShadow: L ? 'none' : '0 1px 2px rgba(0,0,0,0.9)' }}>
              {desig}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Circular member card: avatar + name below
function MemberCompactCard({ m, index = 0, L }) {
  const initials  = m.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const delay     = `${(index % 6) * 0.42}s`
  const floatDur  = `${4.5 + (index % 5) * 0.45}s`
  const beamSpeed = 10 + (index % 4) * 1.5
  const beamC1    = 'rgba(210,210,230,0.6)'
  const beamC2    = 'rgba(255,255,255,0.92)'

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div className="w-full" style={{ animation:`memberCircleFloat ${floatDur} ease-in-out infinite`, animationDelay:delay }}>
        {/* 1.5px padding = border beam ring */}
        <div className="relative w-full rounded-full overflow-hidden" style={{ padding:'1.5px' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.transition = 'transform 260ms cubic-bezier(0.22,1,0.36,1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}>
          <BorderBeam speed={beamSpeed} color1={beamC1} color2={beamC2} delay={delay} />
          <div className="relative w-full aspect-square rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
            {m.profilePhoto
              ? <img src={m.profilePhoto} alt={m.name} className="w-full h-full object-cover" />
              : <span className={`font-clash font-black ${L ? 'text-black/25' : 'text-white/20'}`} style={{ fontSize:'clamp(10px,2vw,16px)' }}>{initials}</span>}
          </div>
        </div>
      </div>
      {/* Name below — first name, legible */}
      <p className="font-inter font-semibold text-center leading-tight w-full px-0.5 truncate"
        style={{ fontSize:'clamp(9px,1.6vw,12px)', color: L ? 'rgba(55,65,81,0.95)' : 'rgba(209,213,219,0.9)' }}>
        {m.name.split(' ')[0]}
      </p>
    </div>
  )
}

// ── Helper: extract image URLs from postcard (multi-image or legacy single) ───
function getPostcardImages(p) {
  if (p.images?.length) return p.images.map(img => (typeof img === 'string' ? img : img.url)).filter(Boolean)
  if (p.imageUrl) return [p.imageUrl]
  return []
}

// ── Single postcard card — neomorphic liquid glass, white photo border ────────
function PostcardCard({ p, L }) {
  const imgs = getPostcardImages(p)
  const [photoIdx, setPhotoIdx] = useState(0)

  // Reset photo index whenever the postcard itself changes
  useEffect(() => { setPhotoIdx(0) }, [p?._id])

  useEffect(() => {
    if (imgs.length <= 1) return
    const t = setInterval(() => setPhotoIdx(i => (i + 1) % imgs.length), 3200)
    return () => clearInterval(t)
  }, [imgs.length])

  if (!p) return null

  return (
    <div className={`rounded-2xl overflow-hidden w-full ${L ? 'postcard-neo-light' : 'postcard-neo-dark'}`}
      style={ L
        ? { background:'#e8e8ec', border:'1px solid rgba(255,255,255,0.7)' }
        : { background:'#131315', border:'1px solid rgba(255,255,255,0.04)' }
      }>
      {/* Header — avatar + full name + section */}
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        {p.photographer?.profilePhoto
          ? <img src={p.photographer.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          : <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center font-inter text-[9px] font-bold text-red-400 shrink-0">
              {(p.photographer?.name || 'U')[0].toUpperCase()}
            </div>
        }
        <div className="min-w-0 flex-1">
          <p className={`font-inter text-[11px] font-bold truncate leading-tight ${L?'text-gray-900':'text-white'}`}>
            {p.photographer?.name || 'Unknown'}
          </p>
          {p.section?.name && (
            <p className="font-inter text-[10px] text-red-500 font-semibold uppercase tracking-[0.1em] truncate leading-tight">
              {p.section.name}
            </p>
          )}
        </div>
      </div>

      {/* Photo with white border — the "postcard" feel */}
      <div className="px-2 pb-1">
        <div className="overflow-hidden" style={{ background:'#fff', padding:'3px', borderRadius:0 }}>
          {/* mobile: ~115% tall, sm+: square (100%) */}
          <div className="relative overflow-hidden pc-postcard-img" style={{ borderRadius:0 }}>
            <div className="absolute inset-0 bg-gray-900">
              {imgs.length > 0 ? imgs.map((url, i) => (
                <img key={i} src={url} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: i === photoIdx ? 1 : 0, transition: 'opacity 700ms ease' }}
                  onError={e => { e.currentTarget.style.opacity = '0' }}
                />
              )) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
              )}
            </div>

            {/* Prominent multi-photo count badge */}
            {imgs.length > 1 && (
              <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full"
                style={{ background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.2)', padding:'3px 7px 3px 5px' }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="13" height="13" rx="2"/>
                  <path d="M8 21h13a2 2 0 0 0 2-2V8"/>
                </svg>
                <span className="font-inter text-[11px] font-bold text-white leading-none">{imgs.length}</span>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="px-2.5 py-1.5" style={{ minHeight:28 }}>
        {p.caption && (
          <p className={`font-inter text-[13.5px] leading-snug truncate ${L?'text-gray-600':'text-gray-400'}`}>{p.caption}</p>
        )}
      </div>
    </div>
  )
}

// ── Minimal neomorphic arrow button ──────────────────────────────────────────
function NeoArrow({ onClick, dir, L }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-110 active:scale-95"
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: L ? '#eef1f7' : '#181820',
        boxShadow: L
          ? '-3px -3px 8px rgba(255,255,255,0.90), 4px 4px 10px rgba(163,177,200,0.45), inset 0 1px 0 rgba(255,255,255,0.80)'
          : '-2px -2px 5px rgba(255,255,255,0.025), 3px 3px 8px rgba(0,0,0,0.85)',
      }}>
      {dir === 'left'
        ? <ChevronLeft size={13} className={L ? 'text-gray-500' : 'text-gray-400'} />
        : <ChevronRight size={13} className={L ? 'text-gray-500' : 'text-gray-400'} />}
    </button>
  )
}

// ── Independent postcard slot — cycles through all postcards on its own clock ──
function PostcardSlot({ postcards, startIdx, intervalMs, L }) {
  const total = postcards.length
  const [idx, setIdx] = useState(() => startIdx % Math.max(total, 1))
  const [vis, setVis] = useState(true)

  // Re-sync if postcards change
  useEffect(() => { setIdx(startIdx % Math.max(postcards.length, 1)) }, [postcards.length, startIdx])

  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => {
      setVis(false)
      setTimeout(() => { setIdx(i => (i + 1) % total); setVis(true) }, 300)
    }, intervalMs)
    return () => clearInterval(t)
  }, [total, intervalMs])

  if (!postcards[idx]) return null
  return (
    <div style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
      transition: 'opacity 320ms ease, transform 320ms ease',
    }}>
      <PostcardCard p={postcards[idx]} L={L} />
    </div>
  )
}

// ── Postcard carousel — desktop (3 independent slots) + mobile (1 pager) ──────
function PostcardCarousel({ postcards, L }) {
  const total = postcards.length

  const [mobileIdx, setMobileIdx] = useState(0)
  const [mobileVis, setMobileVis] = useState(true)
  const mobileDragRef = useRef({ x: 0, on: false })

  // Mobile auto-advance every 5s
  useEffect(() => {
    if (total < 2) return
    const t = setInterval(() => {
      setMobileVis(false)
      setTimeout(() => { setMobileIdx(i => (i + 1) % total); setMobileVis(true) }, 300)
    }, 5000)
    return () => clearInterval(t)
  }, [total])

  function goMobile(next) {
    setMobileVis(false)
    setTimeout(() => { setMobileIdx(((next % total) + total) % total); setMobileVis(true) }, 260)
  }

  const onMobileStart = (e) => {
    mobileDragRef.current = { x: e.clientX ?? e.touches?.[0]?.clientX ?? 0, on: true }
  }
  const onMobileEnd = (e) => {
    if (!mobileDragRef.current.on) return
    mobileDragRef.current.on = false
    const ex = e.clientX ?? e.changedTouches?.[0]?.clientX ?? mobileDragRef.current.x
    const dx = mobileDragRef.current.x - ex
    if (Math.abs(dx) > 40) goMobile(mobileIdx + (dx > 0 ? 1 : -1))
  }
  const onMobileCancel = () => { mobileDragRef.current.on = false }

  if (!total) return (
    <p className={`font-inter text-sm text-center py-16 ${L?'text-gray-400':'text-gray-500'}`}>
      No postcards yet — members can upload after joining.
    </p>
  )

  const dotStyle = (active) => ({
    height: 4,
    width: active ? 14 : 4,
    borderRadius: 9999,
    background: active ? '#dc2626' : L ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.18)',
    transition: 'all 300ms ease',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
  })

  return (
    <>
      {/* ── Mobile: full-width card, swipeable, dots only (no arrows) ── */}
      <div className="sm:hidden w-full">
        <div
          className="w-full select-none"
          style={{ cursor: total > 1 ? 'grab' : 'default', touchAction: 'pan-y' }}
          onMouseDown={onMobileStart} onMouseUp={onMobileEnd} onMouseLeave={onMobileCancel}
          onTouchStart={onMobileStart} onTouchEnd={onMobileEnd}>
          <div style={{
            opacity: mobileVis ? 1 : 0,
            transform: mobileVis ? 'scale(1)' : 'scale(0.97)',
            transition: 'opacity 260ms ease, transform 260ms ease',
          }}>
            <PostcardCard key={postcards[mobileIdx]?._id ?? mobileIdx} p={postcards[mobileIdx]} L={L} />
          </div>
        </div>
        {total > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
              <button key={i} style={dotStyle(i === mobileIdx)}
                onClick={() => goMobile(i)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: 3 independent slots — each shuffles on its own clock ── */}
      <div className="hidden sm:block w-full">
        <div className="grid grid-cols-3 gap-4 lg:gap-5">
          {/* Staggered start positions + different intervals so they never sync */}
          <PostcardSlot postcards={postcards} startIdx={0}                        intervalMs={4200} L={L} />
          <PostcardSlot postcards={postcards} startIdx={Math.floor(total / 3)}    intervalMs={5800} L={L} />
          <PostcardSlot postcards={postcards} startIdx={Math.floor(2 * total / 3)} intervalMs={7300} L={L} />
        </div>
      </div>
    </>
  )
}

// ── Single gallery cell — cycles through photos independently ─────────────────
function GalleryCell({ photos, startIdx, cycleEvery = 3500 }) {
  const [cur, setCur]   = useState(startIdx % Math.max(1, photos.length))
  const [fade, setFade] = useState(true)

  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => { setCur(c => (c + 1) % photos.length); setFade(true) }, 450)
    }, cycleEvery)
    return () => clearInterval(t)
  }, [photos.length, cycleEvery])

  if (!photos.length) return <div className="w-full h-full bg-gray-900" />
  const p = photos[cur]
  return (
    <div className="w-full h-full overflow-hidden">
      <img
        src={p.imageUrl} alt=""
        className="w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: fade ? 1 : 0 }}
      />
    </div>
  )
}

// ── Legacy single-photo cycle (kept for other uses) ───────────────────────────
function GalleryCycle({ photos }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c+1) % Math.max(1, photos.length)), 3200)
    return () => clearInterval(t)
  }, [photos.length])
  if (!photos.length) return null
  return (
    <div className="relative w-full h-full">
      {photos.map((p,i) => (
        <div key={p._id} className={`absolute inset-0 transition-all duration-700 ${i===current ? 'opacity-100' : 'opacity-0'}`}>
          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )
}

// ── Event gallery row — shows one event with cycling photos ──────────────────
// ── Single gallery cell — proper 2-layer crossfade with distinct exit animation ─
const EXIT_ANIMS = ['exitSlideLeft','exitSlideRight','exitSlideDown','exitSlideUp','exitScaleFade']

function GalleryCinemaCell({ url, isBanner, ci, attr, style, eventId }) {
  const prevRef  = useRef(url)
  const [layers, setLayers] = useState({ curr: url, prev: null, key: 0 })

  useEffect(() => {
    if (url === prevRef.current) return
    const prevUrl = prevRef.current
    prevRef.current = url
    if (isBanner) {
      setLayers(s => ({ curr: url, prev: null, key: s.key + 1 }))
      return
    }
    setLayers(s => ({ curr: url, prev: prevUrl, key: s.key + 1 }))
    const t = setTimeout(() => setLayers(s => ({ ...s, prev: null })), 680)
    return () => clearTimeout(t)
  }, [url, isBanner])

  const enterDelay = isBanner ? 0 : ci * 90

  // Banner cell: rounded corners + neomorphic. All other cells: sharp rectangular.
  const wrapperStyle = isBanner && layers.curr ? {
    background: '#0d0d10',
    borderRadius: 14,
    boxShadow: '-3px -3px 8px rgba(255,255,255,0.03), 6px 6px 18px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.07)',
    animation: 'bannerBorderShine 3.6s ease-in-out 1s infinite',
    overflow: 'hidden',
    ...style,
  } : { background: '#08080c', borderRadius: 0, ...style }

  const nav = useNavigate()

  return (
    <div className={`relative group ${isBanner && eventId ? 'cursor-pointer' : ''}`}
      style={{ ...wrapperStyle, overflow: 'hidden' }}
      onClick={isBanner && eventId ? () => nav(`/events-gallery/${eventId}`) : undefined}>
      {/* Outgoing photo — unique exit per cell */}
      {layers.prev && (
        <img src={layers.prev} key={`x-${layers.key}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ animation: `${EXIT_ANIMS[ci % EXIT_ANIMS.length]} 650ms cubic-bezier(0.4,0,0.6,1) forwards`, zIndex: 1 }}
        />
      )}
      {/* Incoming photo — scale+fade, staggered */}
      {layers.curr ? (
        <img src={layers.curr} key={`c-${layers.key}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={isBanner ? { zIndex: 2, objectFit: 'contain', background: '#0e0e12' } : {
            animation: `galleryPhotoIn 820ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
            zIndex: 2,
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background:'#0c0c20', zIndex:2 }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
      )}
      {/* Gradient — lighter on banner so image shows clearly */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: isBanner
          ? 'linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 50%)'
          : 'linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 60%)',
        zIndex: 3,
      }} />
      {/* Banner: "View Gallery" hover overlay */}
      {isBanner && layers.curr && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
          <span className="font-inter text-[9px] uppercase tracking-[0.22em] text-white/90 px-3 py-1.5 rounded-full border border-white/20"
            style={{ background: 'rgba(220,38,38,0.6)' }}>
            View Gallery
          </span>
        </div>
      )}
      {/* Photographer */}
      {attr?.name && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1" style={{ zIndex:4 }}>
          {attr.userId?.profilePhoto && <img src={attr.userId.profilePhoto} alt="" className="w-3 h-3 rounded-full object-cover shrink-0" />}
          <p className="font-inter text-[7px] text-white/50 truncate leading-none">{attr.name}</p>
        </div>
      )}
    </div>
  )
}

// ── Masonry cinema gallery ─────────────────────────────────────────────────────
function EventCinemaGallery({ L, showPast = true }) {
  const { data } = useData(() => galleryApi.getEventCinema(), 5000)
  const allEvents = data?.events || []
  // Prefer current session events; fall back to older ones only when showPast is true.
  const currEvents = allEvents.filter(e => isCurrentSession(e))
  const events     = currEvents.length > 0 ? currEvents : (showPast ? allEvents : [])

  const [evIdx,    setEvIdx]    = useState(0)
  const [nameKey,  setNameKey]  = useState(0)   // drives name animation
  const [exiting,  setExiting]  = useState(false)
  const [cellIdx,  setCellIdx]  = useState([0, 1, 2, 3, 4, 5])

  // Reset to first event when the events list changes (e.g. data refresh delivers
  // current-session events that weren't there before)
  const eventsKey = events.map(e => e._id).join(',')
  useEffect(() => {
    setEvIdx(0)
    setNameKey(k => k + 1)
  }, [eventsKey]) // eslint-disable-line

  const ev     = events[Math.min(evIdx, Math.max(0, events.length - 1))] || null
  const photos = ev?.photos    || []

  // Spread 5 cells across available photos as evenly as possible (evenly spaced)
  useEffect(() => {
    const n = photos.length
    if (n === 0) { setCellIdx([0,0,0,0,0]); return }
    // Evenly space starting indices: [0, n/5, 2n/5, 3n/5, 4n/5]
    setCellIdx([0,1,2,3,4,5].map(i => Math.floor(i * n / 6) % n))
  }, [evIdx]) // eslint-disable-line

  // Smart cycling — each cell picks the next photo not shown by any other cell (if possible)
  useEffect(() => {
    const n = photos.length
    if (n <= 1) return

    const RATES = [4900, 5500, 4400, 6000, 4700, 5200]

    const intervals = RATES.map((ms, ci) =>
      setInterval(() => {
        setCellIdx(prev => {
          const next    = [...prev]
          const taken   = new Set(prev.filter((_, i) => i !== ci))
          let   attempt = (prev[ci] + 1) % n
          for (let k = 0; k < n; k++) {
            if (!taken.has(attempt)) break
            attempt = (attempt + 1) % n
          }
          next[ci] = attempt
          return next
        })
      }, ms)
    )
    return () => intervals.forEach(clearInterval)
  }, [evIdx, photos.length])

  // Navigate between events — triggers name animation
  const goEvent = (dir) => {
    setExiting(true)
    setTimeout(() => {
      setEvIdx(i => (i + dir + events.length) % events.length)
      setExiting(false)
      setNameKey(k => k + 1)
    }, 500)   // slower, smoother crossover
  }

  // Auto-advance every 16s — photos need time to be appreciated
  useEffect(() => {
    if (events.length <= 1) return
    const t = setInterval(() => goEvent(1), 16000)
    return () => clearInterval(t)
  }, [events.length, evIdx]) // eslint-disable-line

  // Must be declared before any early return — hooks must always run in the same order
  const touchStartX = useRef(0)

  if (!events.length) return (
    <div className={`rounded-3xl p-12 text-center auth-glass border ${L?'border-black/7':'border-white/7'}`}>
      <p className="text-3xl mb-3">📸</p>
      <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>Upload event photos to see them here.</p>
    </div>
  )

  const cellUrl  = (ci) => {
    // ci=0 is always the banner cell — shows event logo exclusively
    if (ci === 0) return ev?.logoUrl || photos[0]?.imageUrl || null
    // All other cells show actual gallery photos only — never the event logo
    if (!photos.length) return null
    return photos[cellIdx[ci] % photos.length]?.imageUrl || null
  }
  const cellAttr = (ci) => ci === 0 ? null : photos[cellIdx[ci] % photos.length]?.photographer

  const neoArrow = { background: L ? '#eef1f7' : '#181820', boxShadow: L ? '-3px -3px 8px rgba(255,255,255,0.90), 4px 4px 10px rgba(163,177,200,0.45), inset 0 1px 0 rgba(255,255,255,0.80)' : '-2px -2px 5px rgba(255,255,255,0.025),3px 3px 8px rgba(0,0,0,0.85)' }

  const GAP = 'clamp(5px, 0.9vw, 9px)'
  const SH  = 'clamp(104px, 14.5vw, 205px)'       // slightly bigger small cells
  const LH  = `calc(${SH} * 2 + ${GAP})`          // large = 2 small + gap

  return (
    <div>
      {/* ── Header: event name + nav (name uses horizontal slide — safe for script fonts) ── */}
      <div className="flex items-center gap-2 mb-3">
        {events.length > 1 && (
          <button onClick={() => goEvent(-1)}
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95"
            style={neoArrow}>
            <ChevronLeft size={10} className={L?'text-gray-600':'text-gray-400'} />
          </button>
        )}

        {/* Name — clipped container, horizontal slide animation */}
        <div className="flex-1 min-w-0" style={{
          overflow: 'hidden',
          height: '1.35em',
          fontSize: 'clamp(0.9rem, 2.1vw, 1.15rem)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <p key={nameKey}
            className={`font-inter font-semibold truncate w-full ${L?'text-gray-800':'text-white'}`}
            style={{
              fontSize: 'inherit',
              letterSpacing: '0.02em',
              lineHeight: 1.35,
              animation: exiting
                ? 'nameSlideOut 320ms cubic-bezier(0.4,0,1,1) forwards'
                : 'nameSlideIn 480ms cubic-bezier(0.22,1,0.36,1) forwards',
            }}>
            {ev?.name}
          </p>
        </div>

        {events.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`font-inter text-[9px] tabular-nums ${L?'text-gray-400':'text-gray-600'}`}>{evIdx+1}/{events.length}</span>
            <button onClick={() => goEvent(1)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={neoArrow}>
              <ChevronRight size={10} className={L?'text-gray-600':'text-gray-400'} />
            </button>
          </div>
        )}
      </div>

      {/* ── MOBILE: 2-column 3-row grid — fills more of the screen ── */}
      <div className="sm:hidden"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (Math.abs(dx) > 48 && events.length > 1) goEvent(dx < 0 ? 1 : -1)
        }}>
        {(() => {
          const mSH = 'clamp(120px, 36vw, 170px)'   // taller cells on mobile
          const mGAP = 'clamp(4px, 1.5vw, 7px)'
          return (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:`${mSH} ${mSH} ${mSH}`, gap: mGAP }}>
              {[0,1,2,3,4,5].map(ci => (
                <GalleryCinemaCell key={ci} ci={ci}
                  url={cellUrl(ci)} isBanner={ci === 0 && !!ev?.logoUrl}
                  attr={cellAttr(ci)} style={{ height: mSH }}
                  eventId={ci === 0 ? ev?._id : undefined} />
              ))}
            </div>
          )
        })()}
      </div>

      {/* ── DESKTOP: 4 small LEFT (2×2) + 1 large RIGHT ── */}
      <div className="hidden sm:grid" style={{ gridTemplateColumns:`clamp(150px,30vw,300px) 1fr`, gap: GAP }}>
        {/* Left: 2×2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:`${SH} ${SH}`, gap: GAP }}>
          {[0,1,2,3].map(ci => (
            <GalleryCinemaCell key={ci} ci={ci}
              url={cellUrl(ci)} isBanner={ci === 0 && !!ev?.logoUrl}
              attr={cellAttr(ci)} style={{ height: SH }}
              eventId={ci === 0 ? ev?._id : undefined} />
          ))}
        </div>
        {/* Right: large */}
        <GalleryCinemaCell ci={4}
          url={cellUrl(4)} isBanner={false}
          attr={cellAttr(4)} style={{ height: LH }} />
      </div>
    </div>
  )
}

// ── Club gallery 6-cell grid — central state so each cell shows a DIFFERENT photo ─
// ── Flowing gallery row ────────────────────────────────────────────────────────
const FlowRow = forwardRef(function FlowRow({ photos, speed = 0.5, pausedRef, className = '' }, ref) {
  const trackRef = useRef()
  const posRef   = useRef(0)
  const dragRef  = useRef(null)
  const rafRef   = useRef()

  useImperativeHandle(ref, () => ({
    nudge(delta) { posRef.current += delta }
  }))

  useEffect(() => {
    const track = trackRef.current
    if (!track || !photos.length) return
    const id = requestAnimationFrame(() => {
      const tick = () => {
        if (!pausedRef.current && !dragRef.current) {
          const halfWidth = track.scrollWidth / 2
          if (halfWidth > 0) {
            posRef.current += speed
            if (posRef.current >= halfWidth) posRef.current -= halfWidth
            track.style.transform = `translateX(-${posRef.current}px)`
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    })
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(rafRef.current) }
  }, [photos, speed, pausedRef])

  const startDrag = (x) => { dragRef.current = { x, startPos: posRef.current } }
  const moveDrag  = (x) => {
    if (!dragRef.current || !trackRef.current) return
    const halfWidth = trackRef.current.scrollWidth / 2
    let next = dragRef.current.startPos + (dragRef.current.x - x)
    if (halfWidth > 0) { while (next >= halfWidth) next -= halfWidth; while (next < 0) next += halfWidth }
    posRef.current = next
    trackRef.current.style.transform = `translateX(-${posRef.current}px)`
  }
  const endDrag = () => { dragRef.current = null }

  return (
    <div className={`overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={e => startDrag(e.clientX)} onMouseMove={e => moveDrag(e.clientX)}
      onMouseUp={endDrag} onMouseLeave={endDrag}
      onTouchStart={e => startDrag(e.touches[0].clientX)}
      onTouchMove={e => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}>
      <div ref={trackRef} className="flex gap-2 sm:gap-3" style={{ width: 'max-content', willChange: 'transform' }}>
        {[...photos, ...photos].map((p, i) => (
          <div key={i} className="shrink-0 overflow-hidden rounded-xl sm:rounded-2xl"
            style={{ height: 'clamp(165px, 19vw, 196px)', width: 'clamp(222px, 25.5vw, 264px)' }}>
            <img src={p.imageUrl} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  )
})

// ── Flowing gallery — 2 rows desktop / 3 rows mobile ─────────────────────────
function FlowingGallery({ photos, L, speedMult = 1 }) {
  const pausedRef = useRef(false)
  const r0 = useRef(), r1 = useRef(), r2 = useRef()

  if (photos.length < 3) return null

  const rows = [[], [], []]
  photos.forEach((p, i) => rows[i % 3].push(p))

  const nudge = (dir) => { const d = dir * 260; r0.current?.nudge(d); r1.current?.nudge(d); r2.current?.nudge(d) }

  const edgeFade = L ? 'rgb(248,249,252)' : 'rgb(6,6,8)'

  return (
    <div className="relative select-none -mx-5 sm:-mx-8">

      {/* Edge fade */}
      <div className="absolute inset-y-0 left-0 w-4 sm:w-7 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${edgeFade}, transparent)` }} />
      <div className="absolute inset-y-0 right-0 w-4 sm:w-7 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${edgeFade}, transparent)` }} />

      <div className="space-y-2 sm:space-y-3">
        <FlowRow ref={r0} photos={rows[0]} speed={0.40 * speedMult} pausedRef={pausedRef} />
        <FlowRow ref={r1} photos={rows[1]} speed={0.32 * speedMult} pausedRef={pausedRef} />
        <FlowRow ref={r2} photos={rows[2]} speed={0.36 * speedMult} pausedRef={pausedRef} className="hidden" />
      </div>

      {/* Arrow buttons */}
      <button onClick={() => nudge(-1)} aria-label="Previous"
        className={`absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${L?'bg-white/80 border-black/10 text-gray-700 hover:bg-white shadow-sm':'bg-black/60 border-white/10 text-white hover:bg-black/80'}`}>
        <ChevronLeft size={15} />
      </button>
      <button onClick={() => nudge(1)} aria-label="Next"
        className={`absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${L?'bg-white/80 border-black/10 text-gray-700 hover:bg-white shadow-sm':'bg-black/60 border-white/10 text-white hover:bg-black/80'}`}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}


// ── All home sections — full-screen each ──────────────────────────────────────
function HomeSections({ L, onJoin }) {
  const { user } = useAuth()
  const isAdminOrCore = user && ['admin','core'].includes(user.role)

  const { data: cardData } = useData(() => postcardsApi.list({ limit: 12 }), 5000)
  const { data: galData  } = useData(() => galleryApi.getPhotos({ type:'club', limit: 24 }), 5000)
  const { data: memData  } = useData(() => membersApi.list(),                5000)
  const { data: coreData } = useData(() => coreApi.list(),                   5000)
  const { data: socData  } = useData(() => socialApi.list(),                 5000)
  const { data: compData } = useData(() => competitionsApi.list(),           5000)
  const { data: actData  } = useData(() => activitiesApi.list(),             5000)
  const { data: magData  } = useData(() => magazineApi.getPublished(),       5000)
  const { data: sectData }    = useData(() => settingsApi.getSections(),  5000)
  const { data: contentData } = useData(() => settingsApi.getContent(),   30000)

  const content = contentData?.content || {}
  const [contentLocal, setContentLocal] = useState({})
  const sub    = (key, fb) => contentLocal[key] ?? content[key] ?? fb
  const saveSub = (key)    => (val) => setContentLocal(prev => ({ ...prev, [key]: val }))

  // Gallery carousel speed — persisted in AppSettings, visible to all via getContent()
  const [localSpeedMult, setLocalSpeedMult] = useState(null)
  const speedSaveRef = useRef(null)
  const gallerySpeedMult = localSpeedMult ?? (parseFloat(content['gallery-speed']) || 1)
  const speedLabel = (v) => v < 0.6 ? 'Slow' : v < 1.4 ? 'Normal' : v < 2.2 ? 'Fast' : 'Very Fast'
  const handleSpeedChange = (v) => {
    setLocalSpeedMult(v)
    clearTimeout(speedSaveRef.current)
    speedSaveRef.current = setTimeout(() => settingsApi.patch('gallery-speed', v).catch(() => {}), 500)
  }

  const postcards   = cardData?.postcards    || []
  const photos      = galData?.photos        || []
  const members     = memData?.members       || []
  const coreMembers = coreData?.members      || []
  const socialLinks = socData?.links         || []
  const competitions= compData?.competitions || []
  const activities  = actData?.activities   || []
  const magazines   = magData?.magazines     || []

  // Section visibility — optimistic local state so admin toggle is instant
  const [localSec, setLocalSec] = useState(null)
  const secVis = localSec || sectData?.sections || {}
  const isOn = (id) => secVis[id] !== false

  const showPastEvents = isAdminOrCore || secVis['show-past-events'] !== false
  const showPastComps  = isAdminOrCore || secVis['show-past-competitions'] !== false
  const showPastActs   = isAdminOrCore || secVis['show-past-activities'] !== false

  const carouselComps = (() => { const c = competitions.filter(x => isCurrentSession(x)); return c.length ? c : (showPastComps ? competitions : []) })()
  const carouselActs  = (() => { const base = activities.filter(a => isAdminOrCore || a.status !== 'draft'); const c = base.filter(x => isCurrentSession(x)); return c.length ? c : (showPastActs ? base : []) })()

  const toggleSec = async (id) => {
    const next = !isOn(id)
    setLocalSec(prev => ({ ...(sectData?.sections || {}), ...(prev || {}), [id]: next }))
    try { await settingsApi.setSectionVisible(id, next) } catch {}
  }

  // Hidden-section banner shown to admin/core for off sections
  const HiddenBanner = () => (
    <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-center gap-2 py-1 text-[11px] font-inter font-medium text-amber-400 bg-amber-950/80 border-b border-amber-800/40 backdrop-blur-sm pointer-events-none">
      <span>⚠</span><span>Hidden from public</span>
    </div>
  )

  const [membersExpanded,    setMembersExpanded]    = useState(false)
  const [memberSessionFilter, setMemberSessionFilter] = useState(() => currentSession())
  const [compsExpanded,   setCompsExpanded]   = useState(false)
  const [coreExpanded,    setCoreExpanded]    = useState(false)

  // ── Join-section editable subtitles ──────────────────────────────────────
  const JOIN_DEFAULTS = {
    sub1: "IEM Photography Club is more than a club — it's a community of passionate visual storytellers united by a love for photography. We capture the essence of our institution, one frame at a time.",
    sub2: "From intimate portrait shoots to large-scale event coverage, from workshops with industry professionals to our own competitions — every experience here is designed to sharpen your eye, grow your craft, and build lifelong friendships.",
  }
  const [joinText,    setJoinText]    = useState(JOIN_DEFAULTS)
  const [joinEditing, setJoinEditing] = useState(false)
  const [joinDraft,   setJoinDraft]   = useState(JOIN_DEFAULTS)
  const [joinSaving,  setJoinSaving]  = useState(false)

  useEffect(() => {
    if (!contentData) return
    setJoinText({
      sub1: content['join-sub1'] || JOIN_DEFAULTS.sub1,
      sub2: content['join-sub2'] || JOIN_DEFAULTS.sub2,
    })
  }, [contentData])

  const saveJoinText = async () => {
    setJoinSaving(true)
    try {
      await Promise.all([
        settingsApi.patch('join-sub1', joinDraft.sub1),
        settingsApi.patch('join-sub2', joinDraft.sub2),
      ])
      setJoinText(joinDraft)
      setJoinEditing(false)
    } catch (e) { /* silent — keep dialog open */ }
    finally { setJoinSaving(false) }
  }

  const darkBg  = (n) => ['bg-[#050505]','bg-[#080808]','bg-black','bg-[#06060a]'][n%4]
  const lightBg = (n) => ['bg-white','bg-gray-50','bg-gray-100','bg-gray-50'][n%4]
  const sectionBg = (n) => L ? lightBg(n) : darkBg(n)

  // ── Connect section editable text ────────────────────────────────────────
  const CONNECT_DEFAULTS = {
    headline: 'Follow Our Journey',
    body: 'Stay connected with IEM Photography Club. Follow us across platforms for behind-the-scenes moments, workshop updates, competition announcements, and our latest photographic work.',
  }
  const [connectEditing, setConnectEditing] = useState(null) // 'headline' | 'body' | null
  const [connectDraft,   setConnectDraft]   = useState('')
  const [connectSaving,  setConnectSaving]  = useState(false)

  const saveConnect = async (key) => {
    setConnectSaving(true)
    try {
      await settingsApi.patch(key, connectDraft)
      saveSub(key)(connectDraft)
      setConnectEditing(null)
    } catch {} finally { setConnectSaving(false) }
  }

  return (
    <>
      {/* ══════════════ CONNECT (social links) ═══════════════ */}
      <section className={`relative flex flex-col items-center justify-center overflow-hidden border-t ${L?'border-black/5 bg-white':'border-white/5 bg-[#070709]'} sec-vis min-h-screen`}
        style={{ padding: 'clamp(40px,12vw,140px) 0' }}>
        {/* Subtle gradient accent */}
        {!L && <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(220,38,38,0.04) 0%, transparent 70%)' }} />}

        <div className="relative z-10 w-full max-w-3xl mx-auto px-5 sm:px-8 flex flex-col items-center text-center">

          {/* Headline — editable */}
          {connectEditing === 'headline' ? (
            <div className="w-full max-w-lg mb-3 space-y-2">
              <textarea
                rows={2}
                value={connectDraft}
                onChange={e => setConnectDraft(e.target.value)}
                className="glass-input w-full text-center font-breathing italic text-2xl sm:text-3xl resize-none"
                style={{ borderRadius:'12px', background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}
              />
              <div className="flex gap-2 justify-center">
                <button onClick={() => saveConnect('connect-headline')} disabled={connectSaving}
                  className={`px-4 py-1.5 rounded-xl font-inter text-xs font-semibold ${L?'bg-gray-900 text-white hover:bg-gray-700':'bg-red-600 hover:bg-red-500 text-white'} transition-colors disabled:opacity-60`}>
                  {connectSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setConnectEditing(null)}
                  className={`px-4 py-1.5 rounded-xl font-inter text-xs ${L?'text-gray-600 border border-black/10':'text-gray-400 border border-white/10'}`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full mb-4 flex flex-col items-center">
              {isAdminOrCore && (
                <button onClick={() => { setConnectDraft(sub('connect-headline', CONNECT_DEFAULTS.headline)); setConnectEditing('headline') }}
                  className={`mb-1 p-1.5 rounded-lg transition-colors ${L?'text-gray-400 hover:text-gray-700':'text-gray-600 hover:text-gray-400'}`}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              <h2 className={`font-breathing italic font-semibold leading-tight break-words text-center max-w-[11rem] sm:max-w-none ${L?'text-gray-900':'text-white'}`}
                style={{ fontSize:'clamp(1.8rem,6.5vw,4rem)' }}>
                {sub('connect-headline', CONNECT_DEFAULTS.headline)}
              </h2>
            </div>
          )}

          {/* Decorative rule */}
          <div className="flex items-center gap-3 mb-7">
            <span className={`h-px w-12 sm:w-16 ${L?'bg-red-300/60':'bg-red-800/50'}`} />
            <span className={`font-inter text-[10px] uppercase tracking-[0.28em] ${L?'text-red-500':'text-red-600'}`}>IEM Photography Club</span>
            <span className={`h-px w-12 sm:w-16 ${L?'bg-red-300/60':'bg-red-800/50'}`} />
          </div>

          {/* Body text — editable */}
          {connectEditing === 'body' ? (
            <div className="w-full max-w-xl mb-8 space-y-2">
              <textarea
                rows={3}
                value={connectDraft}
                onChange={e => setConnectDraft(e.target.value)}
                className="glass-input w-full text-sm resize-none text-center"
                style={{ borderRadius:'12px' }}
              />
              <div className="flex gap-2 justify-center">
                <button onClick={() => saveConnect('connect-body')} disabled={connectSaving}
                  className={`px-4 py-1.5 rounded-xl font-inter text-xs font-semibold ${L?'bg-gray-900 text-white hover:bg-gray-700':'bg-red-600 hover:bg-red-500 text-white'} transition-colors disabled:opacity-60`}>
                  {connectSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setConnectEditing(null)}
                  className={`px-4 py-1.5 rounded-xl font-inter text-xs ${L?'text-gray-600 border border-black/10':'text-gray-400 border border-white/10'}`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl mb-12">
              {isAdminOrCore && (
                <div className="flex justify-center mb-1">
                  <button onClick={() => { setConnectDraft(sub('connect-body', CONNECT_DEFAULTS.body)); setConnectEditing('body') }}
                    className={`p-1.5 rounded-lg transition-colors ${L?'text-gray-400 hover:text-gray-700':'text-gray-600 hover:text-gray-400'}`}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              )}
              <p className={`font-inter text-sm sm:text-lg leading-relaxed break-all text-center w-full ${L?'text-gray-500':'text-gray-400'}`}>
                {sub('connect-body', CONNECT_DEFAULTS.body)}
              </p>
            </div>
          )}

          {/* Social icons */}
          {socialLinks.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mt-2">
              {socialLinks.map((link, i) => (
                <SocialIconCard key={link._id} link={link} index={i} L={L} />
              ))}
            </div>
          ) : (
            isAdminOrCore && (
              <p className={`font-inter text-xs ${L?'text-gray-400':'text-gray-600'} italic`}>
                No social links added yet — add them from the admin Socials tab.
              </p>
            )
          )}

        </div>
      </section>

      {/* ══════════════ POSTCARDS ════════════════════════════ */}
      {(isAdminOrCore || isOn('postcards')) && (
      <FullSection id="postcards" bg={`${sectionBg(0)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('postcards') && <HiddenBanner />}
        {!L && <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage:'radial-gradient(circle at 30% 50%, #dc2626 0%, transparent 60%)' }} />}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 w-full py-10 sm:py-16 flex flex-col justify-center min-h-screen">
          <SectionHeader tag="Photography" title="Postcards"
            subtitle={sub('subtitle-postcards', 'Frames through their eyes — every shot tells a story.')}
            href="/postcards" L={L}
            sectionVisible={isOn('postcards')} onToggleSection={isAdminOrCore ? () => toggleSec('postcards') : undefined}
            settingKey="subtitle-postcards" isEditable={isAdminOrCore} onSave={saveSub('subtitle-postcards')} />
          <div className="sec-content"><PostcardCarousel postcards={postcards} L={L} /></div>
        </div>
      </FullSection>
      )}

      {/* ══════════════ EVENT GALLERY (masonry cinema) ══════════════════════ */}
      {(isAdminOrCore || isOn('event-gallery')) && (
      <FullSection id="event-gallery" bg={`${sectionBg(1)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('event-gallery') && <HiddenBanner />}
        {!L && <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage:'radial-gradient(circle at 60% 40%, #0a0a2e 0%, transparent 60%)' }} />}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 w-full py-8 sm:py-16 flex flex-col justify-center" style={{ minHeight: 'clamp(0px, 60vh, 100vh)' }}>
          <SectionHeader tag="In The Field" title="Event Gallery"
            subtitle={sub('subtitle-event-gallery', 'Behind every event, a story worth telling.')}
            href="/events-gallery" L={L}
            sectionVisible={isOn('event-gallery')} onToggleSection={isAdminOrCore ? () => toggleSec('event-gallery') : undefined}
            settingKey="subtitle-event-gallery" isEditable={isAdminOrCore} onSave={saveSub('subtitle-event-gallery')} />
          <div className="sec-content"><EventCinemaGallery L={L} showPast={showPastEvents} /></div>
        </div>
      </FullSection>
      )}

      {/* ══════════════ GALLERY ══════════════════════════════
          6 cells arranged in a 3×2 grid (2×2 on mobile).
          Each cell independently cycles through club photos
          with staggered timing — no two change simultaneously.
          ══════════════════════════════════════════════════════ */}
      {(isAdminOrCore || isOn('gallery')) && (
      <FullSection id="gallery" bg={`${sectionBg(2)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('gallery') && <HiddenBanner />}
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 w-full py-8 sm:pt-14 sm:pb-24 flex flex-col justify-start sm:justify-start" style={{ minHeight:'clamp(0px,60vh,100vh)' }}>
          <SectionHeader tag="Club Gallery" title="Club Gallery"
            subtitle={sub('subtitle-gallery', 'Every shot tells a story. Our photographers capture the world through their own unique perspective.')}
            href="/gallery" L={L}
            sectionVisible={isOn('gallery')} onToggleSection={isAdminOrCore ? () => toggleSec('gallery') : undefined}
            settingKey="subtitle-gallery" isEditable={isAdminOrCore} onSave={saveSub('subtitle-gallery')} />

          {isAdminOrCore && (
            <div className={`flex items-center gap-3 mb-5 px-1 py-2.5 rounded-2xl border ${L?'bg-black/3 border-black/6':'bg-white/3 border-white/6'}`}>
              <span className={`font-inter text-[11px] uppercase tracking-[0.14em] shrink-0 pl-2 ${L?'text-gray-500':'text-gray-400'}`}>
                Carousel Speed
              </span>
              <input
                type="range" min={0.25} max={3} step={0.05}
                value={gallerySpeedMult}
                onChange={e => handleSpeedChange(parseFloat(e.target.value))}
                className="flex-1 h-1 cursor-pointer accent-red-500"
              />
              <span className={`font-inter text-[11px] shrink-0 pr-2 w-16 text-right tabular-nums ${L?'text-gray-500':'text-gray-400'}`}>
                {speedLabel(gallerySpeedMult)}
              </span>
            </div>
          )}

          <div className="sec-content">
            {photos.length === 0 ? (
              <div className={`rounded-3xl p-16 text-center auth-glass border ${L?'border-black/7':'border-white/7'}`}>
                <p className="text-5xl mb-3">🖼</p>
                <p className={`font-inter text-sm ${L?'text-gray-600':'text-gray-400'}`}>Gallery coming soon</p>
              </div>
            ) : (
              <FlowingGallery photos={photos} L={L} speedMult={gallerySpeedMult} />
            )}
          </div>
        </div>
      </FullSection>
      )}

      {/* ══════════════ MEMBERS ══════════════════════════════
          Two-column editorial layout:
          • Left: core team in a tight 2–3 column grid
          Role-grouped compact grid: Core → Coordinators → Members.
          ══════════════════════════════════════════════════════ */}
      {(isAdminOrCore || isOn('members')) && (
      <FullSection id="members" bg={`${sectionBg(3)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('members') && <HiddenBanner />}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-7 pb-8 sm:pt-14 sm:pb-16 flex flex-col justify-start min-h-screen">

            {/* Heading + Explore */}
            <div className="flex items-start justify-between gap-4 sm:gap-6 mb-2 sm:mb-3">
              <div>
                <h2 className={`sh-heading font-breathing italic font-semibold leading-none ${L?'text-gray-900':'text-white'}`}
                  style={{ fontSize:'clamp(1.5rem, 5.5vw, 3.2rem)' }}>
                  Club Members
                </h2>
                <span className={`font-inter text-xs sm:text-sm uppercase tracking-[0.18em] mt-3 sm:mt-4 block ${L?'text-gray-500':'text-gray-400'}`}>
                  {memberSessionFilter === currentSession() ? `${currentSession()} · Current` : memberSessionFilter}
                </span>
              </div>
              <div className="sh-actions flex items-center gap-2 sm:gap-3 shrink-0 mt-1">
                {members.length > 0 && (
                  <span className={`font-clash text-3xl sm:text-5xl font-black leading-none ${L?'text-black/8':'text-white/8'} hidden sm:block`}>
                    {String(members.filter(m=>m.role!=='admin').length).padStart(2,'0')}
                  </span>
                )}
                {isAdminOrCore && (
                  <SectionToggle visible={isOn('members')} onToggle={() => toggleSec('members')} L={L} />
                )}
                <Link to="/members" className="glass-btn glass-pill inline-flex items-center gap-1.5 font-inter text-[10px] uppercase tracking-[0.18em]"
                  style={{ borderRadius:'50px', minHeight:'28px', padding:'0 14px' }}>
                  See more <ArrowRight size={9} />
                </Link>
              </div>
            </div>

            <EditableInlineSubtitle
              text={sub('subtitle-members', 'The faces behind every frame — photographers, coordinators & core.')}
              settingKey="subtitle-members"
              isEditable={isAdminOrCore}
              onSave={saveSub('subtitle-members')}
              L={L}
              className={`font-inter text-sm sm:text-base max-w-md mt-2 mb-5 sm:mb-8 leading-relaxed ${L?'text-gray-400':'text-gray-500'}`}
            />

            {members.length === 0 ? (
              <p className={`font-inter text-sm ${L?'text-gray-400':'text-gray-600'}`}>Members will appear here once registered.</p>
            ) : (() => {
              const memCurSess = currentSession()
              const sessBase   = parseInt(memCurSess.split('-')[0])

              // Build session data from member endYears
              // "active" = tenure extends into current session (endYear > sessBase)
              const allMems    = members.filter(m => m.role !== 'admin')
              const activeMems = allMems.filter(m => !m.endYear || m.endYear > sessBase)
              const pastMems   = allMems.filter(m => m.endYear && m.endYear <= sessBase)
              const pastByEndY = pastMems.reduce((acc, m) => { (acc[m.endYear] = acc[m.endYear] || []).push(m); return acc }, {})
              const pastEndYrs = Object.keys(pastByEndY).map(Number).sort((a, b) => b - a)
              const endYToSess = y => `${y - 1}-${String(y).slice(-2)}`
              const memAllSess = [memCurSess, ...pastEndYrs.map(endYToSess)]
              const isMemPast  = memberSessionFilter !== memCurSess

              const sessionMems = isMemPast
                ? (pastByEndY[pastEndYrs.find(y => endYToSess(y) === memberSessionFilter)] || [])
                : activeMems

              const core    = sortByYearThenName(sessionMems.filter(m => m.role === 'core'))
              const coords  = sortByYearThenName(sessionMems.filter(m => m.role === 'coordinator'))
              const photogs = sortByYearThenName(sessionMems.filter(m => m.role === 'photographer'))
              // Mobile: 16 (4 rows × 4 cols) — Desktop: 18 (2 rows × 9 cols)
              const COLLAPSED    = 18
              const allItems     = [...core, ...coords, ...photogs]
              const MAX_EXPANDED = 48
              const shown     = membersExpanded ? allItems.slice(0, MAX_EXPANDED) : allItems.slice(0, COLLAPSED)
              const totalLeft = allItems.length - MAX_EXPANDED

              return (
                <div>
                  {/* Session pills */}
                  {memAllSess.length > 1 && (
                    <div className="flex gap-2 flex-wrap items-center mb-4 sm:mb-5">
                      <span className={`font-inter text-[10px] uppercase tracking-widest ${L?'text-gray-400':'text-gray-600'}`}>Session</span>
                      {memAllSess.map(s => (
                        <button key={s} onClick={() => { setMemberSessionFilter(s); setMembersExpanded(false) }}
                          className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-inter text-[10px] sm:text-xs font-semibold border transition-all ${
                            memberSessionFilter === s
                              ? 'bg-red-700 text-white border-red-700'
                              : L ? 'border-black/15 text-gray-600 hover:text-gray-900 hover:border-black/25'
                                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                          }`}>
                          {s}{s === memCurSess ? ' · Current' : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="sec-content grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 sm:gap-4">
                    {shown.map((m, i) => {
                      // Items 16-17: desktop only when collapsed (mobile shows 16, desktop shows 18)
                      const desktopOnly = !membersExpanded && i >= 16
                      const card = m.role === 'core'        ? <MemberRoleCard   m={m} accent="red"  index={i} L={L} />
                                 : m.role === 'coordinator' ? <MemberRoleCard   m={m} accent="blue" index={i} L={L} />
                                 : <MemberCompactCard m={m} index={i} L={L} />
                      return (
                        <Link key={m._id} to={`/members/${m._id}`} className={`reveal-card block ${desktopOnly ? 'hidden lg:block' : ''}`}>
                          {isMemPast ? (
                            <div>
                              <div style={{ filter:'grayscale(0.82) brightness(0.72)', transition:'filter 300ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.filter = 'grayscale(0.2) brightness(0.95)' }}
                                onMouseLeave={e => { e.currentTarget.style.filter = 'grayscale(0.82) brightness(0.72)' }}>
                                {card}
                              </div>
                              <p className="font-inter uppercase tracking-[0.16em] text-center mt-0.5"
                                style={{ fontSize:'clamp(6px,0.9vw,8px)', color:'rgba(160,160,160,0.6)' }}>
                                Alumni
                              </p>
                            </div>
                          ) : card}
                        </Link>
                      )
                    })}
                    {/* "+N more" only in expanded state when capped */}
                    {membersExpanded && totalLeft > 0 && (
                      <Link to="/members"
                        className={`aspect-square rounded-full border-2 border-dashed flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-[1.05] self-start ${
                          L?'border-black/10 text-gray-500 hover:border-red-500/40 hover:text-red-500'
                           :'border-white/10 text-gray-600 hover:border-red-400/40 hover:text-red-400'}`}>
                        <span className="font-inter font-bold leading-none" style={{ fontSize:'clamp(8px,1.5vw,11px)' }}>+{totalLeft}</span>
                        <span className="font-inter leading-none" style={{ fontSize:'clamp(6px,1vw,8px)' }}>more</span>
                      </Link>
                    )}
                  </div>

                  {/* Expand / Collapse button */}
                  {allItems.length > COLLAPSED && (
                    <button onClick={() => setMembersExpanded(v => !v)}
                      className={`mt-5 flex items-center gap-1.5 mx-auto font-inter font-semibold uppercase tracking-[0.12em] px-4 py-1.5 rounded-full transition-all active:scale-95 hover:scale-[1.03] ${
                        L ? 'text-gray-600 border border-black/10 hover:border-red-500/40 hover:text-red-600'
                          : 'text-gray-400 border border-white/10 hover:border-red-400/40 hover:text-red-400'
                      }`} style={{ fontSize:'clamp(9px,1.1vw,11px)', animation:'borderFlicker 4.5s ease-in-out infinite' }}>
                      <span>{membersExpanded ? `Collapse` : `Show all ${allItems.length} members`}</span>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                        className={`transition-transform duration-300 ${membersExpanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })()}
        </div>
      </FullSection>
      )}

      {/* ══════════════ CORE COMMITTEE ════════════════════════
          Current year featured prominently at top.
          Past years in a compact horizontal strip below.
          Portrait cards — tall and magazine-like.
          ══════════════════════════════════════════════════════ */}
      {(isAdminOrCore || isOn('core')) && (
      <FullSection id="core" bg={`${sectionBg(4)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('core') && <HiddenBanner />}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-10 pb-10 sm:pt-14 sm:pb-16 flex flex-col justify-start min-h-screen">
          {/* Heading + Explore button */}
          <div className="flex items-start justify-between gap-6 mb-3 sm:mb-4">
            <h2 className={`sh-heading font-breathing italic font-semibold leading-[1.0] ${L?'text-gray-900':'text-white'}`}
              style={{ fontSize:'clamp(1.5rem, 5.5vw, 3.2rem)' }}>
              Core Committee
            </h2>
            <div className="sh-actions flex items-center gap-2 shrink-0 mt-1">
              {isAdminOrCore && (
                <SectionToggle visible={isOn('core')} onToggle={() => toggleSec('core')} L={L} />
              )}
              <Link to="/core" className="glass-btn glass-pill inline-flex items-center gap-1.5 font-inter text-[9px] uppercase tracking-[0.18em]"
                style={{ borderRadius:'50px', minHeight:'26px', padding:'0 12px' }}>
                See more <ArrowRight size={8} />
              </Link>
            </div>
          </div>
          {/* Subtitle — editable by admin/core */}
          {(() => {
            const coreSubtitle = sub('subtitle-core', 'The minds and hearts behind IEM Photography Club.')
            return <EditableInlineSubtitle
              text={coreSubtitle}
              settingKey="subtitle-core"
              isEditable={isAdminOrCore}
              onSave={saveSub('subtitle-core')}
              L={L}
              className={`font-inter text-sm sm:text-base max-w-md mb-5 sm:mb-6 leading-relaxed ${L?'text-gray-400':'text-gray-500'}`}
            />
          })()}

          {coreMembers.length === 0 ? (
            <div className={`auth-glass rounded-3xl p-16 text-center border ${L?'border-black/7':'border-white/7'}`}>
              <p className="text-5xl mb-3">⭐</p>
              <p className={`font-clash font-semibold ${L?'text-gray-600':'text-gray-400'}`}>Core history coming soon</p>
            </div>
          ) : (() => {
            // Group by year, sort descending (most recent first)
            const byYear = coreMembers.reduce((acc, m) => {
              ;(acc[m.year] = acc[m.year] || []).push(m)
              return acc
            }, {})
            const years = Object.keys(byYear).sort((a,b) => b.localeCompare(a))
            const sortCore = arr => [...arr].sort((a, b) => {
              const aC = (a.designation || '').toLowerCase() === 'core'
              const bC = (b.designation || '').toLowerCase() === 'core'
              if (aC !== bC) return aC ? -1 : 1
              return (a.name || '').localeCompare(b.name || '')
            })

            // Graduation month = May. June = past.
            // "2025-26" endYear=2026: May 2026 → Current, June 2026 → Past.
            // "2026-27" endYear=2027: in all of 2026 → Current.
            const _now = new Date(), _yr = _now.getFullYear(), _mo = _now.getMonth() + 1
            const isCurr = (yearStr) => {
              const endYear = parseInt(yearStr.split('-')[0]) + 1
              return endYear > _yr || (endYear === _yr && _mo < 6)
            }
            const currentYear = years.find(y => isCurr(y)) || null
            const pastYears   = years.filter(y => y !== currentYear)

            // Row 1: current + past[0]      → most recent past year with current
            // Row 2: past[1..3]             → next 3 past years all on row 2 (always visible)
            // Extra: past[4+]              → only when expanded (clubs with many years)
            const row1Past  = pastYears.slice(0, 1)
            const row2Past  = pastYears.slice(1, 4)
            const extraPast = pastYears.slice(4)

            // Helper: render a past year group
            const PastGroup = (year, key, withDivider) => (
              <div key={key} className="flex items-start gap-x-5 sm:gap-x-7 flex-shrink-0 w-full sm:w-auto">
                {withDivider && <div className={`hidden sm:block w-px self-stretch ${L?'bg-black/8':'bg-white/6'}`} />}
                <div className="min-w-0 flex-1 sm:flex-none">
                  <p className={`font-inter text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${L?'text-gray-500':'text-gray-500'}`}>{year}</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {sortCore(byYear[year]).map((m, i) => {
                      const userId = m.linkedUser?._id || (typeof m.linkedUser === 'string' ? m.linkedUser : null)
                      const to = userId ? `/members/${userId}` : `/core-member/${m._id}`
                      return (
                        <Link key={m._id} to={to} className="block">
                          <CoreCard m={m} isCurr={false} index={i} L={L} />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )

            return (
              <div className="space-y-6 sm:space-y-7">

                {/* ── ROW 1: current year + most recent past year ── */}
                <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-5 sm:gap-x-8 gap-y-6">
                  {currentYear && (
                    <div className="w-full sm:w-auto flex-shrink-0">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className={`font-inter text-[11px] sm:text-xs font-bold uppercase tracking-wider ${L?'text-red-600':'text-red-400'}`}>{currentYear}</span>
                        <span className={`font-inter text-[9px] px-1.5 py-0.5 rounded-full ${L?'bg-red-50 text-red-600':'bg-red-900/30 text-red-400'}`}>Current</span>
                      </div>
                      <div className="sec-content flex flex-wrap gap-2 sm:gap-2.5">
                        {sortCore(byYear[currentYear]).map((m, i) => {
                          const userId = m.linkedUser?._id || (typeof m.linkedUser === 'string' ? m.linkedUser : null)
                          const to = userId ? `/members/${userId}` : `/core-member/${m._id}`
                          return (
                            <Link key={m._id} to={to} className="reveal-card block">
                              <CoreCard m={m} isCurr={true} index={i} L={L} />
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {currentYear && row1Past.length > 0 && (
                    <div className={`hidden sm:block w-px self-stretch ${L?'bg-black/10':'bg-white/8'}`} />
                  )}
                  {row1Past.map((year, i) => PastGroup(year, year, i > 0))}
                </div>

                {/* ── ROW 2:
                      Mobile: hidden when collapsed, shown when expanded
                      PC:     always visible (sm:flex overrides hidden) ── */}
                {/* ── ROW 2: hidden on mobile by default, always visible on PC ── */}
                {row2Past.length > 0 && (
                  <div className={`flex-wrap sm:flex-nowrap items-start gap-x-3 sm:gap-x-8 gap-y-6 ${coreExpanded ? 'flex' : 'hidden sm:flex'}`}>
                    {row2Past.map((year, i) => PastGroup(year, year, i > 0))}
                  </div>
                )}

                {/* ── EXTRA ROWS: only when expanded ── */}
                {coreExpanded && extraPast.length > 0 && (
                  <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-5 sm:gap-x-8 gap-y-6">
                    {extraPast.map((year, i) => PastGroup(year, year, i > 0))}
                  </div>
                )}

                {/* Button: mobile shows when row2Past exists, PC shows only for 5+ years */}
                {row2Past.length > 0 && (
                  <button onClick={() => setCoreExpanded(v => !v)}
                    className={`mt-2 flex items-center gap-1.5 mx-auto font-inter font-semibold uppercase tracking-[0.12em] px-4 py-1.5 rounded-full transition-all active:scale-95 hover:scale-[1.03] ${
                      L ? 'text-gray-600 border border-black/10 hover:border-red-500/40 hover:text-red-600'
                        : 'text-gray-400 border border-white/10 hover:border-red-400/40 hover:text-red-400'
                    } ${extraPast.length === 0 ? 'sm:hidden' : ''}`}
                    style={{ fontSize:'clamp(9px,1.1vw,11px)', animation:'borderFlicker 4.5s ease-in-out infinite' }}>
                    <span>
                      {coreExpanded
                        ? 'See Less'
                        : extraPast.length > 0
                          ? `Show ${extraPast.length} more past year${extraPast.length > 1 ? 's' : ''}`
                          : 'Show all past years'}
                    </span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      className={`transition-transform duration-300 ${coreExpanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      </FullSection>
      )}

      {/* ══════════════ COMPETITIONS ════════════════════════ */}
      {(isAdminOrCore || isOn('competitions')) && (
      <FullSection id="competitions" bg={`${sectionBg(5)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('competitions') && <HiddenBanner />}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-7 pb-8 sm:pt-10 sm:pb-16 flex flex-col justify-start min-h-screen">
          <SectionHeader tag="Compete" title="Competitions"
            subtitle={sub('subtitle-competitions', 'Frame the moment. Win recognition.')}
            href="/competitions" L={L}
            sectionVisible={isOn('competitions')} onToggleSection={isAdminOrCore ? () => toggleSec('competitions') : undefined}
            settingKey="subtitle-competitions" isEditable={isAdminOrCore} onSave={saveSub('subtitle-competitions')} />
          <div className="sec-content"><CompetitionSlots competitions={carouselComps} L={L} /></div>
        </div>
      </FullSection>
      )}

      {/* ══════════════ ACTIVITIES ══════════════════════════════ */}
      {(isAdminOrCore || isOn('activities')) && (
      <FullSection id="activities" bg={`${sectionBg(6)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('activities') && <HiddenBanner />}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-7 pb-8 sm:pt-10 sm:pb-16 flex flex-col justify-start min-h-screen">
          <SectionHeader tag="Events" title="Activities"
            subtitle={sub('subtitle-activities', 'Behind every frame, a story worth telling.')}
            href="/activities" L={L}
            sectionVisible={isOn('activities')} onToggleSection={isAdminOrCore ? () => toggleSec('activities') : undefined}
            settingKey="subtitle-activities" isEditable={isAdminOrCore} onSave={saveSub('subtitle-activities')} />
          <div className="sec-content"><ActivityCarousel activities={carouselActs} L={L} /></div>
        </div>
      </FullSection>
      )}

      {/* ══════════════ MAGAZINES ══════════════════════════════ */}
      {(isAdminOrCore || isOn('magazines')) && (
      <FullSection id="magazines" bg={`${sectionBg(7)} border-t ${L?'border-black/5':'border-white/5'}`}>
        {isAdminOrCore && !isOn('magazines') && <HiddenBanner />}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-7 pb-8 sm:pt-10 sm:pb-16 flex flex-col justify-start min-h-screen">
          <SectionHeader tag="Community" title="Magazines"
            subtitle={sub('subtitle-magazines', 'Stories crafted by our photographers.')}
            href="/magazines" L={L}
            sectionVisible={isOn('magazines')} onToggleSection={isAdminOrCore ? () => toggleSec('magazines') : undefined}
            settingKey="subtitle-magazines" isEditable={isAdminOrCore} onSave={saveSub('subtitle-magazines')} />
          <div className="sec-content">
          {magazines.length > 0
            ? <MagazineCovers magazines={magazines} L={L} />
            : <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className={L ? 'text-gray-400' : 'text-gray-600'}>
                  <rect x="3" y="2" width="18" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/>
                </svg>
                <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-600'}`}>No magazines published yet</p>
              </div>
          }
          </div>{/* /sec-content */}
        </div>
      </FullSection>
      )}

      {/* ══════════════ JOIN US ══════════════════════════════ */}
      <FullSection id="join" bg="bg-black">
        <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse at 50% 60%, #1a0010 0%, #000000 65%)' }} />
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)' , backgroundSize:'20px 20px' }} />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-24 flex flex-col items-center justify-center min-h-screen text-center">

          {/* About the club */}
          <h2 className="font-breathing italic font-semibold text-white mb-6"
            style={{ fontSize:'clamp(2rem, 7vw, 4rem)', lineHeight:1.18 }}>
            <span className="join-line1 block">Be Part of Our</span>
            <span className="join-story-span block" style={{ color:'#dc2626', marginTop:'0.18em' }}>Story</span>
          </h2>

          <p className="join-p1 font-inter text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mb-4">
            {joinText.sub1}
          </p>
          <p className="join-p2 font-inter text-sm text-gray-500 leading-relaxed max-w-xl mb-8">
            {joinText.sub2}
          </p>

          {/* Edit button — admin/core only */}
          {isAdminOrCore && !joinEditing && (
            <button
              onClick={() => { setJoinDraft(joinText); setJoinEditing(true) }}
              className="mb-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-inter text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/25 transition-all"
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit text
            </button>
          )}

          {/* Inline edit panel — admin/core only */}
          {isAdminOrCore && joinEditing && (
            <div className="w-full max-w-xl mb-8 text-left space-y-3 p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
              <p className="font-inter text-[10px] uppercase tracking-widest text-gray-500 mb-1">Edit subtitles</p>
              <div>
                <label className="font-inter text-[10px] text-gray-500 mb-1 block">Paragraph 1</label>
                <textarea
                  rows={3}
                  value={joinDraft.sub1}
                  onChange={e => setJoinDraft(d => ({ ...d, sub1: e.target.value }))}
                  className="glass-input w-full text-sm resize-none"
                  style={{ borderRadius:'10px' }}
                />
              </div>
              <div>
                <label className="font-inter text-[10px] text-gray-500 mb-1 block">Paragraph 2</label>
                <textarea
                  rows={3}
                  value={joinDraft.sub2}
                  onChange={e => setJoinDraft(d => ({ ...d, sub2: e.target.value }))}
                  className="glass-input w-full text-sm resize-none"
                  style={{ borderRadius:'10px' }}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveJoinText}
                  disabled={joinSaving}
                  className="flex-1 py-2 rounded-xl font-inter text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60"
                >
                  {joinSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setJoinEditing(false)}
                  className="px-4 py-2 rounded-xl font-inter text-sm text-gray-400 border border-white/10 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="join-cta flex flex-col items-center">
            <GlassButton variant="red" onClick={onJoin}
              className="glass-pill px-12 font-inter text-base font-semibold tracking-[0.06em]"
              style={{ minHeight:'58px' }}>
              Become a Member →
            </GlassButton>
            <p className="font-inter text-xs text-gray-600 mt-4">Free to join · Open to all IEM students</p>
          </div>
        </div>
      </FullSection>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MainPage({ onLoginSuccess }) {
  const [mousePos,      setMousePos]      = useState({ x: 0, y: 0 })
  const [titleRevealed, setTitleRevealed] = useState(false)
  const [mobileGlitch,  setMobileGlitch]  = useState(false)
  // Skip the loader when the hero has already played this session (e.g. back-navigation).
  const heroShownThisSession = sessionStorage.getItem('iempc_hero_shown') === '1'
  const [deskVideoReady, setDeskVideoReady] = useState(heroShownThisSession)
  const [mobVideoReady,  setMobVideoReady]  = useState(heroShownThisSession)
  const [heroReveal,     setHeroReveal]     = useState(false)   // drives navbar + content fade-in (synced)
  const [videoProgress,  setVideoProgress]  = useState(0)       // 0–1, for the bottom intro loader
  const glitchTimer  = useRef(null)
  const mouseMoveRaf = useRef(null)
  const openAuth = () => document.dispatchEvent(new CustomEvent('open-auth'))
  const { theme }         = useTheme()
  const { user }          = useAuth()
  const L = theme === 'light'
  const isAdminOrCore = user && ['admin', 'core'].includes(user.role)
  const { data: heroSettingData }  = useData(() => settingsApi.getContent(), 5000)
  const { data: activeThemeData }  = useData(() => heroThemesApi.getActive(), 20000)
  const activeTheme    = activeThemeData?.theme
  const isCustomTheme  = !!(activeTheme && !activeTheme.isDefault)

  // Cache last-seen custom state so first render starts in the right mode — prevents classic→video flash
  const [cachedHeroIsCustom] = useState(() => {
    try { return localStorage.getItem('_heroIsCustom') === '1' } catch { return false }
  })
  useEffect(() => {
    if (activeTheme !== undefined) {
      try { localStorage.setItem('_heroIsCustom', isCustomTheme ? '1' : '0') } catch {}
    }
  }, [isCustomTheme]) // eslint-disable-line

  // Derived theme settings — fall back to defaults when not set / auto
  const themePcVideoUrl     = isCustomTheme && activeTheme.pcVideoUrl
    ? activeTheme.pcVideoUrl
    : 'https://college-photography-competition-iem.s3.ap-south-1.amazonaws.com/videos/hero-desktop.mp4'
  const themeMobileVideoUrl = isCustomTheme
    ? (activeTheme.useSingleVideo ? activeTheme.pcVideoUrl : (activeTheme.mobileVideoUrl || activeTheme.pcVideoUrl)) ||
      'https://college-photography-competition-iem.s3.ap-south-1.amazonaws.com/videos/hero-mobile.mp4'
    : 'https://college-photography-competition-iem.s3.ap-south-1.amazonaws.com/videos/hero-mobile.mp4'
  const themeBlur         = isCustomTheme && !activeTheme.blurAuto     ? activeTheme.blur     : 2.5
  const themeBlurMobile   = isCustomTheme && !activeTheme.blurAuto     ? activeTheme.blur     : 3
  const themeDarkness     = isCustomTheme && !activeTheme.darknessAuto ? activeTheme.darkness : 0.46
  const themeDarknessMob  = isCustomTheme && !activeTheme.darknessAuto ? activeTheme.darkness : 0.50
  const themeNavbarBg     = isCustomTheme && !activeTheme.navbarBgAuto ? activeTheme.navbarBg : null
  const themeHeroColor    = isCustomTheme && !activeTheme.heroTextColorAuto ? activeTheme.heroTextColor : null
  const themeTagline      = isCustomTheme ? (activeTheme.tagline || '') : ''
  const themeIntroMode    = isCustomTheme ? (activeTheme.introMode    || 'immediate') : 'immediate'
  const themeIntroDelay   = isCustomTheme ? (activeTheme.introDelay   ?? 3)           : 3
  const themeAfterPlayMode= isCustomTheme ? (activeTheme.afterPlayMode|| 'loop')      : 'loop'
  const themeAfterPlayBlur= isCustomTheme ? (activeTheme.afterPlayBlur ?? 8)          : 8
  // Saturation: auto (or default) → full grayscale; slider value → partial grayscale
  const themeSatAuto      = isCustomTheme ? (activeTheme.saturationAuto ?? true)      : true
  const themeGrayscale    = themeSatAuto  ? '1.00' : ((100 - (activeTheme?.saturation ?? 0)) / 100).toFixed(2)
  // Brightness: auto → hardcoded defaults (0.44 desktop / 0.48 mobile); slider value / 100
  const themeBrightAuto   = isCustomTheme ? (activeTheme.brightnessAuto ?? true)      : true
  const themeBrightVal    = isCustomTheme ? (activeTheme.brightness ?? 44)            : 44
  const themeBrightDesk   = themeBrightAuto ? '0.44' : (themeBrightVal / 100).toFixed(2)
  const themeBrightMob    = themeBrightAuto ? '0.48' : (themeBrightVal / 100).toFixed(2)
  // Warmth: auto → no filter; slider value → sepia+hue-rotate for amber warmth (not flat tint)
  const themeWarmthAuto   = isCustomTheme ? (activeTheme.warmthAuto ?? true)          : true
  const _W                = themeWarmthAuto ? 0 : ((activeTheme?.warmth ?? 0) / 100)
  const themeWarmth       = _W <= 0 ? '' : `sepia(${(_W*0.65).toFixed(2)}) hue-rotate(${(-_W*18).toFixed(1)}deg) `

  // Intro mode state — controls hero text visibility for timed / after-first-play
  const [heroTextRevealed, setHeroTextRevealed] = useState(true)
  const [afterPlayBlurOn,  setAfterPlayBlurOn]  = useState(false)
  const heroIntroTimer = useRef(null)
  const deskVideoRef   = useRef(null)
  const mobileVideoRef = useRef(null)

  // Only load the hero video that's actually visible at this viewport (sm breakpoint = 640px),
  // so a desktop never downloads the 9:16 video and a phone never downloads the 16:9 one.
  const [heroIsMobile, setHeroIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const onR = () => setHeroIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  // Reset intro state whenever the active theme changes
  useEffect(() => {
    if (activeTheme?._id === undefined) return   // skip initial undefined
    clearTimeout(heroIntroTimer.current)
    setAfterPlayBlurOn(false)
    setVideoProgress(0)
    setHeroTextRevealed(themeIntroMode === 'immediate')
  }, [activeTheme?._id, themeIntroMode]) // eslint-disable-line

  // When the admin actually switches to a DIFFERENT theme (not just initial API load),
  // force the video loader to show once for the new video.
  // We track the previous ID with a ref so "undefined → real ID on mount" is not treated as a switch.
  const prevThemeIdRef = useRef(null)
  useEffect(() => {
    if (!activeTheme?._id) return
    if (prevThemeIdRef.current !== null && prevThemeIdRef.current !== activeTheme._id) {
      sessionStorage.removeItem('iempc_hero_shown')
      setDeskVideoReady(false)
      setMobVideoReady(false)
    }
    prevThemeIdRef.current = activeTheme._id
  }, [activeTheme?._id]) // eslint-disable-line

  // Track video playback progress (0–1) for the bottom intro loader
  const handleVideoTimeUpdate = (e) => {
    const v = e.currentTarget
    if (v.duration) setVideoProgress(Math.min(1, v.currentTime / v.duration))
  }

  // (Timed-intro timer now lives below — it starts once the video is actually ready to play,
  //  so the countdown to the text reveal tracks the video the visitor is watching.)

  const handleDeskVideoEnded = () => {
    if (themeIntroMode === 'after-first-play' && !heroTextRevealed) setHeroTextRevealed(true)
    if (themeAfterPlayMode === 'blur-loop') setAfterPlayBlurOn(true)
    deskVideoRef.current?.play()
  }
  const handleMobileVideoEnded = () => {
    if (themeIntroMode === 'after-first-play' && !heroTextRevealed) setHeroTextRevealed(true)
    if (themeAfterPlayMode === 'blur-loop') setAfterPlayBlurOn(true)
    mobileVideoRef.current?.play()
  }

  // Desktop hero: 'classic' or 'video'. Admin sets via backend (all users see the change).
  // localStorage is only an instant-render cache — backend is authoritative.
  const [desktopHeroMode, setDesktopHeroMode] = useState(() => {
    try { return localStorage.getItem('desktopHeroMode') || 'classic' } catch { return 'classic' }
  })

  // Sync from backend so every user sees whatever admin last configured
  useEffect(() => {
    const saved = heroSettingData?.content?.['desktopHeroMode']
    if (saved) {
      try { localStorage.setItem('desktopHeroMode', saved) } catch {}
      setDesktopHeroMode(prev => {
        if (prev !== saved) { setDeskVideoReady(false); setMobVideoReady(false); sessionStorage.removeItem('iempc_hero_shown') }
        return saved
      })
    }
  }, [heroSettingData])

  const toggleDesktopHero = () => {
    sessionStorage.removeItem('iempc_hero_shown')
    setDeskVideoReady(false)
    setDesktopHeroMode(m => {
      const next = m === 'classic' ? 'video' : 'classic'
      try { localStorage.setItem('desktopHeroMode', next) } catch {}
      settingsApi.patch('desktopHeroMode', next).catch(() => {})
      return next
    })
  }
  // Custom theme always forces video mode on desktop.
  // Use cached flag while API is still loading so we start in the right mode immediately.
  const isVideoMode        = desktopHeroMode === 'video'
  const effectiveIsCustom  = activeTheme !== undefined ? isCustomTheme : cachedHeroIsCustom
  const effectiveVideoMode = effectiveIsCustom ? true : isVideoMode

  // When the active theme changes, React only updates <source src> — the browser must be told to reload.
  // We call .load() + .play() so the new video actually starts playing.
  useEffect(() => {
    if (!deskVideoRef.current || !effectiveVideoMode) return
    deskVideoRef.current.load()
    deskVideoRef.current.play().catch(() => {})
  }, [themePcVideoUrl]) // eslint-disable-line

  useEffect(() => {
    if (!mobileVideoRef.current) return
    mobileVideoRef.current.load()
    mobileVideoRef.current.play().catch(() => {})
  }, [themeMobileVideoUrl]) // eslint-disable-line

  // ── Intro / reveal orchestration ────────────────────────────────────────────
  // The mobile hero is always video-based, so it counts as a "video hero" even when
  // the desktop mode is classic.
  const heroHasVideo = effectiveVideoMode || heroIsMobile
  // "Ready to show" = the visible hero video can play (or there's no video to wait for).
  const videoReady = !heroHasVideo ? true
    : heroIsMobile ? (mobVideoReady || !themeMobileVideoUrl)
    : (deskVideoReady || !themePcVideoUrl)

  // Timed intro: once the video is ready, count down, then reveal the text.
  useEffect(() => {
    if (themeIntroMode !== 'timed' || !videoReady || heroTextRevealed) return
    heroIntroTimer.current = setTimeout(() => setHeroTextRevealed(true), themeIntroDelay * 1000)
    return () => clearTimeout(heroIntroTimer.current)
  }, [themeIntroMode, themeIntroDelay, videoReady]) // eslint-disable-line

  // Navbar + content fade-in, synced with the text reveal.
  useEffect(() => {
    if (!heroHasVideo) { const t = setTimeout(() => setHeroReveal(true), 120); return () => clearTimeout(t) }
    setHeroReveal(videoReady && heroTextRevealed)
  }, [heroHasVideo, videoReady, heroTextRevealed])

  // Safety net: never trap the visitor behind a loader if the video stalls/fails to load.
  useEffect(() => {
    if (!heroHasVideo || videoReady) return
    const t = setTimeout(() => { setDeskVideoReady(true); setMobVideoReady(true) }, 9000)
    return () => clearTimeout(t)
  }, [heroHasVideo, videoReady])

  // Mark hero as seen once it's ready — so back-navigation skips the loader entirely.
  useEffect(() => {
    if (videoReady) sessionStorage.setItem('iempc_hero_shown', '1')
  }, [videoReady])

  // Continuously save scroll position during main-page browsing so back-navigation
  // can restore the exact spot (SPA nav never fires beforeunload, so App.jsx can't save it).
  useEffect(() => {
    let ticking = false
    const handler = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        sessionStorage.setItem('iempc_scroll_y',    String(window.scrollY))
        sessionStorage.setItem('iempc_scroll_path', '/')
        ticking = false
      })
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Restore scroll when returning via back-navigation (intro already seen → no lock).
  useEffect(() => {
    if (!heroShownThisSession) return          // fresh visit — let intro play, don't scroll
    const savedPath = sessionStorage.getItem('iempc_scroll_path')
    const savedY    = parseInt(sessionStorage.getItem('iempc_scroll_y') || '0', 10)
    if (savedPath === '/' && savedY > 0) {
      const t = setTimeout(() => window.scrollTo({ top: savedY, behavior: 'instant' }), 80)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line

  // Lock scroll/interaction until the intro completes (pre-video load for any mode;
  // and through the full timed / after-first-play sequence until the text arrives).
  const introLocked = heroHasVideo && (
    !videoReady ||
    ((themeIntroMode === 'timed' || themeIntroMode === 'after-first-play') && !heroTextRevealed)
  )
  useEffect(() => {
    if (!introLocked) return
    try { window.scrollTo(0, 0) } catch {}
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const block    = e => e.preventDefault()
    const blockKey = e => { if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Spacebar'].includes(e.key)) e.preventDefault() }
    window.addEventListener('wheel', block, { passive: false })
    window.addEventListener('touchmove', block, { passive: false })
    window.addEventListener('keydown', blockKey, { passive: false })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('wheel', block)
      window.removeEventListener('touchmove', block)
      window.removeEventListener('keydown', blockKey)
    }
  }, [introLocked])

  const showBottomLoader = heroHasVideo && videoReady && !heroTextRevealed &&
    (themeIntroMode === 'timed' || themeIntroMode === 'after-first-play')

  const onMouseMove = e => {
    if (mouseMoveRaf.current) return          // skip if a frame is already queued
    const cx = e.clientX, cy = e.clientY
    mouseMoveRaf.current = requestAnimationFrame(() => {
      setMousePos({
        x: (cx / window.innerWidth  - 0.5) * 20,
        y: (cy / window.innerHeight - 0.5) * 20,
      })
      mouseMoveRaf.current = null
    })
  }

  const handleMobileTitleClick = () => {
    if (!titleRevealed) return
    clearTimeout(glitchTimer.current)
    setMobileGlitch(true)
    glitchTimer.current = setTimeout(() => setMobileGlitch(false), 1600)
  }

  // Desktop video hero — same glitch-on-click behaviour as mobile
  const [deskTitleRevealed, setDeskTitleRevealed] = useState(false)
  const [deskGlitch,        setDeskGlitch]        = useState(false)
  const [deskHover,         setDeskHover]         = useState(false)
  const deskGlitchTimer = useRef(null)
  const handleDeskTitleClick = () => {
    if (!deskTitleRevealed) return
    clearTimeout(deskGlitchTimer.current)
    setDeskGlitch(true)
    deskGlitchTimer.current = setTimeout(() => setDeskGlitch(false), 1600)
  }



  return (
    <div className={`min-h-screen relative animate-quick-zoom transition-colors duration-300 ${L ? 'bg-gray-50 text-gray-900' : 'bg-[#050505] text-gray-200'}`} onMouseMove={onMouseMove}>
      {!L && <div className="bg-grain" />}
      <Navbar
        onJoinClick={() => document.dispatchEvent(new CustomEvent('open-auth'))}
        heroMode={isAdminOrCore ? desktopHeroMode : null}
        onToggleHeroMode={isAdminOrCore && !isCustomTheme ? toggleDesktopHero : null}
        themeNavbarBg={themeNavbarBg}
        introReveal={heroReveal}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header id="home"
        className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center overflow-hidden transition-colors duration-300"
        style={{ background: effectiveVideoMode ? '#000' : (L ? '#f9fafb' : '#050505') }}>

        {/* ── Pre-video loader — neomorphic liquid-glass, shown while the hero video buffers ── */}
        {heroHasVideo && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none"
            style={{ background:'#000', opacity: videoReady ? 0 : 1, transition:'opacity 0.7s ease', visibility: videoReady ? 'hidden' : 'visible', transitionProperty:'opacity, visibility', transitionDuration:'0.7s' }}>
            <div style={{
              position:'relative', width:118, height:118, borderRadius:'50%', overflow:'hidden',
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(255,255,255,0.035)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
              boxShadow:'-5px -5px 14px rgba(255,255,255,0.045), 7px 7px 22px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.07)',
            }}>
              {/* sweeping conic ring */}
              <div className="animate-spin" style={{ position:'absolute', inset:7, borderRadius:'50%',
                background:'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.55) 300deg, transparent 360deg)',
                WebkitMask:'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
                mask:'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))', animationDuration:'1.15s' }}/>
              <img src="/IEM_20260416_215615_0000.png" alt="" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', opacity:0.92 }}/>
              {/* liquid sheen */}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(110deg, transparent 32%, rgba(255,255,255,0.16) 50%, transparent 68%)', animation:'liquidSheen 1.9s ease-in-out infinite' }}/>
            </div>
            <p className="font-inter" style={{ marginTop:18, fontSize:10.5, letterSpacing:'0.36em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)', animation:'loaderPulse 1.6s ease-in-out infinite' }}>Loading</p>
          </div>
        )}

        {/* ── Bottom intro loader — advances with the video, vanishes as the text arrives ── */}
        {showBottomLoader && (
          <div className="absolute left-1/2 z-50 pointer-events-none" style={{ bottom:30, transform:'translateX(-50%)', width:148 }}>
            <div style={{
              position:'relative', height:7, borderRadius:999, overflow:'hidden',
              background:'rgba(255,255,255,0.06)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
              boxShadow:'inset 1px 1px 3px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.06)',
            }}>
              <div style={{
                position:'absolute', left:0, top:0, bottom:0, borderRadius:999,
                background:'linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0.8))',
                boxShadow:'0 0 8px rgba(255,255,255,0.35)',
                ...(themeIntroMode === 'timed'
                  ? { width:'100%', animation:`loaderBarFill ${themeIntroDelay}s linear forwards` }
                  : { width:`${Math.round(videoProgress * 100)}%`, transition:'width 0.25s linear' }),
              }}/>
            </div>
          </div>
        )}

        {/* Ambient blobs — classic mode only */}
        {!effectiveVideoMode && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-red-900/10 rounded-full blur-[120px]" />
          </div>
        )}

        {/* Parallax lens rings — classic mode only */}
        {!effectiveVideoMode && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none lens-container sm:translate-y-[10%]"
            style={{ transform: `rotateX(${-mousePos.y * 0.5}deg) rotateY(${mousePos.x * 0.5}deg)` }}
          >
            <div className="lens-ring w-[190px] h-[190px] sm:w-[380px] sm:h-[380px] md:w-[600px] md:h-[600px] border-white/[4%] opacity-50" />
            <div className="lens-ring w-[155px] h-[155px] sm:w-[315px] sm:h-[315px] md:w-[500px] md:h-[500px] border-t-white/[7%] border-b-transparent animate-spin-slow" />
            <div className="lens-ring w-[120px] h-[120px] sm:w-[250px] sm:h-[250px] md:w-[400px] md:h-[400px] border-dashed border-red-500/[8%]" />
          </div>
        )}

        {/* Viewfinder corners — desktop classic mode only */}
        {!effectiveVideoMode && (
          <div className="hidden sm:flex absolute inset-0 pointer-events-none z-20 p-6 md:p-8 flex-col justify-between">
            <div className="flex justify-between">
              <div className="w-4 h-4 md:w-5 md:h-5 border-t border-l border-white/20 rounded-tl" />
              <div className="w-4 h-4 md:w-5 md:h-5 border-t border-r border-white/20 rounded-tr" />
            </div>
            <div className="flex justify-between">
              <div className="w-4 h-4 md:w-5 md:h-5 border-b border-l border-white/20 rounded-bl" />
              <div className="w-4 h-4 md:w-5 md:h-5 border-b border-r border-white/20 rounded-br" />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DESKTOP VIDEO HERO  (hidden sm:block) — landscape video + glass
            Only rendered when desktopHeroMode === 'video'
            ══════════════════════════════════════════════════════════════════ */}

        {/* Desktop landscape video background */}
        {effectiveVideoMode && (
          /* Entire background layer fades in as one unit — video + all overlays together.
             This prevents the backdrop-filter "snap" that happens when blur has
             nothing to blur until the first video frame arrives. */
          <div className="hidden sm:block absolute inset-0 z-10 overflow-hidden"
            style={{
              background: '#000',
              opacity: deskVideoReady ? 1 : 0,
              transition: 'opacity 1.1s cubic-bezier(0.4,0,0.2,1)',
              willChange: 'opacity',
            }}>
            {!heroIsMobile && (
              <video
                ref={deskVideoRef}
                autoPlay muted playsInline preload="auto"
                loop={themeIntroMode !== 'after-first-play'}
                onLoadedData={() => setDeskVideoReady(true)}
                onCanPlay={() => setDeskVideoReady(true)}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleDeskVideoEnded}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: `grayscale(${themeGrayscale}) ${themeWarmth}brightness(${themeBrightDesk}) contrast(1.18)` }}
              >
                <source src={themePcVideoUrl} type="video/mp4" />
              </video>
            )}
            {/* Top vignette — helps navbar white text stand out */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: '130px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.32) 65%, transparent 100%)',
              zIndex: 2,
            }} />
            {/* Frosted glass layer */}
            <div className="absolute inset-0" style={{
              background: `rgba(3,3,10,${themeDarkness})`,
              backdropFilter: `blur(${themeBlur}px)`,
              WebkitBackdropFilter: `blur(${themeBlur}px)`,
            }} />
            {/* After-play blur overlay (blur-loop mode) */}
            {afterPlayBlurOn && (
              <div className="absolute inset-0 pointer-events-none" style={{
                backdropFilter: `blur(${themeAfterPlayBlur}px)`,
                WebkitBackdropFilter: `blur(${themeAfterPlayBlur}px)`,
                animation: 'mobileTaglineReveal 0.8s ease both',
              }} />
            )}
            {/* Diagonal glass shine */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(128deg, rgba(255,255,255,0.07) 0%, transparent 38%, transparent 62%, rgba(255,255,255,0.035) 100%)',
            }} />
            {/* Top-edge glass glint */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.28) 28%, rgba(255,255,255,0.50) 50%, rgba(255,255,255,0.28) 72%, transparent 95%)',
            }} />
            {/* Bottom fade to dark */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
              height: '260px',
              background: 'linear-gradient(to top, rgba(5,5,8,0.98) 0%, rgba(5,5,8,0.5) 55%, transparent 100%)',
            }} />
          </div>
        )}

        {/* Desktop video hero content — rendered only after video is ready,
            so text entrance always plays over a visible background, never over black */}
        {effectiveVideoMode && deskVideoReady && heroTextRevealed && (
          <div className="hidden sm:flex absolute inset-0 z-30 flex-col items-center justify-center px-8"
            key={`desk-text-${heroTextRevealed}`}
            style={{ paddingTop: '7vh' }}>
            <div className="relative z-10 flex flex-col items-center text-center">

              {/* "Welcome to" — fades in after heading settles */}
              <p className="font-inter text-gray-300/60 uppercase mb-5"
                style={{
                  fontSize: '0.72rem', letterSpacing: '0.30em',
                  animation: 'mobileTaglineReveal 0.7s ease 1.9s both',
                }}>
                Welcome to
              </p>

              {/* Club name — same reveal + glitch as mobile */}
              <h1
                className="font-clash uppercase cursor-pointer select-none"
                onClick={handleDeskTitleClick}
                onAnimationEnd={e => { if (e.animationName === 'mobileTextReveal') setDeskTitleRevealed(true) }}
                onMouseEnter={() => setDeskHover(true)}
                onMouseLeave={() => setDeskHover(false)}
                style={{
                  lineHeight: 0.96,
                  animation: deskGlitch
                    ? 'mobileGlitchBurst 0.3s ease both infinite'
                    : deskTitleRevealed
                      ? 'none'
                      : 'mobileTextReveal 1.6s ease 0.3s both',
                  filter: (deskTitleRevealed && !deskGlitch)
                    ? deskHover
                      ? 'drop-shadow(0 0 42px rgba(190,190,190,0.30)) drop-shadow(0 3px 22px rgba(0,0,0,1))'
                      : 'drop-shadow(0 0 28px rgba(160,160,160,0.16)) drop-shadow(0 3px 20px rgba(0,0,0,1))'
                    : undefined,
                  transition: 'filter 0.4s ease',
                }}>
                {['IEM PHOTOGRAPHY', 'CLUB'].map((word, i) => (
                  <span key={word} className="block font-black" style={{
                    fontSize: i === 0 ? 'clamp(4.2rem,8.6vw,8rem)' : 'clamp(3.2rem,6.6vw,6rem)',
                    lineHeight: 1.05,
                    textAlign: 'center',
                    letterSpacing: i === 1 ? '0.16em' : '-0.01em',
                    marginTop: i === 1 ? '0.06em' : '0',
                    ...(themeHeroColor ? {
                      color: themeHeroColor,
                      WebkitTextFillColor: themeHeroColor,
                    } : {
                      backgroundImage: 'linear-gradient(90deg,#d0d0d0 0%,#a0a0a0 12%,#cccccc 26%,#aeaeae 40%,#e0e0e0 54%,#a0a0a0 68%,#cecece 82%,#aeaeae 96%,#d0d0d0 100%)',
                      backgroundSize: '300% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                      animation: 'textPan 10s ease infinite',
                    }),
                  }}>
                    {word}
                  </span>
                ))}
              </h1>

              {/* Thin divider */}
              <div style={{
                width: 64, height: 1,
                background: 'rgba(255,255,255,0.18)',
                margin: '22px auto',
                animation: 'mobileTaglineReveal 0.5s ease 2.1s both',
              }} />

              {/* Permanent subtitle */}
              <p className="font-inter text-gray-300/65 uppercase"
                style={{
                  fontSize: '0.62rem', letterSpacing: '0.24em',
                  animation: 'mobileTaglineReveal 0.7s ease 2.2s both',
                }}>
                The Official Page of IEM Photography Club
              </p>

              {/* Custom tagline from active theme */}
              {themeTagline && (
                <p className="font-inter text-white/85 uppercase font-bold mt-4"
                  style={{
                    fontSize: '0.92rem', letterSpacing: '0.20em',
                    animation: 'mobileTaglineReveal 1.0s cubic-bezier(0.16,1,0.3,1) 2.15s both, taglineBreath 4.5s ease-in-out 3.4s infinite',
                  }}>
                  {themeTagline}
                </p>
              )}
            </div>
          </div>
        )}

{/* toggle rendered via portal below */}


        {/* ══════════════════════════════════════════════════════════════════
            MOBILE HERO  (sm:hidden) — video glass background + new layout
            Desktop is untouched below.
            ══════════════════════════════════════════════════════════════════ */}

        {/* ── Mobile video background with glass effect ── */}
        <div className="sm:hidden absolute inset-0 z-10 overflow-hidden">
          {heroIsMobile && (
            <video
              ref={mobileVideoRef}
              autoPlay muted playsInline preload="auto"
              loop={themeIntroMode !== 'after-first-play'}
              onLoadedData={() => setMobVideoReady(true)}
              onCanPlay={() => setMobVideoReady(true)}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleMobileVideoEnded}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: `grayscale(${themeGrayscale}) ${themeWarmth}brightness(${themeBrightMob}) contrast(1.2)` }}
            >
              <source src={themeMobileVideoUrl} type="video/mp4" />
            </video>
          )}
          {/* Frosted glass layer */}
          <div className="absolute inset-0" style={{
            background: `rgba(3,3,10,${themeDarknessMob})`,
            backdropFilter: `blur(${themeBlurMobile}px)`,
            WebkitBackdropFilter: `blur(${themeBlurMobile}px)`,
          }} />
          {/* After-play blur overlay */}
          {afterPlayBlurOn && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backdropFilter: `blur(${themeAfterPlayBlur}px)`,
              WebkitBackdropFilter: `blur(${themeAfterPlayBlur}px)`,
              animation: 'mobileTaglineReveal 0.8s ease both',
            }} />
          )}
          {/* Diagonal glass shine */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(128deg, rgba(255,255,255,0.08) 0%, transparent 38%, transparent 62%, rgba(255,255,255,0.04) 100%)',
          }} />
          {/* Top-edge glass glint */}
          <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.35) 28%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.35) 72%, transparent 95%)',
          }} />
          {/* Bottom fade to dark */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
            height: '200px',
            background: 'linear-gradient(to top, rgba(5,5,8,0.98) 0%, rgba(5,5,8,0.5) 50%, transparent 100%)',
          }} />
        </div>

        {/* ── Mobile hero content ── */}
        {videoReady && heroTextRevealed && (
        <div className="sm:hidden absolute inset-0 z-30 flex flex-col items-center justify-center px-7"
          key={`mob-text-${heroTextRevealed}`}
          style={{ paddingTop: '3.75rem' }}>
          <div className="relative z-10 w-full flex flex-col items-center text-center">

            {/* Club name — cinematic entrance + click-glitch */}
            <h1
              className="font-clash uppercase w-full cursor-pointer select-none"
              onClick={handleMobileTitleClick}
              onAnimationEnd={e => { if (e.animationName === 'mobileTextReveal') setTitleRevealed(true) }}
              style={{
                lineHeight: 0.96,
                textAlign: 'center',
                animation: mobileGlitch
                  ? 'mobileGlitchBurst 0.3s ease both infinite'
                  : titleRevealed
                    ? 'none'
                    : 'mobileTextReveal 1.6s ease 0.25s both',
                filter: (titleRevealed && !mobileGlitch)
                  ? 'drop-shadow(0 0 28px rgba(160,160,160,0.16)) drop-shadow(0 3px 20px rgba(0,0,0,1))'
                  : undefined,
              }}
            >
              {['IEM PHOTOGRAPHY', 'CLUB'].map((word, i) => (
                <span
                  key={word}
                  className="block font-black"
                  style={{
                    fontSize: 'clamp(2rem,8.8vw,2.6rem)',
                    lineHeight: 1.05,
                    textAlign: 'center',
                    letterSpacing: i === 1 ? '0.14em' : '-0.01em',
                    marginTop: i === 1 ? '0.08em' : '0',
                    ...(themeHeroColor ? {
                      color: themeHeroColor,
                      WebkitTextFillColor: themeHeroColor,
                    } : {
                      backgroundImage: 'linear-gradient(90deg,#dcdcdc 0%,#b8b8b8 12%,#d8d8d8 26%,#c0c0c0 40%,#ebebeb 54%,#b8b8b8 68%,#e0e0e0 82%,#c0c0c0 96%,#dcdcdc 100%)',
                      backgroundSize: '300% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                      animation: 'textPan 10s ease infinite',
                    }),
                  }}
                >
                  {word}
                </span>
              ))}
            </h1>

            {/* Permanent subtitle */}
            <p
              className="font-inter text-gray-300/75 uppercase mt-3"
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.22em',
                animation: 'mobileTaglineReveal 0.7s ease 1.85s both',
              }}
            >
              The Official Page of IEM Photography Club
            </p>

            {/* Custom tagline from active theme */}
            {themeTagline && (
              <p className="font-inter text-white/85 uppercase font-bold mt-5"
                style={{
                  fontSize: '0.72rem', letterSpacing: '0.20em',
                  animation: 'mobileTaglineReveal 1.0s cubic-bezier(0.16,1,0.3,1) 1.75s both, taglineBreath 4.5s ease-in-out 2.9s infinite',
                }}>
                {themeTagline}
              </p>
            )}

          </div>
        </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DESKTOP HERO  (hidden sm:flex) — original centred layout, unchanged
            ══════════════════════════════════════════════════════════════════ */}
        <div className={`${effectiveVideoMode ? 'hidden' : 'hidden sm:flex'} relative z-30 flex-col items-center w-full max-w-7xl mx-auto pt-10 md:pt-14`}>

          {/* Main heading */}
          {/* Desktop heading — ORIGINAL font (Clash Display) + photo texture animation */}
          <div className="animate-focus group cursor-default relative w-full px-4 sm:px-8 md:px-12 py-1 sm:py-3 flex flex-col items-center">
            <h1 className="font-clash uppercase tracking-tighter glitch-text text-white mb-1 leading-[1.0] text-center w-full">
              <span className={`block text-xl md:text-3xl lg:text-4xl mb-2 tracking-[0.1em] ${L ? 'text-gray-600' : 'text-gray-300/80'}`}>Welcome to</span>
              <span
                className="block text-transparent bg-clip-text animate-text-pan sm:text-6xl md:text-8xl lg:text-[7rem] drop-shadow-[0_0_28px_rgba(255,255,255,0.28)]"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80')",
                  backgroundSize: '150%',
                  filter: 'brightness(1.55) contrast(0.92)',
                }}
              >
                IEM PHOTOGRAPHY CLUB
              </span>
            </h1>
            <div className="h-px w-0 group-hover:w-60 bg-red-600 mx-auto mt-3 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.8)] transition-all duration-700" />
          </div>

          <RevealOnScroll delay={600}>
            <p className={`font-inter text-sm md:text-base tracking-[0.22em] mt-4 uppercase text-center px-6 ${L ? 'text-gray-500' : 'text-gray-400/80'}`}>
              The Official Page of IEM Photography Club
            </p>
          </RevealOnScroll>

          {/* Tagline */}
          <RevealOnScroll delay={900}>
            <p className="font-inter text-gray-500 text-base md:text-xl mx-auto mt-4 uppercase px-4 text-center tracking-widest">
              <span className="text-red-500 mr-2">[</span> Capturing The Legacy <span className="text-red-500 ml-2">]</span>
            </p>
          </RevealOnScroll>
        </div>

      </header>

      {/* ══════════════════════════════════════════════════════
          HOME PAGE SECTIONS — live previews of each feature
          Navbar scrolls to these anchor IDs
          ══════════════════════════════════════════════════════ */}
      <HomeSections L={L} onJoin={() => document.dispatchEvent(new CustomEvent('open-auth'))} />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={`py-8 md:py-12 border-t relative z-10 transition-colors duration-300 ${L ? 'bg-white border-black/8' : 'bg-[#020202] border-white/10'}`}>
        <div className="container mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center text-gray-600 text-xs md:text-sm font-inter tracking-wider gap-4 md:gap-0">
          <div className="text-center md:text-left flex items-center gap-3">
            <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-8 h-8 rounded-full opacity-70" />
            <div>
              <span className="text-white text-base sm:text-xl">IEM PHOTOGRAPHY CLUB</span><br />
              <span>&copy; 2026 SYSTEM OPERATIONAL.</span>
            </div>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-gray-500 hover:text-red-400 glass-icon"><Instagram size={20} /></a>
            <a href="#" className="text-gray-500 hover:text-blue-400 glass-icon"><Facebook size={20} /></a>
            <a href="#" className="text-gray-500 hover:text-white glass-icon"><Mail size={20} /></a>
          </div>
        </div>
      </footer>

      {/* AuthModal is global — lives in App.jsx, opened via 'open-auth' event */}
    </div>
  )
}
