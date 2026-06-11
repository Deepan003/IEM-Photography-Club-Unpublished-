import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  type:      { type: String, enum: ['club', 'event'], default: 'club' },
  event:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // set when type=event
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  order:     { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('GallerySection', schema)
