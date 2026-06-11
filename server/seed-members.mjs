/**
 * Test member seed / delete utility
 * Run from project root:
 *
 *   node server/seed-members.mjs           → add 40 test members
 *   node server/seed-members.mjs --delete  → delete all seeded members
 */

import mongoose from 'mongoose'
import bcrypt   from 'bcryptjs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../.env') })

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI
if (!MONGO_URI) {
  console.error('❌  MONGO_URI not found in .env')
  process.exit(1)
}

const { default: User } = await import('./models/User.js')

await mongoose.connect(MONGO_URI)
console.log('✅  Connected to MongoDB\n')

// ─── DELETE MODE ──────────────────────────────────────────────────────────────
if (process.argv.includes('--delete')) {
  const result = await User.deleteMany({ email: /@seed\.test$/ })
  console.log(`🗑️   Deleted ${result.deletedCount} seeded test member(s)`)
  await mongoose.disconnect()
  process.exit(0)
}

// ─── SEED MODE ────────────────────────────────────────────────────────────────
const existing = await User.countDocuments({ email: /@seed\.test$/ })
if (existing > 0) {
  console.log(`⚠️   ${existing} seeded member(s) already exist.`)
  console.log('    Run with --delete first, then seed again.\n')
  await mongoose.disconnect()
  process.exit(1)
}

const hashedPw = await bcrypt.hash('TestPass@123', 12)
const yr = new Date().getFullYear()

const DEPTS = ['BTECH', 'BTECH', 'BTECH', 'BTECH', 'MBA', 'MTECH', 'BCA']

function roleFor(i) {
  if (i < 3)  return 'core'
  if (i < 10) return 'coordinator'
  return 'photographer'
}

const docs = Array.from({ length: 40 }, (_, i) => ({
  name:             `Seed Member ${String(i + 1).padStart(2, '0')}`,
  email:            `seed${String(i + 1).padStart(2, '0')}@seed.test`,
  password:         hashedPw,
  enrollmentNumber: `SEED${String(i + 1).padStart(6, '0')}`,
  rollNumber:       `S${String(i + 1).padStart(4, '0')}`,
  department:       DEPTS[i % DEPTS.length],
  startYear:        yr - 4 + (i % 3),
  endYear:          yr     + (i % 3),   // yr, yr+1, yr+2 — all active
  role:             roleFor(i),
  status:           'approved',
}))

await User.insertMany(docs)

const byRole = docs.reduce((a, d) => { a[d.role] = (a[d.role]||0)+1; return a }, {})
console.log('✅  Inserted 40 test members:')
console.log(`    Core:         ${byRole.core}`)
console.log(`    Coordinator:  ${byRole.coordinator}`)
console.log(`    Photographer: ${byRole.photographer}`)
console.log()
console.log('    Graduating years:', [...new Set(docs.map(d=>d.endYear))].sort().join(', '))
console.log('    Password for all: TestPass@123')
console.log('    Email range:      seed01@seed.test … seed40@seed.test')
console.log()
console.log('    To delete: node server/seed-members.mjs --delete')

await mongoose.disconnect()
