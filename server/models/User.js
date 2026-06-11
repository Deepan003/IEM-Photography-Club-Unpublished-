import mongoose from 'mongoose'
import bcrypt   from 'bcryptjs'
import { computeAcademicYear } from '../utils/yearCalc.js'

const deviceSchema = new mongoose.Schema({
  type:  { type: String, enum: ['camera', 'lens', 'other'], required: true },
  brand: { type: String, trim: true },
  name:  { type: String, trim: true, required: true },
}, { _id: false })

const userSchema = new mongoose.Schema({
  // ── Personal info ──────────────────────────────────────────────────────────
  name:             { type: String, required: true, trim: true },
  department:       { type: String, required: true, enum: ['BBA','BTECH','MTECH','BCA','LLB','MBA','OTHER'] },
  departmentOther:  { type: String, trim: true }, // filled when department = 'OTHER'
  enrollmentNumber: { type: String, required: true, trim: true },
  rollNumber:       { type: String, required: true, trim: true },
  startYear:        { type: Number, required: true },
  endYear:          { type: Number, required: true },

  // ── Account ────────────────────────────────────────────────────────────────
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // bcrypt hash

  // ── Role & status ──────────────────────────────────────────────────────────
  role: {
    type:    String,
    enum:    ['photographer', 'coordinator', 'core', 'admin'],
    default: 'photographer',
  },
  status: {
    type:    String,
    // pending_email  → OTP not yet verified
    // pending_admin  → OTP verified, waiting for admin approval
    // approved       → active member
    // rejected       → admin rejected
    // passout        → programme ended
    enum:    ['pending_email', 'pending_admin', 'approved', 'rejected', 'passout', 'banned'],
    default: 'pending_email',
  },

  // ── OTP (email verification + password reset) ──────────────────────────────
  otpHash:      { type: String, select: false },
  otpExpiry:    { type: Date,   select: false },
  otpPurpose:   { type: String, enum: ['email_verify', 'password_reset'], select: false },

  // ── Profile ────────────────────────────────────────────────────────────────
  bio:                { type: String, maxlength: 500 },
  profilePhoto:       { type: String },   // S3 URL
  profilePhotoS3Key:  { type: String },
  instagramHandle:    { type: String, trim: true },

  // ── Optional device info ───────────────────────────────────────────────────
  devices: [deviceSchema],

  // ── Audit ─────────────────────────────────────────────────────────────────
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:  { type: Date },
  promotedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  promotedAt:  { type: Date },
}, { timestamps: true })

// ── Virtual: computed academic year (never stored) ─────────────────────────
userSchema.virtual('academicYear').get(function () {
  return computeAcademicYear(this.startYear, this.endYear)
})

// ── Pre-save: hash password if modified ───────────────────────────────────
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12)
  }
  next()
})

// ── Method: compare password ──────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

// ── Method: generate & store a hashed OTP ────────────────────────────────
userSchema.methods.setOTP = async function (purpose) {
  const otp = String(Math.floor(100000 + Math.random() * 900000)) // 6 digits
  this.otpHash    = await bcrypt.hash(otp, 8)
  this.otpExpiry  = new Date(Date.now() + 15 * 60 * 1000) // 15 min
  this.otpPurpose = purpose
  return otp // return plaintext to send via email
}

// ── Method: verify OTP ────────────────────────────────────────────────────
userSchema.methods.verifyOTP = async function (candidate, purpose) {
  if (!this.otpHash || !this.otpExpiry) return false
  if (this.otpPurpose !== purpose)       return false
  if (new Date() > this.otpExpiry)       return false
  return bcrypt.compare(candidate, this.otpHash)
}

// ── Method: clear OTP fields ──────────────────────────────────────────────
userSchema.methods.clearOTP = function () {
  this.otpHash    = undefined
  this.otpExpiry  = undefined
  this.otpPurpose = undefined
}

// ── Safe profile (no sensitive fields) ────────────────────────────────────
userSchema.methods.toSafeObject = function () {
  const { password, otpHash, otpExpiry, otpPurpose, ...rest } = this.toObject({ virtuals: true })
  return rest
}

// Indexes for fast search and common filters
userSchema.index({ email: 1 }, { unique: true, background: true })
userSchema.index({ name: 1 }, { background: true })
userSchema.index({ status: 1, endYear: 1 }, { background: true })
userSchema.index({ role: 1, status: 1 }, { background: true })

export default mongoose.model('User', userSchema)
