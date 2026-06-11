# Domain Driven Design (DDD)
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Covers:** Bounded Contexts, Aggregates, Entities, Value Objects, Domain Events, Ubiquitous Language

---

## 1. Ubiquitous Language

The vocabulary used consistently across code, conversations, and documentation:

| Term | Definition |
|------|-----------|
| **Club** | IEM Photography Club — the real-world organization this system serves |
| **Member** | Any person with a system account; base role = Photographer |
| **Core Member** | Executive club member with management privileges (role = `core` or `admin`) |
| **Coordinator** | Member assigned to a specific Event or Activity with upload/announce permissions |
| **Photographer** | Base-level club member; can participate and use member dashboard |
| **Session** | Academic year, e.g. `2025-26` |
| **Event** | A club photography outing or gathering (walk, workshop, exhibition) |
| **Activity** | A recurring or special club program (e.g. "Photo of the Week", campus cleanup) |
| **Competition** | A judged photography contest with entries and winners |
| **Entry** | A competition submission by a Member — one photo + caption |
| **Gallery** | A collection of photos associated with an Event or Competition |
| **Magazine** | A multi-page designed digital publication created in the built-in editor |
| **Page** | A single magazine page rendered from a Layout template |
| **Layout** | A predefined page template defining slot positions and sizes |
| **ImgSlot** | An image placeholder within a Layout; accepts one photo + crop data |
| **TxtSlot** | A text placeholder within a Layout; accepts styled string content |
| **Postcard** | A single artistic photo submitted by members for the postcard carousel |
| **Announcement** | A targeted message broadcast to specific roles or event participants |
| **Hero Mode** | The visual style of the homepage hero section: `classic` or `video` |
| **Draft** | A Magazine not yet published; visible only to its creator and admins |
| **Published** | A Magazine made public; has a thumbnail and appears in the public browser |
| **Approval** | Admin action changing a Member's status from `pending` to `active` |
| **Rejection** | Admin action setting status to `rejected` with an optional reason |
| **Presigned URL** | A time-limited AWS S3 URL that allows direct file upload without exposing credentials |

---

## 2. Bounded Contexts

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       IEM Photography Club Domain                         │
│                                                                           │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐  │
│  │  Identity &    │    │  Content       │    │  Publication           │  │
│  │  Membership    │    │  Management    │    │  (Magazine)            │  │
│  │                │    │                │    │                        │  │
│  │ User           │    │ Event          │    │ Magazine               │  │
│  │ Role           │    │ Competition    │    │ Page                   │  │
│  │ Status         │    │ Activity       │    │ Layout                 │  │
│  │ Approval       │    │ Gallery        │    │ ImgSlot / TxtSlot      │  │
│  └───────┬────────┘    └───────┬────────┘    └──────────┬─────────────┘  │
│          │                    │                         │                 │
│          └────────────────────┼─────────────────────────┘                 │
│                               │                                           │
│  ┌────────────────┐    ┌──────┴─────────┐    ┌────────────────────────┐  │
│  │  Communication │    │  Media         │    │  Site Configuration    │  │
│  │                │    │  Storage       │    │                        │  │
│  │ Announcement   │    │  S3 Upload     │    │ AppSettings            │  │
│  │ Notification   │    │  Presigned URL │    │ Hero Mode              │  │
│  │ Email          │    │  CORS Proxy    │    │ Section Visibility     │  │
│  └────────────────┘    └────────────────┘    └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Aggregates

### 3.1 Member Aggregate

**Root:** `Member`  
**Invariants:**
- A Member's `status` must be one of `pending`, `active`, `rejected`
- A Member cannot have a role higher than `core` without admin action
- `password` is always stored as a bcrypt hash; never returned in responses

```
Member (Aggregate Root)
├── MemberId (Value Object)
├── Email (Value Object — unique, validated format)
├── PasswordHash (Value Object — never exposed)
├── Role (Enum: admin | core | coordinator | photographer)
├── Status (Enum: pending | active | rejected)
├── ProfilePhoto (Value Object — S3 URL or null)
├── AcademicPeriod (Value Object — { startYear, endYear, department })
└── SocialProfile (Value Object — { bio, instagramHandle })
```

**Domain Events:**
- `MemberRegistered` → triggers approval email to admin
- `MemberApproved` → triggers welcome email
- `MemberRejected` → triggers rejection email with reason
- `MemberRoleChanged` → access rights updated immediately

---

### 3.2 Event Aggregate

**Root:** `Event`  
**Invariants:**
- `status` auto-computes from `date`/`endDate` unless `manualStatus` is set
- A Coordinator in `members[]` must be an active Member
- Gallery photo order must be a valid permutation of existing photo IDs

```
Event (Aggregate Root)
├── EventId
├── Title, Description (Value Objects)
├── DateRange (Value Object — { date, endDate })
├── CoverPhoto (Value Object — S3 URL)
├── Status (computed: upcoming | ongoing | past)
├── ManualStatus (Boolean — overrides computed)
├── IsOpenToAll (Boolean)
├── Gallery []
│   └── GalleryPhoto (Entity)
│       ├── PhotoId
│       ├── Url (S3 URL)
│       ├── S3Key
│       ├── UploadedBy (MemberId reference)
│       └── Order (Integer)
└── CoordinatorAssignments []
    └── CoordinatorAssignment (Value Object)
        ├── UserId (MemberId reference)
        ├── CanUpload (Boolean)
        └── ShowInGallery (Boolean)
```

**Domain Events:**
- `EventCreated`
- `GalleryPhotoUploaded` → if `showInGallery`, visible on public website
- `CoordinatorAssigned`

---

### 3.3 Magazine Aggregate

**Root:** `Magazine`  
**Invariants:**
- A `published` Magazine must have a non-null `thumbnailUrl`
- Pages are ordered; their index is their display position
- ImgSlot crop data is bounded: `scale >= 1.0`, rotation in `[-180, 180]`

```
Magazine (Aggregate Root)
├── MagazineId
├── Title (Value Object)
├── TemplateId (String — references templates.js registry)
├── Status (Enum: draft | published)
├── CreatedBy (MemberId reference)
├── ThumbnailUrl (Value Object — S3 URL, null until published)
├── PublishedAt (Date, null until published)
└── Pages [] (ordered)
    └── Page (Entity)
        ├── PageId
        ├── LayoutId (String — references Layout template)
        ├── Images []
        │   └── SlotImage (Value Object)
        │       ├── SlotId (String)
        │       ├── ImageUrl (S3 URL)
        │       ├── S3Key
        │       └── CropData (Value Object — { x, y, scale, rotation })
        └── Texts []
            └── SlotText (Value Object)
                ├── SlotId (String)
                └── Value (String)
```

**Domain Events:**
- `MagazineCreated`
- `MagazinePublished` → thumbnail generated, status updated, visible publicly
- `PageImageUpdated` → crop data / image changed

---

### 3.4 AppSettings Aggregate

**Root:** `AppSettings`  
**Design:** Key-value store where each key is an independent setting. Not a traditional aggregate (no complex invariants), but treated as one domain object for the Site Configuration bounded context.

```
AppSettings
├── Key (String — unique, e.g. 'desktopHeroMode')
├── Value (Mixed — String | Object | Boolean)
├── Label (String — human-readable display name)
└── UpdatedBy (MemberId reference)
```

**Key registry:**

| Key | Type | Values |
|-----|------|--------|
| `desktopHeroMode` | String | `classic` \| `video` |
| `sectionVisibility` | Object | `{ events, competitions, activities, ... }` |
| `subtitle-line1` | String | Hero subtitle text |
| `join-sub1` | String | Join section subheading |
| `connect-sub1` | String | Connect section subheading |
| `coordinator.canUploadGallery` | Boolean | |
| `coordinator.canPostAnnouncements` | Boolean | |

---

## 4. Context Map

```
Identity & Membership ──── upstream ──►  Content Management
(provides User, Role)                    (consumes UserId for coordinators,
                                          gallery uploadedBy, etc.)

Content Management ──────── upstream ──► Publication
(provides Events, Photos)               (consumes photo S3 URLs)

Media Storage ────────────── upstream ──► All contexts
(provides S3 URLs)                       (any context that stores media)

Site Configuration ──────── upstream ──► Public Website
(provides hero mode, visibility)         (reads settings on every render)
```

---

## 5. Domain Services

Services that don't naturally belong to a single aggregate:

| Service | Purpose |
|---------|---------|
| `ThumbnailService` | Captures page 1 of a magazine via html2canvas, uploads to S3, returns URL |
| `PDFExportService` | Orchestrates CORS proxy → html2canvas → jsPDF pipeline for multi-page PDFs |
| `StatusComputeService` | Computes Event/Competition/Activity status from dates (`upcoming/ongoing/past`) |
| `ApprovalNotificationService` | Sends email via Nodemailer when Member is approved/rejected |
| `HeroModeSyncService` | Polls `AppSettings` every 5s and propagates value to all active sessions |

---

## 6. Repository Interfaces

Each aggregate has a corresponding Mongoose model acting as its repository:

| Aggregate | Repository (Mongoose Model) | Key Operations |
|-----------|-----------------------------|---------------|
| Member | `User` | `findByEmail`, `findByIdAndUpdate`, `find({ status: 'pending' })` |
| Event | `Event` | `findById`, `findByIdAndUpdate` (gallery push), `find` with sort |
| Competition | `Competition` | Similar to Event |
| Activity | `Activity` | Similar to Event |
| Magazine | `Magazine` | `findById`, populate pages deeply, `find({ status: 'published' })` |
| AppSettings | `AppSettings` | `findOneAndUpdate({ key }, { value }, { upsert: true })` |
| Postcard | `Postcard` | `find`, `deleteOne` |
| CoreMember | `CoreMember` | `find`, grouped by year |
| Announcement | `Announcement` | `find({ targetRoles: { $in: [userRole] } })` |
