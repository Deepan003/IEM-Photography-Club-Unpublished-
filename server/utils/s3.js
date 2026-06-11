import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID }   from 'crypto'

// ── Lazy S3 client ────────────────────────────────────────────────────────────
// Do NOT create at module load time — same ES-module hoisting issue as email.js.
// By the time any exported function is called, dotenv has already run.
function getClient() {
  const id     = process.env.AWS_ACCESS_KEY_ID
  const secret = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || 'ap-south-1'

  if (!id || !secret) {
    throw new Error(
      'AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing from .env — ' +
      'check that dotenv loaded the file and the keys are correct.'
    )
  }

  return new S3Client({
    region,
    credentials: { accessKeyId: id, secretAccessKey: secret },
  })
}

const BUCKET = () => {
  const b = process.env.S3_BUCKET_NAME
  if (!b) throw new Error('S3_BUCKET_NAME is missing from .env')
  return b
}

// ── Presigned PUT URL ─────────────────────────────────────────────────────────
export async function getPresignedUploadUrl(folder = 'uploads', originalName, contentType) {
  if (!originalName) throw new Error('originalName is required')

  const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const key  = `${folder}/${randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    ContentType: contentType || 'image/jpeg',
    // ACL omitted — use bucket policy for public read access
  })

  const url = await getSignedUrl(getClient(), command, { expiresIn: 300 })
  return { url, key, publicUrl: getPublicUrl(key) }
}

// ── Public URL ────────────────────────────────────────────────────────────────
// Bucket is public-read — serve images directly from S3 (no Express proxy).
// Priority: S3_PUBLIC_URL env var → auto-constructed virtual-hosted URL → proxy fallback.
export function getPublicUrl(key) {
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  }
  const bucket = process.env.S3_BUCKET_NAME
  const region = process.env.AWS_REGION || 'ap-south-1'
  if (bucket) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  }
  // Fallback: proxy through Express (bucket not configured yet)
  return `/api/media/${key}`
}

// ── Upload a Buffer directly from the server (no browser CORS needed) ────────
export async function putBuffer(key, buffer, contentType) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  await getClient().send(new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        buffer,
    ContentType: contentType || 'image/jpeg',
  }))
  return { key, publicUrl: getPublicUrl(key) }
}

// ── Delete object ─────────────────────────────────────────────────────────────
export async function deleteObject(key) {
  if (!key) return
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }))
  } catch (e) {
    // Silently ignore missing objects
    if (e.name !== 'NoSuchKey') console.warn('[s3.deleteObject]', e.message)
  }
}
