/**
 * Test member seed / delete utility
 *
 * SEED  (add 40 fake members):
 *   node scripts/seed-members.mjs
 *
 * DELETE (remove all seeded members):
 *   node scripts/seed-members.mjs --delete
 *
 * All seeded accounts use email pattern: seedXX@seed.test
 * This makes them trivially identifiable and safe to bulk-delete.
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

// Import User model (ES module)
const { default: User } = await import('../server/models/User.js')

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
// Check for existing seeds to avoid duplicate-key errors
const existing = await User.countDocuments({ email: /@seed\.test$/ })
if (existing > 0) {
  console.log(`⚠️   ${existing} seeded members already exist.`)
  console.log('    Run with --delete first, then seed again.\n')
  await mongoose.disconnect()
  process.exit(1)
}

// Pre-hash password once (insertMany skips pre-save hooks)
const hashedPw = await bcrypt.hash('TestPass@123', 12)

const yr = new Date().getFullYear()

// Departments (valid enum values from User model)
const DEPTS = ['BTECH', 'BTECH', 'BTECH', 'BTECH', 'MBA', 'MTECH', 'BCA']

// Role distribution across 40 members
// Index 0-2  → core        (3 core)
// Index 3-9  → coordinator (7 coordinators)
// Index 10+  → photographer (30 photographers)
function roleFor(i) {
  if (i < 3)  return 'core'
  if (i < 10) return 'coordinator'
  return 'photographer'
}

// Senior students (lower endYear) first — mirrors the app's sort order
// endYear spread: yr, yr+1, yr+2 cycling
function endYearFor(i) {
  return yr + (i % 3)      // yr, yr+1, yr+2 — all still "active" (>= currentYear)
}
function startYearFor(i) {
  return endYearFor(i) - 4  // 4-year programme
}

const docs = Array.from({ length: 40 }, (_, i) => ({
  name:             `Seed Member ${String(i + 1).padStart(2, '0')}`,
  email:            `seed${String(i + 1).padStart(2, '0')}@seed.test`,
  password:         hashedPw,
  enrollmentNumber: `SEED${String(i + 1).padStart(6, '0')}`,
  rollNumber:       `S${String(i + 1).padStart(4, '0')}`,
  department:       DEPTS[i % DEPTS.length],
  startYear:        startYearFor(i),
  endYear:          endYearFor(i),
  role:             roleFor(i),
  status:           'approved',
}))

await User.insertMany(docs)

// Summary
const byRole = docs.reduce((acc, d) => { acc[d.role] = (acc[d.role] || 0) + 1; return acc }, {})
console.log(`✅  Inserted 40 test members:`)
console.log(`    Core:          ${byRole.core}`)
console.log(`    Coordinator:   ${byRole.coordinator}`)
console.log(`    Photographer:  ${byRole.photographer}`)
console.log()
console.log('    Graduating years:', [...new Set(docs.map(d => d.endYear))].sort().join(', '))
console.log('    (seniors with lowest endYear will appear first in the app)')
console.log()
console.log('    Password for all:  TestPass@123')
console.log('    Email pattern:     seed01@seed.test … seed40@seed.test')
console.log()
console.log('    To delete:  node scripts/seed-members.mjs --delete')

await mongoose.disconnect()
