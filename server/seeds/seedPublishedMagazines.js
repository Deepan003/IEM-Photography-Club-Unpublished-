import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import mongoose from 'mongoose'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dir, '..', '..', '.env') })

import Magazine from '../models/Magazine.js'
import User from '../models/User.js'

const MAGAZINES = [
  { name: 'Aperture Vol. 1',      templateId: 'pb-01' },
  { name: 'Golden Hour',          templateId: 'rv-01' },
  { name: 'Shadow & Light',       templateId: 'de-01' },
  { name: 'Frame & Focus',        templateId: 'mb-01' },
  { name: 'Cobalt Dreams',        templateId: 'cb-02' },
  { name: 'Smoke & Mirrors',      templateId: 'fn-01' },
  { name: 'Urban Lens',           templateId: 'pb-02' },
  { name: 'Sepia Stories',        templateId: 'rv-02' },
  { name: 'Eclipse Edition',      templateId: 'de-02' },
  { name: 'Studio White',         templateId: 'mb-02' },
  { name: 'Scarlet Frame',        templateId: 'cb-04' },
  { name: 'Detective\'s Eye',     templateId: 'fn-02' },
  { name: 'Portrait Collection',  templateId: 'pb-03' },
  { name: 'Vintage Press',        templateId: 'rv-03' },
  { name: 'Midnight Blue',        templateId: 'de-03' },
  { name: 'Editorial Serif',      templateId: 'mb-03' },
  { name: 'Emerald Shots',        templateId: 'cb-03' },
  { name: 'Nature Journal',       templateId: 'pb-04' },
  { name: 'Film Roll',            templateId: 'rv-04' },
  { name: 'Phantom Issue',        templateId: 'de-04' },
  { name: 'Paper Thin',           templateId: 'mb-04' },
  { name: 'Citrus Burst',         templateId: 'cb-05' },
  { name: 'Minimalist Study',     templateId: 'pb-05' },
  { name: 'Postcard Edition',     templateId: 'rv-05' },
]

const NAMES = MAGAZINES.map(m => m.name)

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌  MONGODB_URI not found in .env')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅  MongoDB connected')

  if (process.argv.includes('--delete')) {
    const r = await Magazine.deleteMany({ name: { $in: NAMES } })
    console.log(`🗑️  Deleted ${r.deletedCount} published seed magazines`)
    await mongoose.disconnect()
    return
  }

  // Resolve user — prefer --userId=<id> arg, else first admin, else first user
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

  const docs = MAGAZINES.map(({ name, templateId }) => ({
    user:        userId,
    name,
    templateId,
    pages:       [],
    draftPages:  [],
    status:      'published',
    slot:        1,
    publishedAt: new Date(),
  }))

  const created = await Magazine.insertMany(docs)
  console.log(`📚  Created ${created.length} published magazines`)
  created.forEach(m => console.log(`   • ${m.name} [${m.templateId}]`))

  await mongoose.disconnect()
  console.log('👋  Done')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
