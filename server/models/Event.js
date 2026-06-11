import mongoose from 'mongoose'

const memberSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventRole:  { type: String, enum: ['photographer','coordinator','core'], default: 'photographer' },
  addedAt:    { type: Date, default: Date.now },
  notified:   { type: Boolean, default: false },
  everAdded:  { type: Number, default: 0 },
}, { _id: false })

const customDateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date:  { type: Date,   required: true },
}, { _id: true })

const eventSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  dates:       [{ type: Date }],                   // legacy
  startDate:   { type: Date },
  endDate:     { type: Date },
  eventDate:   { type: Date },
  eventDates:  [{ type: Date }],
  customDates: [customDateSchema],
  venue:       { type: String, trim: true },
  description: { type: String },
  logoUrl:     { type: String },
  logoS3Key:   { type: String },
  coverUrl:    { type: String },
  driveLink:   { type: String, trim: true, default: '' },
  members:      [memberSchema],
  excludedCores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // status: '' means no status shown; undefined/null falls back to auto-compute
  status:        { type: String, default: 'upcoming' },
  manualStatus:  { type: Boolean, default: false },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  showInGallery: { type: Boolean },
  galleryOrder:  { type: Number, default: 0 },
  isOpenToAll:     { type: Boolean, default: false },
  coordCanEditDetails: { type: Boolean, default: true },
  coordCanUpload:      { type: Boolean, default: true },
  coordCanReorder:     { type: Boolean, default: true },
  coordCanAnnounce:    { type: Boolean, default: true },
}, { timestamps: true })

eventSchema.methods.computeStatus = function () {
  const now = new Date()
  const start = this.startDate  ? new Date(this.startDate)  : null
  const end   = this.endDate    ? new Date(this.endDate)    : null
  const primaryEventDate = this.eventDates?.length ? this.eventDates[0] : this.eventDate
  const day   = primaryEventDate ? new Date(primaryEventDate) : null
  if (start) {
    if (end && now > end)   return 'past'
    if (now >= start)       return 'ongoing'
    return 'upcoming'
  }
  if (day) {
    if (now > day) return 'past'
    return 'upcoming'
  }
  return 'upcoming'
}

eventSchema.pre('save', function (next) {
  if (!this.manualStatus) this.status = this.computeStatus()
  next()
})

export default mongoose.model('Event', eventSchema)
