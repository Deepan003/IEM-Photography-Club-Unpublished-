import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  platform: { type: String, required: true },   // instagram / facebook / twitter / email / other
  label:    { type: String, required: true },
  url:      { type: String, required: true },
  icon:     { type: String, default: '🔗' },    // emoji or icon name
  order:    { type: Number, default: 0 },
  active:   { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('SocialLink', schema)
