import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  order:     { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('PostcardSection', schema)
