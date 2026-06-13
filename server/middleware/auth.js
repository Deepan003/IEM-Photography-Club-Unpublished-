import jwt  from 'jsonwebtoken'
import User from '../models/User.js'

/** Verifies JWT and attaches req.user */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    const user    = await User.findById(payload.id).select('-password -otpHash -otpExpiry -otpPurpose')
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account not yet approved' })
    }
    // Reject tokens issued before a ban or logout (tokenVersion mismatch)
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token has been invalidated. Please sign in again.' })
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/** Role-based guard factory — usage: requireRole('admin','core') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

/** Issue a signed JWT for a user */
export function signToken(userId, tokenVersion = 0) {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}
