import { Router }        from 'express'
import rateLimit         from 'express-rate-limit'
import User              from '../models/User.js'
import AppSettings       from '../models/AppSettings.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { sendOTPEmail }  from '../utils/email.js'
import { isPassout }     from '../utils/yearCalc.js'

const router = Router()

// Rate-limit OTP endpoints to prevent abuse
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many OTP requests. Try again in 15 minutes.' } })

// Rate-limit login and password reset to prevent brute force
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' } })

// ── REGISTER ──────────────────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', otpLimiter, async (req, res) => {
  try {
    const {
      name, department, departmentOther,
      enrollmentNumber, rollNumber, startYear, endYear,
      email, password, devices = [],
    } = req.body

    // Basic validation
    if (!name || !department || !enrollmentNumber || !rollNumber ||
        !startYear || !endYear || !email || !password) {
      return res.status(400).json({ error: 'All required fields must be filled.' })
    }
    if (department === 'OTHER' && !departmentOther?.trim()) {
      return res.status(400).json({ error: 'Please specify your department.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Password must be 128 characters or fewer.' })
    }
    if (Number(startYear) >= Number(endYear)) {
      return res.status(400).json({ error: 'End year must be after start year.' })
    }

    // Check if OTP is required (do this before the existing-user check so we
    // can handle pending_email users differently when OTP is disabled)
    const otpSetting = await AppSettings.findOne({ key: 'auth.otpRequired' })
    const otpRequired = otpSetting != null ? otpSetting.value : true

    // Check passout before saving
    if (isPassout(Number(startYear), Number(endYear))) {
      return res.status(400).json({ error: 'Your programme end year has already passed. Cannot register.' })
    }

    // Check unique email
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      if (existing.status === 'pending_email') {
        if (!otpRequired) {
          // OTP is disabled — upgrade this stuck pending_email account to pending_admin
          existing.status = 'pending_admin'
          existing.clearOTP()
          await existing.save()
          return res.status(201).json({ message: 'Account created! Awaiting admin approval.', skipOtp: true })
        }
        // OTP is required — resend the verification code
        const otp = await existing.setOTP('email_verify')
        await existing.save()
        sendOTPEmail(email, existing.name, otp, 'email_verify')
        return res.status(409).json({
          error: 'An unverified account already exists for this email. A new OTP has been sent — please check your inbox.',
          code: 'RESENT_OTP',
        })
      }
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' })
    }

    if (!otpRequired) {
      // Skip email verification — go straight to pending admin approval
      const user = new User({
        name, department, departmentOther,
        enrollmentNumber, rollNumber,
        startYear: Number(startYear), endYear: Number(endYear),
        email, password, devices,
        status: 'pending_admin',
      })
      await user.save()
      return res.status(201).json({ message: 'Account created! Awaiting admin approval.', skipOtp: true })
    }

    // Create user (status = pending_email)
    const user = new User({
      name, department, departmentOther,
      enrollmentNumber, rollNumber,
      startYear: Number(startYear), endYear: Number(endYear),
      email, password, devices,
      status: 'pending_email',
    })

    const otp = await user.setOTP('email_verify')
    await user.save()

    // sendOTPEmail is fire-and-forget (enqueued with auto-retry) — returns void
    sendOTPEmail(email, name, otp, 'email_verify')
    res.status(201).json({ message: 'OTP sent to your email. Please verify to continue.' })
  } catch (err) {
    console.error('[register]', err)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// ── VERIFY EMAIL OTP ─────────────────────────────────────────────────────
// POST /api/auth/verify-email-otp
router.post('/verify-email-otp', otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpExpiry +otpPurpose')

    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.status !== 'pending_email') {
      return res.status(400).json({ error: 'Email already verified.' })
    }

    const valid = await user.verifyOTP(otp, 'email_verify')
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' })

    user.status = 'pending_admin'
    user.clearOTP()
    await user.save()

    // Return core/coordinator list so user can contact them
    const contacts = await User.find({
      role: { $in: ['core', 'admin'] },
      status: 'approved',
    }).select('name email role -_id')

    res.json({
      message: 'Email verified! Your application is awaiting admin approval.',
      contacts,
    })
  } catch (err) {
    console.error('[verify-email-otp]', err)
    res.status(500).json({ error: 'Verification failed.' })
  }
})

// ── RESEND OTP ────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
router.post('/resend-otp', otpLimiter, async (req, res) => {
  try {
    const { email, purpose } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpExpiry +otpPurpose')

    if (!user) return res.status(404).json({ error: 'User not found.' })

    const otp = await user.setOTP(purpose || 'email_verify')
    await user.save()
    sendOTPEmail(email, user.name, otp, purpose || 'email_verify')
    res.json({ message: 'OTP resent.' })
  } catch (err) {
    console.error('[resend-otp]', err)
    res.status(500).json({ error: 'Failed to resend OTP.' })
  }
})

// ── LOGIN ─────────────────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }
    if (password.length > 128) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' })

    const ok = await user.comparePassword(password)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' })

    // Status checks
    if (user.status === 'pending_email') {
      return res.status(403).json({ error: 'Please verify your email first.', code: 'PENDING_EMAIL' })
    }
    if (user.status === 'pending_admin') {
      const contacts = await User.find({
        role: { $in: ['core', 'admin'] }, status: 'approved',
      }).select('name email role -_id')
      return res.status(403).json({
        error: 'Your account is awaiting admin approval.',
        code: 'PENDING_ADMIN',
        contacts,
      })
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your application was not approved. Contact a Core member.', code: 'REJECTED' })
    }
    if (user.status === 'passout') {
      return res.status(403).json({ error: 'Your account is marked as Passout.', code: 'PASSOUT' })
    }
    if (user.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been banned. Contact a Core member.', code: 'BANNED' })
    }

    // Auto-check passout on login — marks account as passout when programme ends
    if (isPassout(user.startYear, user.endYear) && user.status === 'approved') {
      user.status = 'passout'
      // Core/coordinator role also reverts to photographer on passout
      // (only admin role is permanent — admin never expires)
      if (user.role !== 'admin') user.role = 'photographer'
      await user.save()
      return res.status(403).json({ error: 'Your programme has ended. Account marked as Passout.', code: 'PASSOUT' })
    }

    // Core tenure logic: if core member has graduated (June trigger, same as passout),
    // their ELEVATED role expires — but account stays approved (they can still log in as photographer)
    if (user.role === 'core' && isPassout(user.startYear, user.endYear)) {
      user.role = 'photographer'
      await user.save()
    }

    const token = signToken(user._id, user.tokenVersion)
    res.json({ token, user: user.toSafeObject() })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ error: 'Login failed.' })
  }
})

// ── FORGOT PASSWORD — send OTP ─────────────────────────────────────────────
// POST /api/auth/forgot-password
router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpExpiry +otpPurpose')

    // Don't reveal whether email exists
    if (!user) return res.json({ message: 'If that email exists, an OTP has been sent.' })

    const otp = await user.setOTP('password_reset')
    await user.save()
    sendOTPEmail(email, user.name, otp, 'password_reset')
    res.json({ message: 'OTP sent to your email.' })
  } catch (err) {
    console.error('[forgot-password]', err)
    res.status(500).json({ error: 'Failed to send OTP.' })
  }
})

// ── FORGOT PASSWORD — verify OTP ──────────────────────────────────────────
// POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpExpiry +otpPurpose')

    if (!user) return res.status(404).json({ error: 'User not found.' })

    const valid = await user.verifyOTP(otp, 'password_reset')
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' })

    // Issue a short-lived reset token
    const { signToken: _ , ...jwt } = await import('../middleware/auth.js')
    const resetToken = signToken(user._id) // reuse JWT, reset is distinguished by endpoint

    res.json({ message: 'OTP verified.', resetToken })
  } catch (err) {
    console.error('[verify-reset-otp]', err)
    res.status(500).json({ error: 'Verification failed.' })
  }
})

// ── RESET PASSWORD ─────────────────────────────────────────────────────────
// POST /api/auth/reset-password
router.post('/reset-password', loginLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ error: 'Password must be 128 characters or fewer.' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +otpHash +otpExpiry +otpPurpose')

    if (!user) return res.status(404).json({ error: 'User not found.' })

    const valid = await user.verifyOTP(otp, 'password_reset')
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' })

    user.password = newPassword // will be hashed by pre-save hook
    user.clearOTP()
    user.tokenVersion = (user.tokenVersion || 0) + 1 // invalidate all existing tokens
    await user.save()

    res.json({ message: 'Password reset successfully. Please log in.' })
  } catch (err) {
    console.error('[reset-password]', err)
    res.status(500).json({ error: 'Password reset failed.' })
  }
})

// ── LOGOUT ────────────────────────────────────────────────────────────────
// POST /api/auth/logout  — invalidates the current JWT by bumping tokenVersion
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } })
    res.json({ message: 'Logged out.' })
  } catch (err) {
    console.error('[logout]', err)
    res.status(500).json({ error: 'Logout failed.' })
  }
})

// ── GET CURRENT USER ───────────────────────────────────────────────────────
// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ── GET CORE/ADMIN CONTACTS (public) ──────────────────────────────────────
// GET /api/auth/cores
router.get('/cores', async (req, res) => {
  try {
    const contacts = await User.find({
      role: { $in: ['core', 'admin'] },
      status: 'approved',
    }).select('name email role -_id').sort({ role: 1, name: 1 })
    res.json({ contacts })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts.' })
  }
})

export default router
