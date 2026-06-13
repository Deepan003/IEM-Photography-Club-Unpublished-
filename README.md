<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0a0a0f,50:dc2626,100:0a0a0f&height=220&section=header&text=IEM%20Photography%20Club&fontSize=52&fontColor=ffffff&fontAlignY=38&animation=twinkling&desc=Capturing%20The%20Legacy&descAlignY=60&descSize=18&descColor=rgba(255,255,255,0.7)" width="100%"/>

<br/>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=22&duration=2800&pause=800&color=DC2626&center=true&vCenter=true&multiline=false&width=700&lines=The+Official+IEM+Photography+Club+Platform;Full-Stack+React+%2B+Node.js+%2B+MongoDB;Magazine+Builder+%E2%80%A2+Gallery+%E2%80%A2+Events+%E2%80%A2+Members;Built+with+%E2%9D%A4%EF%B8%8F+for+photographers)](https://git.io/typing-svg)

<br/>

<img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Vite-5.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
<img src="https://img.shields.io/badge/AWS-S3-FF9900?style=for-the-badge&logo=amazons3&logoColor=white" />
<img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />

</div>

---

<div align="center">

## ✦ &nbsp; What is this? &nbsp; ✦

</div>

> **IEM Photography Club** is the official full-stack web platform for the Photography Club of IEM (Institute of Engineering & Management), Kolkata. It serves as the club's digital home — hosting events, galleries, competitions, core committee records, member dashboards, and a built-in **magazine editor** capable of exporting publication-quality PDFs.

---

<div align="center">

## ◈ &nbsp; Architecture at a Glance &nbsp; ◈

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IEM PHOTOGRAPHY CLUB                             │
│                         Full-Stack Architecture                         │
└─────────────────────────────────────────────────────────────────────────┘

     BROWSER                                     SERVER
  ┌──────────────────┐                    ┌───────────────────────┐
  │   React 18 SPA   │  ◄── REST JSON ──► │   Express.js API      │
  │   Vite 5 Build   │                    │   Node.js Runtime     │
  │   TailwindCSS    │                    │   JWT Auth            │
  │   React Router 7 │                    │   Rate Limiting       │
  │   React Query 5  │                    │   Helmet Security     │
  └──────────────────┘                    └──────────┬────────────┘
                                                     │
                                          ┌──────────┴────────────┐
                                          │                       │
                                   ┌──────┴──────┐        ┌──────┴──────┐
                                   │  MongoDB    │        │   AWS S3    │
                                   │  Mongoose   │        │   Storage   │
                                   └─────────────┘        └─────────────┘
```

</div>

---

<div align="center">

## ⬡ &nbsp; Feature Showcase &nbsp; ⬡

</div>

<table>
<tr>
<td width="50%" valign="top">

### 🏠 &nbsp; Public Website
- **Animated hero** — video/classic mode toggle (admin-set, DB-persisted, all users see same view)
- **Cinematic intro** — liquid-glass pre-video loader, navbar fade-in synced to the text, optional scroll-lock + bottom progress loader for timed reveals
- **Event Cinema Gallery** — cinematic photo reel per event
- **Club Gallery** — masonry grid with lightbox
- **Core Committee** — year-wise member grid
- **Competitions & Activities** — with status badges and galleries
- **Magazine Showcase** — published magazine browser
- **Postcard Carousel** — animated horizontal scroll
- **Social Links** — dynamic icons
- **Light / Dark mode** — persisted preference

</td>
<td width="50%" valign="top">

### ⚙️ &nbsp; Admin / Core Panel
- **User management** — approve, reject, assign roles
- **Event management** — full CRUD with gallery upload
- **Competition management** — entry tracking, winner management
- **Activity management** — participation records
- **Magazine builder** — 28 layout templates, drag-to-crop, PDF export
- **Postcard studio** — upload and curate
- **Announcement system** — targeted broadcasts
- **Core committee** — year-wise management
- **Hero Theme Studio** — seasonal video presets, per-theme blur/darkness/saturation/brightness/warmth, intro modes, live 16:9 / 9:16 preview, save vs. activate
- **Settings** — section visibility, subtitle editing, hero mode

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📖 &nbsp; Magazine Editor
- **28 pro layouts** — cover, spreads, editorial, portrait, grid, collage
- **Inline text editing** — double-click any text slot
- **Image crop & pan** — pinch-to-zoom, drag-to-reposition
- **Live theme system** — 8 curated color palettes + 6 font pairings
- **PDF export** — html2canvas + jsPDF, CORS-safe proxy, font embedding
- **Thumbnail generation** — auto OG image on publish
- **Draft / Publish** — version control per magazine

</td>
<td width="50%" valign="top">

### 👤 &nbsp; Member Dashboard
- **Profile** — bio, photo, Instagram, activity calendar
- **My Gallery** — personal gallery (photographers and core members; swipeable lightbox)
- **My Events** — events joined, photos uploaded
- **My Competitions** — entries submitted, results
- **Postcards** — personal upload section
- **Magazine tab** — read published magazines
- **Announcements** — club-wide + event-specific
- **Settings** — photo, bio, social handle
- **Light / Dark mode** toggle

</td>
</tr>
</table>

---

<div align="center">

## ◉ &nbsp; Tech Stack Breakdown &nbsp; ◉

</div>

<div align="center">

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | React 18 + Vite 5 | SPA, fast HMR, ES2020 build target |
| **Routing** | React Router 7 | Client-side navigation, URL-driven tabs |
| **State / Data** | TanStack React Query 5 | Server state, polling, shared cache |
| **Styling** | Tailwind CSS 3.4 | Utility-first, glassmorphic + neumorphic |
| **3D** | Three.js + R3F | 3D canvas elements (admin stats) |
| **PDF** | jsPDF + html2canvas | Magazine PDF export, font embedding |
| **Backend** | Express.js 4 on Node.js | REST API, middleware stack |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Token-based auth, hashed passwords |
| **Database** | MongoDB + Mongoose 8 | Document store, flexible schemas |
| **Storage** | AWS S3 (SDK v3) | Photo / file uploads |
| **Email** | Nodemailer | Signup approval, notifications |
| **Security** | Helmet, CORS, rate-limit | HTTP headers, origin policy, DDoS guard |
| **Build** | Vite manualChunks | Code splitting, lazy admin bundle |

</div>

---

<div align="center">

## ◈ &nbsp; Project Structure &nbsp; ◈

</div>

```
IEM-PHOTOGRAPHY-CLUB/
│
├── 📄 index.html                 # Entry point — non-blocking font loading
├── ⚙️  vite.config.js             # Build config, manualChunks splitting
├── 🎨 tailwind.config.js         # Design tokens, custom utilities
├── 🚀 vercel.json                # Deployment routing rules
│
├── 📁 src/
│   ├── main.jsx                  # React root, QueryClient, theme init
│   ├── App.jsx                   # Routes, auth context, theme context
│   ├── MainPage.jsx              # Public homepage (hero, all sections)
│   ├── index.css                 # Global CSS, animations, glass utilities
│   │
│   ├── 📁 api/
│   │   ├── api.js                # All API client functions (namespaced)
│   │   └── auth.js               # Auth API + token helpers
│   │
│   ├── 📁 components/
│   │   ├── Navbar.jsx            # Top nav, theme toggle, hero mode toggle
│   │   ├── MemberDashboard.jsx   # Member dashboard shell + all tabs
│   │   ├── ImageUpload.jsx       # S3 upload, drag-drop, LiquidLoader
│   │   ├── ProgressiveImage.jsx  # LiquidLoader wave animation
│   │   ├── GlassButton.jsx       # Reusable glassmorphic button
│   │   ├── PageLayout.jsx        # Shared page wrapper with footer
│   │   ├── RevealOnScroll.jsx    # Intersection Observer scroll reveals
│   │   ├── Toast.jsx             # Global toast notification system
│   │   ├── Skeleton.jsx          # Loading skeleton components
│   │   └── 📁 magazine/
│   │       ├── MagazineTab.jsx   # Magazine builder — editor shell + PDF
│   │       ├── TemplatePage.jsx  # All 28 layouts, ImgSlot, TxtSlot
│   │       ├── templates.js      # Template registry + default texts
│   │       └── TemplatePage.css  # Magazine-specific print styles
│   │
│   ├── 📁 pages/
│   │   ├── 📁 admin/
│   │   │   └── AdminDashboard.jsx # Admin shell + all admin tabs
│   │   ├── CoreCommitteePage.jsx
│   │   ├── CompetitionsPage.jsx
│   │   ├── ActivitiesPage.jsx
│   │   ├── ClubGalleryPage.jsx
│   │   ├── MagazinesPage.jsx
│   │   └── ... (other public pages)
│   │
│   ├── 📁 hooks/
│   │   └── useData.js            # React Query wrapper with shared cache
│   │
│   └── 📁 utils/
│       ├── yearCalc.js           # Academic year helpers
│       └── profileReport.js     # CSV / PDF profile export
│
├── 📁 server/
│   ├── index.js                  # Express app entry, middleware, routes
│   ├── 📁 models/                # Mongoose schemas
│   │   ├── User.js
│   │   ├── Event.js
│   │   ├── Competition.js
│   │   ├── Activity.js
│   │   ├── Magazine.js
│   │   ├── Postcard.js
│   │   ├── AppSettings.js
│   │   ├── HeroTheme.js          # Seasonal hero presets (video + visual + intro)
│   │   └── ...
│   ├── 📁 routes/                # Express route handlers
│   │   ├── auth.js
│   │   ├── members.js
│   │   ├── events.js
│   │   ├── gallery.js
│   │   ├── magazines.js
│   │   ├── settings.js
│   │   ├── heroThemes.js         # Hero theme CRUD + activate + video upload
│   │   └── ...
│   ├── 📁 middleware/
│   │   └── auth.js               # JWT verify, requireRole
│   └── 📁 scripts/
│       └── backfillCacheControl.js  # One-time S3 Cache-Control backfill
│
└── 📁 docs/                      # Full project documentation
    ├── 01_SDLC.md
    ├── 02_SRS.md
    ├── 03_SDD.md
    ├── 04_DFD.md
    ├── 05_UIUX.md
    ├── 06_API.md
    ├── 07_DDD.md
    ├── 08_TEST_PLAN.md
    └── 09_DEVOPS.md
```

---

<div align="center">

## ⚡ &nbsp; Quick Start &nbsp; ⚡

</div>

**Prerequisites:** Node.js 18+, MongoDB (local or Atlas), AWS S3 bucket

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/iem-photography-club.git
cd iem-photography-club

# 2. Install frontend deps
npm install

# 3. Install backend deps
cd server && npm install && cd ..

# 4. Create environment file
cp .env.example .env   # then fill in your values
```

**`.env` required variables:**
```env
# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your_super_secret_key_here

# MongoDB
MONGODB_URI=mongodb://localhost:27017/iempc

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_BUCKET_NAME=your-bucket-name

# Email (Nodemailer)
EMAIL_USER=your@email.com
EMAIL_PASS=your_app_password
EMAIL_FROM=IEM Photography Club <your@email.com>
```

```bash
# 5. Seed initial admin
npm run admin:create

# 6. Run dev (frontend + backend concurrently)
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

---

<div align="center">

## 🌐 &nbsp; Deployment &nbsp; 🌐

</div>

<div align="center">

| Platform | Config | Notes |
|:---------|:-------|:------|
| **Vercel** | `vercel.json` included | Full-stack via serverless functions |
| **Render** | Web Service + MongoDB Atlas | Auto-deploy from `main` branch |
| **Railway** | One-click deploy | MongoDB plugin available |
| **Self-hosted** | `npm run build` + `npm start` | Serve `dist/` via Express static |

</div>

See [`docs/09_DEVOPS.md`](docs/09_DEVOPS.md) for full deployment guide.

---

<div align="center">

## 📚 &nbsp; Documentation &nbsp; 📚

</div>

<div align="center">

| Document | Description |
|:---------|:------------|
| [`01_SDLC.md`](docs/01_SDLC.md) | Software Development Lifecycle — phases, milestones, methodology |
| [`02_SRS.md`](docs/02_SRS.md) | Software Requirements Specification — functional & non-functional |
| [`03_SDD.md`](docs/03_SDD.md) | Software Design Document — system architecture, component design |
| [`04_DFD.md`](docs/04_DFD.md) | Data Flow Diagrams — Level 0, 1, 2 DFDs with Mermaid |
| [`05_UIUX.md`](docs/05_UIUX.md) | UI/UX Design Document — design system, patterns, accessibility |
| [`06_API.md`](docs/06_API.md) | API Documentation — all endpoints, request/response schemas |
| [`07_DDD.md`](docs/07_DDD.md) | Domain Driven Design — bounded contexts, aggregates, ubiquitous language |
| [`08_TEST_PLAN.md`](docs/08_TEST_PLAN.md) | Test Plan & QA Report — test cases, coverage, results |
| [`09_DEVOPS.md`](docs/09_DEVOPS.md) | Deployment & DevOps Guide — CI/CD, hosting, env config |

</div>

---

<div align="center">

## ✦ &nbsp; Role Hierarchy &nbsp; ✦

</div>

```
                    ┌──────────┐
                    │  ADMIN   │  ← Full system access, all tabs, all settings
                    └────┬─────┘
                         │
                    ┌────┴─────┐
                    │   CORE   │  ← Panel access, event/comp/activity mgmt
                    └────┬─────┘
                         │
                ┌────────┴────────┐
                │  COORDINATOR    │  ← Gallery upload, announcements
                └────────┬────────┘
                         │
                ┌────────┴────────┐
                │  PHOTOGRAPHER   │  ← Member dashboard, personal stats
                └─────────────────┘
```

---

<div align="center">

## ◈ &nbsp; Key Technical Highlights &nbsp; ◈

</div>

- **`overflow: hidden` dual-layer protection** — magazine images can never escape their slots, both at ImgSlot (inline style) and page container level
- **html2canvas CSS injection** — full CSSOM captured synchronously via `getFullCSSForClone()`, injected into clone's `<head>` to prevent Tailwind class loss
- **React Query shared cache** — identical `fetchFn.toString()` keys share one network request across components
- **Video hero** — `onCanPlay` fade prevents `backdrop-filter` snap; entire background layer fades as unit
- **Font-display: optional** — magazine-only fonts never block render, deferred via `preload` + `onload` swap
- **Admin FAB portal** — `createPortal(fab, document.body)` escapes parent `transform: scale()` stacking context
- **Per-user theme** — toggle available in Navbar, Admin Panel, and Member Dashboard; `localStorage` persisted
- **Global hero mode** — admin sets `desktopHeroMode` to MongoDB via `settingsApi.patch()`, all users read it via 5s polling; `useEffect` applies it immediately on `heroSettingData` change
- **Hero Theme Studio** — DB-backed `HeroTheme` presets served via `/api/hero-themes/active`; save/activate are decoupled and the server strips `isActive`/`isDefault` from update payloads (defence-in-depth); warmth = `sepia() + hue-rotate()` for true amber, not a flat tint
- **Cinematic intro** — pre-video liquid-glass loader lifts on `onLoadedData` (first frame, no black flash); navbar fade-in shares the hero `introReveal` signal; timed/after-first-play modes lock scroll + show a video-synced bottom loader, with a 9s safety unlock
- **Media caching** — viewport-gated single hero video (no double-download of 16:9 + 9:16); `Cache-Control: immutable` on S3 uploads + `backfillCacheControl.js` for existing objects, so videos load from cache on refresh (HTTP-layer cache handles Range requests; a blob cache cannot)

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0a0a0f,50:dc2626,100:0a0a0f&height=120&section=footer&animation=twinkling" width="100%"/>

**IEM Photography Club · Kolkata, India · © 2026**

*Made with passion for photographers, by photographers.*

</div>
