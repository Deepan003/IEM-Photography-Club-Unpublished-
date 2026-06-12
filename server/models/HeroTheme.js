import mongoose from 'mongoose'

const heroThemeSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  isActive:         { type: Boolean, default: false },
  isDefault:        { type: Boolean, default: false },
  pcVideoUrl:       { type: String, default: '' },
  mobileVideoUrl:   { type: String, default: '' },
  useSingleVideo:   { type: Boolean, default: false },
  blur:             { type: Number, default: 2.5 },
  blurAuto:         { type: Boolean, default: true },
  darkness:         { type: Number, default: 0.46 },
  darknessAuto:     { type: Boolean, default: true },
  saturation:       { type: Number, default: 0 },
  saturationAuto:   { type: Boolean, default: true },
  brightness:       { type: Number, default: 44 },
  brightnessAuto:   { type: Boolean, default: true },
  warmth:           { type: Number, default: 0 },
  warmthAuto:       { type: Boolean, default: true },
  navbarBg:         { type: String, default: 'rgba(0,0,0,0.4)' },
  navbarBgAuto:     { type: Boolean, default: true },
  navbarTextColor:  { type: String, default: '#ffffff' },
  heroTextColor:    { type: String, default: '#d0d0d0' },
  heroTextColorAuto:{ type: Boolean, default: true },
  tagline:          { type: String, default: '' },
  introMode:        { type: String, enum: ['immediate', 'timed', 'after-first-play'], default: 'immediate' },
  introDelay:       { type: Number, default: 3 },
  afterPlayMode:    { type: String, enum: ['loop', 'blur-loop'], default: 'loop' },
  afterPlayBlur:    { type: Number, default: 8 },
}, { timestamps: true })

const HeroTheme = mongoose.model('HeroTheme', heroThemeSchema)

export async function ensureDefaultTheme() {
  const count = await HeroTheme.countDocuments()
  if (count === 0) {
    await HeroTheme.create({
      name: 'Default',
      isActive: true,
      isDefault: true,
      pcVideoUrl: 'https://college-photography-competition-iem.s3.ap-south-1.amazonaws.com/videos/hero-desktop.mp4',
      mobileVideoUrl: 'https://college-photography-competition-iem.s3.ap-south-1.amazonaws.com/videos/hero-mobile.mp4',
      blurAuto: true, darknessAuto: true, navbarBgAuto: true, heroTextColorAuto: true,
    })
    console.log('✅  Default hero theme created')
  }
}

export default HeroTheme
