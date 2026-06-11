# Software Design Document (SDD)
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Covers:** System Architecture, Component Design, Database Design, Security Design

---

## 1. System Architecture

### 1.1 Architectural Pattern

The system follows a **3-Tier Client-Server** architecture:

```
┌────────────────────────────────────────────────────────┐
│  TIER 1: Presentation (React SPA)                      │
│  React 18 · Vite 5 · Tailwind CSS · React Router 7    │
│  React Query · Three.js · html2canvas · jsPDF          │
└───────────────────────┬────────────────────────────────┘
                        │ HTTP/REST (JSON)
                        │ JWT Bearer token
┌───────────────────────▼────────────────────────────────┐
│  TIER 2: Application (Express API)                     │
│  Node.js · Express 4 · JWT · bcryptjs                  │
│  Helmet · CORS · express-rate-limit · Nodemailer       │
└────────────┬──────────────────────┬────────────────────┘
             │                      │
┌────────────▼──────────┐  ┌────────▼───────────────────┐
│  TIER 3a: Database    │  │  TIER 3b: Object Storage   │
│  MongoDB (Atlas)      │  │  AWS S3                    │
│  Mongoose 8           │  │  Presigned URLs            │
└───────────────────────┘  └────────────────────────────┘
```

### 1.2 Deployment Architecture

```
Internet ──► Vercel Edge ──► /api/* ──► Express Serverless
                        └──► /* ────► Static React Build (dist/)
                                              │
                                    MongoDB Atlas (cloud)
                                    AWS S3 (ap-south-1)
```

---

## 2. Frontend Architecture

### 2.1 State Management Strategy

| State Type | Solution | Rationale |
|-----------|----------|-----------|
| Server state | TanStack React Query 5 | Caching, polling, shared queries across components |
| Auth state | React Context (`useAuth`) | Global user object, `setUser` updater |
| Theme state | React Context (`useTheme`) | `theme`, `toggleTheme` accessible anywhere |
| Local UI state | `useState` / `useReducer` | Component-scoped ephemeral state |
| URL state | `useSearchParams` | Tab selection survives refresh |
| Persistent preference | `localStorage` | Theme preference, hero mode optimistic cache |

### 2.2 Routing Structure

```
/                       → MainPage (public homepage)
/dashboard              → MemberDashboard (auth required)
/admin                  → AdminDashboard (admin/core only)
/gallery                → ClubGalleryPage
/events                 → EventsPage
/events/:id             → EventDetailPage
/competitions           → CompetitionsPage
/activities             → ActivitiesPage
/magazines              → MagazinesPage
/core                   → CoreCommitteePage
/alumni                 → AlumniPage
/feed                   → FeedPage
/join                   → JoinUsPage
/postcards              → PostcardsPage
```

### 2.3 Component Architecture

```
App.jsx
├── AuthContext (user, setUser)
├── ThemeContext (theme, toggleTheme)
└── Router
    ├── Navbar (all pages)
    ├── MainPage
    │   ├── Hero (mobile animated / desktop classic or video)
    │   ├── HomeSections
    │   │   ├── EventCinemaGallery
    │   │   ├── GalleryCycle
    │   │   ├── PostcardCarousel
    │   │   ├── MembersSection
    │   │   ├── CoreSection
    │   │   ├── CompetitionsSection
    │   │   ├── ActivitiesSection
    │   │   ├── MagazinesSection
    │   │   └── JoinSection
    │   └── Footer
    ├── AdminDashboard
    │   ├── Sidebar (desktop) / BottomDrawer (mobile)
    │   ├── UsersTab
    │   ├── EventsAdminTab → EventManager
    │   ├── CompetitionsAdminTab
    │   ├── ActivitiesAdminTab
    │   ├── CoreTab
    │   ├── GalleryTab
    │   ├── PostcardsTab
    │   ├── MagazineTab → TemplatePage
    │   ├── AnnounceTab
    │   ├── SocialsTab
    │   ├── PermissionsTab
    │   └── ProfileTab
    └── MemberDashboard
        ├── Sidebar (desktop) / BottomSheet (mobile)
        ├── ProfileTab
        ├── MagazineTab (read-only)
        ├── PostcardsUploadTab
        ├── EventsTab
        ├── CompetitionsTab
        ├── ActivitiesTab
        ├── CoordGalleryTab
        └── AnnouncementStudio
```

### 2.4 Code Splitting Strategy

| Chunk | Contents | Load Time |
|-------|----------|-----------|
| `react` | React core | Eager |
| `react-dom` | React DOM | Eager |
| `react-router` | Router | Eager |
| `admin` | All admin pages/components | Lazy (admin login) |
| `magazine` | Magazine editor + templates | Lazy (magazine tab) |
| `gallery` | Club gallery page | Lazy (navigation) |
| `competitions` | Competitions pages | Lazy (navigation) |
| `activities` | Activities pages | Lazy (navigation) |
| `xlsx` | Excel export library | Lazy (download action) |
| `jspdf` + `html2canvas` | PDF generation | Lazy (export action) |
| `three` | Three.js + R3F | Lazy (3D components) |

---

## 3. Backend Architecture

### 3.1 Middleware Stack (per request)

```
Request
  │
  ▼
CORS (origin policy)
  │
  ▼
Helmet (security headers: CSP, HSTS, X-Frame, etc.)
  │
  ▼
express-rate-limit (100 req / 15 min per IP)
  │
  ▼
express.json() (body parsing)
  │
  ▼
Route handler
  │
  ├── Public route → handler()
  │
  └── Protected route
        │
        ▼
      requireAuth (JWT verify → attach req.user)
        │
        ▼
      requireRole('admin' | 'core' | ...) (optional)
        │
        ▼
      handler()
```

### 3.2 Route Modules

| Module | Mount Point | Auth Required |
|--------|------------|---------------|
| `auth.js` | `/api/auth` | Mixed (login: no, getMe: yes) |
| `members.js` | `/api/members` | Mixed (list: public, update: auth) |
| `events.js` | `/api/events` | Mixed (list: public, create: admin/core) |
| `gallery.js` | `/api/gallery` | Mixed |
| `competitions.js` | `/api/competitions` | Mixed |
| `activities.js` | `/api/activities` | Mixed |
| `magazines.js` | `/api/magazines` | Mixed (published: public, create: auth) |
| `postcards.js` | `/api/postcards` | Mixed |
| `core.js` | `/api/core` | Mixed (list: public, create: admin/core) |
| `settings.js` | `/api/settings` | Mixed (content: public, patch: admin/core) |
| `announce.js` | `/api/announce` | Auth required |
| `social.js` | `/api/social` | Mixed |
| `admin.js` | `/api/admin` | Admin only |
| `proxy.js` | `/api/proxy` | No auth (CORS proxy for images) |
| `upload.js` | `/api/upload` | Auth required |

---

## 4. Database Design

### 4.1 Entity Relationship Overview

```
User ──────< EventMember
User ──────< CompetitionEntry
User ──────< ActivityVolunteer
User ──────< PostcardUpload

Event ─────< EventMember
Event ─────< GalleryPhoto
Event ─────< Announcement

Competition ──< CompetitionEntry
Competition ──< Winner
Competition ──< GalleryPhoto

Magazine ──< Page (embedded)
Page ──< ImageSlot (embedded)
Page ──< TextSlot (embedded)

AppSettings ── (key-value store)
```

### 4.2 Key Mongoose Schemas

**User**
```js
{
  name: String (required),
  email: String (unique, required),
  password: String (hashed, never returned),
  role: Enum['admin','core','coordinator','photographer'],
  status: Enum['pending','active','rejected'],
  department: String,
  startYear: Number,
  endYear: Number,
  profilePhoto: String (S3 URL),
  bio: String,
  instagramHandle: String,
  rejectionReason: String,
  createdAt: Date
}
```

**Event**
```js
{
  title: String,
  description: String,
  date: Date,
  endDate: Date,
  coverPhoto: String,
  status: Enum['upcoming','ongoing','past'],
  manualStatus: Boolean,
  isOpenToAll: Boolean,
  gallery: [{ url, s3Key, uploadedBy, order }],
  members: [{ userId, role, permissions }],
  coordinatorPerms: { canUpload, showInGallery }
}
```

**Magazine**
```js
{
  title: String,
  templateId: String,
  status: Enum['draft','published'],
  createdBy: ObjectId,
  pages: [{
    layoutId: String,
    images: [{ slotId, imageUrl, s3Key, cropData: { x, y, scale, rotation } }],
    texts: [{ slotId, value }]
  }],
  thumbnailUrl: String,
  publishedAt: Date
}
```

**AppSettings** (key-value store)
```js
{
  key: String (unique),     // e.g. 'desktopHeroMode', 'join-sub1', 'sectionVisibility'
  value: Mixed,             // String, Object, Boolean depending on key
  label: String,
  updatedBy: ObjectId
}
```

---

## 5. Security Design

### 5.1 Authentication Flow

```
Client                          Server
  │                               │
  ├── POST /api/auth/login ───────►│
  │   { email, password }         │
  │                               ├── findUser(email)
  │                               ├── bcrypt.compare(password, hash)
  │                               ├── jwt.sign({ userId, role }, JWT_SECRET)
  │◄─── { token, user } ──────────┤
  │                               │
  ├── GET /api/members/me ────────►│
  │   Authorization: Bearer <tok>  │
  │                               ├── jwt.verify(token, JWT_SECRET)
  │                               ├── User.findById(decoded.userId)
  │◄─── { user } ─────────────────┤
```

### 5.2 Role-Based Access Control Matrix

| Resource | Public | Photographer | Coordinator | Core | Admin |
|----------|--------|-------------|-------------|------|-------|
| Read events | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create events | — | — | — | ✓ | ✓ |
| Upload event gallery | — | — | ✓* | ✓ | ✓ |
| Manage members | — | — | — | — | ✓ |
| Publish magazine | — | — | — | ✓ | ✓ |
| Read settings | ✓ (content) | ✓ | ✓ | ✓ | ✓ |
| Write settings | — | — | — | ✓ | ✓ |
| Access admin panel | — | — | — | ✓ | ✓ |

*Coordinator gallery upload governed by `coordinator.canUploadGallery` setting
