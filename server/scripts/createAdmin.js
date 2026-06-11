/**
 * IEM Photography Club — Admin Bootstrap Script
 *
 * Run ONCE from terminal to create the initial admin account:
 *   cd server
 *   node scripts/createAdmin.js
 *
 * Reads credentials from ../.env (ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD)
 */
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') })
import mongoose from 'mongoose'
import User     from '../models/User.js'

async function createAdmin() {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌  Missing MONGODB_URI, ADMIN_EMAIL or ADMIN_PASSWORD in .env')
    process.exit(1)
  }

  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected')

  const existing = await User.findOne({ role: 'admin' })
  if (existing) {
    console.log(`⚠️   Admin already exists: ${existing.email}`)
    await mongoose.disconnect()
    return
  }

  const admin = new User({
    name:             ADMIN_NAME || 'Club Admin',
    department:       'OTHER',
    departmentOther:  'Administration',
    enrollmentNumber: 'ADMIN-001',
    rollNumber:       'ADMIN',
    startYear:        2000,
    endYear:          2099,   // effectively never expires
    email:            ADMIN_EMAIL,
    password:         ADMIN_PASSWORD,
    role:             'admin',
    status:           'approved',
  })

  // Skip passout check for admin
  await admin.save()

  console.log('✅  Admin created successfully!')
  console.log(`    Email   : ${admin.email}`)
  console.log(`    Role    : ${admin.role}`)
  console.log(`    Status  : ${admin.status}`)
  console.log('\n🔐  Keep these credentials secure. Do not commit .env to git.')

  await mongoose.disconnect()
}

createAdmin().catch(err => {
  console.error('❌  Error:', err.message)
  process.exit(1)
})
