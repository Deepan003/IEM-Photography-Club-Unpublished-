# User Guide
## IEM Photography Club Web Platform

**Version:** 1.3  
**Last Updated:** June 2026

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Registration & Login](#2-registration--login)
3. [Member Dashboard](#3-member-dashboard)
4. [Club Gallery](#4-club-gallery)
5. [Events](#5-events)
6. [Competitions](#6-competitions)
7. [Activities](#7-activities)
8. [Postcards](#8-postcards)
9. [Magazine](#9-magazine)
10. [Admin Panel](#10-admin-panel)
11. [Role Reference](#11-role-reference)
12. [Security & Privacy](#12-security--privacy)

---

## 1. Getting Started

The IEM Photography Club platform is a members-only web platform. The public can browse the homepage (gallery, events, competitions, core committee), but most features require a verified, admin-approved account.

**Public pages (no login required):**
- Homepage with event cinema gallery
- Club gallery
- Events listing and detail pages
- Competitions listing
- Activities listing
- Core committee
- Magazines
- Postcards

**Login-required pages:**
- Member dashboard
- Personal gallery upload
- Event and competition participation
- Admin/core panel

---

## 2. Registration & Login

### 2.1 Registering a New Account

1. Click **Join / Sign In** in the top-right navbar.
2. Switch to the **Register** tab.
3. Fill in all required fields:
   - Full name, department, enrollment number, roll number
   - Start year and end year of your programme
   - Email address and password (minimum 8 characters)
   - Optional: camera/lens equipment
4. Submit — an **OTP is sent to your email** immediately.
5. Enter the 6-digit OTP within 15 minutes.
6. Once verified, your application enters **admin review**. You will receive an approval or rejection email.

> Your email is locked to your account during review. If rejected, the account is deleted so you may re-apply with the same email after addressing the reason.

### 2.2 Logging In

1. Click **Join / Sign In**.
2. Enter your registered email and password.
3. On success you are taken directly to your **Member Dashboard**.

**Status messages at login:**

| Message | What it means |
|---------|---------------|
| Please verify your email first | You registered but haven't entered your OTP yet |
| Awaiting admin approval | OTP done, waiting for admin to approve |
| Account banned | Contact a core member |
| Programme ended | Your end year has passed; account is read-only passout |

### 2.3 Forgot Password

1. Click **Forgot password?** on the login screen.
2. Enter your registered email — an OTP is sent.
3. Enter the OTP, then set a new password.
4. All existing login sessions are **immediately invalidated** for security.

### 2.4 Logging Out

Click your profile or the **Sign Out** button in the dashboard sidebar. Your session is invalidated server-side — no one can reuse your token after you log out.

---

## 3. Member Dashboard

After login, you land on your personal dashboard. The layout is:
- **Desktop:** Left sidebar with tab navigation
- **Mobile:** Slide-up bottom sheet with full tab list

### 3.1 Tabs Available

| Tab | Who can see it | What it does |
|-----|---------------|--------------|
| Profile | All members | View your profile, stats, activity calendar |
| My Gallery | Photographers, core members | Upload and manage your personal photo gallery |
| Magazine | All members | Read published club magazines |
| Postcards | All members | Upload and browse postcards |
| Events | All members | View events you joined |
| Competitions | All members | View competitions you entered |
| Admin Panel | Admin / Core | Full platform management |

### 3.2 Profile Tab

- View your name, role, department, and academic year
- Edit your **bio** (up to 500 characters)
- Upload or change your **profile photo**
- Set your **Instagram handle**
- View your **activity calendar** — colour-coded heatmap of your participation
- Download your profile as a **PDF or CSV**

### 3.3 Editing Your Profile

1. Go to **Profile → Settings** (gear icon).
2. Click on your profile photo to upload a new one.
3. Edit bio and Instagram handle.
4. Changes save automatically on blur.

### 3.4 Theme Toggle

The sun/moon button in the top bar switches between **dark mode** (default) and **light mode**. Your preference is saved in your browser.

---

## 4. Club Gallery

The club gallery lives at `/gallery` and shows all photos uploaded by admin, core, and coordinators.

### 4.1 Browsing Photos

- Photos load **48 at a time** in a masonry grid.
- Scroll down and click **Load more photos** to see the next batch.
- Filter by **section** using the Filter button (if sections exist).
  - **All** — everything, paginated
  - **General** — photos not assigned to any section
  - Named sections (e.g. "Durga Puja 2025", "Street") — loads all photos in that section at once

### 4.2 Lightbox

Click any photo to open the full-screen lightbox:
- Swipe left/right or use arrow keys to navigate
- Touch/drag supported on mobile
- Shows photographer attribution, caption, section
- Admin/core/coordinator: **Edit** (pencil) and **Delete** (trash) buttons appear

### 4.3 Uploading Photos (Admin / Core / Coordinator)

1. Click **+ Upload** in the top-right.
2. Select up to **20 photos at once** — a 3-column thumbnail preview appears.
3. Drag thumbnails to reorder before uploading.
4. Add an optional caption, attribution (search members or type a name), and section.
5. Click **Upload X Photos** — a progress counter shows each file uploading.

### 4.4 Reordering the Gallery (Admin / Core)

1. Click **Edit Grid** — all loaded photos appear in a drag-and-drop grid.
2. Drag photos to rearrange.
3. Click **Save Order** — the new order is persisted for all visitors.

> If you haven't loaded all pages yet, Edit Grid automatically loads all photos before opening.

---

## 5. Events

### 5.1 Browsing Events

The events listing at `/events` shows all events with status badges:
- **Upcoming** — registration may be open
- **Ongoing** — currently running
- **Past** — completed

Use the search bar or status filter to find specific events.

### 5.2 Event Detail Page

Click any event card to see:
- Full description, venue, date, and schedule
- Coordinator and volunteer team list
- Event gallery (swipe/arrow navigation, lightbox)
- Announcements from coordinators/core

### 5.3 Joining an Event

If registration is open, a **Join** button appears on the event detail page. Once joined you appear in the volunteer list.

### 5.4 Uploading to an Event Gallery (Coordinators)

1. Go to the event detail page → **Gallery tab**.
2. Click **Upload Photos** — select multiple files at once.
3. Photos appear immediately after upload.
4. Drag photos in the grid to reorder them.

---

## 6. Competitions

### 6.1 Browsing Competitions

The `/competitions` page lists all competitions with status badges:
- **Upcoming** — opens soon
- **Active** — currently accepting submissions
- **Past** — closed

> Status updates automatically every hour without requiring a page refresh.

### 6.2 Submitting an Entry

1. Open an **Active** competition.
2. Click **Submit Entry**.
3. Upload your photo, add a title and description.
4. One submission per competition per member.

### 6.3 Winners

Winning entries are displayed in the **Winners** tab of each competition. Admins can also push winners to the main homepage.

### 6.4 Competition Gallery

Coordinators and core members can upload photos to the competition's gallery — separate from submission entries.

---

## 7. Activities

The `/activities` page lists club activities (workshops, outings, etc.). Each activity shows:
- Description, venue, date
- Volunteer/participant list
- Activity gallery

Participation is recorded and contributes to your activity calendar on your profile.

---

## 8. Postcards

Postcards are displayed as a horizontal swipe carousel on the homepage and in the Postcards tab of your dashboard.

- Swipe left/right on mobile
- Arrow navigation on desktop
- Core members and above can upload new postcards from their dashboard

---

## 9. Magazine

### 9.1 Reading Magazines

Browse published magazines at `/magazines`. Click any cover to read it in full-screen mode. Magazines are pageable — swipe or click arrows to turn pages.

### 9.2 Creating a Magazine (Core / Admin)

1. In your dashboard, go to the **Magazine** tab.
2. Click **+ New Magazine**.
3. Choose from **28 layout templates** (covers, spreads, editorial, portrait, grid, collage).
4. Double-click any text area to edit it inline.
5. Click any image slot to upload a photo — pan and zoom to crop.
6. Pick a **colour palette** (8 choices) and **font pairing** (6 choices) from the theme panel.
7. Click **Save Draft** to save without publishing.
8. Click **Publish** — a thumbnail is auto-generated and the magazine appears publicly.
9. Click **Export PDF** to download a print-quality PDF.

---

## 10. Admin Panel

Accessible to **Admin** and **Core** members via the dashboard sidebar.

### 10.1 User Management

**Pending approvals:**
- See all members waiting for approval
- Click **Approve** to activate their account — they receive an email
- Click **Reject** to permanently delete the pending account — they receive a rejection email and may re-apply with the same address

**All users:**
- Search by name, filter by role or status
- **Promote** a photographer to Coordinator or Core
- **Demote** a role one level down
- **Ban** — immediately locks the account and invalidates all their active sessions
- **Unban** — restores access
- **Delete** — permanently removes the account and all their uploaded photos from S3

### 10.2 Gallery Management

- Upload to the club gallery (same multi-file flow as described in §4.3)
- Create and delete **sections** to organise photos
- Assign coordinators — photographers granted coordinator access can upload to the gallery
- Toggle whether coordinators can upload (`Settings → Coordinator Permissions`)

### 10.3 Event Management

- **Create** events with title, description, venue, date, banner image
- **Edit** all event fields after creation
- **Add members** as volunteers or coordinators
- Set **coordinator permissions** per event (can they upload gallery, reorder, make announcements?)
- Toggle **Show in gallery** to control whether the event appears in the homepage cinema gallery
- **Delete** event (removes banner and all gallery photos from S3)

### 10.4 Competition Management

- **Create** competitions with banner, dates, submission deadline
- Manage **volunteers** and their roles
- Upload the **competition gallery** (separate from member submissions)
- Add **winners** with profile photo and winning entry photo
- Post **announcements** to all volunteers or coordinators only
- Set coordinator permissions (manage gallery, winners, announcements)
- Toggle **Show winners on main page**
- **Delete** competition (removes all S3 assets)

### 10.5 Activity Management

- Create and edit activities
- Add participants/volunteers
- Upload activity gallery

### 10.6 Core Committee

- Add core members manually (for members without accounts, e.g. alumni)
- Link entries to registered user accounts
- Manage by academic year (e.g. "2025-26")
- When a member is promoted to Core in User Management, a Core Committee entry is auto-created

### 10.7 Settings

| Setting | What it does |
|---------|--------------|
| Section visibility | Show/hide homepage sections (Gallery, Events, etc.) |
| Coordinator can upload gallery | Toggle globally for all coordinators |
| Hero mode | Classic (image) or Video hero |
| Hero Theme Studio | Create seasonal video hero presets with visual controls |

### 10.8 Announcements

Post club-wide announcements visible to all approved members from their dashboard Announcements tab.

---

## 11. Role Reference

| Role | Can do |
|------|--------|
| **Admin** | Everything — all admin tabs, delete accounts, promote to core, manage settings |
| **Core** | Admin panel, event/competition/activity management, gallery upload, promote to coordinator |
| **Coordinator** | Upload to club gallery (if permitted), upload to assigned events, post announcements |
| **Photographer** | Member dashboard, personal gallery, submit competition entries, view content |
| **Passout** | Read-only access — dashboard visible but no uploads or submissions |
| **Banned** | No access — login blocked, existing sessions immediately revoked |

> Roles expire automatically. When a member's programme end year passes, their elevated role (coordinator/core) reverts to photographer on their next login.

---

## 12. Security & Privacy

### 12.1 Session Security

- All sessions use **JWT tokens** valid for 7 days.
- Logging out **immediately invalidates** your token server-side — no one can reuse it.
- If your account is banned, **all your active sessions are revoked immediately** — even on devices you're currently using.
- Resetting your password **invalidates all existing sessions** across all devices.

### 12.2 Upload Safety

- All uploaded files are validated using **magic byte inspection** — a file renamed from `.exe` to `.jpg` is rejected before it touches S3.
- File size limits: 25 MB per image, 100 MB per video.
- Only authenticated members can upload files.

### 12.3 Photo Deletion

When a photo is deleted (from gallery, profile, or competition), **both the desktop and mobile versions** are removed from S3 immediately — no orphan files accumulate.

When a user account is deleted, all their S3 assets (profile photo, cover photo, personal gallery) are deleted at the same time.

### 12.4 Rate Limiting

| Endpoint group | Limit |
|----------------|-------|
| OTP requests | 5 per 15 minutes |
| Login / password reset | 10 per 15 minutes |
| Admin API | 60 per minute |
| File uploads | 20 per minute |

### 12.5 Your Data

- Passwords are hashed with bcrypt (12 rounds) — not stored in plain text.
- OTPs are hashed and expire after 15 minutes.
- Your email is used only for account notifications (approval, rejection, competition announcements).

---

## Quick Reference — Common Tasks

| Task | Where |
|------|-------|
| Upload a profile photo | Dashboard → Profile → click your avatar |
| Add photos to club gallery | Gallery page → Upload button |
| See your competition entries | Dashboard → Competitions tab |
| Download your profile as PDF | Dashboard → Profile → Export button |
| Change your password | Login screen → Forgot password |
| Switch light/dark mode | Any page → sun/moon icon top-right |
| Read a magazine | `/magazines` → click any cover |
| Approve a pending member | Admin Panel → Pending tab |
| Ban a user | Admin Panel → All Users → find user → Ban |
| Create an event | Admin Panel → Events → New Event |

---

*IEM Photography Club · Kolkata, India · © 2026*
