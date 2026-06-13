import mongoose from 'mongoose'

const photographerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:   { type: String, trim: true },
}, { _id: false })

const schema = new mongoose.Schema({
  imageUrl:     { type: String, required: true },
  s3Key:        { type: String },
  mobileUrl:    { type: String },
  mobileS3Key:  { type: String },
  caption:      { type: String, trim: true },
  section:      { type: mongoose.Schema.Types.ObjectId, ref: 'GallerySection' },
  event:        { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  type:         { type: String, enum: ['club', 'event'], default: 'club' },
  addedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  featured:     { type: Boolean, default: false },
  order:        { type: Number, default: 0 },
  photographer: { type: photographerSchema },
}, { timestamps: true })

export default mongoose.model('GalleryPhoto', schema)
