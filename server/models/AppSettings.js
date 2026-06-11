import mongoose from 'mongoose'

// Generic key-value settings store for app-wide configuration
const schema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  label: { type: String },   // human-readable name
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('AppSettings', schema)
