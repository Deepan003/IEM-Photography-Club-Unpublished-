import { useState, useEffect, useRef } from 'react'
import { authApi, saveToken }          from '../../api/auth.js'
import { computeAcademicYear }         from '../../utils/yearCalc.js'
import { searchCameras, searchLenses } from '../../data/cameras.js'

// ─────────────────────────────────────────────────────────────────────────────
//  Tiny shared primitives  (glass-design system)
// ─────────────────────────────────────────────────────────────────────────────

const Label = ({ children }) => (
  <p className="font-inter text-xs font-medium text-gray-400 uppercase tracking-[0.12em] mb-1.5">
    {children}
  </p>
)

const GlassInput = ({ label, icon, right, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <Label>{label}</Label>}
    <div className="relative">
      {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">{icon}</span>}
      <input
        {...props}
        className={`glass-input ${icon ? 'pl-9' : ''} ${right ? 'pr-11' : ''} ${className}`}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  </div>
)

const GlassSelect = ({ label, children, ...props }) => (
  <div className="space-y-1.5">
    {label && <Label>{label}</Label>}
    <select {...props}
      className="glass-input appearance-none cursor-pointer">
      {children}
    </select>
  </div>
)

// Full-width form button
const FormBtn = ({ children, loading, variant = 'red', ...props }) => (
  <button
    {...props}
    disabled={loading || props.disabled}
    className={`glass-btn ${variant === 'red' ? 'glass-btn-red' : 'glass-btn-light'} w-full py-4 text-sm tracking-[0.12em] uppercase font-inter font-medium mt-3 disabled:opacity-50 disabled:pointer-events-none`}
    style={{ borderRadius: '12px', minHeight: '52px' }}
  >
    {loading ? <span className="animate-pulse opacity-70">Please wait…</span> : children}
  </button>
)

const EyeBtn = ({ open, onClick }) => (
  <button type="button" onClick={onClick}
    className="text-gray-500 hover:text-gray-200 transition-colors p-1">
    {open
      ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
  </button>
)

const Err = ({ msg }) => msg
  ? <p className="text-red-400 text-xs font-inter mt-2 flex items-center gap-1.5">
      <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      {msg}
    </p>
  : null

const DEPARTMENTS = ['BBA', 'BTECH', 'MTECH', 'BCA', 'LLB', 'MBA', 'OTHER']
const YEAR_RANGE  = Array.from({ length: 20 }, (_, i) => 2015 + i)

// ─────────────────────────────────────────────────────────────────────────────
//  Password strength
// ─────────────────────────────────────────────────────────────────────────────
function StrengthBar({ password }) {
  if (!password) return null
  const score = [/.{8,}/, /[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const cols   = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-emerald-400']
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i <= score ? cols[score] : 'bg-white/10'}`} />
        ))}
      </div>
      {score > 0 && <p className="text-[10px] font-inter text-gray-500">{labels[score]}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  OTP big-digit input
// ─────────────────────────────────────────────────────────────────────────────
function OTPField({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>6-Digit OTP</Label>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        maxLength={6} inputMode="numeric" placeholder="• • • • • •"
        className="glass-input text-center font-mono text-2xl tracking-[0.6em] py-4"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Device row with camera/lens autocomplete
// ─────────────────────────────────────────────────────────────────────────────
function DeviceRow({ device, index, onChange, onRemove }) {
  const [sug,     setSug]     = useState([])
  const [showSug, setShowSug] = useState(false)

  const onNameChange = v => {
    onChange(index, 'name', v)
    const s = device.type === 'camera' ? searchCameras(v) : searchLenses(v)
    setSug(s); setShowSug(s.length > 0)
  }

  return (
    <div className="auth-glass rounded-xl p-3 space-y-2.5">
      <div className="flex gap-2 items-center">
        <select value={device.type} onChange={e => onChange(index, 'type', e.target.value)}
          className="glass-input text-xs py-2 w-28 appearance-none">
          <option value="camera">📷 Camera</option>
          <option value="lens">🔭 Lens</option>
          <option value="other">📦 Other</option>
        </select>
        <input value={device.brand} onChange={e => onChange(index, 'brand', e.target.value)}
          placeholder="Brand (optional)"
          className="glass-input text-xs py-2 flex-1 min-w-0" />
        <button type="button" onClick={() => onRemove(index)}
          className="text-gray-600 hover:text-red-400 transition-colors text-sm shrink-0 px-1">✕</button>
      </div>
      <div className="relative">
        <input value={device.name} onChange={e => onNameChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={device.type === 'camera' ? 'e.g. Canon EOS R5' : device.type === 'lens' ? 'e.g. 50mm f/1.8' : 'Item name'}
          className="glass-input text-xs py-2 w-full" />
        {showSug && (
          <div className="absolute top-full left-0 right-0 auth-glass rounded-xl mt-1 py-1 z-50 max-h-36 overflow-y-auto">
            {sug.map(s => (
              <button key={s} type="button"
                onMouseDown={() => { onChange(index, 'name', s); setShowSug(false) }}
                className="block w-full text-left px-3 py-2 text-xs font-inter text-gray-300 hover:bg-white/5 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Step progress dots
// ─────────────────────────────────────────────────────────────────────────────
function StepDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${
          i + 1 === current
            ? 'w-6 h-1.5 bg-red-500'
            : i + 1 < current
            ? 'w-1.5 h-1.5 bg-red-700/60'
            : 'w-1.5 h-1.5 bg-white/15'
        }`} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTER FLOW
// ─────────────────────────────────────────────────────────────────────────────
function RegisterFlow({ onBack, onSuccess }) {
  const [step,    setStep]    = useState(1)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [cores,   setCores]   = useState([])

  const [form, setForm] = useState({
    name: '', department: 'BTECH', departmentOther: '',
    enrollmentNumber: '', rollNumber: '', startYear: '', endYear: '',
  })
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [showP,   setShowP]   = useState(false)
  const [otp,     setOtp]     = useState('')
  const [countdown,setCountdown]=useState(0)
  const [devices, setDevices] = useState([])

  useEffect(() => {
    if (!countdown) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const academicYear = computeAcademicYear(form.startYear, form.endYear)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const go1 = e => {
    e.preventDefault(); setErr('')
    if (!form.name.trim())        return setErr('Name is required.')
    if (form.department === 'OTHER' && !form.departmentOther.trim()) return setErr('Specify your department.')
    if (!form.enrollmentNumber.trim()) return setErr('Enrollment number required.')
    if (!form.rollNumber.trim())   return setErr('Roll number required.')
    if (!form.startYear || !form.endYear) return setErr('Select start and end year.')
    if (Number(form.startYear) >= Number(form.endYear)) return setErr('End year must be after start year.')
    if (academicYear.isPassout)    return setErr('Your end year has already passed.')
    setStep(2)
  }

  const go2 = async e => {
    e.preventDefault(); setErr('')
    if (!email.includes('@'))   return setErr('Enter a valid email.')
    if (pass.length < 8)        return setErr('Password must be at least 8 characters.')
    if (pass !== confirm)        return setErr('Passwords do not match.')
    setLoading(true)
    try {
      await authApi.register({
        ...form, startYear: Number(form.startYear), endYear: Number(form.endYear),
        email, password: pass, devices,
      })
      setCountdown(60); setStep(3)
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }

  const verifyOTP = async e => {
    e.preventDefault(); setErr('')
    if (otp.length !== 6) return setErr('Enter the 6-digit OTP.')
    setLoading(true)
    try {
      const data = await authApi.verifyEmailOtp({ email, otp })
      setCores(data.contacts || []); setStep(4)
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }

  const resend = async () => {
    try { await authApi.resendOtp({ email, purpose: 'email_verify' }); setCountdown(60) }
    catch (e) { setErr(e.message) }
  }

  return (
    <div>
      <StepDots total={4} current={step} />

      {/* Step 1 — Info */}
      {step === 1 && (
        <form onSubmit={go1} className="space-y-3.5">
          <GlassInput label="Full Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" required icon="👤" />

          <div className="grid grid-cols-2 gap-3">
            <GlassSelect label="Department" value={form.department} onChange={e => set('department', e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </GlassSelect>
            {form.department === 'OTHER'
              ? <GlassInput label="Specify" value={form.departmentOther} onChange={e => set('departmentOther', e.target.value)} placeholder="e.g. Law" required />
              : <GlassInput label="Enrollment No." value={form.enrollmentNumber} onChange={e => set('enrollmentNumber', e.target.value)} placeholder="120…" required />
            }
          </div>

          {form.department === 'OTHER' && (
            <GlassInput label="Enrollment No." value={form.enrollmentNumber} onChange={e => set('enrollmentNumber', e.target.value)} placeholder="120…" required />
          )}

          <GlassInput label="Roll Number" value={form.rollNumber} onChange={e => set('rollNumber', e.target.value)} placeholder="CSE/…" required />

          <div className="grid grid-cols-2 gap-3">
            <GlassSelect label="Start Year" value={form.startYear} onChange={e => set('startYear', e.target.value)}>
              <option value="">Select</option>
              {YEAR_RANGE.map(y => <option key={y}>{y}</option>)}
            </GlassSelect>
            <GlassSelect label="End Year" value={form.endYear} onChange={e => set('endYear', e.target.value)}>
              <option value="">Select</option>
              {YEAR_RANGE.map(y => <option key={y}>{y}</option>)}
            </GlassSelect>
          </div>

          {academicYear.label && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${academicYear.isPassout ? 'bg-red-900/20 border border-red-800/30' : 'bg-emerald-900/15 border border-emerald-800/25'}`}>
              <span className="font-inter text-xs text-gray-400">Current Academic Year</span>
              <span className={`font-inter text-sm font-semibold ${academicYear.isPassout ? 'text-red-400' : 'text-emerald-400'}`}>
                {academicYear.label}
              </span>
            </div>
          )}

          <Err msg={err} />
          <FormBtn type="submit">Continue →</FormBtn>
          <button type="button" onClick={onBack} className="w-full text-center text-xs font-inter text-gray-600 hover:text-gray-400 transition-colors mt-1">Back to Login</button>
        </form>
      )}

      {/* Step 2 — Account */}
      {step === 2 && (
        <form onSubmit={go2} className="space-y-3.5">
          <GlassInput label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required icon="✉" />
          <div>
            <GlassInput label="Password" type={showP ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Minimum 8 characters" required right={<EyeBtn open={showP} onClick={() => setShowP(p => !p)} />} />
            <StrengthBar password={pass} />
          </div>
          <GlassInput label="Confirm Password" type={showP ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          <Err msg={err} />
          <FormBtn type="submit" loading={loading}>Send OTP →</FormBtn>
          <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs font-inter text-gray-600 hover:text-gray-400 transition-colors mt-1">← Back</button>
        </form>
      )}

      {/* Step 3 — OTP */}
      {step === 3 && (
        <form onSubmit={verifyOTP} className="space-y-4">
          <p className="text-gray-400 font-inter text-sm text-center">
            Code sent to <span className="text-white font-medium">{email}</span>
          </p>
          <OTPField value={otp} onChange={setOtp} />
          <Err msg={err} />
          <FormBtn type="submit" loading={loading}>Verify Email →</FormBtn>
          <div className="text-center mt-2">
            {countdown > 0
              ? <p className="font-inter text-xs text-gray-600">Resend in {countdown}s</p>
              : <button type="button" onClick={resend} className="font-inter text-xs text-red-500 hover:text-red-400 transition-colors">Resend OTP</button>}
          </div>
        </form>
      )}

      {/* Step 4 — Device Details */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-gray-400 font-inter text-xs text-center leading-relaxed">
            Optional — add your gear. You can update this from your profile anytime.
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {devices.map((d, i) => (
              <DeviceRow key={i} device={d} index={i} onChange={(i,k,v) => setDevices(ds => ds.map((x,j) => j===i ? {...x,[k]:v} : x))} onRemove={i => setDevices(ds => ds.filter((_,j) => j!==i))} />
            ))}
          </div>
          <button type="button" onClick={() => setDevices(d => [...d, { type:'camera', brand:'', name:'' }])}
            className="glass-btn glass-btn-light w-full py-3 text-xs tracking-widest uppercase font-inter"
            style={{ borderRadius:'11px', minHeight:'44px' }}>
            + Add Gear
          </button>
          <FormBtn type="button" onClick={() => setStep(5)}>Continue →</FormBtn>
        </div>
      )}

      {/* Step 5 — Success */}
      {step === 5 && (
        <div className="text-center space-y-5 py-2">
          <div className="w-16 h-16 rounded-full bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h3 className="font-cine text-xl text-white uppercase tracking-widest">Application Sent</h3>
            <p className="text-gray-400 font-inter text-sm mt-2 leading-relaxed">
              Your registration is under review. You'll get an email once an admin approves you.
            </p>
          </div>
          {cores.length > 0 && (
            <div className="auth-glass rounded-xl p-4 text-left space-y-2">
              <p className="font-inter text-[11px] font-medium text-red-400 uppercase tracking-[0.12em] mb-3">Core Team</p>
              {cores.map((c, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-white font-inter text-xs">{c.name}</span>
                  <a href={`mailto:${c.email}`} className="text-red-400/80 hover:text-red-400 text-xs font-inter underline transition-colors">{c.email}</a>
                </div>
              ))}
            </div>
          )}
          <button onClick={onSuccess} className="glass-btn glass-btn-light w-full py-3.5 text-sm tracking-[0.12em] uppercase font-inter" style={{ borderRadius:'12px', minHeight:'52px' }}>
            Got it ✓
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOGIN FLOW
// ─────────────────────────────────────────────────────────────────────────────
function LoginFlow({ onSuccess, onForgot }) {
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [showP,   setShowP]   = useState(false)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(null)

  const submit = async e => {
    e.preventDefault(); setErr(''); setPending(null)
    setLoading(true)
    try {
      const data = await authApi.login({ email, password: pass })
      saveToken(data.token); onSuccess(data.user)
    } catch (e) {
      if (e.message.toLowerCase().includes('approval') || e.message.toLowerCase().includes('pending')) {
        authApi.getCores().then(d => setPending({ message: e.message, contacts: d.contacts || [] })).catch(() => setPending({ message: e.message, contacts: [] }))
      } else setErr(e.message)
    } finally { setLoading(false) }
  }

  if (pending) return (
    <div className="space-y-4 text-center">
      <div className="w-14 h-14 rounded-full bg-yellow-900/25 border border-yellow-600/30 flex items-center justify-center mx-auto">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <p className="text-gray-300 font-inter text-sm leading-relaxed">{pending.message}</p>
      {pending.contacts.length > 0 && (
        <div className="auth-glass rounded-xl p-3 text-left space-y-1.5">
          <p className="font-inter text-[10px] font-medium text-red-400 uppercase tracking-[0.12em] mb-2">Contact Core</p>
          {pending.contacts.map((c, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-white font-inter">{c.name}</span>
              <a href={`mailto:${c.email}`} className="text-red-400/80 hover:underline font-inter">{c.email}</a>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setPending(null)} className="text-xs font-inter text-gray-600 hover:text-gray-400 transition-colors">← Back to Login</button>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <GlassInput label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required icon="✉" />
      <div>
        <GlassInput label="Password" type={showP ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Your password" required right={<EyeBtn open={showP} onClick={() => setShowP(p => !p)} />} />
        <div className="flex justify-end mt-1.5">
          <button type="button" onClick={onForgot} className="font-inter text-xs text-gray-500 hover:text-red-400 transition-colors uppercase tracking-[0.1em]">Forgot password?</button>
        </div>
      </div>
      <Err msg={err} />
      <FormBtn type="submit" loading={loading}>Log In →</FormBtn>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  FORGOT PASSWORD FLOW
// ─────────────────────────────────────────────────────────────────────────────
function ForgotFlow({ onBack }) {
  const [step,    setStep]    = useState(1)
  const [email,   setEmail]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [pass,    setPass]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [showP,   setShowP]   = useState(false)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const s1 = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    try { await authApi.forgotPassword({ email }); setStep(2) }
    catch(e) { setErr(e.message) } finally { setLoading(false) }
  }
  const s2 = e => {
    e.preventDefault(); setErr('')
    if (otp.length !== 6) return setErr('Enter the 6-digit OTP.')
    setStep(3)
  }
  const s3 = async e => {
    e.preventDefault(); setErr('')
    if (pass.length < 8)   return setErr('Password must be at least 8 characters.')
    if (pass !== confirm)   return setErr('Passwords do not match.')
    setLoading(true)
    try { await authApi.resetPassword({ email, otp, newPassword: pass }); setStep(4) }
    catch(e) { setErr(e.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <StepDots total={3} current={Math.min(step, 3)} />

      {step === 1 && (
        <form onSubmit={s1} className="space-y-3.5">
          <p className="text-gray-400 font-inter text-xs text-center mb-4">Enter your registered email to receive a reset code.</p>
          <GlassInput label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required icon="✉" />
          <Err msg={err} />
          <FormBtn type="submit" loading={loading}>Send Reset Code</FormBtn>
          <button type="button" onClick={onBack} className="w-full text-center text-xs font-inter text-gray-600 hover:text-gray-400 transition-colors mt-1">← Back to Login</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={s2} className="space-y-4">
          <p className="text-gray-400 font-inter text-xs text-center">Code sent to <span className="text-white">{email}</span></p>
          <OTPField value={otp} onChange={setOtp} />
          <Err msg={err} />
          <FormBtn type="submit">Verify Code →</FormBtn>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={s3} className="space-y-3.5">
          <div>
            <GlassInput label="New Password" type={showP ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Minimum 8 characters" required right={<EyeBtn open={showP} onClick={() => setShowP(p => !p)} />} />
            <StrengthBar password={pass} />
          </div>
          <GlassInput label="Confirm Password" type={showP ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          <Err msg={err} />
          <FormBtn type="submit" loading={loading}>Reset Password</FormBtn>
        </form>
      )}

      {step === 4 && (
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-gray-300 font-inter text-sm">Password reset successfully.</p>
          <button onClick={onBack} className="glass-btn glass-btn-red w-full py-3.5 text-sm tracking-[0.12em] uppercase font-inter" style={{ borderRadius:'12px', minHeight:'52px' }}>
            Back to Login
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN AUTH MODAL — mobile bottom-sheet / desktop centered
// ─────────────────────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, onAuthSuccess }) {
  const [view, setView] = useState('login')
  const [hasMore, setHasMore] = useState(false)
  const scrollRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const handleLogin = user => { onAuthSuccess?.(user); onClose() }

  const titles = { login: 'Welcome Back', register: 'Create Account', forgot: 'Reset Password' }

  // Check whether there is hidden content below the scroll viewport
  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 8)
  }

  // Re-check whenever the view changes (different form height)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    // Also observe resize (keyboard appearing on mobile changes clientHeight)
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view])

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className={`relative auth-glass w-full sm:max-w-md flex flex-col
        rounded-t-3xl sm:rounded-2xl
        max-h-[92vh] sm:max-h-[88vh]
        ${isMobile ? 'auth-sheet-mobile' : 'auth-modal-desktop'}`}>

        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-white/6 flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-cine text-lg sm:text-xl text-white uppercase tracking-widest">{titles[view]}</h2>
            <p className="font-inter text-xs text-gray-500 mt-1">IEM Photography Club</p>
          </div>
          <button onClick={onClose}
            className="glass-btn glass-btn-light p-2 shrink-0 -mt-1 -mr-1"
            style={{ borderRadius:'9px', minHeight:'36px', minWidth:'36px' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Scrollable body + scroll hint */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="h-full overflow-y-auto no-scrollbar px-5 sm:px-6 py-5"
          >
            {view === 'login'    && <LoginFlow    onSuccess={handleLogin} onForgot={() => setView('forgot')} />}
            {view === 'register' && <RegisterFlow onBack={() => setView('login')} onSuccess={onClose} />}
            {view === 'forgot'   && <ForgotFlow   onBack={() => setView('login')} />}
          </div>

          {/* Scroll-more indicator — fade gradient + bouncing chevron */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 64,
              background: 'linear-gradient(to top, rgba(10,10,14,0.92) 0%, transparent 100%)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: 10,
              pointerEvents: 'none',
              opacity: hasMore ? 1 : 0,
              transition: 'opacity 0.25s ease',
            }}
          >
            <svg
              width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.45)" strokeWidth={2.2}
              style={{ animation: hasMore ? 'auth-bounce 1.4s ease-in-out infinite' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Footer toggle */}
        {view !== 'forgot' && (
          <div className="px-5 sm:px-6 pt-4 border-t border-white/5 text-center shrink-0" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}>
            <p className="font-inter text-sm text-gray-500">
              {view === 'login'
                ? <>New here? <button onClick={() => setView('register')} className="text-white hover:text-red-400 transition-colors font-medium ml-1">Create account</button></>
                : <>Have an account? <button onClick={() => setView('login')} className="text-white hover:text-red-400 transition-colors font-medium ml-1">Log in</button></>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
