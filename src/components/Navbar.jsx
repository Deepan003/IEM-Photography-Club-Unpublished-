import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MoreVertical }      from './Icons'
import { useTheme, useAuth } from '../App.jsx'
import { useData }           from '../hooks/useData.js'
import { settingsApi }       from '../api/api.js'
import GlassButton           from './GlassButton.jsx'

// Section anchors on the home page — navbar scrolls to these
const ALL_SECTION_LINKS = [
  { label: 'Postcards',     href: '/#postcards',    sectionId: 'postcards'     },
  { label: 'Event Gallery', href: '/#event-gallery',sectionId: 'event-gallery' },
  { label: 'Club Gallery',  href: '/#gallery',      sectionId: 'gallery'       },
  { label: 'Members',       href: '/#members',      sectionId: 'members'       },
  { label: 'Core',          href: '/#core',         sectionId: 'core'          },
  { label: 'Competitions',  href: '/#competitions', sectionId: 'competitions'  },
  { label: 'Activities',    href: '/#activities',   sectionId: 'activities'    },
  { label: 'Magazines',     href: '/#magazines',    sectionId: 'magazines'     },
  { label: 'Join Us',       href: '/#join',         sectionId: null            },
]

const HOME_LINKS = []
const NAV_LINKS  = HOME_LINKS

function SunIcon()  { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function HamburgerIcon({ className }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className}>
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
function XNavIcon({ className }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

// Small nav-link with JS press flash
function NavLink({ link, active, isLight, onNav }) {
  const [flashing, setFlashing] = useState(false)
  const t = useRef(null)

  const press = useCallback(() => {
    clearTimeout(t.current)
    setFlashing(false)
    requestAnimationFrame(() => {
      setFlashing(true)
      t.current = setTimeout(() => setFlashing(false), 280)
    })
    onNav?.()
  }, [onNav])

  return (
    <a
      href={link.href}
      onMouseDown={press}
      onTouchStart={press}
      className={`nav-roll relative font-inter text-[13px] font-medium tracking-[0.04em] px-3 py-1.5 rounded-xl transition-all duration-200 select-none cursor-pointer ${
        active
          ? isLight ? 'text-red-600 bg-red-50' : 'text-white bg-white/8'
          : isLight ? 'text-gray-600 hover:text-gray-900 hover:bg-black/5' : 'text-gray-400 hover:text-white hover:bg-white/6'
      }`}
    >
      {link.label}
      {/* Clockwise-drawing SVG border */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" style={{ overflow:'visible' }} aria-hidden>
        <rect className="nav-svg-rect" x="0" y="0" width="100%" height="100%" rx="11" ry="11"
          stroke="rgba(220,38,38,0.55)" strokeWidth="1.5" />
      </svg>
      {/* Press flash */}
      {flashing && (
        <span key={Date.now()} className="absolute inset-0 rounded-[inherit] pointer-events-none nav-flash"
              style={{ background: isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)' }} />
      )}
    </a>
  )
}

export default function Navbar({ onJoinClick, heroMode = null, onToggleHeroMode = null, themeNavbarBg = null, introReveal = null }) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [iconSpin,  setIconSpin]  = useState(false)
  const { theme, toggleTheme }    = useTheme()
  const { user }                  = useAuth()
  const { pathname }              = useLocation()
  const isLight   = theme === 'light'
  const spinTimer = useRef(null)
  const isAdmin   = user && ['admin','core'].includes(user.role)

  // Section visibility — filter out hidden sections for non-admin/core users
  const { data: sectData } = useData(() => settingsApi.getSections(), 5000)
  const PAGE_LINKS = isAdmin
    ? ALL_SECTION_LINKS
    : ALL_SECTION_LINKS.filter(link => !link.sectionId || sectData?.sections?.[link.sectionId] !== false)

  // Track current path for active link highlighting
  const currentPath = pathname

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleThemeToggle = () => {
    clearTimeout(spinTimer.current)
    setIconSpin(false)
    requestAnimationFrame(() => {
      setIconSpin(true)
      spinTimer.current = setTimeout(() => setIconSpin(false), 500)
    })
    toggleTheme()
  }

  // Synced hero fade-in: when introReveal is provided (home hero), the whole navbar
  // fades/slides in together with the hero text. On other pages it stays visible.
  const revealControlled = introReveal !== null && introReveal !== undefined
  const revealStyle = revealControlled
    ? { opacity: introReveal ? 1 : 0, transform: introReveal ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.9s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1), background 0.5s ease, padding 0.5s ease',
        pointerEvents: introReveal ? 'auto' : 'none' }
    : null

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${
        scrolled
          ? `${isLight ? 'bg-white/85' : 'bg-black/85'} backdrop-blur-md py-3 shadow-xl`
          : 'bg-transparent py-4 sm:py-6'
      }`}
      style={{ ...(!scrolled && themeNavbarBg ? { background: themeNavbarBg } : null), ...revealStyle }}
    >
      {/* ── Top vignette (mobile only) — dark gradient behind nav buttons ── */}
      <div className="sm:hidden absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: '130px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)', zIndex: 0 }} />

      {/* ── MOBILE NAV layout (xs only) ── */}
      <div className="sm:hidden flex items-center justify-between w-full px-4" style={{ position: 'relative', zIndex: 1 }}>
        {/* Left: logo + theme toggle */}
        <div className="flex items-center gap-2.5">
          <Link to="/">
            <div className="relative w-11 h-11 rounded-full overflow-hidden border border-gray-600/40 bg-black flex-shrink-0"
              style={{ boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
              <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club" className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none" style={{ animation: 'logoSweep 11s linear 2s infinite' }}>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(108deg,transparent 25%,rgba(255,255,255,0.55) 50%,transparent 75%)' }}/>
              </div>
            </div>
          </Link>
          <GlassButton
            variant="default"
            className={`p-0 ${isLight ? 'text-gray-600' : 'text-gray-300'}`}
            style={{ borderRadius: '10px', minHeight: '34px', minWidth: '34px', padding: '0' }}
            onClick={handleThemeToggle}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <span key={theme} className={iconSpin ? 'icon-spin' : ''} style={{ display: 'flex' }}>
              {isLight ? <MoonIcon /> : <SunIcon />}
            </span>
          </GlassButton>
        </div>
        {/* Right: hamburger + profile */}
        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="default"
            className="p-0 text-current"
            style={{ borderRadius: '10px', minHeight: '34px', minWidth: '34px', padding: '0' }}
            onClick={() => setMenuOpen(p => !p)}
          >
            {menuOpen
              ? <XNavIcon className="text-red-500" />
              : <HamburgerIcon className={isLight ? 'text-gray-700' : 'text-white'} />}
          </GlassButton>
          {user ? (
            <Link to="/dashboard">
              <div className={`w-9 h-9 rounded-full overflow-hidden border ${isLight ? 'border-black/15' : 'border-white/20'} bg-gray-800 flex items-center justify-center`}>
                {user.profilePhoto
                  ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="font-clash text-xs font-bold text-white">{user.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>}
              </div>
            </Link>
          ) : (
            <GlassButton
              variant="pill-red"
              className="px-4 font-inter text-sm font-medium tracking-[0.10em] uppercase"
              style={{ minHeight: '36px' }}
              onClick={() => document.dispatchEvent(new CustomEvent('open-auth'))}
            >
              Join
            </GlassButton>
          )}
        </div>
      </div>

      {/* ── DESKTOP NAV layout (sm+) ── */}
      <div className="hidden sm:flex container mx-auto px-4 sm:px-8 justify-center items-center">
        <div className="flex items-center gap-2 sm:gap-6">

          {/* Logo — left anchor, shifts nav links right-of-center */}
          <Link to="/" className="flex-shrink-0 mr-1">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-600/35 bg-black"
              style={{ boxShadow: '0 0 18px rgba(0,0,0,0.75)' }}>
              <img src="/IEM_20260416_215615_0000.png" alt="IEM Photography Club" className="w-full h-full object-cover"/>
              <div className="absolute inset-0 pointer-events-none" style={{ animation: 'logoSweep 11s linear 5s infinite' }}>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(108deg,transparent 25%,rgba(255,255,255,0.55) 50%,transparent 75%)' }}/>
              </div>
            </div>
          </Link>

          {/* Desktop nav — larger text and spacing */}
          <div className="hidden lg:flex items-center gap-1">
            {PAGE_LINKS.map(link => {
              const isHash = link.href.startsWith('/#')
              const NavEl  = isHash ? 'a' : Link
              const navProp = isHash ? { href: link.href } : { to: link.href }
              return (
                <NavEl key={link.href} {...navProp}
                  className={`nav-roll relative font-inter text-sm font-medium px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer
                    ${isLight ? 'text-gray-600 hover:text-gray-900 hover:bg-black/4' : 'text-gray-400 hover:text-white hover:bg-white/6'}`}>
                  {link.label}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" style={{ overflow:'visible' }} aria-hidden>
                    <rect className="nav-svg-rect" x="0" y="0" width="100%" height="100%" rx="11" ry="11"
                      stroke="rgba(220,38,38,0.55)" strokeWidth="1.5" />
                  </svg>
                </NavEl>
              )
            })}
          </div>

          {/* Hamburger (sm–lg) */}
          <GlassButton
            variant="default"
            className="lg:hidden p-0 text-current"
            style={{ borderRadius:'10px', minHeight:'36px', minWidth:'36px', padding:'0' }}
            onClick={() => setMenuOpen(p => !p)}
          >
            <MoreVertical size={18} className={`transition-transform duration-300 ${menuOpen ? 'rotate-90 text-red-500' : isLight ? 'text-gray-700' : 'text-white'}`} />
          </GlassButton>

          {/* Theme toggle */}
          <GlassButton
            variant="default"
            className={`p-0 ${isLight ? 'text-gray-600' : 'text-gray-300'}`}
            style={{ borderRadius:'10px', minHeight:'36px', minWidth:'36px', padding:'0' }}
            onClick={handleThemeToggle}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <span key={theme} className={iconSpin ? 'icon-spin' : ''} style={{ display:'flex' }}>
              {isLight ? <MoonIcon /> : <SunIcon />}
            </span>
          </GlassButton>

          {/* Admin/Core shortcut */}
          {isAdmin && (
            <div className="hidden sm:block relative">
              <Link to="/admin">
                <GlassButton variant="default"
                  className="px-3 font-inter text-[11px] uppercase tracking-wider text-red-400 flex"
                  style={{ borderRadius:'9px', minHeight:'34px' }}>
                  ⚙ {user.role === 'admin' ? 'Admin' : 'Core'}
                </GlassButton>
              </Link>
            </div>
          )}

          {/* Profile avatar or JOIN */}
          {user ? (
            <Link to="/dashboard">
              <div className={`w-8 h-8 rounded-full overflow-hidden border ${isLight ? 'border-black/15' : 'border-white/20'} bg-gray-800 flex items-center justify-center`}>
                {user.profilePhoto
                  ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="font-clash text-xs font-bold text-white">{user.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>}
              </div>
            </Link>
          ) : (
            <GlassButton
              variant="pill-red"
              className="px-6 sm:px-8 font-inter text-sm font-medium tracking-[0.10em] uppercase"
              style={{ minHeight:'42px' }}
              onClick={() => document.dispatchEvent(new CustomEvent('open-auth'))}
            >
              Join
            </GlassButton>
          )}
        </div>
      </div>

      {/* ── Backdrop — always rendered, fades in/out ── */}
      <div
        className="lg:hidden fixed inset-0 z-[90] transition-all duration-350"
        style={{
          background: 'rgba(0,0,6,0.78)',
          backdropFilter: menuOpen ? 'blur(18px)' : 'blur(0px)',
          WebkitBackdropFilter: menuOpen ? 'blur(18px)' : 'blur(0px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 0.32s ease, backdrop-filter 0.32s ease',
        }}
        onClick={() => setMenuOpen(false)}
      />

      {/* ── Dropdown panel — slide + fade ── */}
      <div
        className="lg:hidden absolute top-full left-0 w-full z-[95]"
        style={{
          padding: '6px 12px 14px',
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.97)',
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 0.32s cubic-bezier(0.22,1,0.36,1), transform 0.32s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div style={{
          background: isLight ? 'rgba(236,240,248,0.96)' : 'rgba(5,4,14,0.97)',
          border: isLight ? '1px solid rgba(255,255,255,0.88)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: isLight
            ? '12px 12px 30px rgba(163,177,200,0.45), -8px -8px 18px rgba(255,255,255,0.92), inset 0 1px 0 rgba(255,255,255,0.98)'
            : '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
        }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="font-clash text-[10px] uppercase tracking-[0.32em]"
              style={{ color: isLight ? 'rgba(71,85,105,0.80)' : 'rgba(255,255,255,0.3)' }}>
              Navigation
            </span>
            <span className="font-mono text-[9px]"
              style={{ color: isLight ? 'rgba(100,116,139,0.65)' : 'rgba(255,255,255,0.18)' }}>
              {PAGE_LINKS.length} sections
            </span>
          </div>

          {/* Top rule */}
          <div style={{ height: 1, background: isLight ? 'rgba(174,185,210,0.35)' : 'rgba(255,255,255,0.06)', margin: '0 16px 6px' }} />

          {/* Links — conditionally rendered so animation replays each open */}
          <div className="px-2 pb-2 space-y-0.5">
            {menuOpen && PAGE_LINKS.map((link, i) => (
              <MobileNavLink
                key={link.href}
                link={link}
                active={currentPath === link.href}
                isLight={isLight}
                index={i}
                onNav={() => setMenuOpen(false)}
                isHash={link.href.startsWith('/#')}
              />
            ))}
          </div>

          {/* Bottom rule */}
          <div style={{ height: 1, background: isLight ? 'rgba(174,185,210,0.35)' : 'rgba(255,255,255,0.06)', margin: '0 16px 10px' }} />

          {/* Close button */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setMenuOpen(false)}
              className={`w-full py-3 rounded-2xl font-inter text-[11px] font-medium tracking-[0.18em] uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
                isLight ? 'text-slate-500 hover:text-slate-700' : 'text-gray-400 bg-white/5 hover:bg-white/8'
              }`}
              style={isLight ? {
                background: 'rgba(232,236,243,0.85)',
                border: '1px solid rgba(255,255,255,0.80)',
                boxShadow: '3px 3px 8px rgba(163,177,200,0.38), -2px -2px 6px rgba(255,255,255,0.80)',
              } : undefined}
            >
              <XNavIcon className="opacity-60" /> Close
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

// Mobile nav link — numbered, staggered entrance, ripple on press
function MobileNavLink({ link, active, isLight, index, onNav, isHash = false }) {
  const [ripple, setRipple] = useState(null)
  const t = useRef(null)

  const handlePress = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const src  = e.touches?.[0] ?? e
    const x    = src.clientX - rect.left
    const y    = src.clientY - rect.top
    setRipple({ x, y, id: Date.now() })
    clearTimeout(t.current)
    t.current = setTimeout(() => { setRipple(null); onNav?.() }, 360)
  }

  return (
    <a
      href={link.href}
      onMouseDown={handlePress}
      onTouchStart={handlePress}
      className="relative block select-none cursor-pointer overflow-hidden rounded-2xl"
      style={{ animation: `mobileNavItemIn 0.42s cubic-bezier(0.22,1,0.36,1) ${index * 48 + 30}ms both` }}
    >
      {/* Active / hover background */}
      <div className={`absolute inset-0 rounded-2xl transition-colors duration-200 ${
        active ? isLight ? 'bg-red-50' : 'bg-red-600/10' : 'bg-transparent'
      }`} />

      {/* Left accent bar — active only */}
      {active && (
        <div className="absolute left-0 top-3 bottom-3 rounded-full"
          style={{ width: 3, background: 'linear-gradient(to bottom,#ef4444,#b91c1c)' }} />
      )}

      {/* Row content */}
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        {/* Number */}
        <span className="font-mono text-[10px] w-5 flex-shrink-0 text-right leading-none"
          style={{ color: active ? '#ef4444' : isLight ? 'rgba(100,116,139,0.65)' : 'rgba(255,255,255,0.2)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Label */}
        <span className={`font-inter text-[15px] font-medium flex-1 leading-none ${
          active ? isLight ? 'text-red-600' : 'text-white' : isLight ? 'text-slate-700' : 'text-gray-300'
        }`}>
          {link.label}
        </span>

        {/* Active dot */}
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Ripple */}
      {ripple && (
        <span key={ripple.id} className="absolute pointer-events-none rounded-full"
          style={{
            left: ripple.x, top: ripple.y,
            width: 12, height: 12,
            background: 'rgba(220,38,38,0.45)',
            animation: 'mobileNavRipple 0.4s ease-out forwards',
          }}
        />
      )}
    </a>
  )
}
