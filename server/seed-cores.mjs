/**
 * Core Committee seed / delete utility
 *
 * SEED  (add past & current core member entries):
 *   node server/seed-cores.mjs
 *
 * DELETE (remove all seeded entries):
 *   node server/seed-cores.mjs --delete
 *
 * All seeded entries have names prefixed "SeedCore" for easy identification.
 */

import mongoose  from 'mongoose'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../.env') })

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI
if (!MONGO_URI) { console.error('❌  MONGO_URI not found'); process.exit(1) }

const { default: CoreMember } = await import('./models/CoreMember.js')

await mongoose.connect(MONGO_URI)
console.log('✅  Connected to MongoDB\n')

// ─── DELETE MODE ──────────────────────────────────────────────────────────────
if (process.argv.includes('--delete')) {
  const result = await CoreMember.deleteMany({ name: /^SeedCore/ })
  console.log(`🗑️   Deleted ${result.deletedCount} seeded core member(s)`)
  await mongoose.disconnect()
  process.exit(0)
}

// ─── SEED MODE ────────────────────────────────────────────────────────────────
const existing = await CoreMember.countDocuments({ name: /^SeedCore/ })
if (existing > 0) {
  console.log(`⚠️   ${existing} seeded core members already exist.`)
  console.log('    Run with --delete first.\n')
  await mongoose.disconnect()
  process.exit(1)
}

const PAST_YEARS = ['2022-23', '2023-24', '2024-25', '2025-26']
const DESIG      = ['Core', 'Core', 'Core', 'Secretary', 'Treasurer']

const docs = []
let order  = 0

for (const year of PAST_YEARS) {
  for (let i = 0; i < 4; i++) {
    docs.push({
      name:        `SeedCore ${year} Member ${i + 1}`,
      year,
      designation: DESIG[i % DESIG.length],
      photoUrl:    '',   // no photo — will show initials placeholder
      s3Key:       '',
      order:       order++,
    })
  }
}

await CoreMember.insertMany(docs)

console.log(`✅  Inserted ${docs.length} seeded core members:`)
for (const y of PAST_YEARS) {
  console.log(`    ${y}: 4 members (Core, Core, Core, Secretary, Treasurer cycling)`)
}
console.log()
console.log('    These will all appear as "Past" (years 2022-23 through 2025-26).')
console.log('    To test "Current": add a "2026-27" entry manually via the admin panel,')
console.log('    or promote a user with endYear=2027 to core (auto-creates it).')
console.log()
console.log('    To delete: node server/seed-cores.mjs --delete')

await mongoose.disconnect()
