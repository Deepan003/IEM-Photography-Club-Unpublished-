import { Resend } from 'resend'

function client() { return new Resend(process.env.RESEND_API_KEY) }

export const FROM = () =>
  process.env.EMAIL_FROM || 'IEM Photography Club <onboarding@resend.dev>'

// Single email — throws on error (same behaviour as nodemailer sendMail)
export async function sendEmail({ from, to, subject, html, cc, bcc, attachments } = {}) {
  const opts = { from: from || FROM(), to, subject, html }
  if (cc?.length)          opts.cc          = cc
  if (bcc?.length)         opts.bcc         = bcc
  if (attachments?.length) opts.attachments = attachments
  const { error } = await client().emails.send(opts)
  if (error) throw new Error(error.message || JSON.stringify(error))
}

// Bulk send using Resend batch API (max 100 per call)
export async function sendBulk(recipients, subject, html, { cc = [], bcc = [], attachments = [] } = {}) {
  const r    = client()
  const f    = FROM()
  let   sent = 0

  const base = { from: f, subject, html }
  if (cc.length)          base.cc          = cc
  if (bcc.length)         base.bcc         = bcc
  if (attachments.length) base.attachments = attachments.map(a => ({ filename: a.name, path: a.url }))

  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients.slice(i, i + 100).map(r => ({ ...base, to: r.email }))
    try {
      const { data, error } = await r.batch.send(batch)
      if (error) console.error('[resend] batch error:', error.message || JSON.stringify(error))
      else       sent += data?.data?.length ?? batch.length
    } catch (e) {
      console.error('[resend] batch failed:', e.message)
    }
  }

  return sent
}
