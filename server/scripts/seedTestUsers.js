/**
 * IEM Photography Club — Test Users Seed Script
 *
 * Creates 16 test accounts (4 per college year) for handing out to users during demos.
 * Run from the project root:
 *   node server/scripts/seedTestUsers.js
 *
 * Existing test accounts with the same email are left untouched (idempotent).
 */

import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })

import mongoose from 'mongoose'
import User     from '../models/User.js'

// ── Test user definitions ──────────────────────────────────────────────────
// Format: year X = college year (1st–4th), slot = 1–4
// startYear / endYear reflect the 2025-26 academic cycle for a 4-year BTECH.
const TEST_USERS = [
  // ── 1st Year (2025 batch) ──────────────────────────────────────────────
  { name:'Test User 1.1', email:'testuser1.1@iempc.test', password:'testuser1.1', startYear:2025, endYear:2029, enroll:'TU-1-01', roll:'TU101' },
  { name:'Test User 1.2', email:'testuser1.2@iempc.test', password:'testuser1.2', startYear:2025, endYear:2029, enroll:'TU-1-02', roll:'TU102' },
  { name:'Test User 1.3', email:'testuser1.3@iempc.test', password:'testuser1.3', startYear:2025, endYear:2029, enroll:'TU-1-03', roll:'TU103' },
  { name:'Test User 1.4', email:'testuser1.4@iempc.test', password:'testuser1.4', startYear:2025, endYear:2029, enroll:'TU-1-04', roll:'TU104' },

  // ── 2nd Year (2024 batch) ──────────────────────────────────────────────
  { name:'Test User 2.1', email:'testuser2.1@iempc.test', password:'testuser2.1', startYear:2024, endYear:2028, enroll:'TU-2-01', roll:'TU201' },
  { name:'Test User 2.2', email:'testuser2.2@iempc.test', password:'testuser2.2', startYear:2024, endYear:2028, enroll:'TU-2-02', roll:'TU202' },
  { name:'Test User 2.3', email:'testuser2.3@iempc.test', password:'testuser2.3', startYear:2024, endYear:2028, enroll:'TU-2-03', roll:'TU203' },
  { name:'Test User 2.4', email:'testuser2.4@iempc.test', password:'testuser2.4', startYear:2024, endYear:2028, enroll:'TU-2-04', roll:'TU204' },

  // ── 3rd Year (2023 batch) ──────────────────────────────────────────────
  { name:'Test User 3.1', email:'testuser3.1@iempc.test', password:'testuser3.1', startYear:2023, endYear:2027, enroll:'TU-3-01', roll:'TU301' },
  { name:'Test User 3.2', email:'testuser3.2@iempc.test', password:'testuser3.2', startYear:2023, endYear:2027, enroll:'TU-3-02', roll:'TU302' },
  { name:'Test User 3.3', email:'testuser3.3@iempc.test', password:'testuser3.3', startYear:2023, endYear:2027, enroll:'TU-3-03', roll:'TU303' },
  { name:'Test User 3.4', email:'testuser3.4@iempc.test', password:'testuser3.4', startYear:2023, endYear:2027, enroll:'TU-3-04', roll:'TU304' },

  // ── 4th Year (2022 batch) ──────────────────────────────────────────────
  { name:'Test User 4.1', email:'testuser4.1@iempc.test', password:'testuser4.1', startYear:2022, endYear:2026, enroll:'TU-4-01', roll:'TU401' },
  { name:'Test User 4.2', email:'testuser4.2@iempc.test', password:'testuser4.2', startYear:2022, endYear:2026, enroll:'TU-4-02', roll:'TU402' },
  { name:'Test User 4.3', email:'testuser4.3@iempc.test', password:'testuser4.3', startYear:2022, endYear:2026, enroll:'TU-4-03', roll:'TU403' },
  { name:'Test User 4.4', email:'testuser4.4@iempc.test', password:'testuser4.4', startYear:2022, endYear:2026, enroll:'TU-4-04', roll:'TU404' },
]

async function seed() {
  const { MONGODB_URI } = process.env
  if (!MONGODB_URI) { console.error('❌  MONGODB_URI missing in .env'); process.exit(1) }

  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected\n')

  let created = 0, skipped = 0

  for (const u of TEST_USERS) {
    const exists = await User.findOne({ email: u.email })
    if (exists) {
      console.log(`⏭   Skipped  (already exists): ${u.email}`)
      skipped++
      continue
    }

    const user = new User({
      name:             u.name,
      department:       'BTECH',
      enrollmentNumber: u.enroll,
      rollNumber:       u.roll,
      startYear:        u.startYear,
      endYear:          u.endYear,
      email:            u.email,
      password:         u.password,   // hashed by pre-save hook
      role:             'photographer',
      status:           'approved',
    })
    await user.save()
    console.log(`✅  Created: ${u.name.padEnd(16)} | ${u.email.padEnd(28)} | password: ${u.password}`)
    created++
  }

  console.log(`\n── Summary ──────────────────────────────────`)
  console.log(`   Created : ${created}`)
  console.log(`   Skipped : ${skipped}`)
  console.log(`   Total   : ${TEST_USERS.length}`)
  console.log('\n── Credentials to hand out ──────────────────')
  console.log('   Year  Name              Email                        Password')
  console.log('   ──────────────────────────────────────────────────────────────')
  for (const u of TEST_USERS) {
    const yr = u.startYear === 2025 ? '1st' : u.startYear === 2024 ? '2nd' : u.startYear === 2023 ? '3rd' : '4th'
    console.log(`   ${yr}   ${u.name.padEnd(16)} ${u.email.padEnd(28)} ${u.password}`)
  }

  await mongoose.disconnect()
  console.log('\n✅  Done.')
}

seed().catch(err => { console.error('❌  Error:', err.message); process.exit(1) })
