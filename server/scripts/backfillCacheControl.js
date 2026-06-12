// One-time backfill: add a long-lived Cache-Control header to all existing media
// objects in the S3 bucket, so browsers stop re-downloading videos/images on every
// refresh. New uploads already get this header (see utils/s3.js → putBuffer).
//
//   Run from the project root:  node server/scripts/backfillCacheControl.js
//
// It copies each object onto itself with MetadataDirective=REPLACE, which rewrites
// the headers while keeping the same key, content, and content-type.

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '..', '.env') })

const REGION = process.env.AWS_REGION || 'ap-south-1'
const BUCKET = process.env.S3_BUCKET_NAME
const CACHE  = 'public, max-age=31536000, immutable'
const MEDIA_RE = /\.(mp4|webm|mov|m4v|jpg|jpeg|png|webp|avif|gif)$/i

if (!BUCKET) { console.error('S3_BUCKET_NAME missing from .env'); process.exit(1) }

const s3 = new S3Client({
  region: REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
})

async function run() {
  let token, total = 0, updated = 0, skipped = 0
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
    for (const obj of list.Contents || []) {
      total++
      if (!MEDIA_RE.test(obj.Key)) { skipped++; continue }
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: obj.Key }))
        await s3.send(new CopyObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
          CopySource: `/${BUCKET}/${encodeURIComponent(obj.Key).replace(/%2F/g, '/')}`,
          MetadataDirective: 'REPLACE',
          ContentType: head.ContentType || 'application/octet-stream',
          CacheControl: CACHE,
        }))
        updated++
        console.log(`✓ ${obj.Key}`)
      } catch (e) {
        console.warn(`✗ ${obj.Key} — ${e.message}`)
      }
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (token)

  console.log(`\nDone. Scanned ${total}, updated ${updated}, skipped ${skipped} (non-media).`)
}

run().catch(e => { console.error(e); process.exit(1) })
