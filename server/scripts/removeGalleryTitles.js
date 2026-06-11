/**
 * IEM Photography Club — Gallery Title Cleanup
 *
 * One-time migration: the gallery "title" field was removed in favour of
 * photographer attribution + caption only. This unsets the orphaned `title`
 * field from every GalleryPhoto document so it is truly gone from the database.
 *
 * Run ONCE from terminal:
 *   cd server
 *   node scripts/removeGalleryTitles.js
 *
 * Reads MONGODB_URI from ../.env
 */
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })
import mongoose     from 'mongoose'
import GalleryPhoto from '../models/GalleryPhoto.js'

async function run() {
  const { MONGODB_URI } = process.env
  if (!MONGODB_URI) {
    console.error('❌  Missing MONGODB_URI in .env')
    process.exit(1)
  }

  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected')

  // Use the raw collection so the (now-removed) `title` field can still be matched/unset
  const result = await GalleryPhoto.collection.updateMany(
    { title: { $exists: true } },
    { $unset: { title: '' } }
  )

  console.log(`✅  Removed "title" from ${result.modifiedCount} gallery photo(s).`)
  await mongoose.disconnect()
}

run().catch(err => {
  console.error('❌  Error:', err.message)
  process.exit(1)
})
