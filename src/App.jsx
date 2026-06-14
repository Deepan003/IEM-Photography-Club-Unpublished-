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
import WelcomeOverlay    from './components/WelcomeOverlay.jsx'
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
const UserProfilePage      = lazy(() => import('./pages/UserProfilePage'))
const CoreMemberProfilePage = lazy(() => import('./pages/CoreMemberProfilePage'))
const NotFoundPage          = lazy(() => import('./pages/NotFoundPage'))

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
// Rendered as a fixed overlay on top of the already-rendering main app.
// This means main-page content is loaded in the background while the preloader
// is visible, so when it fades there is zero flash or swap delay.
function Preloader({ onComplete, ready }) {
  const [burning, setBurning] = useState(false)

  useEffect(() => {
    // Don't start the countdown until auth is resolved (ready=true).
    // This keeps the black screen while we're waiting for getMe() on first load.
    if (!ready) return
    const t1 = setTimeout(() => setBurning(true), 2000)
    // Fire onComplete only AFTER the 1-second opacity transition finishes
    const t2 = setTimeout(onComplete,             3100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ready, onComplete])

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-1000 ${burning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      aria-hidden={burning}
    >
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
  const [showPreloader, setShowPreloader] = useState(
    () => sessionStorage.getItem('iempc_phase') !== 'main'
  )
  const [currentUser,  setCurrentUser]  = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [theme,        setTheme]        = useState(() => localStorage.getItem('iempc_theme') || 'dark')
  const [authModal,    setAuthModal]    = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(null)
  const [pendingNav,   setPendingNav]   = useState(null)
  const [welcomeUser,  setWelcomeUser]  = useState(null)

  useEffect(() => {
    const open = () => setAuthModal(true)
    document.addEventListener('open-auth', open)
    return () => document.removeEventListener('open-auth', open)
  }, [])

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // Restore scroll position once the main app is visible (preloader gone or skipped)
  useEffect(() => {
    if (showPreloader || checkingAuth) return
    const savedPath = sessionStorage.getItem('iempc_scroll_path')
    const savedY    = parseInt(sessionStorage.getItem('iempc_scroll_y') || '0', 10)
    if (savedPath === window.location.pathname && savedY > 0) {
      const t = setTimeout(() => { window.scrollTo({ top: savedY, behavior: 'instant' }) }, 80)
      return () => clearTimeout(t)
    }
    sessionStorage.removeItem('iempc_scroll_y')
    sessionStorage.removeItem('iempc_scroll_path')
  }, [showPreloader, checkingAuth])

  useEffect(() => {
    if (!getToken()) { setCheckingAuth(false); return }
    authApi.getMe()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => clearToken())
      .finally(() => setCheckingAuth(false))
  }, [])

  const themeCtx = { theme, toggleTheme }
  const authCtx  = { user: currentUser, setUser: setCurrentUser }

  const handlePreloaderComplete = () => {
    sessionStorage.setItem('iempc_phase', 'main')
    setShowPreloader(false)
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ToastProvider>
    <ThemeCtx.Provider value={themeCtx}>
      <AuthCtx.Provider value={authCtx}>

        {/* ── Preloader overlay — sits on top (z-9999), fades out revealing the
             main app that has already been rendering underneath.
             `ready` delays the countdown until auth is resolved so the black
             screen persists while getMe() is in-flight. ── */}
        {showPreloader && (
          <Preloader onComplete={handlePreloaderComplete} ready={!checkingAuth} />
        )}

        {/* ── Global auth modal ── */}
        {authModal && !currentUser && (
          <AuthModal
            onClose={() => setAuthModal(false)}
            onAuthSuccess={user => {
              setCurrentUser(user)
              setAuthModal(false)
              setLoginSuccess(user)
            }}
          />
        )}

        {/* ── Login success animation ── */}
        {loginSuccess && (
          <LoginSuccess
            user={loginSuccess}
            onDone={() => {
              const u = loginSuccess
              setLoginSuccess(null)
              setPendingNav(['admin','core'].includes(u?.role) ? '/admin' : '/dashboard')
              // Show welcome overlay once per member (non-admin) on first ever login
              if (u && !['admin'].includes(u.role) && !localStorage.getItem(`welcome_seen_${u._id}`)) {
                setWelcomeUser(u)
              }
            }}
          />
        )}

        {/* ── First-login welcome overlay ── */}
        {welcomeUser && (
          <WelcomeOverlay user={welcomeUser} onClose={() => setWelcomeUser(null)} />
        )}

        {/* ── Main app — always renders so content is ready when preloader fades ── */}
        {!checkingAuth && (
          <BrowserRouter>
            <Suspense fallback={null}>
              <div style={{ isolation: 'isolate', minHeight: '100vh' }}>
              <Routes>
                <Route path="/"              element={<MainPage />} />
                <Route path="/postcards"     element={<PostcardsPage />} />
                <Route path="/gallery"       element={<ClubGalleryPage />} />
                <Route path="/events"        element={<EventsPage />} />
                <Route path="/events/:id"    element={<EventDetailPage />} />
                <Route path="/members"       element={<MembersPage />} />
                <Route path="/members/:id"     element={<UserProfilePage />} />
                <Route path="/core-member/:id" element={<CoreMemberProfilePage />} />
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

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </div>
            </Suspense>

            {pendingNav && (
              <NavigateEffect to={pendingNav} onDone={() => setPendingNav(null)} />
            )}
          </BrowserRouter>
        )}

      </AuthCtx.Provider>
    </ThemeCtx.Provider>
    </ToastProvider>
    </QueryClientProvider>
  )
}
