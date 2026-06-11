import mongoose from 'mongoose'

const attachmentSchema = new mongoose.Schema({
  name: String,
  url:  String,
  size: Number,
  mime: String,
}, { _id: false })

const recipientSchema = new mongoose.Schema({
  type:   { type: String, enum: ['user','external'], default: 'external' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email:  String,
  name:   String,
}, { _id: false })

const schema = new mongoose.Schema({
  kind:     { type: String, enum: ['broadcast','compose'], default: 'broadcast' },
  status:   { type: String, enum: ['sent','draft'],        default: 'sent'      },
  subject:  { type: String, required: true, trim: true },
  content:  { type: String, required: true },
  sentBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // broadcast recipients
  recipientPreset: { type: String, enum: ['all','cores','coordinators','stream','year','role','custom'], default: 'all' },
  filters: {
    stream: String,
    year:   Number,
    role:   String,
  },
  customRecipients:   [recipientSchema],   // used when preset='custom'
  resolvedRecipients: [recipientSchema],   // full resolved list for every broadcast send

  // compose recipients
  toRecipients:  [recipientSchema],
  ccEmails:      [String],
  bccEmails:     [String],

  attachments:    [attachmentSchema],
  recipientCount: { type: Number, default: 0 },
  preview:        { type: String },
  binned:         { type: Boolean, default: false },
  binnedAt:       { type: Date },

  // Context — set when the announcement belongs to a specific event/competition/activity
  contextType: { type: String, enum: ['event','competition','activity'], default: null },
  contextId:   { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true })

export default mongoose.model('GlobalAnnouncement', schema)
