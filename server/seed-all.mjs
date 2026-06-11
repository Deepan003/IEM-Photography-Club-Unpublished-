/**
 * Comprehensive seed — realistic historical + current test data
 *
 * USAGE:
 *   node server/seed-all.mjs           → seed everything
 *   node server/seed-all.mjs --delete  → delete all seeded data
 *
 * WHAT GETS CREATED:
 *  ─ 3   current core User accounts (endYear=2027, role=core)
 *      + matching CoreMember entries for "2026-27"
 *  ─ 8   past CoreMember entries (2022-23 to 2025-26, no User accounts)
 *  ─ 15  past member User accounts — graduated (endYear 2024–2025)
 *  ─ 40  present member User accounts (coordinator + photographer)
 *  ─ 16  events  across 4 academic sessions (2023-24 → 2026-27)
 *  ─  7  past competitions (2023-24 → 2025-26 sessions)
 *  ─  3  upcoming competitions (2026-27 current session)
 *  ─ 12  activities across 4 academic sessions
 *  ─ 30  published magazines (blank template pages)
 *
 * Identification markers (safe to delete):
 *  - Users        → email ends with @iem-seed.test
 *  - CoreMembers  → name starts with [SEED]
 *  - Competitions → name starts with [SEED]
 *  - Events       → name starts with [SEED]
 *  - Activities   → name starts with [SEED]
 */

import mongoose  from 'mongoose'
import bcrypt    from 'bcryptjs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../.env') })

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI
if (!MONGO_URI) { console.error('❌  MONGO_URI / MONGODB_URI not in .env'); process.exit(1) }

const { default: User        } = await import('./models/User.js')
const { default: CoreMember  } = await import('./models/CoreMember.js')
const { default: Competition } = await import('./models/Competition.js')
const { default: Event       } = await import('./models/Event.js')
const { default: Activity    } = await import('./models/Activity.js')
const { default: Magazine    } = await import('./models/Magazine.js')

await mongoose.connect(MONGO_URI)
console.log('✅  Connected to MongoDB\n')

// ─── DELETE MODE ──────────────────────────────────────────────────────────────
if (process.argv.includes('--delete')) {
  const seededUserIds = (await User.find({ email: /@iem-seed\.test$/ }).select('_id')).map(u => u._id)
  const mg = seededUserIds.length ? await Magazine.deleteMany({ user: { $in: seededUserIds } }) : { deletedCount: 0 }
  const u  = await User.deleteMany({ email: /@iem-seed\.test$/ })
  const cm = await CoreMember.deleteMany({ name: /^\[SEED\]/ })
  const cp = await Competition.deleteMany({ name: /^\[SEED\]/ })
  const ev = await Event.deleteMany({ name: /^\[SEED\]/ })
  const ac = await Activity.deleteMany({ name: /^\[SEED\]/ })
  console.log(`🗑️   Deleted ${mg.deletedCount} seeded Magazine(s)`)
  console.log(`🗑️   Deleted ${u.deletedCount}  seeded User(s)`)
  console.log(`🗑️   Deleted ${cm.deletedCount} seeded CoreMember(s)`)
  console.log(`🗑️   Deleted ${cp.deletedCount} seeded Competition(s)`)
  console.log(`🗑️   Deleted ${ev.deletedCount} seeded Event(s)`)
  console.log(`🗑️   Deleted ${ac.deletedCount} seeded Activity/Activities`)
  await mongoose.disconnect()
  process.exit(0)
}

// ─── GUARD ────────────────────────────────────────────────────────────────────
const existingUsers = await User.countDocuments({ email: /@iem-seed\.test$/ })
const existingCM    = await CoreMember.countDocuments({ name: /^\[SEED\]/ })
const existingCP    = await Competition.countDocuments({ name: /^\[SEED\]/ })
const existingEv    = await Event.countDocuments({ name: /^\[SEED\]/ })
const existingAc    = await Activity.countDocuments({ name: /^\[SEED\]/ })
if (existingUsers > 0 || existingCM > 0 || existingCP > 0 || existingEv > 0 || existingAc > 0) {
  console.log(`⚠️   Already seeded: ${existingUsers} user(s), ${existingCM} CoreMember(s), ${existingCP} Competition(s), ${existingEv} Event(s), ${existingAc} Activity/Activities.`)
  console.log('     Run --delete first to re-seed.\n')
  await mongoose.disconnect()
  process.exit(1)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const hashedPw = await bcrypt.hash('TestPass@123', 12)
const yr   = new Date().getFullYear()   // 2026
const mo   = new Date().getMonth() + 1  // 6 (June)

const currentAcadYear = mo < 6
  ? `${yr - 1}-${String(yr).slice(-2)}`
  : `${yr}-${String(yr + 1).slice(-2)}`   // "2026-27"

// Fixed calendar dates — session-correct regardless of when script runs
const D = (y, m, d) => new Date(y, m - 1, d)  // month is 1-indexed

const DEPTS = ['BTECH', 'BTECH', 'BTECH', 'MTECH', 'BCA', 'MBA']

// ─── 1. THREE CURRENT CORE USERS ──────────────────────────────────────────────
const coreUsers = [
  { name:'[SEED] Arjun Sharma',    email:'arjun@iem-seed.test',    department:'BTECH', endYear: yr + 1 },
  { name:'[SEED] Priya Nair',      email:'priya@iem-seed.test',     department:'BTECH', endYear: yr + 1 },
  { name:'[SEED] Rahul Verma',     email:'rahul@iem-seed.test',     department:'MTECH', endYear: yr + 1 },
].map(u => ({
  ...u,
  password:         hashedPw,
  enrollmentNumber: `CORE${Math.random().toString(36).slice(-6).toUpperCase()}`,
  rollNumber:       `C${Math.random().toString(36).slice(-4).toUpperCase()}`,
  startYear:        u.endYear - 4,
  role:             'core',
  status:           'approved',
}))

const insertedCoreUsers = await User.insertMany(coreUsers)
console.log(`✅  Created ${insertedCoreUsers.length} current core User accounts`)

const currentCoreMembers = insertedCoreUsers.map((u, i) => ({
  name:        u.name,
  year:        currentAcadYear,
  designation: ['President', 'Secretary', 'Treasurer'][i] || 'Core',
  photoUrl:    '',
  s3Key:       '',
  linkedUser:  u._id,
  order:       i,
}))
await CoreMember.insertMany(currentCoreMembers)
console.log(`✅  Created ${currentCoreMembers.length} CoreMember entries for ${currentAcadYear} (Current)\n`)

// ─── 2. PAST CORE MEMBERS (historical, no User accounts) ──────────────────────
const pastCoreData = [
  { name:'[SEED] Amit Roy',        year:'2022-23', designation:'President',  order:0 },
  { name:'[SEED] Sneha Das',       year:'2022-23', designation:'Secretary',  order:1 },
  { name:'[SEED] Ravi Kumar',      year:'2023-24', designation:'President',  order:0 },
  { name:'[SEED] Pooja Ghosh',     year:'2023-24', designation:'Secretary',  order:1 },
  { name:'[SEED] Vishal Mehta',    year:'2024-25', designation:'President',  order:0 },
  { name:'[SEED] Ananya Bose',     year:'2024-25', designation:'Treasurer',  order:1 },
  { name:'[SEED] Karan Singh',     year:'2025-26', designation:'President',  order:0 },
  { name:'[SEED] Meera Pillai',    year:'2025-26', designation:'Secretary',  order:1 },
]
await CoreMember.insertMany(pastCoreData)
console.log(`✅  Created ${pastCoreData.length} past CoreMember entries (2022-23 to 2025-26)\n`)

// ─── 3. PAST MEMBER USERS — graduated ─────────────────────────────────────────
// These users were registered and active in previous sessions.
// Their endYear < current year marks them as passout/alumni.
const pastMemberNames = [
  // 2024-25 batch (endYear 2025) — 10 members
  '[SEED] Saurav Chakraborty', '[SEED] Ritika Mukherjee', '[SEED] Debayan Ghosh',
  '[SEED] Trisha Banerjee',    '[SEED] Arijit Mondal',    '[SEED] Susmita Roy',
  '[SEED] Biplab Das',         '[SEED] Ankita Sen',       '[SEED] Pritam Bose',
  '[SEED] Madhuri Paul',
  // 2023-24 batch (endYear 2024) — 8 members
  '[SEED] Soumya Datta',       '[SEED] Nilufar Begum',    '[SEED] Rahul Saha',
  '[SEED] Payel Kundu',        '[SEED] Subhajit Karmakar','[SEED] Debjani Haldar',
  '[SEED] Ayan Chatterjee',    '[SEED] Sumana Biswas',
]

const pastMemberDocs = pastMemberNames.map((name, i) => {
  const is2025batch = i < 10
  const endYear = is2025batch ? 2025 : 2024
  const isCoord = i % 6 === 0    // a handful of coordinators
  return {
    name,
    email:            `pastmember${String(i + 1).padStart(2, '0')}@iem-seed.test`,
    password:         hashedPw,
    enrollmentNumber: `PAST${String(i + 1).padStart(5, '0')}`,
    rollNumber:       `P${String(i + 1).padStart(4, '0')}`,
    department:       DEPTS[i % DEPTS.length],
    startYear:        endYear - 4,
    endYear,
    role:             isCoord ? 'coordinator' : 'photographer',
    status:           'approved',
  }
})
await User.insertMany(pastMemberDocs)
console.log(`✅  Created ${pastMemberDocs.length} past (graduated) member User accounts`)
console.log(`    2024-25 batch (endYear 2025): ${pastMemberDocs.filter(m => m.endYear === 2025).length} members`)
console.log(`    2023-24 batch (endYear 2024): ${pastMemberDocs.filter(m => m.endYear === 2024).length} members\n`)

// ─── 4. PRESENT MEMBER USERS ──────────────────────────────────────────────────
// 5 coordinators + 35 photographers, graduating yr+1 or yr+2
const memberDocs = Array.from({ length: 40 }, (_, i) => {
  const isCoord = i < 5
  const endYear = yr + 1 + (i % 2)
  return {
    name:             `[SEED] ${isCoord ? 'Coord' : 'Photo'} Member ${String(i + 1).padStart(2, '0')}`,
    email:            `member${String(i + 1).padStart(2, '0')}@iem-seed.test`,
    password:         hashedPw,
    enrollmentNumber: `MEM${String(i + 1).padStart(6, '0')}`,
    rollNumber:       `M${String(i + 1).padStart(4, '0')}`,
    department:       DEPTS[i % DEPTS.length],
    startYear:        endYear - 4,
    endYear,
    role:             isCoord ? 'coordinator' : 'photographer',
    status:           'approved',
  }
})
await User.insertMany(memberDocs)
const byRole = memberDocs.reduce((a, d) => { a[d.role] = (a[d.role]||0)+1; return a }, {})
console.log(`✅  Created ${memberDocs.length} present member User accounts`)
console.log(`    Coordinators: ${byRole.coordinator}  |  Photographers: ${byRole.photographer}`)
console.log(`    endYear ${yr+1}: ${memberDocs.filter(m=>m.endYear===yr+1).length}  |  endYear ${yr+2}: ${memberDocs.filter(m=>m.endYear===yr+2).length}\n`)

// ─── 5. EVENTS ────────────────────────────────────────────────────────────────

const events = [
  // ── 2023-24 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Club Foundation Day Photography Walk',
    description: 'Our annual Foundation Day walk through IEM campus — members document the campus architecture, candid student life, and the energy of the new academic year.',
    venue:       'IEM Campus, Gurukul',
    eventDate:   D(2023, 8, 25),
    startDate:   D(2023, 8, 25),
    endDate:     D(2023, 8, 25),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Festive Frames — Durga Puja Coverage',
    description: 'A 4-day documentary photography assignment across Kolkata\'s iconic Durga Puja pandals. Members captured the craftsmanship, devotion, and crowd energy.',
    venue:       'Kolkata City Pandals',
    startDate:   D(2023, 10, 21),
    endDate:     D(2023, 10, 24),
    eventDate:   D(2023, 10, 21),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Annual Fest 2024 — Official Coverage',
    description: 'Full official photography and videography coverage of IEM Annual Fest 2024. Core and coordinator team documented every performance, stall, and ceremony.',
    venue:       'IEM Campus Main Grounds',
    startDate:   D(2024, 2, 10),
    endDate:     D(2024, 2, 12),
    eventDate:   D(2024, 2, 10),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },

  // ── 2024-25 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Freshers Orientation & Camera Basics',
    description: 'Welcome event for new batch members — introduction to DSLR/mirrorless basics, club rules, gear library, and a guided campus shoot.',
    venue:       'IEM Seminar Hall + Campus',
    eventDate:   D(2024, 9, 7),
    startDate:   D(2024, 9, 7),
    endDate:     D(2024, 9, 7),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Heritage Walk — North Kolkata',
    description: 'An immersive photography walk through the crumbling havelis, narrow lanes, and chai stalls of North Kolkata. Focus on texture, decay, and street life.',
    venue:       'Shyambazar to Kumartuli, North Kolkata',
    eventDate:   D(2024, 11, 9),
    startDate:   D(2024, 11, 9),
    endDate:     D(2024, 11, 9),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Winter Capture Drive 2025',
    description: 'Early morning golden-hour shoot across the Maidan and Victoria Memorial. Long exposures, fog shots, and the quiet of Kolkata before rush hour.',
    venue:       'Maidan & Victoria Memorial, Kolkata',
    eventDate:   D(2025, 1, 19),
    startDate:   D(2025, 1, 19),
    endDate:     D(2025, 1, 19),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Annual Exhibition 2025 — Frames of the Year',
    description: 'The club\'s biggest event — a curated display of the year\'s best works. Jury evaluation, public voting, certificates, and a grand prize ceremony.',
    venue:       'IEM College Auditorium',
    startDate:   D(2025, 3, 14),
    endDate:     D(2025, 3, 16),
    eventDate:   D(2025, 3, 14),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },

  // ── 2025-26 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Monsoon Walk — Kolkata Streets',
    description: 'Puddles, rain-soaked streets, and the unmistakable energy of a Kolkata monsoon. Members explore rain photography, reflections, and street candids.',
    venue:       'Park Street & New Market Area, Kolkata',
    eventDate:   D(2025, 7, 20),
    startDate:   D(2025, 7, 20),
    endDate:     D(2025, 7, 20),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Portrait Session — Studio Fundamentals',
    description: '3-light studio portrait session — members learn Rembrandt, butterfly, and split lighting setups, and practice posing and direction.',
    venue:       'IEM Photography Studio',
    eventDate:   D(2025, 9, 13),
    startDate:   D(2025, 9, 13),
    endDate:     D(2025, 9, 13),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Diwali Lights — Night Photography',
    description: 'Celebrating Diwali through the lens — diyas, fireworks trails, sparklers, and the lit-up streets of the city. Long-exposure techniques demonstrated live.',
    venue:       'IEM Campus + Nearby Residential Areas',
    eventDate:   D(2025, 10, 28),
    startDate:   D(2025, 10, 28),
    endDate:     D(2025, 10, 28),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Club Photography Exhibition 2026',
    description: 'The 2025-26 annual showcase — best works from events, competitions, and personal projects. Featuring guest photographer talk and awards ceremony.',
    venue:       'IEM College Auditorium',
    startDate:   D(2026, 2, 20),
    endDate:     D(2026, 2, 22),
    eventDate:   D(2026, 2, 20),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Farewell & Graduation Shoot 2026',
    description: 'Bittersweet goodbye — candid and posed photography session for the outgoing 2025-26 batch. Portraits, group shots, and a final walk through campus.',
    venue:       'IEM Campus',
    eventDate:   D(2026, 5, 8),
    startDate:   D(2026, 5, 8),
    endDate:     D(2026, 5, 8),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },

  // ── 2026-27 session — CURRENT ─────────────────────────────────────────────
  {
    name:        '[SEED] Club Orientation 2026 — New Members Welcome',
    description: 'Kick-off of the 2026-27 academic session. New member registration, gear demo, club handbook walkthrough, and a short campus shoot.',
    venue:       'IEM Seminar Hall',
    eventDate:   D(2026, 6, 28),
    startDate:   D(2026, 6, 28),
    endDate:     D(2026, 6, 28),
    status:      'upcoming',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Monsoon Street Hunt 2026',
    description: 'The first big shoot of the season — members fan out across the city to capture Kolkata in the rain. Best shots go into the club\'s annual print.',
    venue:       'Various — Kolkata City Locations',
    eventDate:   D(2026, 7, 19),
    startDate:   D(2026, 7, 19),
    endDate:     D(2026, 7, 19),
    status:      'upcoming',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Golden Hour & Blue Hour Workshop',
    description: 'Hands-on outdoor session at sunset and into blue hour. Covers manual exposure, white balance, and processing for warm-to-cool light transitions.',
    venue:       'Prinsep Ghat, Kolkata',
    eventDate:   D(2026, 8, 16),
    startDate:   D(2026, 8, 16),
    endDate:     D(2026, 8, 16),
    status:      'upcoming',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Annual Exhibition 2027 — Call for Submissions',
    description: 'Save the date for the biggest showcase of the 2026-27 session. Submit your best work across 5 categories: Portrait, Landscape, Street, Wildlife, Experimental.',
    venue:       'IEM College Auditorium',
    startDate:   D(2027, 3, 5),
    endDate:     D(2027, 3, 7),
    eventDate:   D(2027, 3, 5),
    status:      'upcoming',
    manualStatus: true,
    isOpenToAll: true,
  },
]

await Event.insertMany(events)
const eventsBySession = {
  '2023-24': events.filter(e => e.eventDate?.getFullYear() === 2023 || (e.startDate?.getFullYear() === 2023) || (e.eventDate?.getFullYear() === 2024 && e.eventDate?.getMonth() < 5)),
  '2024-25': events.filter(e => (e.eventDate?.getFullYear() === 2024 && e.eventDate?.getMonth() >= 5) || (e.startDate?.getFullYear() === 2025 && e.startDate?.getMonth() < 5) || (e.eventDate?.getFullYear() === 2025 && e.eventDate?.getMonth() < 5)),
  '2025-26': events.filter(e => (e.eventDate?.getFullYear() === 2025 && e.eventDate?.getMonth() >= 5) || (e.startDate?.getFullYear() === 2026 && e.startDate?.getMonth() < 5) || (e.eventDate?.getFullYear() === 2026 && e.eventDate?.getMonth() < 5)),
  '2026-27': events.filter(e => e.eventDate?.getFullYear() === 2026 && e.eventDate?.getMonth() >= 5),
}
console.log(`✅  Created ${events.length} events across sessions:`)
Object.entries(eventsBySession).forEach(([sess, arr]) => {
  if (arr.length) console.log(`    ${sess}: ${arr.length} event(s)`)
})
console.log()

// ─── 6. COMPETITIONS ──────────────────────────────────────────────────────────

const competitions = [
  // ── 2023-24 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Freshman Flash 2023',
    description: 'First competition of the academic year — open to new and returning members. Any genre, any subject. Best 10 shots shortlisted for the club wall.',
    details: {
      themes: ['Open Theme'],
      venue:  'Online Submission',
      prize:  '₹2,000 + Certificate',
      rules:  'One entry per participant. Minimal editing only (crop, exposure, contrast). JPEG final.',
    },
    startDate:   D(2023, 10, 1),
    endDate:     D(2023, 11, 1),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'1st Place',  name:'Saurav Chakraborty' },
      { position:2, label:'2nd Place',  name:'Ritika Mukherjee' },
      { position:3, label:'3rd Place',  name:'Rahul Saha' },
    ],
  },
  {
    name:        '[SEED] Silhouette Showcase 2024',
    description: 'The art of the silhouette — bold shapes, dramatic backlighting, and emotion through form. One of the most popular competitions in club history.',
    details: {
      themes: ['Human Silhouette', 'Object Silhouette', 'Architecture'],
      venue:  'Open Location + Online',
      prize:  '₹3,500 + Framed Print',
      rules:  'Subject must be identifiable as a silhouette. No digital compositing. Natural or practical light only.',
    },
    startDate:   D(2024, 1, 10),
    endDate:     D(2024, 2, 10),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'Gold',         name:'Pooja Ghosh' },
      { position:2, label:'Silver',       name:'Ayan Chatterjee' },
      { position:3, label:'Bronze',       name:'Debjani Haldar' },
      { position:4, label:'Jury Choice',  name:'Soumya Datta' },
    ],
  },

  // ── 2024-25 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Macro World 2024',
    description: 'The unseen world up close. Insects, water drops, textures — macro photography at its finest.',
    details: {
      themes: ['Nature Macro', 'Everyday Objects', 'Textures'],
      venue:  'IEM Photography Lab',
      prize:  '₹2,500 + Equipment Voucher',
      rules:  'Minimum 1:2 magnification. EXIF data must confirm macro lens use.',
    },
    startDate:   D(2024, 8, 5),
    endDate:     D(2024, 9, 5),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'Best Macro',   name:'Biplab Das' },
      { position:2, label:'Runner Up',    name:'Priya Chatterjee' },
    ],
  },
  {
    name:        '[SEED] Cultural Kaleidoscope 2024',
    description: 'Celebrating the rich cultural tapestry of Bengal and India through photography. From festivals to folk art to street performers.',
    details: {
      themes: ['Festivals', 'Folk Art & Craft', 'Street Performance'],
      venue:  'Kolkata & Online',
      prize:  '₹4,500 + Trophy + Magazine Feature',
      rules:  'Photos must be taken in India. Model releases required for close portraits.',
    },
    startDate:   D(2024, 12, 1),
    endDate:     D(2025, 1, 15),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'1st Prize',    name:'Ankita Sen' },
      { position:2, label:'2nd Prize',    name:'Madhuri Paul' },
      { position:3, label:'3rd Prize',    name:'Debayan Ghosh' },
    ],
  },

  // ── 2025-26 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Monsoon Frames 2025',
    description: 'Capture the magic of rain — puddles, clouds, and the first drops of the season. Open to all genres.',
    details: {
      themes: ['Rain & Reflection', 'Street in Monsoon'],
      venue:  'IEM Campus, Gurukul',
      prize:  '₹5,000 cash + Certificate',
      rules:  'One entry per participant. RAW + JPEG required. No heavy compositing.',
    },
    startDate:   D(2025, 8, 1),
    endDate:     D(2025, 9, 15),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'1st Prize',    name:'Aarav Bose' },
      { position:2, label:'2nd Prize',    name:'Ritu Sharma' },
      { position:3, label:'3rd Prize',    name:'Dev Nair' },
      { position:4, label:'Special Award',name:'Pooja Roy' },
    ],
  },
  {
    name:        '[SEED] Monochrome Stories 2026',
    description: 'Strip away colour and find the soul of the image. Black and white photography only.',
    details: {
      themes: ['Portraits', 'Architecture', 'Abstract'],
      venue:  'IEM Auditorium + Online',
      prize:  '₹4,000 + Framed Print + Certificate',
      rules:  'Only B&W submissions accepted. Colour photos converted to B&W will be disqualified.',
    },
    startDate:   D(2026, 1, 10),
    endDate:     D(2026, 2, 20),
    status:      'past',
    manualStatus: true,
    winners: [
      { position:1, label:'1st Place',    name:'Vishal Mehta' },
      { position:2, label:'2nd Place',    name:'Sneha Das' },
      { position:3, label:'3rd Place',    name:'Rahul Das' },
      { position:4, label:'Jury Special', name:'Tanya Ghosh' },
    ],
  },

  // ── 2026-27 session — CURRENT (upcoming) ──────────────────────────────────
  {
    name:        '[SEED] Street & Soul 2026',
    description: 'The streets are alive — document the pulse of the city through candid, honest photography. No staged shots.',
    details: {
      themes: ['Candid Street', 'Urban Life', 'Faces of the City'],
      venue:  'Kolkata City Streets + Online Submission',
      prize:  '₹8,000 cash + Trophy + Feature on Club Instagram',
      rules:  'All photos must be taken outdoors in public spaces. No studio recreations. Max 3 entries per person.',
    },
    startDate:   D(2026, 7, 1),
    endDate:     D(2026, 8, 15),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: true,
    formPublished: false,
  },
  {
    name:        '[SEED] Nature & Wildlife Open 2026',
    description: 'From birds to butterflies, forests to fungi — celebrate the natural world in all its diversity.',
    details: {
      themes: ['Birds in Flight', 'Forest Floor', 'Wildlife Portraits'],
      venue:  'Open — Any natural location in India',
      prize:  '₹6,000 + National Wildlife Magazine Feature',
      rules:  'No captive animals. No baiting. Location metadata required.',
    },
    startDate:   D(2026, 8, 1),
    endDate:     D(2026, 9, 30),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: true,
    formPublished: false,
  },
  {
    name:        '[SEED] Architecture & Light 2026',
    description: 'Buildings, bridges, interiors — explore geometry, symmetry and how light transforms structure.',
    details: {
      themes: ['Modern Architecture', 'Heritage Buildings', 'Interior Spaces'],
      venue:  'IEM Campus + Kolkata Heritage Sites',
      prize:  '₹5,500 + Certificate + Internship Opportunity',
      rules:  'HDR blending is allowed. Long-exposure encouraged.',
    },
    startDate:   D(2026, 9, 1),
    endDate:     D(2026, 10, 31),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: false,
    formPublished: false,
  },
]

await Competition.insertMany(competitions)
console.log(`✅  Created ${competitions.length} competitions:`)
console.log(`    Past (2023-24): 2  |  Past (2024-25): 2  |  Past (2025-26): 2`)
console.log(`    Upcoming (2026-27): 3\n`)

// ─── 7. ACTIVITIES ────────────────────────────────────────────────────────────

const activities = [
  // ── 2023-24 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Lightroom Basics Workshop',
    subject:     'Post-Processing',
    description: 'Hands-on 3-hour session covering Lightroom Classic fundamentals — import workflow, exposure correction, colour grading, and export settings. Targeted at members with less than 6 months of editing experience.',
    venue:       'IEM Computer Lab',
    startDate:   D(2023, 9, 15),
    endDate:     D(2023, 9, 15),
    eventDate:   D(2023, 9, 15),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Camera Settings Masterclass',
    subject:     'Technical Skills',
    description: 'Deep dive into the exposure triangle — aperture, shutter speed, ISO — and when to break the rules. Includes live shooting exercise in challenging light.',
    venue:       'IEM Seminar Hall',
    startDate:   D(2023, 11, 18),
    endDate:     D(2023, 11, 18),
    eventDate:   D(2023, 11, 18),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },

  // ── 2024-25 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Composition & Framing Course',
    subject:     'Visual Storytelling',
    description: 'A structured 4-session course on the rule of thirds, leading lines, negative space, framing, and visual weight. Each session ends with a practical assignment.',
    venue:       'IEM Seminar Hall + Campus',
    startDate:   D(2024, 7, 10),
    endDate:     D(2024, 7, 31),
    eventDate:   D(2024, 7, 10),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Portrait Lighting Fundamentals',
    subject:     'Portraiture',
    description: 'Studio session covering the 5 main portrait lighting patterns, use of reflectors and diffusers, and on-location natural-light techniques. Every member gets time in front of and behind the camera.',
    venue:       'IEM Photography Studio',
    startDate:   D(2024, 10, 5),
    endDate:     D(2024, 10, 5),
    eventDate:   D(2024, 10, 5),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Post-Processing Intensive 2025',
    subject:     'Post-Processing',
    description: 'Advanced retouching in Photoshop and Lightroom — frequency separation, dodge & burn, sky replacement, and colour grading for cinematic looks.',
    venue:       'IEM Computer Lab',
    startDate:   D(2025, 2, 22),
    endDate:     D(2025, 2, 23),
    eventDate:   D(2025, 2, 22),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },

  // ── 2025-26 session ───────────────────────────────────────────────────────
  {
    name:        '[SEED] Astrophotography Night',
    subject:     'Night Photography',
    description: 'Weekend overnight session outside the city — Milky Way core capture, star trails, and light painting. Telescope demonstration included.',
    venue:       'Rajarhat Open Fields (Dark Sky Area)',
    eventDate:   D(2025, 8, 24),
    startDate:   D(2025, 8, 24),
    endDate:     D(2025, 8, 25),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Wildlife & Nature Photography Guide',
    subject:     'Wildlife',
    description: 'Visiting wildlife photographer shares techniques for bird photography, tracking subjects, and ethical wildlife practices. Includes a field session at the Rabindra Sarobar lake.',
    venue:       'IEM Seminar Hall + Rabindra Sarobar',
    startDate:   D(2025, 11, 8),
    endDate:     D(2025, 11, 9),
    eventDate:   D(2025, 11, 8),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Camera Gear Maintenance Workshop',
    subject:     'Equipment Care',
    description: 'Sensor cleaning, lens calibration, bag packing, and field-repair basics. Every club member with borrowed gear is required to attend.',
    venue:       'IEM Photography Studio',
    startDate:   D(2026, 3, 22),
    endDate:     D(2026, 3, 22),
    eventDate:   D(2026, 3, 22),
    status:      'past',
    manualStatus: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Street Photography Ethics & Law',
    subject:     'Ethics',
    description: 'Discussion-based session on legal rights when photographing in public, model consent, privacy in journalism, and how to handle confrontations professionally.',
    venue:       'IEM Seminar Hall',
    startDate:   D(2026, 4, 18),
    endDate:     D(2026, 4, 18),
    eventDate:   D(2026, 4, 18),
    status:      'past',
    manualStatus: true,
    isOpenToAll: true,
  },

  // ── 2026-27 session — CURRENT ─────────────────────────────────────────────
  {
    name:        '[SEED] Club Orientation Activity 2026',
    subject:     'Orientation',
    description: 'Icebreaker activity for the new 2026-27 batch — speed critique rounds, gear meet-and-greet, and a blind photo assignment to judge current skill levels.',
    venue:       'IEM Open Courtyard',
    startDate:   D(2026, 6, 18),
    endDate:     D(2026, 6, 18),
    eventDate:   D(2026, 6, 18),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: true,
    isOpenToAll: true,
  },
  {
    name:        '[SEED] Monsoon Photography Techniques',
    subject:     'Field Techniques',
    description: 'Live demonstration and practice session for rain photography — waterproofing gear, slow shutter water effects, reflection hunting, and colour accuracy in overcast light.',
    venue:       'IEM Campus (Outdoors)',
    startDate:   D(2026, 7, 20),
    endDate:     D(2026, 7, 20),
    eventDate:   D(2026, 7, 20),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: true,
    isOpenToAll: false,
  },
  {
    name:        '[SEED] Adobe Lightroom Advanced',
    subject:     'Post-Processing',
    description: 'Advanced Lightroom session covering masking with AI, colour grading using the colour wheels, lens corrections, and exporting for print vs web with correct colour profiles.',
    venue:       'IEM Computer Lab',
    startDate:   D(2026, 9, 6),
    endDate:     D(2026, 9, 7),
    eventDate:   D(2026, 9, 6),
    status:      'upcoming',
    manualStatus: true,
    showNewBadge: false,
    isOpenToAll: false,
  },
]

await Activity.insertMany(activities)
const actPast     = activities.filter(a => a.status === 'past').length
const actUpcoming = activities.filter(a => a.status === 'upcoming').length
console.log(`✅  Created ${activities.length} activities:`)
console.log(`    Past (2023-24): 2  |  Past (2024-25): 3  |  Past (2025-26): 4`)
console.log(`    Upcoming (2026-27): ${actUpcoming}\n`)

// ─── 8. MAGAZINES ─────────────────────────────────────────────────────────────
const seededMembers = await User.find({ email: /@iem-seed\.test$/ }).select('_id name').lean()

const magazineData = [
  { tpl:'pb-01', name:'Desert Horizons',     pages:['photo-book-cover','grid-top-duo','captions-trio','row-2'] },
  { tpl:'pb-02', name:'Urban Geometry',      pages:['photo-book-cover','grid-top-duo','two-stack','grid-4'] },
  { tpl:'pb-03', name:'Portrait Sessions',   pages:['photo-book-cover','elegant-portrait','grid-top-duo','masonry-3'] },
  { tpl:'pb-04', name:'Field Notes',         pages:['photo-book-cover','full-bleed','captions-trio','text-spread'] },
  { tpl:'pb-05', name:'Minimal Objects',     pages:['photo-book-cover','grid-top-duo','grid-6','two-stack'] },
  { tpl:'de-01', name:'Shadow Cast',         pages:['bold-cover','window-strip','bold-dark','text-spread'] },
  { tpl:'de-02', name:'Eclipse',             pages:['bold-cover','full-bleed','bold-dark','masonry-3'] },
  { tpl:'de-03', name:'Midnight Blue',       pages:['bold-cover','full-bleed','split-right','window-strip'] },
  { tpl:'de-04', name:'Phantom Light',       pages:['bold-cover','window-strip','bold-dark','feature-trio'] },
  { tpl:'de-05', name:'Noir Feature',        pages:['cover','window-strip','portrait-feature','text-columns'] },
  { tpl:'mb-01', name:'Vogue Mono',          pages:['cover','full-bleed','split-left','grid-4'] },
  { tpl:'mb-02', name:'Studio White',        pages:['cover','split-right','grid-6','feature-trio'] },
  { tpl:'mb-03', name:'Editorial Serif',     pages:['cover','full-bleed','masonry-3','split-left'] },
  { tpl:'mb-04', name:'Paper Thin',          pages:['cover','grid-4','split-right','full-bleed'] },
  { tpl:'mb-05', name:'Ivory Grid',          pages:['cover','masonry-3','full-bleed','editorial-4'] },
  { tpl:'rv-01', name:'Golden Memories',     pages:['vintage-collage','journal-photo','scatter-3','quote-page'] },
  { tpl:'rv-02', name:'Sepia Dreams',        pages:['vintage-collage','journal-photo','scatter-3','masonry-3'] },
  { tpl:'rv-03', name:'Vintage Press',       pages:['retro-diagonal','retro-cols','split-left','full-bleed'] },
  { tpl:'rv-04', name:'Film Roll',           pages:['retro-diagonal','retro-cols','portrait-feature','grid-4'] },
  { tpl:'rv-05', name:'Postcard Series',     pages:['retro-diagonal','retro-cols','row-3','full-bleed'] },
  { tpl:'cb-01', name:'Flame Orange',        pages:['constructivist-red','pillars-toc','interview-duo','grid-4'] },
  { tpl:'cb-02', name:'Cobalt City',         pages:['lifestyle-cover','toc-numbered','split-left','grid-4'] },
  { tpl:'cb-03', name:'Emerald',             pages:['cover','full-bleed','split-right','masonry-3'] },
  { tpl:'cb-04', name:'Scarlet Edition',     pages:['constructivist-red','pillars-toc','interview-duo','editorial-4'] },
  { tpl:'cb-05', name:'Citrus',              pages:['cover','full-bleed','split-left','feature-trio'] },
  { tpl:'sp-01', name:'Clean Portfolio',     pages:['arch-cover','elegant-portrait','triple-portrait','grid-4'] },
  { tpl:'sp-02', name:'Dark Portfolio',      pages:['bold-cover','portrait-feature','triple-portrait','masonry-3'] },
  { tpl:'sp-03', name:"Architect's Eye",     pages:['arch-cover','row-3','catalog-spread','grid-6'] },
  { tpl:'no-01', name:'Forest Walk',         pages:['cover','full-bleed','captions-trio','row-3'] },
  { tpl:'no-02', name:'Earth Tones',         pages:['cover','captions-trio','full-bleed','row-2'] },
]

const magNow = new Date()
const magazineDocs = magazineData.map((m, i) => {
  const user    = seededMembers[i % seededMembers.length]
  const pubDate = new Date(magNow - (10 + i * 5) * 864e5)
  return {
    user:        user._id,
    name:        m.name,
    templateId:  m.tpl,
    pages:       m.pages.map((layoutId, order) => ({ layoutId, images:[], texts:[], order })),
    status:      'published',
    slot:        1,
    publishedAt: pubDate,
    createdAt:   pubDate,
    updatedAt:   pubDate,
  }
})
await Magazine.insertMany(magazineDocs)
console.log(`✅  Created ${magazineDocs.length} published magazines (blank — no uploaded photos)\n`)

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEED SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Core (${currentAcadYear}):    3 users + 3 CoreMember entries
Past Core History:            8 CoreMember entries (2022-23 → 2025-26)

Past Members (graduated):    ${pastMemberDocs.length}
  • 2024-25 batch (endYear 2025): 10
  • 2023-24 batch (endYear 2024):  8

Active Members:              40  (5 coordinators + 35 photographers)

Events (${events.length} total):
  • 2023-24 session: 3 past events
  • 2024-25 session: 5 past events
  • 2025-26 session: 6 past events (incl. farewell & exhibition)
  • 2026-27 session: 4 upcoming events

Competitions (${competitions.length} total):
  • 2023-24 session: 2 past
  • 2024-25 session: 2 past
  • 2025-26 session: 2 past
  • 2026-27 session: 3 upcoming

Activities (${activities.length} total):
  • 2023-24 session: 2 past
  • 2024-25 session: 3 past
  • 2025-26 session: 4 past
  • 2026-27 session: 3 upcoming

Published Magazines:         30  (blank — no uploaded images)

Password for all seeded accounts:  TestPass@123
Email pattern (current members):   member01@iem-seed.test … member40@iem-seed.test
Email pattern (past members):      pastmember01@iem-seed.test … pastmember18@iem-seed.test
Email pattern (core):              arjun@iem-seed.test, priya@iem-seed.test, rahul@iem-seed.test

To delete all:  node server/seed-all.mjs --delete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

await mongoose.disconnect()
