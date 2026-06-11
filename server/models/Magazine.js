import mongoose from 'mongoose'

const pageSchema = new mongoose.Schema({
  layoutId:  { type: String, required: true },   // e.g. 'full-bleed', 'split-50'
  images:    [{ slotId: String, imageUrl: String, s3Key: String, cropData: mongoose.Schema.Types.Mixed }],
  texts:     [{ slotId: String, content: String }],
  order:     { type: Number, default: 0 },
}, { _id: true })

const magazineSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:           { type: String, default: '' },
  templateId:     { type: String, required: true },
  pages:          [pageSchema],           // LIVE published pages (shown to public)
  draftPages:     [pageSchema],           // DRAFT saved pages (not yet published)
  draftUpdatedAt: { type: Date },         // when draft was last saved
  status:         { type: String, enum: ['draft','published'], default: 'draft' },
  slot:           { type: Number, enum: [1, 2], default: 1 },
  publishedAt:    { type: Date },
  thumbnailUrl:   { type: String },  // S3 URL of first-page preview image (for OG tags)
}, { timestamps: true })

export default mongoose.model('Magazine', magazineSchema)
