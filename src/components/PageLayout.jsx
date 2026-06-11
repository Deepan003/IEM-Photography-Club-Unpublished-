import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme, useAuth } from '../App.jsx'
import GlassButton           from './GlassButton.jsx'

const SunIcon  = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const MoonIcon = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>

// Map each path to its natural parent — used when the user arrives fresh (no in-app history).
// location.key === 'default' only on a brand-new history entry (direct URL, new tab, external link).
// After any in-app navigate() the key becomes a unique string and is preserved across refreshes.
function getParentRoute(pathname, userRole) {
  if (/^\/events\//.test(pathname))         return '/events'
  if (/^\/events-gallery\//.test(pathname)) return '/events-gallery'
  if (/^\/competitions\//.test(pathname))   return '/competitions'
  if (/^\/activities\//.test(pathname))     return '/activities'
  if (/^\/magazine\//.test(pathname))       return '/magazines'
  if (pathname === '/settings')             return ['admin','core'].includes(userRole) ? '/admin' : '/dashboard'
  if (pathname === '/my-events')            return '/dashboard'
  if (pathname === '/feed')                 return '/'
  return '/'
}

export default function PageLayout({ children, title, subtitle }) {
  const location               = useLocation()
  const { pathname }           = location
  const navigate               = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user }               = useAuth()
  const L = theme === 'light'
  const openAuth = () => document.dispatchEvent(new CustomEvent('open-auth'))

  // Scroll to top only on genuine navigation (not on refresh).
  // On refresh the scroll restore in App.jsx handles position.
  const isRefresh = sessionStorage.getItem('iempc_scroll_path') === pathname
  useEffect(() => {
    if (!isRefresh) window.scrollTo(0, 0)
  }, [pathname])

  // location.key is 'default' only when arriving from outside the app (fresh tab, direct URL, external link).
  // After any in-app navigate() it becomes a unique string and survives refreshes via history.state.
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      // replace: true prevents a loop — without it, pressing Back from the
      // parent page would navigate(-1) straight back to the detail page.
      navigate(getParentRoute(pathname, user?.role), { replace: true })
    }
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className={`min-h-screen transition-colors duration-300 ${L ? 'bg-gray-50 text-gray-900' : 'bg-[#050505] text-gray-200'}`}>

      {/* ── Minimal top bar: logo left + back + theme/profile right ── */}
      <header className={`fixed top-0 left-0 w-full z-[100] flex items-center border-b backdrop-blur-md transition-colors duration-300
        ${L ? 'bg-white/80 border-black/6' : 'bg-[#050505]/80 border-white/5'}`}
        style={{ height: 68, ...(L ? { boxShadow: '0 4px 24px rgba(163,177,200,0.20), inset 0 -1px 0 rgba(255,255,255,0.55)' } : {}) }}>
        <div className="w-full max-w-7xl mx-auto px-5 flex items-center justify-between gap-3">

          {/* Left: logo + back button */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/" className="flex items-center gap-3 mr-1">
              <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-9 h-9 rounded-full" />
              <span className={`font-clash font-semibold text-[15px] tracking-wide hidden sm:block ${L ? 'text-gray-800' : 'text-gray-200'}`}>
                IEM Photography Club
              </span>
            </Link>
            <div className={`h-6 w-px mx-1.5 ${L ? 'bg-black/10' : 'bg-white/10'}`} />
            <button onClick={handleBack}
              className={`flex items-center gap-2 font-inter text-[14px] font-medium transition-colors px-3 py-2 rounded-xl ${
                L ? 'text-gray-400 hover:text-gray-800 hover:bg-black/4' : 'text-gray-500 hover:text-white hover:bg-white/6'
              }`}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>

          {/* Right: theme toggle + profile/join */}
          <div className="flex items-center gap-2.5 shrink-0">
            <GlassButton variant="default" onClick={toggleTheme}
              className={`p-0 ${L ? 'text-gray-500' : 'text-gray-400'}`}
              style={{ borderRadius:'11px', minHeight:'38px', minWidth:'38px', padding:'0' }}
              title="Toggle theme">
              {L ? <MoonIcon /> : <SunIcon />}
            </GlassButton>

            {user ? (
              <Link to={['admin','core'].includes(user.role) ? '/admin' : '/dashboard'} title="Dashboard">
                <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${L ? 'border-black/12' : 'border-white/18'} bg-gray-800 flex items-center justify-center`}>
                  {user.profilePhoto
                    ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                    : <span className="font-clash text-sm font-bold text-white">{initials}</span>}
                </div>
              </Link>
            ) : (
              <GlassButton variant="pill-red" onClick={openAuth}
                className="px-5 font-inter text-[14px] font-medium tracking-[0.08em] uppercase"
                style={{ minHeight:'38px' }}>
                Join
              </GlassButton>
            )}
          </div>
        </div>
      </header>

      {/* Page title banner */}
      {(title || subtitle) && (
        <div className={`pt-[96px] sm:pt-[112px] pb-6 sm:pb-10 px-4 sm:px-6 text-center border-b ${L ? 'border-black/5' : 'border-white/5'}`}>
          {title && (() => {
            const len = title.length
            const fontSize = len >= 12
              ? 'clamp(1.6rem, 7.5vw, 4.5rem)'
              : len >= 9
              ? 'clamp(2rem, 9vw, 5rem)'
              : 'clamp(2.5rem, 11vw, 5.5rem)'
            return (
              <h1 className={`font-breathing italic leading-[1.05] font-semibold ${L ? 'text-gray-900' : 'text-white'}`}
                style={{ fontSize }}>
                {title}
              </h1>
            )
          })()}
          {subtitle && (
            <p className={`font-inter text-sm max-w-2xl mx-auto leading-relaxed mt-6 sm:mt-7 ${L ? 'text-gray-500' : 'text-gray-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <main className={`${title || subtitle ? '' : 'pt-[68px]'}`}>
        {children}
      </main>

      <footer className={`border-t py-8 mt-16 text-center transition-colors ${L ? 'bg-white border-black/5' : 'bg-[#020202] border-white/5'}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-5 h-5 rounded-full opacity-60" />
          <span className={`font-clash text-sm font-medium ${L ? 'text-gray-600' : 'text-gray-500'}`}>IEM Photography Club</span>
        </div>
        <p className={`font-inter text-[11px] ${L ? 'text-gray-400' : 'text-gray-700'}`}>© 2026 · All rights reserved</p>
      </footer>
    </div>
  )
}
