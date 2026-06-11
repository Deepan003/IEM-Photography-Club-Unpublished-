# Software Requirements Specification (SRS)
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Standard:** Based on IEEE 830-1998

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the IEM Photography Club web platform — a full-stack web application serving as the digital presence and management system for the Photography Club of IEM, Kolkata.

### 1.2 Scope
The system shall provide:
- A public-facing website showcasing club activities, events, galleries, and publications
- An admin/core panel for club management
- A member dashboard for individual photographers
- A built-in magazine design and PDF export tool

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| Admin | Highest privilege role; full system access |
| Core | Club executive member; manages content, cannot manage system settings |
| Coordinator | Event/gallery coordinator; limited upload permissions |
| Photographer | Regular club member |
| Session | Academic year, e.g. "2025-26" |
| FAB | Floating Action Button |
| Magazine | Multi-page digital publication with template layouts |

---

## 2. Overall Description

### 2.1 Product Perspective
The system is a standalone web application accessible via any modern browser. It is not integrated with any external club management system. Media storage is delegated to AWS S3; email delivery to Nodemailer.

### 2.2 Product Functions (Summary)

| Category | Functions |
|----------|-----------|
| Auth | Register, login, JWT refresh, role-based access |
| Public website | Hero, gallery, events, competitions, activities, magazines, team, socials |
| Admin panel | Users, events, competitions, activities, postcards, core committee, settings, announcements |
| Member dashboard | Profile, personal stats, galleries, postcards, magazine reader |
| Magazine editor | Template selection, text/image editing, crop, PDF export, publish |

### 2.3 User Classes

| Class | Privileges | Access Points |
|-------|-----------|---------------|
| Anonymous | Read public pages | Website |
| Photographer | Member dashboard + magazine reader | Dashboard |
| Coordinator | Dashboard + gallery upload | Dashboard |
| Core | Admin panel (limited) + dashboard | Admin panel |
| Admin | Full admin panel + all settings | Admin panel |

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | System shall allow new users to register with name, email, password, department, start year, end year |
| FR-AUTH-02 | Registration creates account in `pending` state; admin must approve |
| FR-AUTH-03 | System shall authenticate users via email/password and issue a JWT |
| FR-AUTH-04 | JWT shall expire after a configurable duration; client shall handle 401 gracefully |
| FR-AUTH-05 | Admin shall be able to reject applications with an optional reason message |
| FR-AUTH-06 | Admin shall be able to promote/demote user roles |
| FR-AUTH-07 | Passwords shall be stored as bcrypt hashes (minimum 10 rounds) |

### 3.2 Public Website

| ID | Requirement |
|----|-------------|
| FR-PUB-01 | Hero section shall display animated typography with mobile and desktop variants |
| FR-PUB-02 | Admin shall be able to toggle hero between classic and video mode; change persisted in DB; all users see the same mode within 5 seconds |
| FR-PUB-03 | Gallery section shall display club photos in a masonry grid |
| FR-PUB-04 | Events cinema gallery shall render per-event photo reels |
| FR-PUB-05 | Core committee shall be displayed year-wise with photos and designations |
| FR-PUB-06 | Competitions and activities shall show status badges (UPCOMING / ONGOING / PAST) |
| FR-PUB-07 | Published magazines shall be browsable and linkable |
| FR-PUB-08 | Social links shall be configurable by admin |
| FR-PUB-09 | Section visibility shall be individually togglable by admin; changes persist to DB |
| FR-PUB-10 | Subtitle text in hero shall be editable inline by admin/core |

### 3.3 Event Management

| ID | Requirement |
|----|-------------|
| FR-EVT-01 | Admin/core shall create, edit, delete events with title, date, description, cover photo |
| FR-EVT-02 | Event status (upcoming/ongoing/past) shall be auto-computed from dates, overridable manually |
| FR-EVT-03 | Gallery photos shall be uploadable per event; order shall be rearrangeable |
| FR-EVT-04 | Coordinators shall be assignable to events with configurable upload permissions |
| FR-EVT-05 | Events shall support an "open to all" flag for public photo upload |

### 3.4 Competition Management

| ID | Requirement |
|----|-------------|
| FR-COMP-01 | Admin/core shall create competitions with title, date, description, rules |
| FR-COMP-02 | Members shall be able to submit entries (photos) to open competitions |
| FR-COMP-03 | Admin shall be able to record winners with position and prize |
| FR-COMP-04 | Competition gallery shall be orderable; visibility configurable |

### 3.5 Magazine Editor

| ID | Requirement |
|----|-------------|
| FR-MAG-01 | Admin/core/member shall be able to create multi-page magazines |
| FR-MAG-02 | System shall provide at minimum 20 distinct page layout templates |
| FR-MAG-03 | Each page shall support at least 1 image slot and 1 text slot |
| FR-MAG-04 | Images shall be uploadable to S3; crop/pan/zoom/rotation shall be adjustable per slot |
| FR-MAG-05 | Text slots shall be editable inline via double-click |
| FR-MAG-06 | At least 6 color palettes and 4 font pairings shall be available |
| FR-MAG-07 | Magazine shall be exportable to PDF preserving all layout, images, and fonts |
| FR-MAG-08 | PDF generation shall use a CORS proxy to embed S3 images as data URLs |
| FR-MAG-09 | Published magazines shall auto-generate a thumbnail from page 1 |
| FR-MAG-10 | Draft and Published states shall be maintained independently |

### 3.6 Member Dashboard

| ID | Requirement |
|----|-------------|
| FR-DASH-01 | Members shall view their own profile, bio, photo, department |
| FR-DASH-02 | Members shall see statistics for events, competitions, activities participated |
| FR-DASH-03 | Members shall edit their bio, profile photo, and Instagram handle |
| FR-DASH-04 | Activity calendar shall highlight days with club activity |
| FR-DASH-05 | Members shall read all published magazines |
| FR-DASH-06 | Coordinators shall upload photos to permitted galleries |

### 3.7 Settings

| ID | Requirement |
|----|-------------|
| FR-SET-01 | Hero mode (classic/video) setting shall be persisted in DB and served to all users |
| FR-SET-02 | Section visibility (8 sections) shall be togglable and persist to DB |
| FR-SET-03 | Subtitle/join text editable by admin; persists to DB |
| FR-SET-04 | Coordinator permissions (gallery upload, postcard section, announcements) shall be configurable |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | Initial page load (LCP) shall complete within 3 seconds on a 4G connection |
| NFR-PERF-02 | Admin bundle shall be lazy-loaded; main bundle shall not exceed 500KB gzipped |
| NFR-PERF-03 | API responses shall complete within 800ms for list endpoints under normal load |
| NFR-PERF-04 | PDF export for a 10-page magazine shall complete within 30 seconds |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All API endpoints except public reads shall require valid JWT |
| NFR-SEC-02 | Role checks shall be performed server-side on every protected route |
| NFR-SEC-03 | Passwords shall never be returned in API responses |
| NFR-SEC-04 | Rate limiting shall prevent more than 100 requests/15min per IP |
| NFR-SEC-05 | HTTP security headers (CSP, HSTS, X-Frame-Options) shall be set via Helmet |
| NFR-SEC-06 | `.env` files shall never be committed to version control |

### 4.3 Usability

| ID | Requirement |
|----|-------------|
| NFR-USE-01 | All interactive elements shall be accessible on touch devices |
| NFR-USE-02 | Light and dark mode shall be supported throughout; preference persisted |
| NFR-USE-03 | Loading states shall use skeleton loaders, not blank screens |
| NFR-USE-04 | Error states shall display human-readable messages, not stack traces |

### 4.4 Compatibility

| ID | Requirement |
|----|-------------|
| NFR-COMP-01 | Application shall function on Chrome, Firefox, Safari, Edge (latest 2 versions) |
| NFR-COMP-02 | Application shall be fully usable on screens from 320px to 2560px wide |
| NFR-COMP-03 | Build target shall be ES2020 (no IE11 support required) |

### 4.5 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | System shall have 99% uptime when hosted on Vercel/Render |
| NFR-REL-02 | Data shall not be lost on server restart (all persistence in MongoDB) |
| NFR-REL-03 | Media files shall survive server restarts (stored on S3, not local disk) |
