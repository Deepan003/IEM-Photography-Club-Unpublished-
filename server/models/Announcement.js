import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  event:         { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  subject:       { type: String },                   // custom email subject
  content:       { type: String, required: true },   // HTML allowed (for embedded links)
  sentBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientType: { type: String, enum: ['all','coordinators','core','individual'], default: 'all' },
  recipient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if individual
  sentByRole:    { type: String },   // 'coordinator' | 'core' | 'admin' — for display in email/UI
}, { timestamps: true })

export default mongoose.model('Announcement', schema)
