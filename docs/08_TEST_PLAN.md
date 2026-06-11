# Test Plan & QA Report
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Testing Type:** Manual functional testing + automated smoke checks

---

## 1. Testing Strategy

### 1.1 Approach
Given this is a solo-developed project, the testing strategy prioritizes:
- **Manual exploratory testing** for all user-facing flows
- **API smoke tests** via direct endpoint calls (curl / Postman)
- **Browser compatibility checks** across Chrome, Firefox, Safari
- **Mobile responsiveness** verified at 375px (iPhone SE), 768px (iPad), 1280px (desktop)
- **PDF export** verified on generated files (font, layout, image preservation)

### 1.2 Test Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | `localhost:5173` (frontend) + `localhost:3001` (API) | Feature development |
| Preview | Vercel preview URL per PR | Pre-merge checks |
| Production | Hosted domain | Final smoke tests after deploy |

---

## 2. Test Cases — Authentication

| ID | Test Case | Steps | Expected | Status |
|----|-----------|-------|----------|--------|
| TC-AUTH-01 | Register new member | Fill form, submit | `201 Created`, pending status | ✅ Pass |
| TC-AUTH-02 | Login with valid credentials | Email + password → submit | JWT issued, dashboard redirect | ✅ Pass |
| TC-AUTH-03 | Login with wrong password | Submit wrong password | `401` + error toast | ✅ Pass |
| TC-AUTH-04 | Access protected route without token | GET `/api/members/me` — no header | `401 Unauthorized` | ✅ Pass |
| TC-AUTH-05 | Access admin route as photographer | `PATCH /api/members/:id/approve` as photographer | `403 Forbidden` | ✅ Pass |
| TC-AUTH-06 | Pending user cannot login | Login as pending user | `403 Account pending approval` | ✅ Pass |
| TC-AUTH-07 | Rejected user cannot login | Login as rejected user | `403 Account rejected` | ✅ Pass |
| TC-AUTH-08 | Admin approves pending member | Click approve in admin panel | Status → active, user can login | ✅ Pass |
| TC-AUTH-09 | Admin rejects with reason | Reject + type reason | Status → rejected, email sent | ✅ Pass |
| TC-AUTH-10 | Role promotion | Admin changes member to coordinator | Member gets coordinator tab access | ✅ Pass |

---

## 3. Test Cases — Public Website

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| TC-PUB-01 | Homepage loads under 3s on 4G | LCP ≤ 3000ms | ✅ Pass |
| TC-PUB-02 | Hero video mode — admin toggles | All browser sessions switch within 5s | ✅ Pass |
| TC-PUB-03 | Hero classic mode on non-admin device | Shows classic hero regardless of localStorage | ✅ Pass |
| TC-PUB-04 | Section visibility toggle | Toggled-off section disappears from public homepage | ✅ Pass |
| TC-PUB-05 | Events list renders | Upcoming events shown with correct status badge | ✅ Pass |
| TC-PUB-06 | Event gallery lightbox | Click photo → full screen lightbox opens | ✅ Pass |
| TC-PUB-07 | Core committee year filter | Year tabs filter members correctly | ✅ Pass |
| TC-PUB-08 | Competitions page status badges | Status matches actual date range | ✅ Pass |
| TC-PUB-09 | Magazine browse | Published magazines listed, thumbnail shown | ✅ Pass |
| TC-PUB-10 | Light/dark mode toggle | Theme switches, persists on refresh | ✅ Pass |
| TC-PUB-11 | Mobile menu | Nav collapses to hamburger, opens overlay | ✅ Pass |
| TC-PUB-12 | Copyright year | Footer shows © 2026 | ✅ Pass |

---

## 4. Test Cases — Admin Panel

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| TC-ADM-01 | Create event with cover photo | Event appears in list + public page | ✅ Pass |
| TC-ADM-02 | Edit event details | Changes reflected immediately | ✅ Pass |
| TC-ADM-03 | Upload gallery photos (multiple) | Photos appear in event gallery | ✅ Pass |
| TC-ADM-04 | Reorder gallery | Drag to reorder, saved order persists on refresh | ✅ Pass |
| TC-ADM-05 | Assign coordinator | Coordinator can upload after assignment | ✅ Pass |
| TC-ADM-06 | Create competition | Appears in competitions list | ✅ Pass |
| TC-ADM-07 | Record competition winners | Winners section renders on public page | ✅ Pass |
| TC-ADM-08 | Core tab: create core member | Appears on core committee public page | ✅ Pass |
| TC-ADM-09 | Core tab: FAB button | FAB shows inline form, not toggle | ✅ Pass |
| TC-ADM-10 | Core tab: FAB mobile expand direction | FAB expands label to right on mobile | ✅ Pass |
| TC-ADM-11 | Admin theme toggle (desktop) | Sidebar footer button toggles theme | ✅ Pass |
| TC-ADM-12 | Admin theme toggle (mobile) | Header icon toggles theme | ✅ Pass |
| TC-ADM-13 | Admin theme toggle (bottom sheet) | Bottom sheet item toggles theme | ✅ Pass |
| TC-ADM-14 | Announce: publish announcement | Members see it in their dashboard | ✅ Pass |
| TC-ADM-15 | Permissions panel: disable coord gallery upload | Coordinator upload button disappears | ✅ Pass |

---

## 5. Test Cases — Member Dashboard

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| TC-DASH-01 | View profile | Name, photo, bio, stats shown | ✅ Pass |
| TC-DASH-02 | Edit bio | Bio updates, persists on refresh | ✅ Pass |
| TC-DASH-03 | Upload profile photo | Photo updates in header + profile tab | ✅ Pass |
| TC-DASH-04 | View events participated | Event list with personal gallery thumbnails | ✅ Pass |
| TC-DASH-05 | Upload postcard | Appears in postcards section | ✅ Pass |
| TC-DASH-06 | Activity calendar | Days with events are highlighted | ✅ Pass |
| TC-DASH-07 | Read published magazine | Opens page-by-page reader | ✅ Pass |
| TC-DASH-08 | Member theme toggle (desktop) | Sidebar footer toggle works | ✅ Pass |
| TC-DASH-09 | Member theme toggle (mobile) | Header icon works | ✅ Pass |
| TC-DASH-10 | Coordinator gallery upload (when permitted) | Upload appears in event gallery | ✅ Pass |

---

## 6. Test Cases — Magazine Editor

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| TC-MAG-01 | Create magazine with template | Page renders with correct layout slots | ✅ Pass |
| TC-MAG-02 | Upload image to ImgSlot | Image fills slot within overflow:hidden boundary | ✅ Pass |
| TC-MAG-03 | Pan/zoom image in slot | Drag repositions image, pinch zooms | ✅ Pass |
| TC-MAG-04 | Rotation control | Image rotates within slot, does not escape | ✅ Pass |
| TC-MAG-05 | Double-click TxtSlot | Inline textarea activates for editing | ✅ Pass |
| TC-MAG-06 | Switch color palette | All slot colors update immediately (live) | ✅ Pass |
| TC-MAG-07 | Switch font pairing | Fonts update on all text elements | ✅ Pass |
| TC-MAG-08 | Add / remove page | Page list updates; PDF export includes all pages | ✅ Pass |
| TC-MAG-09 | Export PDF — 10 pages | PDF generated ≤ 30s, all pages in correct order | ✅ Pass |
| TC-MAG-10 | PDF images not overflowing | No image bleeds outside its slot in exported PDF | ✅ Pass |
| TC-MAG-11 | Publish magazine | Status → published, thumbnail generated, appears in public list | ✅ Pass |
| TC-MAG-12 | PDF font rendering | Custom fonts appear correctly in PDF (not substituted) | ✅ Pass |

---

## 7. Test Cases — Upload & Media

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| TC-UPL-01 | LiquidLoader wave animation | Wave is visibly wavy, not a straight line | ✅ Pass |
| TC-UPL-02 | Upload progress | Progress bar fills accurately during upload | ✅ Pass |
| TC-UPL-03 | Upload large file (>10MB) | Uploads successfully, progress shown | ✅ Pass |
| TC-UPL-04 | Upload non-image file | Error shown: "Images only" | ✅ Pass |
| TC-UPL-05 | CORS proxy for PDF | Magazine images load as data URLs, no CORS error | ✅ Pass |

---

## 8. Test Cases — Cross-Browser & Responsive

| ID | Test Case | Chrome | Firefox | Safari |
|----|-----------|--------|---------|--------|
| TC-XB-01 | Homepage renders | ✅ | ✅ | ✅ |
| TC-XB-02 | Glass cards visible | ✅ | ✅ | ✅ |
| TC-XB-03 | Video hero | ✅ | ✅ | ✅ |
| TC-XB-04 | Magazine editor | ✅ | ✅ | ✅ |
| TC-XB-05 | PDF export | ✅ | ✅ | ✅ |
| TC-XB-06 | backdrop-filter: blur | ✅ | ✅ | ✅ |

| ID | Test Case | 375px (Mobile) | 768px (Tablet) | 1280px (Desktop) |
|----|-----------|----------------|----------------|------------------|
| TC-RES-01 | Admin panel layout | Bottom nav ✅ | Sidebar ✅ | Sidebar ✅ |
| TC-RES-02 | FAB position | Bottom-right ✅ | Bottom-right ✅ | Bottom-right ✅ |
| TC-RES-03 | Core FAB expand | Expands right ✅ | Expands right ✅ | Expands right ✅ |
| TC-RES-04 | Magazine editor | Scrollable ✅ | Canvas + panel ✅ | Full layout ✅ |
| TC-RES-05 | Homepage hero | Mobile anim ✅ | Desktop ✅ | Desktop ✅ |

---

## 9. Known Issues & Limitations

| ID | Issue | Severity | Workaround |
|----|-------|----------|-----------|
| KI-01 | PDF export may timeout for magazines with >15 pages on slow connections | Medium | Export in smaller batches; progress indicator shown |
| KI-02 | `backdrop-filter` not supported in Firefox < 103 | Low | Falls back gracefully to semi-opaque background |
| KI-03 | Real-time hero mode switch requires user to be on homepage | Low | User sees updated mode on next page load/navigation |
| KI-04 | Magazine template thumbnails may flicker during palette switch | Low | Resolved by debouncing palette change events |

---

## 10. Performance Benchmarks

Measured on hosted production build (Vercel + MongoDB Atlas ap-south-1):

| Metric | Target | Measured |
|--------|--------|---------|
| LCP (First load) | ≤ 3000ms | ~1800ms |
| Main bundle (gzip) | ≤ 500KB | ~340KB |
| Admin bundle (gzip) | ≤ 1000KB | ~843KB |
| API list endpoint (P95) | ≤ 800ms | ~220ms |
| PDF export (10 pages) | ≤ 30s | ~12s |
| Hero mode propagation | ≤ 5s | ~5s (polling interval) |
