# Software Development Lifecycle (SDLC)
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Methodology:** Agile (iterative sprints) with documentation artifacts borrowed from RUP

---

## 1. Overview

The IEM Photography Club platform was developed using an **iterative Agile approach** with continuous delivery. The development proceeded across distinct phases, each delivering a vertical slice of working functionality rather than completing one horizontal layer at a time.

---

## 2. SDLC Phases

### Phase 1 — Requirements & Discovery

**Duration:** ~1 week  
**Activities:**
- Stakeholder interviews with club admin and core members
- Identification of primary user personas (admin, core, coordinator, photographer)
- Enumeration of functional requirements (see `02_SRS.md`)
- Technology stack selection and feasibility assessment

**Deliverables:**
- User stories and acceptance criteria
- Wireframes for key flows (login, dashboard, event detail)
- Technology decision record: React + Vite + Node.js + MongoDB + AWS S3

---

### Phase 2 — System Design

**Duration:** ~1 week  
**Activities:**
- Database schema design (Users, Events, Competitions, Activities, Gallery, Magazines, Postcards, Settings)
- API surface design (RESTful, JWT-authenticated)
- Component hierarchy design for React SPA
- Role-based access control (RBAC) matrix design
- AWS S3 bucket policy and presigned URL strategy

**Deliverables:**
- Entity Relationship Diagram (see `03_SDD.md`)
- API endpoint catalogue (see `06_API.md`)
- Component tree diagram
- Authentication flow diagram

---

### Phase 3 — Core Infrastructure (Sprint 1–2)

**Duration:** ~2 weeks  
**Features Delivered:**
- Express server scaffolding with Helmet, CORS, rate limiting
- MongoDB connection with Mongoose models
- JWT authentication (signup, login, token refresh)
- User role system (admin / core / coordinator / photographer)
- React SPA shell with React Router 7
- Tailwind CSS design tokens and global styles
- GlassButton, Navbar, PageLayout base components
- AWS S3 upload integration with `multer` and presigned URLs

---

### Phase 4 — Public Website (Sprint 3–4)

**Duration:** ~2 weeks  
**Features Delivered:**
- Homepage hero (mobile animated + desktop classic/video)
- Event Cinema Gallery section
- Club Gallery with masonry grid
- Core Committee page (year-wise)
- Competitions and Activities public pages
- Magazine published browser
- Postcard carousel
- Social links
- Section visibility (admin-configurable)
- Light/Dark mode with `localStorage` persistence

---

### Phase 5 — Admin Dashboard (Sprint 5–7)

**Duration:** ~3 weeks  
**Features Delivered:**
- Admin panel shell (desktop sidebar + mobile bottom drawer)
- User management (approve, reject, promote, role assignment)
- Event CRUD (create, detail page, gallery upload, coordinator management)
- Competition CRUD (entries, gallery, winner tracking)
- Activity CRUD (volunteers, gallery)
- Core committee management (year-wise CRUD)
- Postcards management
- Announcement system (drafts, publish, target segments)
- Social links management
- Permissions panel (coordinator capability flags)

---

### Phase 6 — Member Dashboard (Sprint 8–9)

**Duration:** ~2 weeks  
**Features Delivered:**
- Member dashboard shell (sidebar + mobile sheet)
- Profile tab (bio, photo, Instagram, activity calendar, stats)
- Events / Competitions / Activities tabs (personal participation records)
- Postcard upload tab
- Gallery coordinator tab
- Announcements tab
- Profile settings (edit photo, bio, handle)

---

### Phase 7 — Magazine Editor (Sprint 10–12)

**Duration:** ~3 weeks (most complex feature)  
**Features Delivered:**
- 28 magazine layout templates across 8 categories
- Inline text editing (TxtSlot double-click)
- Image upload per slot with S3 integration
- Image crop/pan editor (drag, pinch-to-zoom, rotation)
- 8 color palettes + 6 font pairings (live preview)
- Draft/Publish versioning
- PDF export pipeline (html2canvas + jsPDF, CORS proxy, font embedding, CSS injection)
- Auto thumbnail generation (first page capture → S3)
- Template page thumbnails in browser

---

### Phase 8 — Polish, Optimization & Production Hardening (Sprint 13)

**Duration:** ~1 week  
**Activities:**
- Non-blocking font loading (`rel="preload"` + `onload` swap)
- Vite `manualChunks` code splitting (admin bundle 1.4MB → 843KB)
- `will-change: transform` on animated elements
- `text-rendering: optimizeSpeed` and antialiased fonts
- `font-display: swap` for UI fonts, `font-display: optional` for magazine fonts
- Video hero smoothness fix (`onCanPlay` opacity fade, rAF throttle on `mousemove`)
- ImgSlot `overflow: hidden` dual-layer hardening (inline + Tailwind) for PDF
- Hero mode backend persistence (MongoDB settings, 5s polling for real-time sync)
- Copyright year standardisation (all → 2026)
- `.gitignore` hardening, documentation authorship

---

## 3. Release History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | Jan 2026 | Core auth, basic admin, public pages |
| 0.2.0 | Feb 2026 | Member dashboard, gallery, events |
| 0.3.0 | Mar 2026 | Magazine editor v1, PDF export |
| 0.4.0 | Apr 2026 | Magazine editor v2 (28 layouts, crop editor) |
| 0.5.0 | May 2026 | Video hero, light mode revamp, FAB redesign |
| 1.0.0 | Jun 2026 | Production hardening, backend hero sync, docs |

---

## 4. Definition of Done

A feature is considered **Done** when:

- [ ] Functional requirement fully implemented and verified manually
- [ ] Works in both light and dark mode
- [ ] Responsive across mobile (320px), tablet (768px), desktop (1280px)
- [ ] No console errors in browser devtools
- [ ] API error states handled with user-visible feedback
- [ ] No new TypeScript / ESLint regressions
- [ ] Code reviewed (self-review for solo project)

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S3 CORS blocks PDF image capture | High | High | CORS proxy (`/api/proxy/image`) converts to data URLs |
| html2canvas CSS injection fails | Medium | High | Full CSSOM dump via `getFullCSSForClone()` + inline critical styles |
| MongoDB Atlas cold start latency | Low | Medium | Connection pooling, 5s `useData` polling prevents stale UI |
| JWT secret rotation | Low | High | `JWT_SECRET` in `.env`, never committed |
| Video file too large for git | High | Medium | `.gitignore` excludes `*.mp4`; host on S3/CDN |
| Font blocking render | Medium | Medium | `font-display: swap/optional`, non-blocking preload pattern |
