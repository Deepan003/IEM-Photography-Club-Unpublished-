# Deployment & DevOps Guide
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Covers:** Environment Setup, Vercel Deployment, Render Deployment, AWS S3, MongoDB Atlas, CI/CD

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| Git | 2.x | Version control |
| MongoDB Atlas account | — | Hosted database |
| AWS account | — | S3 media storage |
| Vercel account | — | Frontend + serverless API hosting |

---

## 2. Environment Variables

Create a `.env` file in the **project root** (never commit this file — it is in `.gitignore`).

```env
# ─── Server ───────────────────────────────────────────
PORT=3001
NODE_ENV=development

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_byte_random_secret_here

# ─── MongoDB ──────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/iempc?retryWrites=true&w=majority

# ─── AWS S3 ───────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_BUCKET_NAME=iem-photography-club

# ─── Email (Nodemailer / Gmail App Password) ──────────
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=IEM Photography Club <your_email@gmail.com>

# ─── Frontend (Vite) ─────────────────────────────────
VITE_API_URL=http://localhost:3001/api
```

**For production** (`NODE_ENV=production`), set all these in your hosting platform's environment settings — never in files.

---

## 3. Local Development

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/iem-photography-club.git
cd iem-photography-club

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server && npm install && cd ..

# 4. Set up environment
cp .env.example .env
# Edit .env with your actual values

# 5. Create initial admin user (one-time setup)
cd server && node scripts/createAdmin.js && cd ..

# 6. Start both frontend and backend
npm run dev
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001/api
```

**Concurrent dev script** (`package.json`):
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "cd server && nodemon index.js",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server/index.js"
  }
}
```

---

## 4. AWS S3 Setup

### 4.1 Bucket Creation

1. Create a bucket in AWS Console, region `ap-south-1` (or your preference)
2. **Block Public Access**: Uncheck "Block all public access" → confirm
3. Add bucket policy for public read:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::iem-photography-club/*"
  }]
}
```

### 4.2 CORS Configuration

In S3 → Permissions → CORS:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
  "AllowedOrigins": [
    "http://localhost:5173",
    "https://your-production-domain.com"
  ],
  "ExposeHeaders": ["ETag"]
}]
```

### 4.3 IAM User

Create a dedicated IAM user with this policy (least-privilege):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::iem-photography-club",
      "arn:aws:s3:::iem-photography-club/*"
    ]
  }]
}
```

Generate Access Key ID and Secret — use these in `.env`.

### 4.4 Media Caching (videos & images)

Hero/theme videos are large and must not be re-downloaded on every page load. Caching is handled at the HTTP layer (correct for video **Range** requests — a JS/blob cache is not):

- **New uploads** automatically get `Cache-Control: public, max-age=31536000, immutable` (set in `server/utils/s3.js → putBuffer`). Object keys are random UUIDs, so caching them forever is safe.
- **Existing objects** (default hero videos + pre-existing theme videos) lack the header. Backfill them once:

  ```bash
  node server/scripts/backfillCacheControl.js
  ```

  The script lists every media object and rewrites its headers in place (`CopyObject` with `MetadataDirective=REPLACE`), preserving key, body, and content-type.

- **Frontend** loads only the viewport-appropriate hero video (16:9 on desktop, 9:16 on mobile) and reveals it on `onLoadedData` (first decoded frame) to avoid a black flash.

> ⚠️ **Dev tip:** Chrome DevTools → Network → **"Disable cache"** bypasses the HTTP cache (and service-worker caches) while DevTools is open, making media appear to re-download every refresh. Uncheck it when verifying cache behaviour.

**CDN (optional, recommended at scale):** Front the bucket with CloudFront for edge caching + faster global delivery; the `immutable` headers above carry through.

---

## 5. MongoDB Atlas Setup

1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Database Access**: Create user with `readWriteAnyDatabase` role
3. **Network Access**: Add `0.0.0.0/0` (allow all IPs) — or restrict to your server IP in production
4. Copy the connection string → set as `MONGODB_URI` in `.env`
5. The app auto-creates collections via Mongoose on first request — no manual schema migration needed

---

## 6. Deployment on Vercel (Recommended)

Vercel can host both the React frontend (static) and the Express API (serverless functions) from one repository.

### 6.1 vercel.json

```json
{
  "version": 2,
  "builds": [
    { "src": "server/index.js", "use": "@vercel/node" },
    { "src": "package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "server/index.js" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### 6.2 Deploy Steps

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy (first time — interactive setup)
vercel

# 4. Set environment variables
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add AWS_REGION production
vercel env add AWS_BUCKET_NAME production
vercel env add EMAIL_USER production
vercel env add EMAIL_PASS production
vercel env add EMAIL_FROM production

# 5. Deploy to production
vercel --prod
```

### 6.3 Automatic Deploys

In Vercel dashboard → Project Settings → Git:
- Connect your GitHub repository
- Set production branch to `main`
- Every push to `main` auto-deploys

---

## 7. Deployment on Render (Alternative)

### 7.1 Backend (Web Service)

1. New → Web Service → connect GitHub repo
2. **Build command:** `cd server && npm install`
3. **Start command:** `node server/index.js`
4. **Environment:** Add all `.env` variables
5. Set `PORT=3001` (or use `process.env.PORT`)

### 7.2 Frontend (Static Site)

1. New → Static Site → connect same GitHub repo
2. **Build command:** `npm install && npm run build`
3. **Publish directory:** `dist`
4. **Rewrite rule:** `/* → /index.html` (for client-side routing)
5. Set env: `VITE_API_URL=https://your-backend.onrender.com/api`

---

## 8. Environment-Specific Config

### 8.1 Vite Environment Handling

```js
// vite.config.js
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react': ['react', 'react-dom'],
          'admin': ['src/pages/admin/AdminDashboard.jsx'],
          'magazine': ['src/components/magazine/MagazineTab.jsx'],
          // ...
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'  // Only in dev
    }
  }
})
```

### 8.2 CORS Config (server/index.js)

```js
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,  // Set to production domain in env
].filter(Boolean)

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))
```

---

## 9. CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml` for automated deployment:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**GitHub Secrets required:**
- `VERCEL_TOKEN` — from Vercel Account Settings → Tokens
- `VERCEL_ORG_ID` — from `.vercel/project.json` after first `vercel` deploy
- `VERCEL_PROJECT_ID` — from `.vercel/project.json`
- `VITE_API_URL` — production API base URL

---

## 10. Post-Deployment Checklist

After every production deploy, verify:

- [ ] Homepage loads correctly
- [ ] Login and token issuance works
- [ ] Image upload to S3 succeeds
- [ ] Magazine PDF export generates correctly (CORS proxy working)
- [ ] Admin panel accessible for admin user
- [ ] Hero mode toggle propagates to non-admin browser within 5s
- [ ] Email notifications sent on member approval
- [ ] MongoDB Atlas shows recent connections (not blocked)

---

## 11. Monitoring & Maintenance

| Task | Frequency | Tool |
|------|-----------|------|
| Check Vercel deploy logs | After each deploy | Vercel dashboard |
| Monitor MongoDB Atlas metrics | Weekly | Atlas dashboard |
| Rotate JWT secret | Every 6 months | Update Vercel env var |
| Rotate AWS access keys | Every 6 months | IAM console |
| Review S3 storage usage | Monthly | AWS billing dashboard |
| Check rate limit logs | If traffic spikes | Server logs / Vercel functions |

---

## 12. Rollback Procedure

**Vercel rollback** (instant, zero downtime):
```bash
# List recent deployments
vercel ls

# Roll back to a specific deployment
vercel rollback <deployment-id>
```

Or via Vercel dashboard → Deployments → click any previous deployment → "Promote to Production".

**Database rollback:**
MongoDB Atlas supports point-in-time restore on M10+ clusters. For free M0 clusters, maintain regular exports:
```bash
mongodump --uri="$MONGODB_URI" --out=./backups/$(date +%Y%m%d)
```
