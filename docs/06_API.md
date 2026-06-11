# API Documentation
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Base URL:** `https://your-domain.com/api`  
**Auth:** Bearer JWT in `Authorization` header

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

JWT payload: `{ userId: string, role: 'admin'|'core'|'coordinator'|'photographer', iat, exp }`

---

## 1. Auth Routes — `/api/auth`

### POST `/api/auth/register`
Register a new member (creates `status: 'pending'`).

**Body:**
```json
{
  "name": "Arjun Roy",
  "email": "arjun@iem.edu.in",
  "password": "securePass123",
  "department": "CSE",
  "startYear": 2024,
  "endYear": 2028
}
```

**Response 201:**
```json
{ "message": "Registration successful. Awaiting admin approval." }
```

**Errors:** `400 Email already registered`, `422 Validation failed`

---

### POST `/api/auth/login`
Authenticate and receive JWT.

**Body:**
```json
{ "email": "admin@iem.edu.in", "password": "password123" }
```

**Response 200:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "_id": "64a3b...",
    "name": "Admin User",
    "email": "admin@iem.edu.in",
    "role": "admin",
    "status": "active",
    "profilePhoto": "https://s3.amazonaws.com/...",
    "department": "CSE",
    "startYear": 2022
  }
}
```

**Errors:** `401 Invalid credentials`, `403 Account pending approval`, `403 Account rejected`

---

### GET `/api/auth/me`
`🔒 Auth required`  
Get the currently authenticated user.

**Response 200:** Same `user` object as login.

---

## 2. Members Routes — `/api/members`

### GET `/api/members`
Public. Returns all active members.

**Query params:** `role=photographer`, `year=2024`

**Response 200:**
```json
[{
  "_id": "64a3b...",
  "name": "Priya Sen",
  "role": "photographer",
  "department": "ECE",
  "startYear": 2023,
  "profilePhoto": "https://...",
  "bio": "Street photographer.",
  "instagramHandle": "@priya.frames"
}]
```

---

### GET `/api/members/:id`
Public. Get one member by ID.

---

### PATCH `/api/members/:id`
`🔒 Auth required (self or admin)`  
Update profile fields.

**Body (any subset):**
```json
{
  "bio": "Updated bio",
  "instagramHandle": "@new_handle",
  "profilePhoto": "https://s3..."
}
```

---

### GET `/api/members/pending`
`🔒 Admin only`  
List all pending registrations.

---

### PATCH `/api/members/:id/approve`
`🔒 Admin only`

**Body:**
```json
{ "role": "photographer" }
```

---

### PATCH `/api/members/:id/reject`
`🔒 Admin only`

**Body:**
```json
{ "reason": "Not a current IEM student." }
```

---

### PATCH `/api/members/:id/role`
`🔒 Admin only`

**Body:**
```json
{ "role": "coordinator" }
```

---

## 3. Events Routes — `/api/events`

### GET `/api/events`
Public.

**Response 200:**
```json
[{
  "_id": "...",
  "title": "Monsoon Walk 2026",
  "description": "...",
  "date": "2026-07-15T10:00:00Z",
  "endDate": "2026-07-15T17:00:00Z",
  "coverPhoto": "https://...",
  "status": "upcoming",
  "gallery": [{ "url": "https://...", "order": 0 }]
}]
```

---

### GET `/api/events/:id`
Public. Single event with full gallery.

---

### POST `/api/events`
`🔒 Admin/Core`

**Body (multipart/form-data):**
```
title, description, date, endDate, coverPhoto (file), isOpenToAll
```

---

### PATCH `/api/events/:id`
`🔒 Admin/Core`  
Update event details.

---

### DELETE `/api/events/:id`
`🔒 Admin only`

---

### POST `/api/events/:id/gallery`
`🔒 Auth required (admin/core or assigned coordinator with canUpload)`

**Body (multipart/form-data):**
```
photos[] (files)
```

**Response 200:**
```json
{ "uploaded": 5, "gallery": [...] }
```

---

### PATCH `/api/events/:id/gallery/reorder`
`🔒 Admin/Core`

**Body:**
```json
{ "order": ["photoId1", "photoId2", "photoId3"] }
```

---

### POST `/api/events/:id/coordinators`
`🔒 Admin/Core`

**Body:**
```json
{ "userId": "64a3b...", "canUpload": true, "showInGallery": true }
```

---

## 4. Competitions Routes — `/api/competitions`

### GET `/api/competitions`
Public.

### GET `/api/competitions/:id`
Public. Includes gallery and winners.

### POST `/api/competitions`
`🔒 Admin/Core`

**Body:**
```json
{
  "title": "Golden Lens 2026",
  "description": "...",
  "date": "2026-09-01",
  "rules": "...",
  "prizeDetails": "...",
  "isOpenToAll": true
}
```

### PATCH `/api/competitions/:id`
`🔒 Admin/Core`

### DELETE `/api/competitions/:id`
`🔒 Admin only`

### POST `/api/competitions/:id/entries`
`🔒 Auth required`  
Submit a competition entry.

**Body (multipart/form-data):** `photo (file), caption`

### POST `/api/competitions/:id/winners`
`🔒 Admin/Core`

**Body:**
```json
{ "userId": "...", "position": 1, "prize": "₹5000 + Certificate" }
```

---

## 5. Magazines Routes — `/api/magazines`

### GET `/api/magazines`
Public. Returns `status: 'published'` magazines only.

**Response 200:**
```json
[{
  "_id": "...",
  "title": "SNAP Vol. 3",
  "templateId": "editorial-spread",
  "thumbnailUrl": "https://...",
  "publishedAt": "2026-05-01T00:00:00Z",
  "createdBy": { "name": "...", "role": "core" }
}]
```

---

### GET `/api/magazines/all`
`🔒 Auth required`  
Returns all magazines including drafts (for editors).

---

### GET `/api/magazines/:id`
`🔒 Auth required (for draft) / Public (for published)`  
Full magazine with all pages, slots, images, texts.

---

### POST `/api/magazines`
`🔒 Auth required`

**Body:**
```json
{ "title": "My Magazine", "templateId": "cover-classic" }
```

---

### PATCH `/api/magazines/:id`
`🔒 Auth required (owner or admin/core)`

**Body (any subset of magazine fields):**
```json
{
  "pages": [{
    "layoutId": "spread-2col",
    "images": [{ "slotId": "img-1", "imageUrl": "https://...", "cropData": { "x": 0, "y": -20, "scale": 1.2, "rotation": 0 } }],
    "texts": [{ "slotId": "title", "value": "Golden Hour" }]
  }]
}
```

---

### PATCH `/api/magazines/:id/publish`
`🔒 Admin/Core`

**Body:**
```json
{ "thumbnailUrl": "https://..." }
```

---

### DELETE `/api/magazines/:id`
`🔒 Admin/Core`

---

## 6. Settings Routes — `/api/settings`

### GET `/api/settings/content`
**Public.** Returns content-related settings (hero mode, section visibility, subtitle text, etc.)

**Response 200:**
```json
{
  "content": {
    "desktopHeroMode": "video",
    "sectionVisibility": { "events": true, "competitions": true, "activities": true },
    "subtitle-line1": "Capturing the Legacy",
    "join-sub1": "Be part of something..."
  }
}
```

---

### PATCH `/api/settings/:key`
`🔒 Admin/Core`  
Upsert a single setting.

**Body:**
```json
{ "value": "video" }
```

**Response 200:**
```json
{ "key": "desktopHeroMode", "value": "video" }
```

---

### GET `/api/settings`
`🔒 Admin only`  
All settings (including admin-only keys).

---

## 7. Upload Routes — `/api/upload`

### POST `/api/upload/image`
`🔒 Auth required`  
Upload any image to S3.

**Body (multipart/form-data):** `file (image), folder (optional, e.g. "profiles")`

**Response 200:**
```json
{
  "url": "https://bucket.s3.ap-south-1.amazonaws.com/profiles/uuid-filename.jpg",
  "key": "profiles/uuid-filename.jpg"
}
```

---

### DELETE `/api/upload/image`
`🔒 Auth required`  
Delete an S3 object.

**Body:**
```json
{ "key": "profiles/uuid-filename.jpg" }
```

---

## 8. Proxy Route — `/api/proxy`

### GET `/api/proxy/image?url=<encoded_s3_url>`
**No auth required.**  
Proxies an S3 image and returns it as a base64 data URL. Used by the magazine PDF export pipeline to bypass S3 CORS restrictions in html2canvas.

**Response 200:**
```
data:image/jpeg;base64,/9j/4AAQ...
```

---

## 9. Core Committee Routes — `/api/core`

### GET `/api/core`
Public. Returns all core members grouped by year.

### POST `/api/core`
`🔒 Admin/Core`

**Body (multipart/form-data):**
```
name, year (e.g. "2025-26"), designation, photo (file)
```

### PATCH `/api/core/:id`
`🔒 Admin/Core`

### DELETE `/api/core/:id`
`🔒 Admin/Core`

---

## 10. Announcements Routes — `/api/announce`

### GET `/api/announce`
`🔒 Auth required`  
Returns announcements for the current user (based on role/event membership).

### POST `/api/announce`
`🔒 Admin/Core/Coordinator (if permitted)`

**Body:**
```json
{
  "title": "Event Rescheduled",
  "body": "The Monsoon Walk is moved to July 20.",
  "targetRoles": ["all"],
  "eventId": "64a3b..." 
}
```

### DELETE `/api/announce/:id`
`🔒 Admin/Core`

---

## Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": "Short error code",
  "message": "Human-readable description",
  "statusCode": 401
}
```

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Rate Limiting

- **Global:** 100 requests per 15 minutes per IP
- **Auth endpoints:** 10 requests per 15 minutes per IP (stricter)
- Exceeded: `429 Too Many Requests` with `Retry-After` header
