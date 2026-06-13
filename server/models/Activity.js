import mongoose from 'mongoose'

const galleryItemSchema = new mongoose.Schema({
  imageUrl:  { type: String, required: true },
  s3Key:     { type: String },
  mobileUrl: { type: String },
  mobileKey: { type: String },
  caption:   { type: String },
  order:     { type: Number, default: 0 },
}, { _id: true })

const linkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url:  { type: String, required: true },
  type: { type: String, enum: ['external','resource'], default: 'external' },
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
  subject:     { type: String },
  description: { type: String },
  venue:       { type: String },

  startDate:   { type: Date },
  endDate:     { type: Date },
  eventDate:   { type: Date },
  eventDates:  [{ type: Date }],
  customDates: [{ title: { type: String, required: true }, date: { type: Date, required: true } }],

  status:       { type: String, default: 'draft' },   // '' = no status shown; enum removed to allow blank
  manualStatus: { type: Boolean, default: false },
  showNewBadge: { type: Boolean, default: false },
  showInGallery: { type: Boolean },   // true=force-on, false=force-off, null/undefined=auto

  bannerUrl:           { type: String },
  bannerS3Key:         { type: String },
  activityBannerUrl:   { type: String },
  activityBannerS3Key: { type: String },

  googleFormUrl: { type: String },
  formPublished: { type: Boolean, default: false },

  driveLink:     { type: String, trim: true, default: '' },  // Google Drive link to the full photo set

  isOpenToAll: { type: Boolean, default: false },

  coordCanEditDetails:      { type: Boolean, default: true },
  coordCanManageGallery:    { type: Boolean, default: true },
  coordCanManageVolunteers: { type: Boolean, default: true },
  coordCanAnnounce:         { type: Boolean, default: true },
  allowVolunteersEdit:      { type: Boolean, default: true },

  excludedCores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  volunteers:    [volunteerSchema],
  gallery:       [galleryItemSchema],
  announcements: [announcementSchema],
  links:         [linkSchema],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

schema.methods.computeStatus = function () {
  if (this.manualStatus) return this.status
  const now = new Date()
  if (!this.startDate) return 'upcoming'
  if (this.endDate && now > this.endDate) return 'past'
  if (now >= this.startDate) return 'ongoing'
  return 'upcoming'
}

schema.pre('save', function (next) {
  if (!this.manualStatus) this.status = this.computeStatus()
  next()
})

export default mongoose.model('Activity', schema)
