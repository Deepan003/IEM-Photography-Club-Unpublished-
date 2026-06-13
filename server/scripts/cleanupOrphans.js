import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import mongoose from 'mongoose'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '..', '.env') })

import GalleryPhoto from '../models/GalleryPhoto.js'
import Event        from '../models/Event.js'
import Competition  from '../models/Competition.js'
import User         from '../models/User.js'
import { deleteObject } from '../utils/s3.js'

const DRY_RUN = process.argv.includes('--dry-run')

let deleted = 0
let freed   = 0

async function del(key) {
  if (!key) return
  if (!DRY_RUN) await deleteObject(key).catch(() => {})
  freed++
}

// ── 1. Event gallery photos whose event no longer exists ─────────────────────
async function cleanOrphanEventPhotos() {
  const eventPhotos = await GalleryPhoto.find({ type: 'event', event: { $ne: null } }).lean()
  if (!eventPhotos.length) { console.log('  ✅ No event gallery photos found'); return }

  const eventIds = [...new Set(eventPhotos.map(p => p.event.toString()))]
  const existingEvents = await Event.find({ _id: { $in: eventIds } }).select('_id').lean()
  const existingSet = new Set(existingEvents.map(e => e._id.toString()))

  const orphans = eventPhotos.filter(p => !existingSet.has(p.event.toString()))
  console.log(`  Found ${orphans.length} orphaned event gallery photo(s) (event deleted without gallery cleanup)`)

  for (const p of orphans) {
    console.log(`    🗑️  GalleryPhoto ${p._id} (event: ${p.event})`)
    await del(p.s3Key)
    await del(p.mobileS3Key)
    if (!DRY_RUN) await GalleryPhoto.deleteOne({ _id: p._id })
    deleted++
  }
}

// ── 2. Competition submissions whose user no longer exists ────────────────────
async function cleanOrphanSubmissions() {
  const comps = await Competition.find({ 'submissions.0': { $exists: true } })
  let totalRemoved = 0

  for (const comp of comps) {
    const userIds = [...new Set(comp.submissions.map(s => s.user?.toString()).filter(Boolean))]
    const existingUsers = await User.find({ _id: { $in: userIds } }).select('_id').lean()
    const existingSet = new Set(existingUsers.map(u => u._id.toString()))

    const orphanSubs = comp.submissions.filter(s => s.user && !existingSet.has(s.user.toString()))
    if (!orphanSubs.length) continue

    console.log(`  Competition "${comp.name}" — ${orphanSubs.length} orphaned submission(s)`)
    for (const s of orphanSubs) {
      console.log(`    🗑️  Submission by user ${s.user} — s3Key: ${s.s3Key || 'none'}`)
      await del(s.s3Key)
      totalRemoved++
      freed += s.s3Key ? 0 : 0 // already counted in del()
    }

    if (!DRY_RUN) {
      const orphanUserIds = orphanSubs.map(s => s.user)
      await Competition.updateOne(
        { _id: comp._id },
        { $pull: { submissions: { user: { $in: orphanUserIds } } } }
      )
    }
    deleted += orphanSubs.length
  }

  if (!totalRemoved) console.log('  ✅ No orphaned competition submissions found')
}

// ── 3. GalleryPhoto addedBy pointing at deleted users ────────────────────────
async function cleanStaleAddedBy() {
  const photos = await GalleryPhoto.find({ addedBy: { $ne: null } }).select('addedBy').lean()
  if (!photos.length) { console.log('  ✅ No club gallery photos with addedBy found'); return }

  const userIds = [...new Set(photos.map(p => p.addedBy.toString()))]
  const existingUsers = await User.find({ _id: { $in: userIds } }).select('_id').lean()
  const existingSet = new Set(existingUsers.map(u => u._id.toString()))

  const staleIds = userIds.filter(id => !existingSet.has(id))
  if (!staleIds.length) { console.log('  ✅ All addedBy references are valid'); return }

  console.log(`  Found ${staleIds.length} deleted user(s) still referenced in GalleryPhoto.addedBy`)
  if (!DRY_RUN) {
    const r = await GalleryPhoto.updateMany(
      { addedBy: { $in: staleIds } },
      { $unset: { addedBy: 1 }, $set: { 'photographer.userId': null } }
    )
    console.log(`    ✏️  Nullified addedBy on ${r.modifiedCount} photo(s) (photos kept)`)
  } else {
    const count = await GalleryPhoto.countDocuments({ addedBy: { $in: staleIds } })
    console.log(`    [DRY RUN] Would nullify addedBy on ${count} photo(s)`)
  }
}

// ── 4. Competition winner/judge photos for non-existent competitions ──────────
// (only relevant if a competition was manually removed from DB without deleting S3)
// We cannot enumerate S3 without listing the entire bucket, so we skip that here.
// The new delete route handles this going forward.

async function main() {
  if (!process.env.MONGODB_URI) { console.error('❌  MONGODB_URI not set'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅  MongoDB connected')
  if (DRY_RUN) console.log('ℹ️   DRY RUN — no changes will be made\n')

  console.log('\n[1] Orphaned event gallery photos')
  await cleanOrphanEventPhotos()

  console.log('\n[2] Orphaned competition submissions')
  await cleanOrphanSubmissions()

  console.log('\n[3] Stale addedBy references in club gallery')
  await cleanStaleAddedBy()

  console.log(`\n─────────────────────────────────────────`)
  console.log(`  S3 objects deleted : ${freed}`)
  console.log(`  DB records removed : ${deleted}`)
  if (DRY_RUN) console.log('  (dry run — nothing was actually changed)')
  console.log('─────────────────────────────────────────')

  await mongoose.disconnect()
  console.log('👋  Done')
}

main().catch(err => {
  console.error('❌  Cleanup failed:', err.message)
  process.exit(1)
})
