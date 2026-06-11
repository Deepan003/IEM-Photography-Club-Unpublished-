/**
 * Passout detection + CoreMember auto-promotion
 *
 * Rules:
 *  - User is "passout" if endYear < currentYear
 *    OR (endYear === currentYear AND currentMonth >= June)
 *  - Passout core members automatically get a CoreMember entry created
 *    (admin can edit it afterwards — photo, designation, order)
 *  - Idempotent: safe to call multiple times, won't create duplicates
 */

import User       from '../models/User.js'
import CoreMember from '../models/CoreMember.js'

// Current academic year string (same logic as admin.js)
function currentAcademicYear() {
  const now = new Date(), yr = now.getFullYear(), mo = now.getMonth() + 1
  return mo < 6
    ? `${yr - 1}-${String(yr).slice(-2)}`
    : `${yr}-${String(yr + 1).slice(-2)}`
}

// Sync: any approved core User who lacks a CoreMember entry for the current
// academic year gets one created automatically (e.g. pre-existing cores).
export async function syncCurrentCoreMembers() {
  const yearStr    = currentAcademicYear()
  const coreUsers  = await User.find({ role: 'core', status: 'approved' })
    .select('_id name profilePhoto profilePhotoS3Key')

  let created = 0
  for (const u of coreUsers) {
    const exists = await CoreMember.findOne({
      $or: [
        { linkedUser: u._id },
        { name: u.name, year: yearStr },
      ],
    })
    if (!exists) {
      await CoreMember.create({
        name:        u.name,
        year:        yearStr,
        designation: 'Core',
        photoUrl:    u.profilePhoto      || '',
        s3Key:       u.profilePhotoS3Key || '',
        linkedUser:  u._id,
        order:       0,
      })
      created++
      console.log(`✅  CoreMember synced: ${u.name} → ${yearStr}`)
    }
  }
  if (created === 0) console.log('✅  Core sync: all current cores already have entries')
}

function shouldPassout(endYear) {
  if (!endYear) return false
  const now = new Date()
  const yr  = now.getFullYear()
  const mo  = now.getMonth() + 1   // 1 = Jan, 6 = June
  return endYear < yr || (endYear === yr && mo >= 6)
}

// "2025-26" from endYear = 2026
function academicYearStr(endYear) {
  return `${endYear - 1}-${String(endYear).slice(-2)}`
}

export async function checkAndFlagPassouts() {
  // Only look at currently approved users who have an endYear set
  const users = await User.find({ status: 'approved', endYear: { $exists: true, $ne: null } })
    .select('_id name role endYear profilePhoto profilePhotoS3Key')

  const passoutIds = []
  const passoutCores = []

  for (const u of users) {
    if (shouldPassout(u.endYear)) {
      passoutIds.push(u._id)
      if (u.role === 'core') passoutCores.push(u)
    }
  }

  if (passoutIds.length === 0) {
    console.log('✅  Passout check: no new passouts found')
    return
  }

  // Mark all as passout; also revert any elevated role so DB stays consistent
  // (role is also reverted at login time, but that's lazy — fix it here too)
  await User.updateMany(
    { _id: { $in: passoutIds }, role: { $ne: 'admin' } },
    { $set: { status: 'passout', role: 'photographer' } }
  )
  console.log(`✅  Passout check: flagged ${passoutIds.length} user(s) as passout`)

  // Auto-create CoreMember entries for passout core members
  for (const u of passoutCores) {
    const yearStr = academicYearStr(u.endYear)

    // Idempotency check: skip if already linked or if same name+year exists
    const exists = await CoreMember.findOne({
      $or: [
        { linkedUser: u._id },
        { name: u.name, year: yearStr },
      ],
    })
    if (exists) continue

    await CoreMember.create({
      name:        u.name,
      year:        yearStr,
      designation: 'Core',
      photoUrl:    u.profilePhoto      || '',
      s3Key:       u.profilePhotoS3Key || '',
      linkedUser:  u._id,
      order:       0,
    })
    console.log(`✅  CoreMember auto-created: ${u.name} (${yearStr})`)
  }
}
