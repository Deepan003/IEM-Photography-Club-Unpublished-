import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import mongoose from 'mongoose'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '..', '.env') })

import Magazine from '../models/Magazine.js'
import User from '../models/User.js'

const TEMPLATE_IDS = [
  'pb-01', 'pb-02', 'pb-03', 'pb-04', 'pb-05',
  'de-01', 'de-02', 'de-03', 'de-04', 'de-05',
  'mb-01', 'mb-02', 'mb-03', 'mb-04', 'mb-05',
  'rv-01', 'rv-02', 'rv-03', 'rv-04', 'rv-05',
  'cb-01', 'cb-02', 'cb-03', 'cb-04',
]

const COUNT = 24

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌  MONGODB_URI not found in .env')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅  MongoDB connected')

  if (process.argv.includes('--delete')) {
    const r = await Magazine.deleteMany({ status: 'draft', name: '', 'pages.0': { $exists: false }, 'draftPages.0': { $exists: false } })
    console.log(`🗑️  Deleted ${r.deletedCount} empty draft magazines`)
    await mongoose.disconnect()
    return
  }

  // Resolve user — prefer --userId=<id> arg, else pick first admin, else first user
  const userArg = process.argv.find(a => a.startsWith('--userId='))
  let userId

  if (userArg) {
    userId = userArg.split('=')[1].trim()
    console.log(`👤  Using provided userId: ${userId}`)
  } else {
    const adminUser = await User.findOne({ role: 'admin' }).select('_id name').lean()
    if (!adminUser) {
      const anyUser = await User.findOne().select('_id name').lean()
      if (!anyUser) {
        console.error('❌  No users found in database. Create a user first.')
        await mongoose.disconnect()
        process.exit(1)
      }
      userId = anyUser._id
      console.log(`👤  Using first user found: ${anyUser.name} (${anyUser._id})`)
    } else {
      userId = adminUser._id
      console.log(`👤  Using admin user: ${adminUser.name} (${adminUser._id})`)
    }
  }

  const docs = Array.from({ length: COUNT }, (_, i) => ({
    user:       userId,
    name:       '',
    templateId: TEMPLATE_IDS[i % TEMPLATE_IDS.length],
    pages:      [],
    draftPages: [],
    status:     'draft',
    slot:       1,
  }))

  const created = await Magazine.insertMany(docs)
  console.log(`📚  Created ${created.length} empty magazines`)

  await mongoose.disconnect()
  console.log('👋  Done')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
