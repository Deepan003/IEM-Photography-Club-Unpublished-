import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '..', '.env') })

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.S3_BUCKET_NAME
const BASE   = process.env.S3_PUBLIC_URL

async function upload(localPath, s3Key) {
  console.log(`Uploading ${localPath} → s3://${BUCKET}/${s3Key} …`)
  const body = readFileSync(localPath)
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         s3Key,
    Body:        body,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000',
  }))
  console.log(`  ✅  Done → ${BASE}/${s3Key}`)
}

const root = resolve(__dir, '..', '..')

// video.mp4  → used for mobile hero
await upload(resolve(root, 'video.mp4'), 'videos/hero-mobile.mp4')

// Winds_blowing… → used as desktop landscape hero
// (the code references "video landscape.mp4" — we rename it cleanly on S3)
const landscape = resolve(root, 'Winds_blowing_through_pine_trees_202606110917.mp4')
await upload(landscape, 'videos/hero-desktop.mp4')

console.log('\nUpdate MainPage.jsx src attributes to:')
console.log(`  Mobile:  ${BASE}/videos/hero-mobile.mp4`)
console.log(`  Desktop: ${BASE}/videos/hero-desktop.mp4`)
