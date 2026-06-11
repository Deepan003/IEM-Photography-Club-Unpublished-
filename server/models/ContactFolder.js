import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema({
  name:  { type: String, default: '' },
  email: { type: String, required: true, trim: true, lowercase: true },
}, { _id: false })

const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color:       { type: String, default: '#7c3aed' },
  contacts:    [contactSchema],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('ContactFolder', schema)
