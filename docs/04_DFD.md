# Data Flow Diagrams (DFD)
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Notation:** Yourdon-DeMarco (Mermaid flowchart syntax)

---

## Level 0 — Context Diagram

The entire system as a single process exchanging data with external entities.

```mermaid
flowchart LR
    ANON((Anonymous\nVisitor))
    MEMBER((Club\nMember))
    ADMIN((Admin /\nCore))
    S3[(AWS S3)]
    SMTP((Email\nServer)]

    ANON -->|Browse website, view events/gallery/magazines| SYS[IEM Photography\nClub Platform]
    MEMBER -->|Login, upload photos, edit profile, build magazines| SYS
    ADMIN -->|Manage users, events, settings, publish content| SYS
    SYS -->|Page data, gallery photos, magazine PDFs| ANON
    SYS -->|Dashboard data, notifications| MEMBER
    SYS -->|Admin reports, approval actions| ADMIN
    SYS -->|Upload/Download file requests| S3
    S3 -->|Presigned URLs, file stream| SYS
    SYS -->|Approval notifications, rejection emails| SMTP
    SMTP -->|Delivery status| SYS
```

---

## Level 1 — System Decomposition

Major subsystems and data flows between them.

```mermaid
flowchart TD
    ANON((Visitor))
    MEMBER((Member))
    ADMIN((Admin))
    S3[(S3)]
    DB[(MongoDB)]

    subgraph FRONTEND [React SPA]
        AUTH[1.0\nAuthentication]
        PUB[2.0\nPublic Website]
        ADMP[3.0\nAdmin Panel]
        DASHB[4.0\nMember Dashboard]
        MAG[5.0\nMagazine Editor]
    end

    subgraph BACKEND [Express API]
        AUTHAPI[Auth Routes]
        DATAAPI[Data Routes]
        SETTAPI[Settings Routes]
        UPLOADAPI[Upload Routes]
    end

    ANON -->|Browse| PUB
    MEMBER -->|Login| AUTH
    ADMIN -->|Login| AUTH
    AUTH -->|JWT Token| MEMBER
    AUTH -->|JWT Token| ADMIN
    MEMBER -->|Authenticated requests| DASHB
    ADMIN -->|Authenticated requests| ADMP
    ADMP -->|CRUD operations| DATAAPI
    DASHB -->|Profile, upload| DATAAPI
    ADMP -->|Settings changes| SETTAPI
    PUB -->|GET public data| DATAAPI
    MAG -->|Upload images| UPLOADAPI
    UPLOADAPI -->|Put object| S3
    S3 -->|URL| UPLOADAPI
    DATAAPI -->|Read/Write| DB
    SETTAPI -->|Upsert settings| DB
    AUTHAPI -->|User lookup| DB
```

---

## Level 2 — Authentication Subsystem (Process 1.0)

```mermaid
flowchart TD
    USER((User))
    DB[(MongoDB\nUsers)]
    JWT_STORE[(localStorage)]

    USER -->|email + password| P1_1[1.1\nValidate Credentials]
    P1_1 -->|findByEmail| DB
    DB -->|User document| P1_1
    P1_1 -->|bcrypt.compare| P1_2[1.2\nVerify Password Hash]
    P1_2 -->|sign payload: userId, role| P1_3[1.3\nGenerate JWT]
    P1_3 -->|JWT token + user object| USER
    P1_3 -->|Store token| JWT_STORE

    USER -->|token on each request| P1_4[1.4\nVerify JWT\nMiddleware]
    P1_4 -->|decoded userId| DB
    DB -->|req.user| P1_4
    P1_4 -->|authorized req.user| HANDLER[Route Handler]

    USER -->|Register: name, email, dept, year| P1_5[1.5\nCreate Pending User]
    P1_5 -->|Insert status=pending| DB
    DB -->|_id| P1_5

    ADMIN((Admin)) -->|approve/reject + userId| P1_6[1.6\nUpdate User Status]
    P1_6 -->|Update status, role| DB
```

---

## Level 2 — Event Management Subsystem (Process 3.2)

```mermaid
flowchart TD
    ADMIN((Admin/Core))
    COORD((Coordinator))
    VISITOR((Visitor))
    DB[(MongoDB Events)]
    S3[(AWS S3)]

    ADMIN -->|title, date, desc, coverPhoto| P3_1[3.2.1\nCreate Event]
    P3_1 -->|Insert Event doc| DB
    P3_1 -->|Upload cover photo| S3

    ADMIN -->|eventId, updates| P3_2[3.2.2\nEdit Event]
    P3_2 -->|findByIdAndUpdate| DB

    ADMIN -->|eventId + userId + perms| P3_3[3.2.3\nAssign Coordinator]
    P3_3 -->|Push to members[]| DB

    COORD -->|eventId + photos| P3_4[3.2.4\nUpload Gallery Photos]
    P3_4 -->|Check canUploadGallery permission| DB
    P3_4 -->|Upload files| S3
    S3 -->|URLs| P3_4
    P3_4 -->|Push to gallery[]| DB

    DB -->|Event status auto-computed from dates| P3_5[3.2.5\nAuto Status Compute]
    P3_5 -->|upcoming / ongoing / past| DB

    VISITOR -->|GET /events| P3_6[3.2.6\nServe Public Events]
    DB -->|Published events + galleries| P3_6
    P3_6 -->|Event list + gallery URLs| VISITOR
```

---

## Level 2 — Magazine PDF Export (Process 5.3)

```mermaid
flowchart TD
    USER((User))
    S3[(AWS S3)]
    DB[(MongoDB Magazines)]

    USER -->|Click Export PDF| P5_1[5.3.1\nCapture Page DOM]
    P5_1 -->|For each img slot URL| P5_2[5.3.2\nCORS Proxy\n/api/proxy/image]
    P5_2 -->|Fetch image from S3| S3
    S3 -->|Binary image data| P5_2
    P5_2 -->|base64 data URL| P5_1

    P5_1 -->|DOM clone + injected CSS| P5_3[5.3.3\nhtml2canvas\nRendering]
    P5_3 -->|Canvas per page| P5_4[5.3.4\njsPDF Assembly]
    P5_4 -->|addPage + addImage per canvas| P5_4
    P5_4 -->|.pdf blob| USER

    USER -->|Click Publish| P5_5[5.3.5\nGenerate Thumbnail]
    P5_5 -->|Capture page 1 canvas| P5_3
    P5_3 -->|Canvas| P5_5
    P5_5 -->|toBlob| P5_6[5.3.6\nUpload Thumbnail to S3]
    P5_6 -->|S3 URL| DB
    DB -->|Updated thumbnailUrl + status=published| DB
```

---

## Level 2 — Settings Propagation (Process 3.6 / Hero Mode)

```mermaid
flowchart TD
    ADMIN((Admin))
    ALLUSERS((All Users\nAny Device))
    DB[(MongoDB AppSettings)]
    LS[(localStorage\nper-browser)]

    ADMIN -->|Toggle hero mode| P3_6_1[3.6.1\nWrite to localStorage\n + PATCH /api/settings/desktopHeroMode]
    P3_6_1 -->|optimistic update| LS
    P3_6_1 -->|upsert { key, value }| DB

    ALLUSERS -->|Every 5 seconds: GET /api/settings/content| P3_6_2[3.6.2\nFetch Hero Setting\nvia useData poll]
    DB -->|{ desktopHeroMode: 'video'|'classic' }| P3_6_2
    P3_6_2 -->|heroSettingData changed| P3_6_3[3.6.3\nuseEffect: apply new mode]
    P3_6_3 -->|setDesktopHeroMode| ALLUSERS
    P3_6_3 -->|localStorage cache update| LS
```

---

## Data Dictionary

| Data Flow | Contents | Format |
|-----------|----------|--------|
| JWT Token | `{ userId, role, iat, exp }` | Signed JWT string |
| User Document | name, email, passwordHash, role, status, dept, years, photo, bio | BSON/JSON |
| Event Document | title, date, endDate, cover, gallery[], members[], status | BSON/JSON |
| Magazine Document | title, pages[], status, templateId, thumbnailUrl | BSON/JSON |
| Page Slot | imageUrl / text value, slotId, cropData | JSON embedded |
| AppSettings | `{ key, value, label, updatedBy }` | Key-value BSON |
| S3 Upload | multipart/form-data binary | HTTP multipart |
| S3 URL | `https://<bucket>.s3.<region>.amazonaws.com/<key>` | HTTPS URL string |
| Proxy Response | `data:<mime>;base64,<encoded>` | Data URL |
| PDF Blob | Binary PDF data | application/pdf |
