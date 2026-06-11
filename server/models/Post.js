import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:    { type: String, required: true, trim: true, maxlength: 500 },
}, { timestamps: true })

const schema = new mongoose.Schema({
  imageUrl:  { type: String, required: true },
  s3Key:     { type: String },
  caption:   { type: String, trim: true, maxlength: 2200 },
  author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments:  [commentSchema],
}, { timestamps: true })

export default mongoose.model('Post', schema)
