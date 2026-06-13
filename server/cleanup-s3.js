/**
 * cleanup-s3.js
 * Deletes S3 objects that are no longer referenced in MongoDB.
 * Keeps: every s3Key in any DB record + their _mobile.jpg counterparts.
 *
 * Requires s3:ListBucket + s3:DeleteObject permissions on the IAM user.
 * Run from server/: node cleanup-s3.js
 */

import { config }        from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
const __dir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '../.env') })
config({ path: resolve(__dir, '.env') })

import mongoose from 'mongoose'
import {
  S3Client, ListObjectsV2Command, DeleteObjectsCommand,
} from '@aws-sdk/client-s3'

// ── Lightweight schemas ───────────────────────────────────────────────────────
const loose = { strict: false, timestamps: false }
const GalleryPhoto = mongoose.model('GalleryPhoto', new mongoose.Schema({ s3Key: String, mobileS3Key: String }, loose))
const CoreMember   = mongoose.model('CoreMember',   new mongoose.Schema({
  s3Key: String, coverPhotoS3Key: String,
  gallery: [new mongoose.Schema({ s3Key: String, mobileKey: String }, loose)],
}, loose))
const User = mongoose.model('User', new mongoose.Schema({
  profilePhotoS3Key: String, coverPhotoS3Key: String,
  gallery: [new mongoose.Schema({ s3Key: String, mobileKey: String }, loose)],
}, loose))
const Competition = mongoose.model('Competition', new mongoose.Schema({
  bannerS3Key: String, competitionBannerS3Key: String,
  gallery: [new mongoose.Schema({ s3Key: String, mobileKey: String }, loose)],
  winners:  [new mongoose.Schema({ photoS3Key: String, winningPhotoS3Key: String }, loose)],
  judges:   [new mongoose.Schema({ s3Key: String }, loose)],
}, loose))
const Activity = mongoose.model('Activity', new mongoose.Schema({
  bannerS3Key: String, activityBannerS3Key: String,
  gallery: [new mongoose.Schema({ s3Key: String, mobileKey: String }, loose)],
}, loose))
const Event = mongoose.model('Event', new mongoose.Schema({
  bannerS3Key: String, eventBannerS3Key: String,
}, loose))
const PostcardSection = mongoose.model('PostcardSection', new mongoose.Schema({ s3Key: String }, loose))
const Magazine        = mongoose.model('Magazine',        new mongoose.Schema({ s3Key: String, thumbnailS3Key: String }, loose))

// ── S3 ────────────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})
const BUCKET = process.env.S3_BUCKET_NAME

// ── Collect all keys referenced in MongoDB ────────────────────────────────────
async function collectUsedKeys() {
  const used = new Set()
  const add  = (k) => { if (k) used.add(k) }

  // GalleryPhoto
  const gp = await GalleryPhoto.find({}).lean()
  gp.forEach(p => { add(p.s3Key); add(p.mobileS3Key) })

  // CoreMember
  const cm = await CoreMember.find({}).lean()
  cm.forEach(m => {
    add(m.s3Key); add(m.coverPhotoS3Key)
    ;(m.gallery || []).forEach(p => { add(p.s3Key); add(p.mobileKey) })
  })

  // User
  const users = await User.find({}).lean()
  users.forEach(u => {
    add(u.profilePhotoS3Key); add(u.coverPhotoS3Key)
    ;(u.gallery || []).forEach(p => { add(p.s3Key); add(p.mobileKey) })
  })

  // Competition
  const comps = await Competition.find({}).lean()
  comps.forEach(c => {
    add(c.bannerS3Key); add(c.competitionBannerS3Key)
    ;(c.gallery || []).forEach(p => { add(p.s3Key); add(p.mobileKey) })
    ;(c.winners || []).forEach(w => { add(w.photoS3Key); add(w.winningPhotoS3Key) })
    ;(c.judges  || []).forEach(j => add(j.s3Key))
  })

  // Activity
  const acts = await Activity.find({}).lean()
  acts.forEach(a => {
    add(a.bannerS3Key); add(a.activityBannerS3Key)
    ;(a.gallery || []).forEach(p => { add(p.s3Key); add(p.mobileKey) })
  })

  // Event banners
  const evs = await Event.find({}).lean()
  evs.forEach(e => { add(e.bannerS3Key); add(e.eventBannerS3Key) })

  // Postcards
  const pcs = await PostcardSection.find({}).lean()
  pcs.forEach(p => add(p.s3Key))

  // Magazines
  const mags = await Magazine.find({}).lean()
  mags.forEach(m => { add(m.s3Key); add(m.thumbnailS3Key) })

  used.delete(undefined); used.delete(null); used.delete('')
  return used
}

// ── List all S3 objects ───────────────────────────────────────────────────────
async function listAll() {
  const keys = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
    for (const obj of res.Contents || []) keys.push({ key: obj.Key, size: obj.Size })
    token = res.NextContinuationToken
  } while (token)
  return keys
}

// ── Delete in batches of 1000 (S3 limit) ────────────────────────────────────
async function deleteKeys(keys) {
  const batch = keys.map(k => ({ Key: k }))
  for (let i = 0; i < batch.length; i += 1000) {
    const chunk = batch.slice(i, i + 1000)
    const res = await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: chunk, Quiet: false },
    }))
    if (res.Errors?.length) {
      res.Errors.forEach(e => console.error(`  Delete error: ${e.Key} — ${e.Message}`))
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || process.env.MONGO_URL
  if (!mongoUri) { console.error('No MongoDB URI found in .env'); process.exit(1) }
  if (!BUCKET)   { console.error('S3_BUCKET_NAME missing in .env'); process.exit(1) }

  // ── dry-run flag ──────────────────────────────────────────────────────────
  const DRY = process.argv.includes('--dry-run')
  if (DRY) console.log('DRY RUN — nothing will be deleted.\n')

  console.log('Connecting to MongoDB...')
  await mongoose.connect(mongoUri)
  console.log('Connected.\n')

  console.log('Collecting used S3 keys from MongoDB...')
  const used = await collectUsedKeys()
  console.log(`${used.size} keys referenced in DB.\n`)

  console.log('Listing S3 objects...')
  let all
  try {
    all = await listAll()
  } catch (err) {
    if (err.name === 'AccessDenied' || err.Code === 'AccessDenied') {
      console.error('\n⚠️  s3:ListBucket permission denied.')
      console.error('   Add "s3:ListBucket" to the IAM user policy in AWS console, then re-run.\n')
      console.error(`   Keys in DB (these are safe): ${used.size}`)
    } else {
      console.error('S3 list failed:', err.message)
    }
    await mongoose.disconnect(); process.exit(1)
  }

  console.log(`${all.length} objects in S3.\n`)

  // Partition into keep / delete
  const toDelete  = all.filter(o => !used.has(o.key))
  const totalSize = toDelete.reduce((s, o) => s + o.size, 0)

  console.log(`── Keep   : ${all.length - toDelete.length} objects`)
  console.log(`── Delete : ${toDelete.length} objects  (${(totalSize / 1024 / 1024).toFixed(1)} MB freed)`)

  if (!toDelete.length) {
    console.log('\nNothing to delete — S3 is clean.')
    await mongoose.disconnect(); return
  }

  console.log('\nOrphaned objects to delete:')
  toDelete.forEach(o => console.log(`  ${o.key}  (${Math.round(o.size / 1024)} KB)`))

  if (DRY) {
    console.log('\nDry run done — re-run without --dry-run to actually delete.')
    await mongoose.disconnect(); return
  }

  console.log('\nDeleting...')
  await deleteKeys(toDelete.map(o => o.key))
  console.log('Done.')

  await mongoose.disconnect()
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1) })
