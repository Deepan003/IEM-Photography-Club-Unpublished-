import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'   // join lives in 'path'
import { existsSync }             from 'fs'     // existsSync lives in 'fs'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '.env') })

import express    from 'express'
import cors       from 'cors'
import helmet     from 'helmet'
import mongoose   from 'mongoose'
import mediaRoutes              from './routes/media.js'
import postRoutes               from './routes/posts.js'
import globalAnnouncementRoutes from './routes/globalAnnouncements.js'
import settingsRoutes           from './routes/settings.js'
import authRoutes               from './routes/auth.js'
import adminRoutes       from './routes/admin.js'
import uploadRoutes      from './routes/upload.js'
import postcardsRoutes   from './routes/postcards.js'
import galleryRoutes     from './routes/gallery.js'
import eventsRoutes      from './routes/events.js'
import membersRoutes     from './routes/members.js'
import coreRoutes        from './routes/coreCommittee.js'
import socialRoutes      from './routes/socialLinks.js'
import competitionsRoutes from './routes/competitions.js'
import activitiesRoutes   from './routes/activities.js'
import magazineRoutes    from './routes/magazines.js'
import imageProxyRoutes  from './routes/imageProxy.js'
import heroThemesRoutes  from './routes/heroThemes.js'
import { ensureDefaultTheme } from './models/HeroTheme.js'
import { checkAndFlagPassouts, syncCurrentCoreMembers } from './utils/passout.js'

const app    = express()
app.set('trust proxy', 1)   // read real client IP from X-Forwarded-For (needed behind Nginx/Render/Railway)
const PORT   = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// Security headers — CSP disabled because Vite's built SPA uses inline module scripts
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

// In prod the SPA is served by this same Express server (same origin), so CORS only
// matters if you later add a separate frontend domain. ALLOWED_ORIGINS is optional.
const allowedOrigins = isProd
  ? (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : true)   // true = reflect request origin (same-server SPA deploy is always same-origin)
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))
app.use(express.json({ limit: '5mb' }))

app.use('/api/media',         mediaRoutes)
app.use('/api/posts',         postRoutes)
app.use('/api/announce',      globalAnnouncementRoutes)
app.use('/api/settings',      settingsRoutes)
app.use('/api/auth',          authRoutes)
app.use('/api/admin',        adminRoutes)
app.use('/api/upload',       uploadRoutes)
app.use('/api/postcards',    postcardsRoutes)
app.use('/api/gallery',      galleryRoutes)
app.use('/api/events',       eventsRoutes)
app.use('/api/members',      membersRoutes)
app.use('/api/core',         coreRoutes)
app.use('/api/social',       socialRoutes)
app.use('/api/competitions', competitionsRoutes)
app.use('/api/activities',   activitiesRoutes)
app.use('/api/magazines',   magazineRoutes)
app.use('/api/proxy/image', imageProxyRoutes)
app.use('/api/hero-themes', heroThemesRoutes)
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }))

if (isProd) {
  const dist = join(__dir, '..', 'dist')
  if (existsSync(dist)) {
    app.use(express.static(dist))
    app.get(/^(?!\/api).*/, (_, res) => res.sendFile(join(dist, 'index.html')))
  } else {
    console.warn('⚠️   dist/ not found — run `npm run build` first')
  }
}

// Schedules a daily passout+core-sync check at 00:05 each night.
// Runs with pure Node setTimeout — no extra dependencies.
function scheduleDailyPassoutCheck() {
  const now  = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(0, 5, 0, 0)           // 00:05 AM next day
  const delay = next - now
  setTimeout(async () => {
    console.log('⏰  Daily passout check triggered')
    await checkAndFlagPassouts().catch(e => console.error('⚠️  Passout check failed:', e.message))
    await syncCurrentCoreMembers().catch(e => console.error('⚠️  Core sync failed:', e.message))
    scheduleDailyPassoutCheck()        // reschedule for the following day
  }, delay)
  const h = String(next.getHours()).padStart(2,'0'), m = String(next.getMinutes()).padStart(2,'0')
  console.log(`⏰  Next passout check scheduled: ${next.toDateString()} ${h}:${m}`)
}

// Global Express error handler — catches next(err) from all routes/middleware
app.use((err, req, res, _next) => {
  console.error('❌  Express error:', err.message)
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: isProd ? 'Internal server error' : err.message })
})

process.on('uncaughtException',  err => console.error('❌  Uncaught exception:',  err))
process.on('unhandledRejection', err => console.error('❌  Unhandled rejection:', err))

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅  MongoDB connected')
    // Run immediately on startup
    await ensureDefaultTheme().catch(e => console.error('⚠️  Hero theme init failed:', e.message))
    await checkAndFlagPassouts().catch(e => console.error('⚠️  Passout check failed:', e.message))
    await syncCurrentCoreMembers().catch(e => console.error('⚠️  Core sync failed:', e.message))
    // Then schedule daily at 00:05 so June 1 transition fires automatically
    scheduleDailyPassoutCheck()
    app.listen(PORT, () => console.log(`🚀  Server → http://localhost:${PORT}`))
  })
  .catch(err => { console.error('❌  MongoDB:', err.message); process.exit(1) })
