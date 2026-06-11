import { useState }          from 'react'
import { Link }               from 'react-router-dom'
import PageLayout              from '../components/PageLayout.jsx'
import GlassButton             from '../components/GlassButton.jsx'
import ImageUpload             from '../components/ImageUpload.jsx'
import { membersApi }          from '../api/api.js'
import { useTheme, useAuth }   from '../App.jsx'
import { useToast }            from '../components/Toast.jsx'
import { computeAcademicYear } from '../utils/yearCalc.js'

const DEPT_FULL = { BBA:'BBA', BTECH:'B.Tech', MTECH:'M.Tech', BCA:'BCA', LLB:'LLB', MBA:'MBA', OTHER:'Other' }

function Section({ title, children, L }) {
  return (
    <div className={`auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
      <div className={`px-5 py-3.5 border-b ${L?'border-black/5 bg-black/2':'border-white/5 bg-white/2'}`}>
        <p className="font-clash font-semibold text-sm text-red-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, L }) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b last:border-0 ${L?'border-black/5':'border-white/5'}`}>
      <span className="font-inter text-[11px] text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`font-inter text-sm ${L?'text-gray-900':'text-white'} text-right`}>{value || '—'}</span>
    </div>
  )
}

export default function UserSettingsPage() {
  const { theme }         = useTheme()
  const { user, setUser } = useAuth()
  const { toast }         = useToast()
  const [bio,     setBio]     = useState(user?.bio || '')
  const [insta,   setInsta]   = useState(user?.instagramHandle || '')
  const [photo,   setPhoto]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [tab,     setTab]     = useState('profile')
  const L = theme === 'light'

  if (!user) return null

  const academicYear = computeAcademicYear(user.startYear, user.endYear)
  const initials = user.name.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const dept = user.department === 'OTHER' ? (user.departmentOther || 'Other') : (DEPT_FULL[user.department] || user.department)

  const save = async (e) => {
    e.preventDefault(); setMsg(''); setSaving(true)
    try {
      const body = { bio, instagramHandle: insta }
      if (photo) { body.profilePhoto = photo.publicUrl; body.profilePhotoS3Key = photo.key }
      const { user: updated } = await membersApi.updateMe(body)
      setUser(updated); toast.success('Saved', 'Profile updated!')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  const TABS = [
    { id:'profile', label:'Profile' },
    { id:'account', label:'Account Info' },
    { id:'devices', label:'My Gear' },
  ]

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen pt-14 transition-colors ${L?'bg-gray-50':'bg-[#050505]'}`}>

        {/* Profile header */}
        <div className={`border-b py-8 px-4 transition-colors ${L?'bg-white border-black/8':'bg-[#080808] border-white/5'}`}>
          <div className="max-w-2xl mx-auto flex items-center gap-5">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 ${L?'border-black/12':'border-white/15'} bg-gray-800 flex items-center justify-center shrink-0`}>
              {(photo?.publicUrl || user.profilePhoto)
                ? <img src={photo?.publicUrl || user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="font-clash text-2xl font-black text-white opacity-40">{initials}</span>}
            </div>
            <div>
              <h1 className={`font-breathing text-3xl sm:text-4xl font-semibold ${L?'text-gray-900':'text-white'}`}>{user.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`font-inter text-sm ${L?'text-gray-500':'text-gray-400'}`}>{dept} · {academicYear.label}</span>
                {user.instagramHandle && (
                  <a href={`https://instagram.com/${user.instagramHandle}`} target="_blank" rel="noopener noreferrer"
                    className="font-inter text-xs text-red-400 hover:underline">@{user.instagramHandle}</a>
                )}
              </div>
              {user.bio && <p className={`font-inter text-sm mt-2 leading-relaxed ${L?'text-gray-600':'text-gray-400'} max-w-sm`}>{user.bio}</p>}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className={`border-b px-4 transition-colors ${L?'bg-white border-black/8':'bg-[#050505] border-white/5'}`}>
          <div className="max-w-2xl mx-auto flex gap-6 py-3">
            <Link to="/feed" className={`font-inter text-sm font-medium transition-colors flex items-center gap-1.5 ${L?'text-gray-600 hover:text-gray-900':'text-gray-400 hover:text-white'}`}>
              <span>📸</span> My Feed
            </Link>
            <Link to="/my-events" className={`font-inter text-sm font-medium transition-colors flex items-center gap-1.5 ${L?'text-gray-600 hover:text-gray-900':'text-gray-400 hover:text-white'}`}>
              <span>📅</span> My Events
            </Link>
            <Link to="/dashboard" className={`font-inter text-sm font-medium transition-colors flex items-center gap-1.5 ${L?'text-gray-600 hover:text-gray-900':'text-gray-400 hover:text-white'}`}>
              <span>🏠</span> Dashboard
            </Link>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
          {/* Tabs */}
          <div className={`flex gap-1 p-1 rounded-2xl w-fit ${L?'bg-black/5':'bg-white/5'}`}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl font-inter text-sm font-medium transition-all ${tab===t.id?'bg-red-700 text-white':`${L?'text-gray-600':'text-gray-400'} hover:text-white`}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Profile tab — editable */}
          {tab === 'profile' && (
            <form onSubmit={save} className="space-y-5">
              <Section title="Profile Photo" L={L}>
                <ImageUpload
                  folder="profiles"
                  onUpload={r => setPhoto(r)}
                  label="Upload new photo"
                  currentUrl={photo?.publicUrl || user.profilePhoto}
                />
              </Section>

              <Section title="Bio & Links" L={L}>
                <div className="space-y-4">
                  <div>
                    <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">
                      Bio <span className="normal-case font-normal">({bio.length}/500)</span>
                    </label>
                    <textarea value={bio} onChange={e => setBio(e.target.value.slice(0,500))} maxLength={500}
                      rows={4} placeholder="Tell the club about yourself, your photography style, interests…"
                      className="glass-input w-full resize-none" style={{ borderRadius:'12px' }} />
                  </div>

                  <div>
                    <label className="font-inter text-[11px] text-gray-500 uppercase tracking-widest mb-1.5 block">Instagram Handle</label>
                    <div className="flex items-center glass-input overflow-hidden" style={{ borderRadius:'12px', padding:'0' }}>
                      <span className={`px-4 font-inter text-sm font-medium ${L?'text-gray-500':'text-gray-500'} border-r border-white/10 py-3`}>@</span>
                      <input value={insta} onChange={e => setInsta(e.target.value.replace('@',''))}
                        placeholder="yourhandle"
                        className="flex-1 bg-transparent border-0 outline-none py-3 px-4 font-inter text-sm text-white" />
                    </div>
                  </div>
                </div>
              </Section>

              {msg && <p className={`font-inter text-sm text-center ${msg.startsWith('✓')?'text-green-400':'text-red-400'}`}>{msg}</p>}

              <GlassButton type="submit" variant="red" disabled={saving}
                className="w-full font-inter text-sm tracking-[0.06em] uppercase"
                style={{ borderRadius:'14px', minHeight:'52px' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </GlassButton>
            </form>
          )}

          {/* Account info tab — read only */}
          {tab === 'account' && (
            <Section title="Account Information" L={L}>
              <div className="space-y-0">
                <Row label="Full Name"     value={user.name}             L={L} />
                <Row label="Email"         value={user.email}            L={L} />
                <Row label="Department"    value={dept}                  L={L} />
                <Row label="Enrollment No" value={user.enrollmentNumber} L={L} />
                <Row label="Roll No"       value={user.rollNumber}       L={L} />
                <Row label="Programme"     value={`${user.startYear} – ${user.endYear}`} L={L} />
                <Row label="Current Year"  value={academicYear.label}    L={L} />
                <Row label="Role"          value={user.role}             L={L} />
                <Row label="Status"        value={user.status}           L={L} />
                <Row label="Member Since"  value={new Date(user.createdAt).toLocaleDateString('en-IN', { year:'numeric', month:'long' })} L={L} />
              </div>
              <p className={`font-inter text-[11px] text-gray-500 mt-4 leading-relaxed`}>
                Name, department and enrollment details cannot be changed. Contact an admin if there's an error.
              </p>
            </Section>
          )}

          {/* Gear tab */}
          {tab === 'devices' && (
            <Section title="My Camera Gear" L={L}>
              {user.devices?.length === 0 || !user.devices ? (
                <p className={`font-inter text-sm text-center py-6 ${L?'text-gray-400':'text-gray-600'}`}>
                  No gear listed yet.<br />
                  <span className="text-[11px] text-gray-500">You can add gear from the Dashboard.</span>
                </p>
              ) : (
                <div className="space-y-3">
                  {user.devices.map((d,i) => (
                    <div key={i} className={`flex items-center gap-3 py-2.5 border-b last:border-0 ${L?'border-black/5':'border-white/5'}`}>
                      <span className="text-xl">{d.type==='camera'?'📷':d.type==='lens'?'🔭':'📦'}</span>
                      <div>
                        <p className={`font-inter text-sm ${L?'text-gray-900':'text-white'}`}>{d.name}</p>
                        {d.brand && <p className="font-inter text-xs text-gray-500">{d.brand}</p>}
                      </div>
                      <span className={`ml-auto font-inter text-[10px] px-2 py-0.5 rounded-full ${L?'bg-black/5 text-gray-500':'bg-white/5 text-gray-500'} capitalize`}>{d.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
