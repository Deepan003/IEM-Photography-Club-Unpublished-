/**
 * Lightweight in-process email queue.
 *
 * Why: sending email synchronously inside a request handler means the API
 * response waits for the SMTP round-trip (typically 0.5–3 s). If the mail
 * provider is slow or briefly unavailable, the user gets a delayed or failed
 * response even though the underlying action (OTP generated, member approved)
 * succeeded. This queue decouples the two.
 *
 * How it works:
 *  • enqueueEmail(fn) adds an async function to a FIFO queue and returns
 *    immediately — the API handler can respond right away.
 *  • A single worker drains the queue sequentially (avoids hammering SMTP).
 *  • On failure it retries up to MAX_RETRIES times with exponential back-off.
 *  • No external dependencies — no Redis, no BullMQ.
 *
 * Limitations: queue lives in memory, so a server restart drops pending jobs.
 * For the Photography Club's volume this is acceptable; upgrade to BullMQ +
 * Redis later if needed.
 */

const MAX_RETRIES = 3

const queue = []
let   busy  = false

async function drain() {
  if (busy || queue.length === 0) return
  busy = true

  const { fn, retries, label } = queue.shift()
  try {
    await fn()
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = 1_500 * 2 ** retries   // 1.5s, 3s, 6s
      console.warn(`[emailQueue] "${label}" failed (attempt ${retries + 1}/${MAX_RETRIES}), retrying in ${delay}ms — ${err.message}`)
      queue.unshift({ fn, retries: retries + 1, label })
      await new Promise(r => setTimeout(r, delay))
    } else {
      console.error(`[emailQueue] "${label}" failed permanently after ${MAX_RETRIES} attempts — ${err.message}`)
      console.error(`[emailQueue] Check EMAIL_USER / EMAIL_PASS env vars and Gmail App Password validity.`)
    }
  }

  busy = false
  setImmediate(drain)
}

/**
 * Add an email-sending function to the queue.
 * @param {() => Promise<void>} fn   — async function that performs the send
 * @param {string}              label — short description for log messages
 */
export function enqueueEmail(fn, label = 'email') {
  queue.push({ fn, retries: 0, label })
  setImmediate(drain)
}
