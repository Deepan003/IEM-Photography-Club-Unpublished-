import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  year:         { type: String, required: true },          // e.g. "2023-24"
  designation:  { type: String, default: 'Core' },         // Core / Honourable Mention / custom
  photoUrl:     { type: String },
  s3Key:        { type: String },
  linkedUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if they have an account
  order:        { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('CoreMember', schema)
