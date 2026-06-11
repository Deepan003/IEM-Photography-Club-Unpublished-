import mongoose from 'mongoose'

const winnerSchema = new mongoose.Schema({
  position:          { type: Number },
  label:             { type: String, default: '1st Prize' },
  name:              { type: String, required: true },
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  photoUrl:          { type: String },       // winner portrait
  photoS3Key:        { type: String },
  winningPhotoUrl:   { type: String },       // winning photograph/entry
  winningPhotoS3Key: { type: String },
}, { _id: true })

const galleryItemSchema = new mongoose.Schema({
  imageUrl:  { type: String, required: true },
  s3Key:     { type: String },
  caption:   { type: String },
  order:     { type: Number, default: 0 },
}, { _id: true })

const submissionSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  imageUrl:    { type: String },
  s3Key:       { type: String },
  title:       { type: String, trim: true },
  description: { type: String },
  submittedAt: { type: Date, default: Date.now },
  rank:        { type: Number },
}, { _id: false })

const judgeSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  bio:      { type: String },
  photoUrl: { type: String },
  s3Key:    { type: String },
}, { _id: true })

const linkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url:  { type: String, required: true },
  type: { type: String, enum: ['certificate','external','resource'], default: 'external' },
}, { _id: true })

const volunteerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['volunteer', 'coordinator'], default: 'volunteer' },
}, { _id: false })

const announcementSchema = new mongoose.Schema({
  message:       { type: String, required: true },
  subject:       { type: String },
  recipientType: { type: String, default: 'all' },
  sentByRole:    { type: String },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pinned:        { type: Boolean, default: false },
}, { timestamps: true })

const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String },
  details: {
    themes: [{ type: String }],
    venue:  { type: String },
    prize:  { type: String },
    rules:  { type: String },
    other:  { type: String },
  },

  judges: [judgeSchema],

  // Custom named dates
  customDates: [{ title: { type: String, required: true }, date: { type: Date, required: true } }],

  // Dates
  startDate:            { type: Date },
  endDate:              { type: Date },
  eventDate:            { type: Date },           // actual event/competition day (first of eventDates for compat)
  eventDates:           [{ type: Date }],
  submissionDeadline:   { type: Date },
  resultDate:           { type: Date },
  prizeDistributionDate:{ type: Date },

  // Status
  status:       { type: String, default: 'draft' },   // '' = no status shown; enum removed to allow blank
  manualStatus: { type: Boolean, default: false },
  showNewBadge: { type: Boolean, default: false },
  showInGallery: { type: Boolean },   // true=force-on, false=force-off, null/undefined=auto

  // Prize
  prizeEnabled: { type: Boolean, default: true },

  // Media — logo (small, used in cards) + full competition banner
  bannerUrl:              { type: String },
  bannerS3Key:            { type: String },
  competitionBannerUrl:   { type: String },
  competitionBannerS3Key: { type: String },

  // Google Form
  googleFormUrl:  { type: String },
  formPublished:  { type: Boolean, default: false },

  driveLink:      { type: String, trim: true, default: '' },  // Google Drive link to the full photo set

  // Visibility
  isOpenToAll:    { type: Boolean, default: false }, // non-volunteers can view

  // Permissions
  // Per-section coordinator permissions
  coordCanEditDetails:      { type: Boolean, default: true },
  coordCanManageGallery:    { type: Boolean, default: true },
  coordCanManageWinners:    { type: Boolean, default: false },
  coordCanManageVolunteers: { type: Boolean, default: true },
  coordCanAnnounce:         { type: Boolean, default: true },
  allowVolunteersEdit:      { type: Boolean, default: true }, // master toggle (used by middleware)

  // People
  excludedCores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // cores explicitly removed by admin
  volunteers:   [volunteerSchema],
  coordinators: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, _id: false }], // legacy alias
  winners:      [winnerSchema],
  gallery:      [galleryItemSchema],
  submissions:  [submissionSchema],
  announcements:[announcementSchema],
  links:         [linkSchema],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

schema.methods.computeStatus = function () {
  if (this.manualStatus) return this.status
  const now = new Date()
  if (!this.startDate) return 'upcoming'
  if (this.endDate && now > this.endDate) return 'past'
  if (now >= this.startDate)             return 'ongoing'
  return 'upcoming'
}

schema.pre('save', function (next) {
  if (!this.manualStatus) this.status = this.computeStatus()
  next()
})

export default mongoose.model('Competition', schema)
