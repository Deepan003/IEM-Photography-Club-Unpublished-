import { useState, useEffect, useCallback } from 'react'
import { adminApi }          from '../../api/admin.js'
import { computeAcademicYear } from '../../utils/yearCalc.js'

// ── Shared ────────────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  admin:        'bg-red-900/40 text-red-400 border-red-800/50',
  core:         'bg-amber-900/40 text-amber-400 border-amber-800/50',
  coordinator:  'bg-blue-900/40 text-blue-400 border-blue-800/50',
  photographer: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50',
}
const ROLE_ICON  = { admin:'👑', core:'⭐', coordinator:'🔵', photographer:'📷' }

const STATUS_BADGE = {
  approved:       'bg-green-900/30 text-green-400 border-green-800/40',
  pending_admin:  'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
  pending_email:  'bg-gray-800/50 text-gray-400 border-gray-700/40',
  rejected:       'bg-red-900/30 text-red-400 border-red-800/40',
  passout:        'bg-gray-800/50 text-gray-500 border-gray-700/40',
  banned:         'bg-red-950/60 text-red-300 border-red-900/60',
}
const STATUS_LABEL = {
  approved:      '✓ Approved',
  pending_admin: '⏳ Awaiting Approval',
  pending_email: '📧 Email Unverified',
  rejected:      '✗ Rejected',
  passout:       '🎓 Passout',
  banned:        '🚫 Banned',
}

function Badge({ style, children }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-tech uppercase tracking-wider ${style}`}>
      {children}
    </span>
  )
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-[#0d0d0d] border border-white/8 p-4">
      <p className="text-gray-500 text-[10px] font-tech uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-cine text-3xl ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-1 font-body">{sub}</p>}
    </div>
  )
}

// ── Reject confirm inline ─────────────────────────────────────────────────────
function RejectConfirm({ onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('')
  return (
    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
      <input
        value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full bg-black border border-white/10 px-2 py-1.5 text-white text-xs font-body focus:border-red-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => onConfirm(reason)} disabled={loading}
          className="flex-1 bg-red-800 hover:bg-red-700 text-white text-xs font-tech uppercase py-1.5 transition-colors disabled:opacity-50">
          {loading ? '…' : 'Confirm Reject'}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-white/10 text-gray-400 hover:text-white text-xs font-tech uppercase py-1.5 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Delete confirmation inline ────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="mt-2 border border-red-900/50 bg-red-950/20 p-3 space-y-2">
      <p className="text-red-300 text-xs font-body">
        ⚠ Permanently delete <strong>{name}</strong>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 bg-red-800 hover:bg-red-700 text-white text-xs font-tech uppercase py-1.5 transition-colors disabled:opacity-50">
          {loading ? '…' : 'Yes, Delete Forever'}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-white/10 text-gray-400 hover:text-white text-xs font-tech uppercase py-1.5 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── User card ─────────────────────────────────────────────────────────────────
function UserCard({ user, mode, currentUserRole, onAction }) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState('')

  const initials     = user.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const academicYear = computeAcademicYear(user.startYear, user.endYear)
  const dept         = user.department === 'OTHER' ? (user.departmentOther || 'Other') : user.department

  const act = async (fn, label) => {
    setBusy(true); setMsg('')
    try { await fn(); setMsg(`✓ ${label}`); onAction() }
    catch (e) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-[#0d0d0d] border border-white/8 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shrink-0">
          <span className="font-cine text-sm text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-body text-sm font-medium truncate">{user.name}</p>
          <p className="text-gray-500 text-xs font-body truncate">{user.email}</p>
        </div>
        <div className="shrink-0 flex flex-col gap-1 items-end">
          <Badge style={ROLE_BADGE[user.role] || ROLE_BADGE.photographer}>
            {ROLE_ICON[user.role]} {user.role}
          </Badge>
          {mode === 'all' && (
            <Badge style={STATUS_BADGE[user.status] || ''}>
              {STATUS_LABEL[user.status] || user.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span className="text-gray-600">Dept: </span><span className="text-gray-300">{dept}</span></div>
        <div><span className="text-gray-600">Year: </span><span className="text-gray-300">{academicYear.label}</span></div>
        <div><span className="text-gray-600">Enroll: </span><span className="text-gray-300">{user.enrollmentNumber}</span></div>
        <div><span className="text-gray-600">Roll: </span><span className="text-gray-300">{user.rollNumber}</span></div>
        <div><span className="text-gray-600">Batch: </span><span className="text-gray-300">{user.startYear}–{user.endYear}</span></div>
        <div><span className="text-gray-600">Joined: </span><span className="text-gray-300">{new Date(user.createdAt).toLocaleDateString('en-IN')}</span></div>
      </div>

      {/* ── Actions ── */}
      {user.role !== 'admin' && (
        <div className="space-y-2 pt-1 border-t border-white/5">

          {/* Pending: approve / reject */}
          {mode === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => act(() => adminApi.approve(user._id), 'Approved')} disabled={busy}
                className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-tech uppercase py-1.5 transition-colors disabled:opacity-50">
                {busy ? '…' : '✓ Approve'}
              </button>
              <button onClick={() => setRejectOpen(r => !r)} disabled={busy}
                className="flex-1 border border-red-800/60 hover:bg-red-900/30 text-red-400 text-xs font-tech uppercase py-1.5 transition-colors disabled:opacity-50">
                ✗ Reject
              </button>
            </div>
          )}
          {rejectOpen && (
            <RejectConfirm
              loading={busy}
              onConfirm={reason => act(() => adminApi.reject(user._id, reason), 'Rejected')}
              onCancel={() => setRejectOpen(false)}
            />
          )}

          {/* Members: promote / demote */}
          {mode === 'members' && (
            <div className="flex flex-wrap gap-1.5">
              {user.role === 'photographer' && (
                <button onClick={() => act(() => adminApi.promote(user._id, 'coordinator'), 'Promoted to Coordinator')} disabled={busy}
                  className="text-[10px] font-tech uppercase px-2.5 py-1 border border-blue-700/40 text-blue-400 hover:bg-blue-900/30 transition-colors disabled:opacity-50">
                  ↑ Coordinator
                </button>
              )}
              {(user.role === 'photographer' || user.role === 'coordinator') && currentUserRole === 'admin' && (
                <button onClick={() => act(() => adminApi.promote(user._id, 'core'), 'Promoted to Core')} disabled={busy}
                  className="text-[10px] font-tech uppercase px-2.5 py-1 border border-amber-700/40 text-amber-400 hover:bg-amber-900/30 transition-colors disabled:opacity-50">
                  ↑ Core
                </button>
              )}
              {user.role !== 'photographer' && (
                <button onClick={() => act(() => adminApi.demote(user._id), 'Demoted')} disabled={busy}
                  className="text-[10px] font-tech uppercase px-2.5 py-1 border border-white/10 text-gray-500 hover:text-white transition-colors disabled:opacity-50">
                  ↓ Demote
                </button>
              )}
            </div>
          )}

          {/* ── Ban / Delete — visible on ALL tabs for any non-admin user ── */}
          <div className="flex flex-wrap gap-1.5">
            {/* Ban / Unban */}
            {user.status !== 'banned' ? (
              <button onClick={() => act(() => adminApi.ban(user._id), 'Banned')} disabled={busy}
                className="text-[10px] font-tech uppercase px-2.5 py-1 border border-orange-700/40 text-orange-400 hover:bg-orange-900/20 transition-colors disabled:opacity-50">
                🚫 Ban
              </button>
            ) : (
              <button onClick={() => act(() => adminApi.unban(user._id), 'Unbanned')} disabled={busy}
                className="text-[10px] font-tech uppercase px-2.5 py-1 border border-green-700/40 text-green-400 hover:bg-green-900/20 transition-colors disabled:opacity-50">
                ✓ Unban
              </button>
            )}

            {/* Delete — admin only, always visible */}
            {currentUserRole === 'admin' && (
              <button onClick={() => setDeleteOpen(d => !d)} disabled={busy}
                className="text-[10px] font-tech uppercase px-2.5 py-1 border border-red-900/60 text-red-500 hover:bg-red-950/30 transition-colors disabled:opacity-50">
                🗑 Delete
              </button>
            )}
          </div>

          {deleteOpen && (
            <DeleteConfirm
              name={user.name}
              loading={busy}
              onConfirm={() => act(() => adminApi.deleteUser(user._id), 'Deleted permanently')}
              onCancel={() => setDeleteOpen(false)}
            />
          )}
        </div>
      )}

      {msg && <p className={`text-xs font-body mt-1 ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
    </div>
  )
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
export default function AdminPanel({ currentUser, onBack }) {
  const [tab,       setTab]       = useState('pending')
  const [pending,   setPending]   = useState([])
  const [members,   setMembers]   = useState([])
  const [allUsers,  setAllUsers]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [error,     setError]     = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pRes, mRes, aRes] = await Promise.all([
        adminApi.getPending(),
        adminApi.getUsers({ status: 'approved' }),
        adminApi.getUsers(),
      ])
      setPending(pRes.users  || [])
      setMembers(mRes.users  || [])
      setAllUsers(aRes.users || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Filter helpers
  const filterBySearch = arr =>
    !search.trim()
      ? arr
      : arr.filter(u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.enrollmentNumber?.toLowerCase().includes(search.toLowerCase())
        )

  const shown = filterBySearch(
    tab === 'pending' ? pending :
    tab === 'members' ? members :
    allUsers
  )

  // Stats
  const totalApproved    = allUsers.filter(u => u.status === 'approved').length
  const totalPending     = pending.length
  const totalCore        = allUsers.filter(u => u.role === 'core').length
  const totalCoordinator = allUsers.filter(u => u.role === 'coordinator').length

  const TABS = [
    { id: 'pending', label: 'Pending' },
    { id: 'members', label: 'Members' },
    { id: 'all',     label: 'All Users' },
  ]

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 flex flex-col">

      {/* ── Header ── */}
      <header className="w-full border-b border-white/5 bg-black/60 backdrop-blur-sm px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/IEM_20260416_215615_0000.png" alt="logo" className="w-7 h-7 rounded-full" />
          <div>
            <p className="font-tech text-white text-sm uppercase tracking-widest">Admin Panel</p>
            <p className="text-gray-600 text-[10px] font-tech uppercase tracking-wider hidden sm:block">IEM Photography Club</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} title="Refresh"
            className="text-gray-500 hover:text-white transition-colors text-sm px-2">↻</button>
          <button onClick={onBack}
            className="font-tech text-xs text-gray-500 hover:text-white uppercase tracking-wider transition-colors px-3 py-1.5 border border-white/8 hover:border-white/20">
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Members"   value={totalApproved}    color="text-white" />
            <StatCard label="Pending"         value={totalPending}     color={totalPending > 0 ? 'text-yellow-400' : 'text-white'} />
            <StatCard label="Core"            value={totalCore}        color="text-amber-400" />
            <StatCard label="Coordinators"    value={totalCoordinator} color="text-blue-400" />
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-white/8">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative font-tech text-xs uppercase tracking-widest px-5 py-2.5 transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? 'border-red-600 text-white'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}>
                {t.label}
                {t.id === 'pending' && totalPending > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-600 text-white font-inter text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {totalPending > 99 ? '99+' : totalPending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Search ── */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or enrollment…"
            className="w-full bg-[#0d0d0d] border border-white/8 px-4 py-2.5 text-white text-sm font-body focus:border-red-500 focus:outline-none"
          />

          {/* ── Content ── */}
          {error && <p className="text-red-400 font-body text-sm">{error}</p>}

          {loading ? (
            <div className="py-16 text-center">
              <p className="font-tech text-gray-600 text-xs uppercase tracking-widest animate-pulse">Loading…</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/8">
              <p className="font-tech text-gray-600 text-xs uppercase tracking-widest">
                {tab === 'pending' ? 'No pending requests 🎉' : 'No users found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shown.map(u => (
                <UserCard
                  key={u._id}
                  user={u}
                  mode={tab === 'all' ? 'all' : tab === 'pending' ? 'pending' : 'members'}
                  currentUserRole={currentUser.role}
                  onAction={fetchAll}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
