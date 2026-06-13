import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  year:         { type: String, required: true },          // e.g. "2023-24"
  designation:  { type: String, default: 'Core' },         // Core / Honourable Mention / custom
  stream:       { type: String },                           // e.g. "Landscape Photography" (optional)
  photoUrl:     { type: String },
  s3Key:        { type: String },
  coverPhoto:           { type: String },
  coverPhotoS3Key:      { type: String },
  coverPhotoPosition:   { type: String, default: '50%' },
  gallery: [{
    url:      { type: String, required: true },
    s3Key:    { type: String, required: true },
    caption:  { type: String, maxlength: 200, default: '' },
    order:    { type: Number, default: 0 },
  }],
  linkedUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if they have an account
  order:        { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('CoreMember', schema)
