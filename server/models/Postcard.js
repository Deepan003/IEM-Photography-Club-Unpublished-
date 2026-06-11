import mongoose from 'mongoose'

const imageSchema = new mongoose.Schema({
  url:   { type: String, required: true },
  s3Key: { type: String },
}, { _id: false })

const schema = new mongoose.Schema({
  // Multiple images per postcard (up to 15, like an Instagram carousel)
  images:   { type: [imageSchema], default: [] },

  // Legacy single-image field — kept for backward compat
  imageUrl: { type: String },
  s3Key:    { type: String },

  caption:  { type: String, trim: true, maxlength: 50 },
  section:  { type: mongoose.Schema.Types.ObjectId, ref: 'PostcardSection' },
  photographer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved: { type: Boolean, default: true },
}, { timestamps: true })

// Virtual: always return an array of image URLs regardless of which field was used
schema.virtual('allImages').get(function () {
  if (this.images?.length) return this.images
  if (this.imageUrl) return [{ url: this.imageUrl, s3Key: this.s3Key }]
  return []
})

export default mongoose.model('Postcard', schema)
