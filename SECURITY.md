# Security Documentation — IEM Photography Club

**Last updated:** June 2026
**Audit basis:** Full codebase review against OWASP Top 10, "7 Vulnerabilities of Vibe-Coded Apps", and manual route-by-route inspection.

This document covers every security decision made across the entire application — backend routes, data models, file handling, frontend rendering, HTTP headers, secret management, and access control. It is written to be understandable by both developers and non-technical readers, with plain-English explanations followed by technical details.

---

## Table of Contents

1. [Authentication — Passwords, Hashing, and Login](#1-authentication--passwords-hashing-and-login)
2. [Session Tokens — JWT with Token Versioning](#2-session-tokens--jwt-with-token-versioning)
3. [One-Time Passwords — Email Verification and Password Reset](#3-one-time-passwords--email-verification-and-password-reset)
4. [Account Status Lifecycle](#4-account-status-lifecycle)
5. [Role-Based Access Control](#5-role-based-access-control)
6. [Granular Coordinator Permission Flags](#6-granular-coordinator-permission-flags)
7. [Resource Ownership Checks (IDOR Prevention)](#7-resource-ownership-checks-idor-prevention)
8. [Rate Limiting — Brute Force and Abuse Prevention](#8-rate-limiting--brute-force-and-abuse-prevention)
9. [File Upload Security](#9-file-upload-security)
10. [S3 Data Integrity — Cleanup on Every Delete](#10-s3-data-integrity--cleanup-on-every-delete)
11. [Injection Attack Prevention](#11-injection-attack-prevention)
12. [Cross-Site Scripting (XSS) Prevention](#12-cross-site-scripting-xss-prevention)
13. [Server-Side Request Forgery (SSRF) Prevention](#13-server-side-request-forgery-ssrf-prevention)
14. [HTTP Security Headers and Content Security Policy](#14-http-security-headers-and-content-security-policy)
15. [CORS Configuration](#15-cors-configuration)
16. [Sensitive Data Protection](#16-sensitive-data-protection)
17. [Mass Assignment Protection](#17-mass-assignment-protection)
18. [Denial of Service Protection](#18-denial-of-service-protection)
19. [Secret and Credential Management](#19-secret-and-credential-management)
20. [Email Security](#20-email-security)
21. [Replay Attack Prevention](#21-replay-attack-prevention)
22. [Error Handling and Information Leakage Prevention](#22-error-handling-and-information-leakage-prevention)
23. [Known Considerations and Future Work](#23-known-considerations-and-future-work)
24. [Full Vulnerability Audit Log](#24-full-vulnerability-audit-log)

---

## 1. Authentication — Passwords, Hashing, and Login

**Files involved:** `server/models/User.js`, `server/routes/auth.js`

---

### 1.1 Passwords Are Never Stored in Plaintext

Every password is hashed using **bcrypt with 12 rounds** before being saved to the database. The hashing happens inside a Mongoose pre-save hook, meaning it runs automatically whenever the `password` field is modified — on registration, password reset, and admin-forced changes. It cannot be accidentally bypassed.

```js
// server/models/User.js
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12)
  }
  next()
})
```

**What 12 rounds means:** bcrypt runs 2¹² = 4,096 iterations of its internal key expansion per hash. This takes roughly 250–400ms on modern hardware. That delay is imperceptible to a user logging in once, but makes offline brute-force attacks against a stolen database computationally infeasible — an attacker trying millions of guesses per second would need decades to crack a strong password.

**The `password` field is also `select: false`** on the schema, which means every database query by default excludes it from results. A developer cannot accidentally return passwords in an API response.

---

### 1.2 Password Length Policy — Minimum and Maximum

**File:** `server/routes/auth.js`

Passwords must be **at least 8 characters** and **at most 128 characters**. This policy is enforced server-side on all three endpoints that interact with bcrypt — register, login, and password reset.

```js
// Register & Reset Password
if (password.length < 8)   return res.status(400).json({ error: 'Password must be at least 8 characters.' })
if (password.length > 128) return res.status(400).json({ error: 'Password must be 128 characters or fewer.' })

// Login — returns a generic error to avoid revealing the cap exists
if (password.length > 128) return res.status(401).json({ error: 'Invalid email or password.' })
```

**Why a 128-character maximum?** bcrypt silently truncates inputs longer than 72 bytes — so hashing a 10,000-character string produces the same result as hashing 72 characters, but the full string still has to be passed to the bcrypt C library. On a long enough input, this blocks Node.js's single-threaded event loop for several seconds, making the server unresponsive to all other users. This is called a **Long Password Denial of Service** attack. The 128-character cap eliminates it while comfortably exceeding any legitimate password length.

**Why does login return 401 instead of 400 for an oversized password?** Because a user who registered through normal flows can never have a password longer than 128 characters (register already prevented it). Returning the same generic "Invalid email or password" as a wrong password avoids revealing implementation details that could help an attacker probe the system.

---

### 1.3 User Enumeration Prevention on Login and Forgot Password

Both the login route and the forgot-password route are designed to not reveal whether an email address has an account:

```js
// Login — same message whether email doesn't exist or password is wrong
if (!user) return res.status(401).json({ error: 'Invalid email or password.' })
const ok = await user.comparePassword(password)
if (!ok)  return res.status(401).json({ error: 'Invalid email or password.' })

// Forgot password — same message whether email exists or not
if (!user) return res.json({ message: 'If that email exists, an OTP has been sent.' })
```

This prevents **user enumeration attacks**, where an attacker systematically tests email addresses to build a list of registered accounts.

---

## 2. Session Tokens — JWT with Token Versioning

**File:** `server/middleware/auth.js`

---

### 2.1 JSON Web Tokens

Authenticated sessions use signed **JWTs (JSON Web Tokens)**. The token is issued on login and must be included in the `Authorization: Bearer <token>` header on every subsequent API request. Tokens are signed using the `JWT_SECRET` environment variable with a configurable expiry (default: 7 days).

Because tokens are passed in a header — not a cookie — the browser never automatically attaches them to cross-origin requests. This makes **CSRF (Cross-Site Request Forgery)** attacks structurally impossible: CSRF exploits automatic cookie attachment, which does not apply here.

---

### 2.2 Token Version — Immediate Invalidation on Logout, Ban, or Password Reset

A standard JWT cannot be revoked before its expiry date — once issued, it's valid until it expires. This means a stolen token remains usable even if the user logs out. The application solves this with a **tokenVersion** field on every user account.

Every JWT payload carries the `tokenVersion` at the time it was issued. On every authenticated request, the middleware reads the current `tokenVersion` from the database and compares it to the value in the token:

```js
// server/middleware/auth.js
if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
  return res.status(401).json({ error: 'Token has been invalidated. Please sign in again.' })
}
```

Whenever a security-sensitive event occurs, `tokenVersion` is incremented. All previously issued tokens instantly become invalid:

| Event | Route | Effect |
|---|---|---|
| User logs out | `POST /api/auth/logout` | `$inc: { tokenVersion: 1 }` |
| Admin bans a user | `POST /api/admin/ban/:id` | `tokenVersion += 1` — user is cut off immediately |
| User resets password | `POST /api/auth/reset-password` | `tokenVersion += 1` — all existing sessions invalidated |

This eliminates **login replay attacks** — even a captured token becomes worthless the moment the session is ended.

---

### 2.3 `requireAuth` — Enforced on Every Protected Route

The `requireAuth` middleware runs on every route that requires authentication. It:

1. Checks for the `Authorization: Bearer <token>` header
2. Cryptographically verifies the JWT signature using `JWT_SECRET`
3. Fetches the user from the database (excluding sensitive fields)
4. Rejects accounts that are not `approved` status
5. Compares `tokenVersion` and rejects mismatches

```js
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' })
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    const user    = await User.findById(payload.id).select('-password -otpHash -otpExpiry -otpPurpose')
    if (!user)                         return res.status(401).json({ error: 'User not found' })
    if (user.status !== 'approved')    return res.status(403).json({ error: 'Account not yet approved' })
    if (payload.tokenVersion !== user.tokenVersion) return res.status(401).json({ error: 'Token has been invalidated.' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

---

## 3. One-Time Passwords — Email Verification and Password Reset

**File:** `server/models/User.js`

---

### 3.1 OTP Generation and Hashing

OTPs for email verification and password reset are 6-digit codes generated with `Math.floor(100000 + Math.random() * 900000)`. The **plaintext OTP is only sent via email and never stored in the database**. Only the bcrypt hash (8 rounds) is persisted.

```js
userSchema.methods.setOTP = async function (purpose) {
  const otp        = String(Math.floor(100000 + Math.random() * 900000))
  this.otpHash    = await bcrypt.hash(otp, 8)
  this.otpExpiry  = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  this.otpPurpose = purpose
  return otp // returned to be sent via email, not stored
}
```

If the database is ever compromised, an attacker cannot extract usable OTPs from the stored hashes.

---

### 3.2 OTP Verification — Three Layers of Checks

Every OTP verification performs three checks before accepting it:

```js
userSchema.methods.verifyOTP = async function (candidate, purpose) {
  if (!this.otpHash || !this.otpExpiry) return false   // must exist
  if (this.otpPurpose !== purpose)       return false   // purpose lock
  if (new Date() > this.otpExpiry)       return false   // must not be expired
  return bcrypt.compare(candidate, this.otpHash)        // hash comparison
}
```

1. **Existence check** — no OTP has been set on this account
2. **Purpose lock** — an OTP generated for `email_verify` cannot be used for `password_reset`, and vice versa. This prevents an attacker from triggering one OTP flow and replaying it against another.
3. **Expiry check** — OTPs are valid for only 15 minutes
4. **Hash comparison** — the submitted OTP is compared to the stored hash using bcrypt's constant-time comparison (immune to timing attacks)

All three OTP fields (`otpHash`, `otpExpiry`, `otpPurpose`) are `select: false` on the schema.

---

## 4. Account Status Lifecycle

**Files:** `server/middleware/auth.js`, `server/routes/auth.js`, `server/routes/admin.js`

Every user account moves through a strictly controlled status machine. Access to the application is gated at every step.

```
[Registration]
      │
      ▼
 pending_email  ──(OTP verified)──▶  pending_admin  ──(admin approves)──▶  approved
                                                     ──(admin rejects)──▶  rejected (deleted)
      │
      ▼ (programme end date passes)
   passout  ←──────────────────────────────────────────── approved
      │
      │ (admin action)
      ▼
   banned
```

- **`pending_email`** — registered but OTP not verified. Cannot log in.
- **`pending_admin`** — OTP verified. Waiting for admin/core approval. Cannot log in.
- **`approved`** — active member. Full access based on role.
- **`rejected`** — application rejected. Account deleted from database.
- **`passout`** — programme end date has passed. Cannot log in. Checked automatically on login and nightly.
- **`banned`** — banned by admin/core. Cannot log in. `tokenVersion` is immediately incremented to cut off any active session.

The `requireAuth` middleware enforces `status === 'approved'` on every protected endpoint. A pending, passout, or banned JWT — even if unexpired and cryptographically valid — is rejected at the middleware level.

---

### 4.1 Automatic Passout Detection

**File:** `server/utils/passout.js`, `server/index.js`

Two automatic processes flag expired accounts:

**On login:** Every time a user logs in, the application checks if their programme end date has passed. If it has, their account is immediately marked `passout` and login is refused. If they held a `core` role, it reverts to `photographer` — only the `admin` role is permanent.

**Daily job:** A background timer runs at 00:05 AM every night, calling `checkAndFlagPassouts()` to catch accounts belonging to users who have not logged in since their end date. This ensures that passout accounts are deactivated even if their owners never attempt to log in again.

---

## 5. Role-Based Access Control

**File:** `server/middleware/auth.js`, all route files

---

### 5.1 Role Hierarchy

The application has four roles in ascending order of privilege:

| Role | What they can do |
|---|---|
| `photographer` | View content, post to the member feed, manage their own profile, gallery, and competition entries |
| `coordinator` | All above + upload to club gallery, manage events/competitions/activities (if permitted), send announcements (if permitted by admin) |
| `core` | All above + approve/reject/ban members, manage all events and competitions, access admin panel |
| `admin` | All above + permanently delete accounts, manage all system settings. Cannot be banned, demoted, or deleted. |

---

### 5.2 `requireRole` — Composable Role Guard

`requireRole` is a middleware factory that takes one or more allowed roles and returns a middleware function. It is always chained after `requireAuth`:

```js
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' })
    next()
  }
}
```

This is used throughout the application:

```js
const guard       = [requireAuth, requireRole('admin', 'core')]
const adminOnly   = [requireAuth, requireRole('admin')]
const adminOrCore = [requireAuth, requireRole('admin', 'core')]
```

---

### 5.3 Admin Account Hard Protection

Multiple routes explicitly refuse to operate on the admin account:

```js
// admin.js
if (user.role === 'admin') return res.status(400).json({ error: 'Cannot ban the admin account.' })
if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete the admin account.' })
if (user.role === 'admin') return res.status(400).json({ error: 'Cannot change admin role.' })
```

Even a core member with access to the admin panel cannot lock out or remove the admin account.

---

### 5.4 Promotion Restrictions

Only `admin` can promote a user to `core`. A `core` member can only promote to `coordinator`:

```js
// admin.js
const allowed = req.user.role === 'admin'
  ? ['coordinator', 'core']
  : ['coordinator']  // core can only grant coordinator
if (!allowed.includes(role)) return res.status(403).json({ error: 'You cannot assign that role.' })
```

---

### 5.5 Context-Level Authorization — Event and Competition Coordinators

Beyond global roles, certain operations check whether the user is a coordinator **of that specific event or competition**. This is implemented as middleware:

```js
// events.js — adminOrEventCoord
async function adminOrEventCoord(req, res, next) {
  if (['admin', 'core'].includes(req.user.role)) return next()
  const event = await Event.findById(req.params.id).select('members')
  const m = event.members.find(m => m.user?.toString() === req.user._id.toString())
  if (m?.eventRole === 'coordinator') return next()
  return res.status(403).json({ error: 'Not authorized.' })
}

// competitions.js — adminOrCompVolunteer
async function adminOrCompVolunteer(req, res, next) {
  if (['admin', 'core'].includes(req.user.role)) return next()
  const comp = await Competition.findById(req.params.id).select('volunteers allowVolunteersEdit')
  if (!comp.allowVolunteersEdit) return res.status(403).json({ error: 'Not authorized.' })
  const vol = comp.volunteers.find(v => v.user?.toString() === req.user._id.toString())
  if (vol) return next()
  return res.status(403).json({ error: 'Not authorized.' })
}
```

A coordinator for Event A cannot modify Event B. Being a volunteer in Competition X does not grant any access to Competition Y.

---

## 6. Granular Coordinator Permission Flags

**Files:** `server/routes/competitions.js`, `server/routes/events.js`, `server/routes/gallery.js`, `server/routes/globalAnnouncements.js`, `server/models/AppSettings.js`

Even when a user is a coordinator for a specific event or competition, their capabilities are controlled by **per-resource permission flags** set by admin/core. This prevents over-granting access.

### Competition Permission Flags (`competitions.js`)

| Flag | Controls |
|---|---|
| `coordCanEditDetails` | Whether coordinators can edit competition name, description, dates, venue |
| `coordCanManageGallery` | Whether coordinators can add/delete/reorder competition gallery photos |
| `coordCanManageWinners` | Whether coordinators can add/edit/delete competition winners |
| `coordCanManageVolunteers` | Whether coordinators can manage the volunteer list |
| `coordCanAnnounce` | Whether coordinators can send announcements to competition participants |
| `allowVolunteersEdit` | Master toggle — if false, volunteers cannot make any edits regardless of other flags |

These flags are checked inside every relevant route:
```js
// Even if the user is an authorized volunteer, this additional check applies
if (!['admin','core'].includes(req.user.role) && !comp.coordCanManageWinners) {
  return res.status(403).json({ error: 'Winner management is not enabled for this competition.' })
}
```

### Event and Activity Permission Flags

| Flag | Controls |
|---|---|
| `coordCanUpload` | Whether event coordinators can upload photos to the event gallery |
| `coordCanReorder` | Whether event coordinators can reorder gallery photos |
| `coordCanAnnounce` | Whether event coordinators can send announcements to event members |

### Global Coordinator Permissions (`AppSettings`)

System-wide coordinator capabilities are managed through the settings system:

| Setting Key | Controls |
|---|---|
| `coordinator.canUploadGallery` | Whether coordinators can upload to the main club gallery |
| `coordinator.canCreatePostcardSection` | Whether coordinators can create postcard sections |
| `coordinator.canSendAnnouncements` | Whether coordinators can use the announcement system at all |

These settings are read at request time — changing them takes effect immediately without requiring a server restart.

---

## 7. Resource Ownership Checks (IDOR Prevention)

**IDOR (Insecure Direct Object Reference)** is when a user can access or modify another user's resource simply by knowing its ID. The application prevents this by verifying ownership on every resource that belongs to a user, before any modification or deletion.

### Posts and Comments

**File:** `server/routes/posts.js`

```js
// Deleting a post
const isOwner = post.author.toString() === req.user._id.toString()
const isAdmin = ['admin','core'].includes(req.user.role)
if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed.' })

// Deleting a comment
const isOwner = comment.user.toString() === req.user._id.toString()
const isAdmin = ['admin','core'].includes(req.user.role)
if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed.' })
```

### Gallery Photos

**File:** `server/routes/gallery.js`

```js
const isOwner = photo.addedBy?.toString() === req.user?._id?.toString()
const isPriv  = ['admin','core'].includes(req.user.role)
if (!isOwner && !isPriv) return res.status(403).json({ error: 'Not allowed.' })
```

### Personal Gallery

**File:** `server/routes/members.js`

Members can only delete photos from **their own** personal gallery. The route fetches the user by `req.user._id` (set by `requireAuth`), not by any client-supplied ID:

```js
router.delete('/me/gallery/:photoId', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id).select('gallery') // always the logged-in user
  const photo = user.gallery.id(req.params.photoId)
  if (!photo) return res.status(404).json({ error: 'Photo not found' })
  // ...delete
})
```

### Announcement Drafts

Draft ownership is enforced at the database query level — the `sentBy` condition is baked into the MongoDB filter, so the route cannot accidentally operate on another user's draft even if the ID is known:

```js
await GlobalAnnouncement.findOneAndUpdate(
  { _id: req.params.id, sentBy: req.user._id, status: 'draft' },  // ownership in query
  { $set: update },
  { new: true }
)
```

---

## 8. Rate Limiting — Brute Force and Abuse Prevention

**Package:** `express-rate-limit`
**Files:** `server/routes/auth.js`, `server/routes/admin.js`, `server/routes/upload.js`, `server/routes/globalAnnouncements.js`

Rate limiting is applied per IP address. The server uses `app.set('trust proxy', 1)` so that Render's reverse proxy correctly forwards the real client IP in the `X-Forwarded-For` header. Without this, all requests would appear to come from the proxy's IP and rate limiting would be ineffective.

| Endpoint Group | Limit | Window | Attack Prevented |
|---|---|---|---|
| OTP send / verify / resend | 5 requests | 15 minutes | OTP brute force, OTP spam |
| Login | 10 requests | 15 minutes | Password brute force |
| Password reset | 10 requests | 15 minutes | Reset link abuse |
| Admin API | 60 requests | 1 minute | Member enumeration, data scraping |
| File uploads | 20 requests | 1 minute | Storage abuse, upload loops |
| Announcement sends | 10 requests | 10 minutes | Email spam through the system |

When a limit is exceeded, the server returns `429 Too Many Requests`. Rate limiters run before the route handler, so the server does minimal work per rejected request.

---

## 9. File Upload Security

**File:** `server/routes/upload.js`
**Packages:** `multer`, `sharp`, `file-type`

File upload is one of the highest-risk attack surfaces in any web application. The following defences are applied in sequence — each layer catches what the previous might miss.

---

### 9.1 Authentication Required

All upload endpoints require `requireAuth`. Unauthenticated uploads are rejected before any file processing begins.

---

### 9.2 File Size Limits — Enforced at Streaming Level

```js
const upload      = multer({ limits: { fileSize: 25 * 1024 * 1024  } })  // 25 MB — images
const uploadVideo = multer({ limits: { fileSize: 100 * 1024 * 1024 } })  // 100 MB — video
const uploadAttachment = multer({ limits: { fileSize: 50 * 1024 * 1024 } }) // 50 MB — attachments
```

Multer enforces these limits during HTTP streaming — the file is rejected before it is fully buffered into memory. This prevents memory exhaustion from large file attacks.

---

### 9.3 MIME Type Check — First Pass (Client-Supplied)

```js
fileFilter: (_, file, cb) => {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'), false)
  cb(null, true)
}
```

This rejects obvious non-images early, before the file body is read. However, the `Content-Type` header is sent by the browser and is trivially spoofable, so this is a convenience check only — not a security boundary.

---

### 9.4 Magic Byte Validation — Second Pass (Actual File Content)

**Package:** `file-type`

After the file is fully received, its binary content is inspected:

```js
const fileType = await fileTypeFromBuffer(req.file.buffer)
if (!fileType || !fileType.mime.startsWith('image/')) {
  return res.status(400).json({ error: 'File is not a valid image.' })
}
```

`file-type` reads the first bytes of the file — called "magic bytes" or a file signature — to determine what the file actually is, regardless of its extension or `Content-Type` header. A renamed executable (`malware.exe` → `photo.jpg`) will be caught here because its file signature (`MZ`) does not match any image format.

---

### 9.5 Sharp Re-encoding — Destroys All Hidden Payloads

**Package:** `sharp`

Every accepted image is completely re-encoded through Sharp before storage:

```js
sharp(req.file.buffer)
  .rotate()                               // honour EXIF orientation
  .resize({ width: 1920, withoutEnlargement: true })
  .flatten({ background: '#ffffff' })     // PNG alpha → white (no transparency tricks)
  .jpeg({ quality: 85, progressive: true })
  .toBuffer()
```

This is the most thorough protection step. Re-encoding through Sharp:
- Destroys any malicious payload hidden in EXIF metadata
- Strips ICC profiles that could contain embedded code
- Defeats polyglot files — files that are simultaneously a valid JPEG and a valid HTML/JavaScript file
- Produces a clean, freshly-generated JPEG with no relationship to the original file's internal structure

Two variants are produced: desktop (1920px wide) and mobile (900px wide), both stored separately on S3.

---

### 9.6 S3 Folder Allowlist

The upload destination folder within S3 is validated against a strict allowlist. Any unrecognised folder name silently falls back to the safe `uploads` default:

```js
const ALLOWED_FOLDERS = [
  'postcards','gallery','events','profiles','competitions','core','posts',
  'magazines','core-gallery','core-covers','event-gallery','activities',
]
const folder = ALLOWED_FOLDERS.includes(req.body?.folder) ? req.body.folder : 'uploads'
```

This prevents path traversal attempts where an attacker might try to write to an arbitrary S3 prefix.

---

### 9.7 UUID-Based S3 Keys — No User-Controlled Filenames

```js
const uuid = randomUUID()
const key  = `${folder}/${uuid}.jpg`
```

The original filename from the client is completely discarded. The S3 object key is a cryptographically random UUID. This eliminates filename injection, path traversal, and key collision attacks.

---

### 9.8 Video and Attachment Extension Sanitisation

For video and attachment uploads, where re-encoding is not performed, the file extension is sanitised before being used in the S3 key:

```js
const ext = (req.file.originalname.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
const key = `${folder}/${randomUUID()}.${ext}`
```

The `.replace(/[^a-z0-9]/g, '')` strips any character that is not a lowercase letter or digit — preventing `.` sequences, path separators, shell metacharacters, and other injection attempts in the extension.

---

## 10. S3 Data Integrity — Cleanup on Every Delete

**Files:** All route files in `server/routes/`, `server/utils/s3.js`

When any database record containing an S3 reference is deleted, the corresponding S3 objects are also deleted. This prevents orphaned files accumulating on S3, and ensures that deleted content is truly gone — not just unreferenced.

The `deleteObject` utility in `server/utils/s3.js` is used consistently across the entire codebase:

| Route File | What Gets Cleaned Up on Delete |
|---|---|
| `members.js` | Profile photo + mobile key, cover photo, personal gallery photos + mobile keys |
| `gallery.js` | Club gallery photos (desktop + mobile S3 keys) |
| `admin.js` | On permanent user deletion: profile photo, cover, personal gallery, all competition submission photos across all competitions |
| `posts.js` | Post image S3 key, plus all keys when admin purges all posts |
| `competitions.js` | Banner, competition banner, gallery photos, winner photos, all submission photos |
| `events.js` | Gallery photos, event logo |
| `activities.js` | Activity banner, gallery photos |
| `coreCommittee.js` | Core member photo, cover photo, all gallery photos |
| `magazines.js` | All page images and attachments |
| `postcards.js` | Postcard image |

**Profile photo rotation** — when a user uploads a new profile photo, the previous one is deleted from S3 before the new key is stored:

```js
// members.js
if (profilePhotoS3Key) {
  const old = await User.findById(req.user._id).select('profilePhotoS3Key')
  if (old?.profilePhotoS3Key && old.profilePhotoS3Key !== profilePhotoS3Key) {
    await deleteObject(old.profilePhotoS3Key).catch(() => {})
  }
}
```

The same pattern applies to cover photos.

**User deletion cascade** — when an admin permanently deletes a user account, the deletion covers:
1. Profile photo and cover photo S3 keys
2. Every photo in the user's personal gallery (desktop and mobile keys)
3. Every competition submission photo the user ever uploaded (found by querying all competitions)
4. Competition documents are updated to remove the user's submissions
5. Club gallery photos attributed to the user remain (they are club property) but attribution is nullified

---

## 11. Injection Attack Prevention

---

### 11.1 SQL Injection

**Not applicable.** The database is MongoDB. There is no SQL anywhere in the application.

---

### 11.2 NoSQL Injection (MongoDB Operator Injection)

**Risk:** An attacker sends `{ "email": { "$gt": "" } }` in the request body, hoping MongoDB will execute the operator and return all users regardless of email value.

**Protection 1 — Mongoose Strict Schema Typing:**

Every field on every Mongoose schema is explicitly typed. When Mongoose receives an object where a `String` type is expected, it attempts to cast the value to a string. The object `{ "$gt": "" }` cannot be cast to a string — Mongoose throws a `CastError` and the query never executes.

**Protection 2 — Regex Character Escaping on Search Inputs:**

Every route that builds a `$regex` query from user input first escapes all special regex metacharacters:

```js
// Used in admin.js, gallery.js, and globalAnnouncements.js
filter.name = {
  $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  $options: 'i'
}
```

The regex `/[.*+?^${}()|[\]\\]/g` matches every character that has special meaning in a regular expression and the replacement `\\$&` escapes each with a backslash. This converts any regex metacharacter in the search query to a literal character, preventing **ReDoS (Regular Expression Denial of Service)** attacks.

---

### 11.3 Command Injection

**Not applicable.** No shell commands are executed anywhere in the application. There are no `exec()`, `spawn()`, or `eval()` calls that accept user input.

---

### 11.4 Server-Side Template Injection (SSTI)

**Not applicable.** The backend is a pure JSON REST API. There is no server-side template engine (no EJS, Pug, Handlebars, Jinja). All HTML rendering happens client-side in React. User input is never interpolated into a template that is then executed or rendered on the server.

---

## 12. Cross-Site Scripting (XSS) Prevention

**XSS** is an attack where malicious JavaScript is injected into a website and executed in another user's browser — potentially stealing session tokens, redirecting users, or defacing the site.

---

### 12.1 React Auto-Escaping — Primary Defence

The entire frontend is built with React. React automatically HTML-escapes all dynamic content rendered with `{variable}` syntax in JSX. A caption stored as `<script>alert(1)</script>` is rendered as the literal text `&lt;script&gt;alert(1)&lt;/script&gt;` — the browser displays it as text and never executes it.

---

### 12.2 DOMPurify — Rich HTML Rendering in Announcements

**File:** `src/components/announcement/_shared.jsx`
**Package:** `dompurify`

Announcements support HTML content. When this content is rendered in the web UI, it is sanitised with DOMPurify before being set as HTML:

```jsx
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.content) }} />
```

DOMPurify parses the HTML in a sandboxed context, strips dangerous tags (`<script>`, `<iframe>`, `<form>`, `<object>`) and attributes (`onerror=`, `onclick=`, `href="javascript:"`), and returns clean HTML safe for DOM injection.

---

### 12.3 sanitize-html — Email Content Sanitisation

**File:** `server/routes/globalAnnouncements.js`
**Package:** `sanitize-html`

Before any announcement HTML is embedded in an outgoing email, it is sanitised server-side with `sanitize-html`:

```js
const SAFE_EMAIL_TAGS = {
  allowedTags: ['p','br','div','span','strong','em','b','i','u','s',
                 'h1','h2','h3','h4','ul','ol','li','blockquote','a','img'],
  allowedAttributes: {
    'a':   ['href', 'style', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'style'],
    '*':   ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
}
```

Tags like `<script>`, `<iframe>`, `<form>`, and `<object>` — and all `on*` event handler attributes — are stripped. Legitimate formatting tags are preserved. This prevents a privileged user from embedding executable code or phishing forms in emails sent from the official club address.

---

### 12.4 SVG Icons Are Hardcoded

**File:** `src/components/Icons.jsx`

The one other use of `dangerouslySetInnerHTML` in the codebase is for SVG icon paths:

```jsx
dangerouslySetInnerHTML={{ __html: path }}
```

The `path` value is a hardcoded string defined in the component source — it is never derived from user input or database content. This is safe.

---

### 12.5 Content Security Policy — Backup Defence

The CSP `script-src 'self'` directive (Section 14) provides a backup layer: even if an XSS vector were somehow introduced, the browser would refuse to execute any injected inline script or script loaded from an external domain.

---

## 13. Server-Side Request Forgery (SSRF) Prevention

**SSRF** is when a server is tricked into making HTTP requests to unintended internal or external destinations — potentially exposing cloud metadata services, internal APIs, or making the server act as an anonymous proxy.

---

### 13.1 Image Proxy — Restricted to S3, Authentication Required

**File:** `server/routes/imageProxy.js`

The image proxy exists to support PDF generation. `html2canvas` cannot load images cross-origin from S3 due to browser CORS restrictions, so the server fetches the image and returns it same-origin. Previously this was an unauthenticated open proxy that would fetch **any** HTTPS URL from **anyone**. It now enforces two controls:

```js
router.get('/', requireAuth, async (req, res) => {   // authenticated callers only
  const BUCKET_HOST = `${process.env.S3_BUCKET_NAME}.s3`

  const parsed = new URL(url)
  if (parsed.protocol !== 'https:')           return res.status(400).json({ error: 'https only' })
  if (!parsed.hostname.includes(BUCKET_HOST)) return res.status(403).json({ error: 'URL not from allowed host.' })
  // then fetch and return
})
```

1. **Authentication required** — unauthenticated callers cannot trigger any outbound request
2. **Hostname allowlist** — only URLs whose hostname matches the application's S3 bucket are proxied

This is the same approach used by the upload route's own proxy, which already had these restrictions from the start.

---

### 13.2 Upload Route Proxy — Same Restriction

**File:** `server/routes/upload.js`

```js
if (!url || !url.startsWith('https://') || !url.includes(BUCKET_HOST)) {
  return res.status(400).json({ error: 'Invalid or disallowed URL.' })
}
```

Only HTTPS URLs containing the known S3 bucket hostname are fetched. This was implemented from the beginning for the upload proxy.

---

## 14. HTTP Security Headers and Content Security Policy

**File:** `server/index.js`
**Package:** `helmet`

Helmet sets a comprehensive collection of HTTP security headers on every response.

---

### 14.1 All Headers Set by Helmet

| Header | Value | Protection |
|---|---|---|
| `Content-Security-Policy` | Full policy (see below) | XSS, code injection, clickjacking |
| `X-Frame-Options` | `DENY` | Clickjacking (legacy browser fallback) |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing attacks |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | Forces HTTPS — prevents HTTP downgrade |
| `X-DNS-Prefetch-Control` | `off` | Prevents DNS-based tracking side-channels |
| `Referrer-Policy` | `no-referrer` | Prevents URL tokens leaking via Referer header |
| `X-Permitted-Cross-Domain-Policies` | `none` | Blocks Flash/Silverlight cross-domain access |
| `X-Download-Options` | `noopen` | Prevents IE from opening downloaded files directly |

---

### 14.2 Content Security Policy Directives

```js
contentSecurityPolicy: {
  directives: {
    defaultSrc:     ["'self'"],
    scriptSrc:      ["'self'"],
    styleSrc:       ["'self'", "'unsafe-inline'"],
    imgSrc:         ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc:     ["'self'", 'https:'],
    fontSrc:        ["'self'", 'data:'],
    objectSrc:      ["'none'"],
    baseUri:        ["'self'"],
    formAction:     ["'self'"],
    workerSrc:      ["'self'", 'blob:'],
    frameAncestors: ["'none'"],
  },
}
```

| Directive | Explanation |
|---|---|
| `default-src 'self'` | Any resource type not covered by a specific directive falls back to same-origin only |
| `script-src 'self'` | Only scripts loaded from the same domain run. Injected inline `<script>` tags and external script URLs are blocked by the browser. |
| `style-src 'self' 'unsafe-inline'` | Inline styles (`style={}` in React, Tailwind utility classes) are needed. Script-based CSP is unaffected. |
| `img-src 'self' data: blob: https:` | Images from own domain, data URIs, blob URIs, and S3/CDN HTTPS URLs |
| `connect-src 'self' https:` | Covers all `fetch()` and `XMLHttpRequest` calls. App calls its own API only; `https:` allows any HTTPS endpoint in case of third-party API calls |
| `font-src 'self' data:` | Local fonts and base64-embedded fonts |
| `object-src 'none'` | Absolutely no Flash, plugins, or embedded objects — no exceptions |
| `base-uri 'self'` | Prevents `<base href="https://attacker.com">` injection, which would redirect all relative URLs to an attacker's domain |
| `form-action 'self'` | HTML forms cannot submit to external domains. Prevents form-based phishing overlays. |
| `worker-src 'self' blob:` | Allows Web Workers from the same origin or blob URLs (for any worker-based processing) |
| `frame-ancestors 'none'` | This page cannot be embedded in an `<iframe>` on any external site — prevents clickjacking |

---

### 14.3 Why `script-src 'self'` Works Without `'unsafe-inline'`

**File:** `vite.config.js`

By default, Vite's production build injects a small inline JavaScript polyfill for `<link rel="modulepreload">` into `index.html`. This inline script would violate `script-src 'self'`. The fix was to disable this polyfill:

```js
build: {
  target: 'es2020',
  modulePreload: { polyfill: false },
}
```

All browsers capable of running an `es2020` JavaScript bundle natively support `modulepreload` — the polyfill only helped older browsers that cannot run the app anyway. Disabling it is invisible to users.

---

## 15. CORS Configuration

**File:** `server/index.js`
**Package:** `cors`

**CORS (Cross-Origin Resource Sharing)** controls which external websites can make API calls to the server from a user's browser.

```js
const allowedOrigins = isProd
  ? (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : false)   // block all cross-origin requests by default
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

if (isProd && !process.env.ALLOWED_ORIGINS) {
  console.log('ℹ️   ALLOWED_ORIGINS not set — cross-origin requests blocked')
}
```

**In production:** The React SPA and the Express API are served from the same server on the same domain (Render). The browser never sends a CORS preflight for same-origin requests, so CORS has zero effect on normal app usage. Defaulting to `false` means any request from a different domain is blocked without any allowlist entry.

**In development:** The three Vite dev server ports are explicitly allowed.

**Why CSRF is not a threat regardless of CORS:** The app uses JWTs in the `Authorization` header — not cookies. Browsers only auto-attach cookies to requests; custom headers require explicit JavaScript. CSRF attacks cannot set custom headers, so they cannot authenticate with the API even if CORS were fully open.

---

## 16. Sensitive Data Protection

---

### 16.1 `select: false` — Schema-Level Exclusion

**File:** `server/models/User.js`

The most sensitive fields on the User schema are marked `select: false`, which means Mongoose never returns them in query results unless explicitly opted in:

```js
password:   { type: String, required: true, select: false },
otpHash:    { type: String, select: false },
otpExpiry:  { type: Date,   select: false },
otpPurpose: { type: String, select: false },
```

This is the last line of defence against accidental data leakage — even if a developer writes a `User.find()` query without specifying exclusions, the sensitive fields are not included.

---

### 16.2 `toSafeObject()` — Safe Serialisation on Login

**File:** `server/models/User.js`

```js
userSchema.methods.toSafeObject = function () {
  const { password, otpHash, otpExpiry, otpPurpose, ...rest } = this.toObject({ virtuals: true })
  return rest
}
```

This method is called on login and profile responses, providing a second safety layer that explicitly strips sensitive fields before the response is sent.

---

### 16.3 Explicit Field Exclusion in Bulk Queries

Every admin and member listing route explicitly excludes sensitive fields:

```js
.select('-password -otpHash -otpExpiry -otpPurpose')
```

---

### 16.4 Sensitive Fields Never Returned in Responses

When sensitive fields are needed (e.g., to verify a password or OTP), they are fetched with `.select('+password')` for that specific operation, used locally, and never forwarded to the client.

---

## 17. Mass Assignment Protection

**Mass assignment** occurs when a server blindly saves every field the client sends in a request body, allowing an attacker to modify fields they should not control — such as audit fields, status flags, or ownership references.

**File:** `server/routes/globalAnnouncements.js`

The announcement draft PATCH endpoints previously used `{ $set: req.body }`, forwarding the entire request body to MongoDB. They now use an explicit field whitelist:

```js
const { subject, content, kind, recipientPreset, filters,
        customRecipients, toRecipients, ccEmails, bccEmails, attachments } = req.body
const update = { subject, content, kind, recipientPreset, filters,
                 customRecipients, toRecipients, ccEmails, bccEmails, attachments }
// Remove undefined fields so they do not overwrite existing values
Object.keys(update).forEach(k => update[k] === undefined && delete update[k])
await GlobalAnnouncement.findOneAndUpdate(..., { $set: update }, ...)
```

Fields that are now protected from client modification:

| Field | Why Protected |
|---|---|
| `status` | Only the send endpoint changes `draft` → `sent` — cannot be bypassed |
| `sentBy` | Set at record creation; cannot be re-attributed to another user |
| `recipientCount` | Set by the send endpoint after actual delivery — it is an audit record |
| `resolvedRecipients` | Audit record of who actually received the email |
| `binned` / `binnedAt` | Controlled only by the bin and restore endpoints |

The same protection applies to the context-specific draft PATCH route.

---

## 18. Denial of Service Protection

Multiple mechanisms work together to prevent the server from being overwhelmed.

---

### 18.1 Rate Limiting

Covered in full in [Section 8](#8-rate-limiting--brute-force-and-abuse-prevention).

---

### 18.2 JSON Body Size Cap

**File:** `server/index.js`

```js
app.use(express.json({ limit: '5mb' }))
```

Request bodies larger than 5 MB are rejected before they are parsed. This prevents memory exhaustion from crafted large JSON payloads.

---

### 18.3 Long Password Denial of Service Prevention

Covered in [Section 1.2](#12-password-length-policy--minimum-and-maximum). The 128-character maximum prevents bcrypt from being used as a compute weapon against the server.

---

### 18.4 Posts Feed Pagination Cap

**File:** `server/routes/posts.js`

```js
.limit(Math.min(100, Number(limit) || 30))
```

The feed endpoint caps responses at 100 posts per request regardless of the client-supplied `limit`. Without this, an unauthenticated request with `?limit=100000` could attempt to load the entire posts collection with full `populate()` expansion, blocking the event loop.

---

### 18.5 Gallery Pagination Cap

**File:** `server/routes/gallery.js`

```js
const limit = Math.min(500, Number(req.query.limit) || 200)
```

Gallery photo responses are capped at 500 per request.

---

### 18.6 Multer File Size Limits

As described in [Section 9.2](#92-file-size-limits--enforced-at-streaming-level), file size is enforced during HTTP streaming before file data enters application memory.

---

### 18.7 Announcement Batch Sending

**File:** `server/routes/globalAnnouncements.js`

Bulk announcement emails are sent in batches of 10 recipients at a time with sequential awaiting via the Resend HTTP API. This prevents the email API from being flooded and avoids exhausting rate limits.

---

## 19. Secret and Credential Management

---

### 19.1 Environment Variables

All secrets are loaded from a `.env` file at server startup using `dotenv`. The file is loaded before any module imports to ensure all environment variables are available to the entire application.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (includes username and password) |
| `JWT_SECRET` | HMAC key for signing and verifying JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `AWS_ACCESS_KEY_ID` | S3 access key — server-side only |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key — server-side only |
| `AWS_REGION` | S3 bucket region |
| `S3_BUCKET_NAME` | S3 bucket name |
| `RESEND_API_KEY` | Resend API key for sending OTPs and announcements |
| `EMAIL_FROM` | Display name and address for outgoing emails |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (optional in same-origin deploy) |

---

### 19.2 `.gitignore` — Secrets Never Committed

Every `.env` variant is excluded from version control:

```gitignore
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local
.env.production
.env.staging
```

---

### 19.3 No `VITE_` Prefixed Secrets

Vite bundles all environment variables prefixed with `VITE_` into the compiled frontend JavaScript. No secret — AWS keys, MongoDB credentials, JWT secret — is ever given a `VITE_` prefix. The frontend bundle contains zero credentials.

---

### 19.4 AWS S3 — Server-Side Only

All S3 operations (upload, delete, presigned URL generation) happen exclusively in server-side code (`server/utils/s3.js`). The frontend calls `/api/upload` which acts as a proxy. The AWS SDK is never imported in any `src/` file.

---

### 19.5 VS Code Local History Excluded

```gitignore
.history/
```

VS Code's Local History extension copies every file edit to `.history/`. If a developer ever opens a `.env` file in the editor, its content would be preserved there. The directory is gitignored.

---

### 19.6 Claude Code Project Files Excluded

```gitignore
.claude/
```

Claude Code's project configuration and session memory files are gitignored.

---

### 19.7 Seed Scripts and One-Time Admin Scripts Excluded

```gitignore
server/seed-members.mjs
server/seed-cores.mjs
server/seed-all.mjs
server/seeds/
server/scripts/seedTestUsers.js
server/scripts/cleanupOrphans.js
server/scripts/removeGalleryTitles.js
server/scripts/backfillCacheControl.js
```

One-time maintenance scripts and seed files with test data are kept locally and never committed to the repository.

---

## 20. Email Security

---

### 20.1 OTPs Are Never Stored in Plaintext

The plaintext OTP is generated in memory, emailed, and immediately discarded. Only the bcrypt hash is written to the database. A database breach cannot reveal any active OTP.

---

### 20.2 Email Content Sanitisation

Described in [Section 12.3](#123-sanitize-html--email-content-sanitisation). `sanitize-html` strips executable HTML from announcement content before it is embedded in email templates.

---

### 20.3 Forgot Password Does Not Reveal Account Existence

```js
if (!user) return res.json({ message: 'If that email exists, an OTP has been sent.' })
```

The same response is returned whether the email is registered or not.

---

### 20.4 Email Notifications for Membership Changes

When a user is added to an event or competition, or their role within it changes, they receive an automated email notification. These emails contain no sensitive data and serve as an audit trail for the affected user.

---

### 20.5 Email Transport — Resend HTTP API (No SMTP)

**Files:** `server/utils/resend.js`, `server/utils/emailQueue.js`

The application was originally designed with nodemailer over SMTP (port 587, Gmail). This was replaced with the **Resend HTTP API** for the following reasons:

- Render's free tier blocks outbound SMTP connections on port 587. Attempting to connect silently hangs until the OTP timeout, making email flows completely broken in production.
- The Resend SDK communicates exclusively over HTTPS (port 443), which is never blocked.
- Resend provides delivery analytics, bounce tracking, and a web UI for debugging sent emails.

**Security properties of this transport:**

| Property | Detail |
| --- | --- |
| Protocol | HTTPS (TLS 1.2/1.3) — all API calls are encrypted in transit |
| Authentication | API key in `Authorization: Bearer` header — never in URL |
| Credential storage | API key in server-only `.env` — never bundled into the frontend |
| Rate limits | Resend enforces per-second and daily send limits — adds a second layer of DDoS guard on top of the app-level rate limiter |
| From address | Locked to `EMAIL_FROM` env var — users cannot control the `From` header |

**Limitation:** Without a verified sending domain, Resend restricts the `From` address to `onboarding@resend.dev`, which only delivers to the Resend account owner's email. Full multi-recipient delivery requires a verified domain configured in Resend and reflected in `EMAIL_FROM`.

---

## 21. Replay Attack Prevention

---

### 21.1 HTTPS Enforced in Production

The application is deployed on Render with enforced HTTPS/TLS. All communication between browser and server is encrypted. Tokens cannot be intercepted in transit.

---

### 21.2 tokenVersion — Immediate Invalidation

Covered in full in [Section 2.2](#22-token-version--immediate-invalidation-on-logout-ban-or-password-reset). Any captured token becomes worthless the moment its owner logs out or their account is acted upon.

---

## 22. Error Handling and Information Leakage Prevention

**File:** `server/index.js`

---

### 22.1 Global Error Handler — Strips Error Details in Production

```js
app.use((err, req, res, _next) => {
  console.error('❌  Express error:', err.message)
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: isProd ? 'Internal server error' : err.message })
})
```

In production, all unhandled errors return the generic message `"Internal server error"`. Stack traces, file paths, internal error messages, package names, and version numbers are never exposed to clients — all of which could help an attacker map the system.

In development, the real error message is returned to the developer to assist debugging.

---

### 22.2 Process-Level Exception Handlers

```js
process.on('uncaughtException',  err => console.error('❌  Uncaught exception:',  err))
process.on('unhandledRejection', err => console.error('❌  Unhandled rejection:', err))
```

Uncaught exceptions and unhandled promise rejections are logged to the console (visible in Render's log stream) rather than crashing the process silently.

---

## 23. Known Considerations and Future Work

---

### 23.1 nodemailer CVEs — Resolved via Resend Migration

nodemailer has been fully removed from the application and replaced with the **Resend HTTP API** (`resend` npm package). All CVEs that previously applied to nodemailer are no longer relevant — there is no SMTP library in the dependency tree.

See [Section 20.5](#205-email-transport--resend-http-api-no-smtp) for the full rationale and security properties of the new transport.

---

### 23.2 xlsx — Prototype Pollution and ReDoS (Low Priority)

`xlsx@0.18.5` (SheetJS Community Edition) has known prototype pollution and ReDoS vulnerabilities. The app uses it client-side only for CSV/Excel export — it never parses untrusted user-uploaded files. Risk is low but the package is no longer actively maintained. Migration to `@sheet/core` or an alternative is recommended when the export feature is next modified.

---

### 23.3 CSP `style-src 'unsafe-inline'`

The CSP permits inline styles because React components use `style={{}}` props extensively. Eliminating `'unsafe-inline'` for styles would require replacing all inline style props across the component library with CSS classes. This is a hardening improvement, not an active vulnerability — no CSS injection attack path currently exists in the application.

---

### 23.4 Structured Logging

The application uses `console.error()` for server-side logging. For security incident investigation, structured logging with request IDs, user IDs, IP addresses, and timestamps would significantly improve the ability to reconstruct timelines. A library like `pino` would be a low-overhead improvement.

---

## 24. Full Vulnerability Audit Log

This table is the complete record of every vulnerability identified, assessed, and acted upon during the security audit conducted in June 2026.

| # | Vulnerability | Category | Severity | Status | Fix Applied |
|---|---|---|---|---|---|
| 1 | Long Password DoS before bcrypt | Denial of Service | Medium | **Fixed** | 128-char cap on register, login, and reset routes |
| 2 | Open unauthenticated SSRF via image proxy | SSRF | High | **Fixed** | S3 hostname allowlist + `requireAuth` added to `imageProxy.js` |
| 3 | Uncapped posts feed pagination | Denial of Service | Low | **Fixed** | `Math.min(100, limit)` cap in `posts.js` |
| 4 | Mass assignment on announcement draft PATCH | Broken Access Control | Medium | **Fixed** | Explicit field whitelist in both draft PATCH routes |
| 5 | Raw user HTML embedded in outgoing emails | Email Injection | Medium | **Fixed** | `sanitize-html` applied in `buildEmailHtml()` before template insertion |
| 6 | Content Security Policy disabled | Misconfiguration | Info | **Fixed** | Vite modulepreload polyfill disabled; full CSP enabled in Helmet |
| 7 | CORS default reflected any origin in production | Misconfiguration | Info | **Fixed** | Default changed to `false`; startup warning added |
| 8 | SSTI (Server-Side Template Injection) | Injection | N/A | Not applicable | No server-side template engine |
| 9 | SQL Injection | Injection | N/A | Not applicable | MongoDB — no SQL |
| 10 | NoSQL Injection | Injection | Low | Mitigated | Mongoose schema type casting + regex escaping on all search inputs |
| 11 | ReDoS via search input | Denial of Service | Low | Mitigated | All `$regex` queries escape metacharacters before use |
| 12 | XSS via React rendering | XSS | N/A | Not applicable | React auto-escapes all JSX interpolations |
| 13 | XSS via announcement HTML display | XSS | Low | Mitigated | DOMPurify on all `dangerouslySetInnerHTML` usage |
| 14 | CSRF | CSRF | N/A | Not applicable | JWT in Authorization header — not cookies |
| 15 | AWS credential leakage to frontend | Secrets | N/A | Not applicable | Server-side only; no `VITE_AWS_*` variables |
| 16 | Login replay attack | Authentication | Low | Mitigated | tokenVersion system + HTTPS |
| 17 | Brute force login | Authentication | Medium | Mitigated | 10 requests / 15 min rate limit |
| 18 | OTP brute force | Authentication | Medium | Mitigated | 5 requests / 15 min + bcrypt comparison + 15 min expiry |
| 19 | OTP purpose confusion | Authentication | Low | Mitigated | Purpose field checked on every OTP verification |
| 20 | Sensitive fields in API responses | Data Exposure | Medium | Mitigated | `select: false` on schema + `toSafeObject()` + explicit exclusions |
| 21 | User enumeration via login/forgot password | Data Exposure | Low | Mitigated | Generic error messages regardless of whether account exists |
| 22 | File upload — malicious file execution | File Upload | High | Mitigated | Magic bytes + sharp re-encoding + UUID keys + extension sanitisation |
| 23 | File upload — path traversal | File Upload | Medium | Mitigated | S3 folder allowlist + UUID-based keys |
| 24 | Orphaned S3 files after record deletion | Data Integrity | Low | Mitigated | `deleteObject` called on all delete operations across all routes |
| 25 | Profile/cover photo not cleaned up on replace | Data Integrity | Low | Mitigated | Old S3 key deleted before new key is stored |
| 26 | IDOR on user-owned resources | Access Control | Medium | Mitigated | Ownership checks on all post, comment, gallery, and draft operations |
| 27 | Privilege escalation — role promotion | Access Control | High | Mitigated | Core can only promote to coordinator; admin role protected from all modifications |
| 28 | Coordinator over-permission on events/comps | Access Control | Medium | Mitigated | Per-resource `coordCan*` flags; context-level middleware |
| 29 | Pastejacking | Social Engineering | N/A | Not applicable | No copyable terminal commands or code blocks displayed |
| 30 | Vite inline script blocking CSP | Misconfiguration | Info | Fixed | `modulePreload: { polyfill: false }` in `vite.config.js` |
| 31 | Error messages revealing stack traces in prod | Information Disclosure | Medium | Mitigated | Global error handler returns generic message in production |
| 32 | nodemailer CVEs | Dependency | High | **Fixed** | Replaced nodemailer entirely with Resend HTTP API — no SMTP library in dependency tree |
| 33 | xlsx prototype pollution / ReDoS | Dependency | Low | Pending | Client-side only; low risk; replace when convenient |

---

*This document reflects the security state of the application as of June 2026.*
*Any new feature that involves user input, file handling, authentication, or external services should be evaluated against this document before deployment.*
