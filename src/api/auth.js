/** Frontend API client — all calls go to /api (proxied to Express in dev) */

const BASE = '/api/auth'

async function req(method, path, body) {
  const token = localStorage.getItem('iempc_token')
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const authApi = {
  register:        body => req('POST', '/register',          body),
  verifyEmailOtp:  body => req('POST', '/verify-email-otp', body),
  resendOtp:       body => req('POST', '/resend-otp',        body),
  login:           body => req('POST', '/login',             body),
  forgotPassword:  body => req('POST', '/forgot-password',  body),
  verifyResetOtp:  body => req('POST', '/verify-reset-otp', body),
  resetPassword:   body => req('POST', '/reset-password',   body),
  getMe:           ()   => req('GET',  '/me'),
  getCores:        ()   => req('GET',  '/cores'),
}

export function saveToken(token) { localStorage.setItem('iempc_token', token) }
export function getToken()       { return localStorage.getItem('iempc_token') }
export function clearToken()     { localStorage.removeItem('iempc_token') }
export function isLoggedIn()     { return !!getToken() }
