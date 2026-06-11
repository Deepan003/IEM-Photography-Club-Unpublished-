import { useState, useEffect, lazy, Suspense, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

// Lives inside BrowserRouter — navigates when pendingNav is set
function NavigateEffect({ to, onDone }) {
  const navigate = useNavigate()
  useEffect(() => { navigate(to, { replace: true }); onDone?.() }, [])
  return null
}
import AuthModal         from './components/auth/AuthModal.jsx'
import LoginSuccess      from './components/LoginSuccess.jsx'
import { getToken, clearToken, authApi } from './api/auth.js'

// ── Lazy-loaded components (code-split) ───────────────────────────────────────
const MemberDashboard   = lazy(() => import('./components/MemberDashboard'))

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const MainPage          = lazy(() => import('./MainPage'))
const PostcardsPage     = lazy(() => import('./pages/PostcardsPage'))
const ClubGalleryPage   = lazy(() => import('./pages/ClubGalleryPage'))
const EventsPage        = lazy(() => import('./pages/EventsPage'))
const EventDetailPage   = lazy(() => import('./pages/EventDetailPage'))
const MembersPage       = lazy(() => import('./pages/MembersPage'))
const CoreCommitteePage = lazy(() => import('./pages/CoreCommitteePage'))
const CompetitionsPage       = lazy(() => import('./pages/CompetitionsPage'))
const ActivitiesPage         = lazy(() => import('./pages/ActivitiesPage'))
const EventsGalleryPage      = lazy(() => import('./pages/EventsGalleryPage'))
const EventGalleryDetailPage = lazy(() => import('./pages/EventGalleryDetailPage'))
const UserSettingsPage  = lazy(() => import('./pages/UserSettingsPage'))
const FeedPage          = lazy(() => import('./pages/FeedPage'))
const MagazinesPage       = lazy(() => import('./pages/MagazinesPage'))
const MagazinePublicPage  = lazy(() => import('./pages/MagazinePublicPage'))
const UserEventsPage    = lazy(() => import('./pages/UserEventsPage'))
const AlumniPage        = lazy(() => import('./pages/AlumniPage'))
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard'))
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard'))

// ── Theme context ─────────────────────────────────────────────────────────────
export const ThemeCtx = createContext({ theme: 'dark', toggleTheme: () => {} })
export const useTheme = () => useContext(ThemeCtx)

// ── Auth context ──────────────────────────────────────────────────────────────
export const AuthCtx  = createContext({ user: null, setUser: () => {} })
export const useAuth  = () => useContext(AuthCtx)

function applyTheme(t) {
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(t)
  localStorage.setItem('iempc_theme', t)
}

// ── Preloader ─────────────────────────────────────────────────────────────────
function Preloader({ onComplete }) {
  const [burning, setBurning] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setBurning(true),  2000)
    const t2 = setTimeout(onComplete,              2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-[1000] bg-black flex items-center justify-center transition-opacity duration-1000 ${burning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="relative z-10 text-center px-4">
        <h1 className="font-cine text-xl sm:text-3xl md:text-6xl text-white tracking-[0.3em] uppercase animate-fade-in-slow">
          IEM PHOTOGRAPHY CLUB
        </h1>
      </div>
      <button onClick={onComplete}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 font-inter text-sm text-white/30 hover:text-white/70 tracking-[0.18em] uppercase transition-colors duration-200 flex items-center gap-2 group">
        Skip
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform duration-200">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div className={`absolute inset-0 z-20 pointer-events-none ${burning ? 'animate-film-burn' : 'opacity-0'}`} />
    </div>
  )
}

// ── Scroll position persistence across refresh ────────────────────────────────
// Save scroll position before unload, restore it after the app mounts.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('iempc_scroll_y',   String(window.scrollY))
    sessionStorage.setItem('iempc_scroll_path', window.location.pathname)
  })
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // Show the preloader ONCE per browser session (new tab = fresh splash, refresh = skip).
  const [phase, setPhase] = useState(() => sessionStorage.getItem('iempc_phase') || 'preloader')
  const advancePhase = (p) => { sessionStorage.setItem('iempc_phase', p); setPhase(p) }
  const [currentUser,  setCurrentUser]  = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [theme,        setTheme]        = useState(() => localStorage.getItem('iempc_theme') || 'dark')
  // ── Global auth modal — one instance, triggered from anywhere via event ──
  const [authModal,    setAuthModal]    = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(null)   // null | user object
  const [pendingNav,   setPendingNav]   = useState(null)   // set after animation → NavigateEffect handles it

  useEffect(() => {
    const open = () => setAuthModal(true)
    document.addEventListener('open-auth', open)
    return () => document.removeEventListener('open-auth', open)
  }, [])

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // Restore scroll position after the main app renders (phase = main)
  useEffect(() => {
    if (phase !== 'main') return
    const savedPath = sessionStorage.getItem('iempc_scroll_path')
    const savedY    = parseInt(sessionStorage.getItem('iempc_scroll_y') || '0', 10)
    if (savedPath === window.location.pathname && savedY > 0) {
      // Slight delay to let the page content render first
      const t = setTimeout(() => { window.scrollTo({ top: savedY, behavior: 'instant' }) }, 80)
      return () => clearTimeout(t)
    }
    sessionStorage.removeItem('iempc_scroll_y')
    sessionStorage.removeItem('iempc_scroll_path')
  }, [phase])

  useEffect(() => {
    if (!getToken()) { setCheckingAuth(false); return }
    authApi.getMe()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => clearToken())
      .finally(() => setCheckingAuth(false))
  }, [])

  if (checkingAuth) return null

  const themeCtx = { theme, toggleTheme }
  const authCtx  = { user: currentUser, setUser: setCurrentUser }

  // Splash screen shown once per browser session
  if (phase === 'preloader') return <ThemeCtx.Provider value={themeCtx}><Preloader onComplete={() => advancePhase('main')} /></ThemeCtx.Provider>

  return (
    <QueryClientProvider client={queryClient}>
    <ToastProvider>
    <ThemeCtx.Provider value={themeCtx}>
      <AuthCtx.Provider value={authCtx}>
        {/* ── Global auth modal ── */}
        {authModal && !currentUser && (
          <AuthModal
            onClose={() => setAuthModal(false)}
            onAuthSuccess={user => {
              setCurrentUser(user)
              setAuthModal(false)
              setLoginSuccess(user)   // trigger the success animation
            }}
          />
        )}

        {/* ── Login success animation (outside Router — no useNavigate) ── */}
        {loginSuccess && (
          <LoginSuccess
            user={loginSuccess}
            onDone={() => {
              setLoginSuccess(null)
              // Admin/core go to admin panel, everyone else to dashboard
              // loginSuccess IS the user object — use its role, not the undefined 'user' variable
              setPendingNav(
                ['admin','core'].includes(loginSuccess?.role) ? '/admin'
                : '/dashboard'
              )
            }}
          />
        )}
        <BrowserRouter>
          <Suspense fallback={null}>
            {/* Scroll performance: isolate BrowserRouter tree so JS work doesn't block paint */}
            <div style={{ isolation: 'isolate', minHeight: '100vh' }}>
            <Routes>
              {/* Public site */}
              <Route path="/"              element={<MainPage />} />
              <Route path="/postcards"     element={<PostcardsPage />} />
              <Route path="/gallery"       element={<ClubGalleryPage />} />
              <Route path="/events"        element={<EventsPage />} />
              <Route path="/events/:id"    element={<EventDetailPage />} />
              <Route path="/members"       element={<MembersPage />} />
              <Route path="/alumni"        element={<AlumniPage />} />
              <Route path="/core"          element={<CoreCommitteePage />} />
              <Route path="/join"          element={<Navigate to="/#join" replace />} />
              <Route path="/competitions"        element={<CompetitionsPage />} />
              <Route path="/competitions/:id"   element={<CompetitionsPage />} />
              <Route path="/activities"          element={<ActivitiesPage />} />
              <Route path="/activities/:id"      element={<ActivitiesPage />} />
              <Route path="/magazines"           element={<MagazinesPage />} />
              <Route path="/magazine/:id"       element={<MagazinePublicPage />} />
              <Route path="/events-gallery"     element={<EventsGalleryPage />} />
              <Route path="/events-gallery/:id" element={<EventGalleryDetailPage />} />

              {/* Auth-required */}
              <Route path="/dashboard" element={
                currentUser
                  ? ['admin','core'].includes(currentUser.role)
                    ? <Navigate to="/admin" replace />
                    : <MemberDashboard onLogout={() => { clearToken(); setCurrentUser(null) }} />
                  : <Navigate to="/" replace />
              } />
              <Route path="/coordinator-dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/settings"   element={currentUser ? <UserSettingsPage /> : <Navigate to="/" replace />} />
              <Route path="/feed"       element={<FeedPage />} />
              <Route path="/my-events"  element={currentUser ? <UserEventsPage /> : <Navigate to="/" replace />} />
              <Route path="/admin"      element={
                currentUser && ['admin','core'].includes(currentUser.role)
                  ? <AdminDashboard />
                  : <Navigate to="/" replace />
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </div>
          </Suspense>

          {pendingNav && (
            <NavigateEffect to={pendingNav} onDone={() => setPendingNav(null)} />
          )}
        </BrowserRouter>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
    </ToastProvider>
    </QueryClientProvider>
  )
}
