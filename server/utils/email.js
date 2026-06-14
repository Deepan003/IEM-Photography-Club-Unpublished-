import { Resend }       from 'resend'
import { enqueueEmail } from './emailQueue.js'

function client() { return new Resend(process.env.RESEND_API_KEY) }

const from = () =>
  process.env.EMAIL_FROM || 'IEM Photography Club <onboarding@resend.dev>'

async function resendSend(opts) {
  const { error } = await client().emails.send(opts)
  if (error) throw new Error(error.message || JSON.stringify(error))
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
function wrap(title, body) {
  return `
  <!DOCTYPE html><html><body style="margin:0;padding:0;background:#050505;font-family:'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#0a0a0a;border:1px solid #222;border-radius:12px;overflow:hidden">
    <div style="background:#111;padding:24px 32px;border-bottom:2px solid #dc2626">
      <h2 style="margin:0;color:#fff;font-size:18px;letter-spacing:2px;text-transform:uppercase">
        📷 IEM Photography Club
      </h2>
    </div>
    <div style="padding:32px">
      <h3 style="color:#fff;margin:0 0 16px;font-size:17px">${title}</h3>
      ${body}
      <p style="color:#555;font-size:12px;margin-top:32px;border-top:1px solid #222;padding-top:16px">
        Automated message — do not reply.
      </p>
    </div>
  </div>
  </body></html>`
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Each public send* function now enqueues the work and returns immediately so
// the calling API route can respond without waiting for SMTP.
// The actual send runs in the background with automatic retry.

// ── OTP email ─────────────────────────────────────────────────────────────────
export function sendOTPEmail(to, name, otp, purpose) {
  const isPwReset = purpose === 'password_reset'
  const subject   = isPwReset ? 'Password Reset OTP' : 'Email Verification OTP'
  const heading   = isPwReset ? 'Reset your password' : 'Verify your email'

  const body = `
    <p style="color:#aaa;font-size:14px;line-height:1.6">Hi ${name},</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6">
      ${isPwReset
        ? 'You requested a password reset. Use the OTP below.'
        : 'Welcome! Please verify your email address using the OTP below.'}
    </p>
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
      <div style="letter-spacing:10px;font-size:36px;font-weight:700;color:#fff;font-family:monospace">
        ${otp}
      </div>
      <p style="color:#666;font-size:12px;margin:12px 0 0">Valid for 15 minutes</p>
    </div>
    <p style="color:#555;font-size:13px">If you did not request this, ignore this email.</p>`

  enqueueEmail(() => resendSend({ from: from(), to, subject, html: wrap(heading, body) }), `OTP → ${to}`)
}

// ── Approval ──────────────────────────────────────────────────────────────────
export function sendApprovalEmail(to, name) {
  const body = `
    <p style="color:#aaa;font-size:14px;line-height:1.6">Hi ${name},</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6">
      Your IEM Photography Club membership has been <strong style="color:#22c55e">approved</strong>!
      You can now log in and access all member features.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.SITE_URL || 'http://localhost:5173'}"
         style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
        Log In Now
      </a>
    </div>`

  enqueueEmail(() => resendSend({
    from: from(), to,
    subject: '🎉 Your membership has been approved!',
    html: wrap('Welcome to the Club!', body),
  }), `approval → ${to}`)
}

// ── Magazine published / republished ─────────────────────────────────────────
export function sendMagazinePublishedEmail({ to, name, magazineName, isRepublish, pdfBase64 }) {
  const siteUrl = process.env.SITE_URL || 'http://localhost:5173'
  const safeName = (magazineName || 'magazine').trim()

  const subject = isRepublish
    ? `✨ Your magazine "${safeName}" has been updated & republished!`
    : `🎉 Congratulations! "${safeName}" is now live on our website!`

  const body = `
    <div style="text-align:center;padding:8px 0 24px">
      <div style="font-size:52px;margin-bottom:4px">${isRepublish ? '✨' : '🎉'}</div>
    </div>

    <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 6px">Hi <strong style="color:#fff">${name}</strong>,</p>

    <div style="background:linear-gradient(135deg,#1a0a0a,#200c0c);border:1px solid rgba(220,38,38,0.4);border-radius:14px;padding:22px 24px;margin:20px 0;text-align:center">
      <p style="color:#9ca3af;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 6px">
        ${isRepublish ? 'Updated Edition' : 'Now Published'}
      </p>
      <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:0.02em">"${safeName}"</h2>
      <p style="color:#dc2626;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0">
        ● Live on IEM Photography Club
      </p>
    </div>

    <p style="color:#aaa;font-size:14px;line-height:1.85;margin:0 0 16px">
      ${isRepublish
        ? `What an incredible update! Every revision you make breathes new life into your work — it reflects your dedication, your growth, and your relentless pursuit of perfection. We are honoured to showcase your refined vision to the entire community.`
        : `This is a huge moment — your creative work is now out in the world for everyone to see! Every photograph you chose, every layout you crafted tells a story that only <em>you</em> could tell. The IEM Photography Club is truly proud to have your work as part of our community.`
      }
    </p>

    <p style="color:#aaa;font-size:14px;line-height:1.85;margin:0 0 28px">
      ${isRepublish
        ? `Keep pushing boundaries. Keep refining your craft. Each iteration is a testament to how seriously you take your art — and it shows. Your best work is always the one you haven't made yet. 📸`
        : `Remember: this is just the beginning of your creative journey here. Keep shooting, keep creating, and keep inspiring everyone around you. The world needs more storytellers like you. 📸`
      }
    </p>

    <div style="text-align:center;margin:0 0 20px">
      <a href="${siteUrl}/magazines"
         style="display:inline-block;background:#dc2626;color:#fff;padding:13px 36px;border-radius:9px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em">
        View Your Magazine →
      </a>
    </div>

    ${pdfBase64 ? `<p style="color:#555;font-size:12px;text-align:center;margin:0">A PDF copy of your magazine is attached to this email.</p>` : ''}
  `

  const attachments = pdfBase64
    ? [{ filename: `${safeName.replace(/[^a-zA-Z0-9 _-]/g,'').trim() || 'magazine'}.pdf`,
         content: pdfBase64, encoding: 'base64', contentType: 'application/pdf' }]
    : []

  enqueueEmail(() => resendSend({ from: from(), to, subject, html: wrap(isRepublish ? '✨ Magazine Updated!' : '🎉 Your Magazine is Live!', body), attachments }), `magazine → ${to}`)
}

// ── Rejection ─────────────────────────────────────────────────────────────────
export function sendRejectionEmail(to, name, reason = '') {
  const body = `
    <p style="color:#aaa;font-size:14px;line-height:1.6">Hi ${name},</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6">
      Unfortunately your membership application was not approved at this time.
      ${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ''}
    </p>
    <p style="color:#aaa;font-size:14px">
      Contact a Core member if you believe this is an error.
    </p>`

  enqueueEmail(() => resendSend({
    from: from(), to,
    subject: 'IEM Photography Club — Application Update',
    html: wrap('Application Status', body),
  }), `rejection → ${to}`)
}
