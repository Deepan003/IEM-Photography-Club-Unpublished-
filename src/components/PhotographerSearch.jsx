import { useState, useEffect } from 'react'
import { membersApi } from '../api/api.js'

// ── Photographer search — local filter, Gmail-style recognition ───────────────
// Shared by the public Club Gallery page and the admin/core Gallery dashboard.
// Uploader can free-type any name; as they type, registered members from the
// database surface in a dropdown (profile pic + name + department · year).
// Picking one attaches the userId so the member's avatar/profile links through.
export default function PhotographerSearch({ value, onSelect, required, L }) {
  const [allMembers, setAllMembers] = useState([])
  const [q,          setQ]          = useState(value?.name || '')
  const [results,    setResults]    = useState([])
  const [open,       setOpen]       = useState(false)
  const [matched,    setMatched]    = useState(value?.userId ? value : null)

  // Load all approved members once on mount
  useEffect(() => {
    membersApi.list().then(d => setAllMembers(d.members || [])).catch(() => {})
  }, [])

  const search = (text) => {
    setQ(text)
    setMatched(null)
    if (!text.trim()) { setResults([]); onSelect(null); return }
    // Filter locally — instant, no API needed
    const filtered = allMembers
      .filter(m => m.name.toLowerCase().includes(text.trim().toLowerCase()))
      .slice(0, 8)
    setResults(filtered)
    setOpen(true)
    // Exact match → auto-recognise
    const exact = filtered.find(m => m.name.toLowerCase() === text.trim().toLowerCase())
    if (exact) { setMatched(exact); onSelect({ userId: exact._id, name: exact.name }) }
    else onSelect({ name: text.trim() })
  }

  const pick = (u) => {
    setQ(u.name); setMatched(u); onSelect({ userId: u._id, name: u.name })
    setResults([]); setOpen(false)
  }

  const clear = () => { setQ(''); setMatched(null); setResults([]); onSelect(null) }

  const yr = (u) => u.startYear ? `${u.startYear}–${u.endYear}` : ''

  // Gmail-style: when a registered member is matched, show coloured pill instead of input
  if (matched) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background:'rgba(220,38,38,0.1)', border:'1.5px solid rgba(220,38,38,0.35)' }}>
        {matched.profilePhoto
          ? <img src={matched.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0"/>
          : <div className="w-7 h-7 rounded-full flex items-center justify-center font-inter font-bold text-xs text-white shrink-0"
              style={{background:'#dc2626'}}>{matched.name[0].toUpperCase()}</div>}
        <div className="flex-1 min-w-0">
          <p className="font-inter text-sm font-semibold text-red-400 leading-tight truncate">{matched.name}</p>
          {yr(matched) && <p className="font-inter text-[9px] text-red-400/60">{matched.department} · {yr(matched)}</p>}
        </div>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
        <button type="button" onClick={clear} className="text-gray-500 hover:text-red-400 transition-colors shrink-0 w-5 h-5 flex items-center justify-center">✕</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input value={q}
        onChange={e => search(e.target.value)}
        onFocus={() => { setOpen(true); if (q.trim()) search(q) }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Start typing a name…"
        className={`glass-input w-full text-sm ${required && !q.trim() ? 'ring-1 ring-red-500/50' : ''}`}
        style={{ borderRadius:10 }}/>
      {open && results.length > 0 && (
        <div className={`absolute left-0 right-0 top-full mt-1 z-[999] rounded-xl overflow-hidden border shadow-2xl ${L?'bg-white border-black/8':'bg-[#111] border-white/8'}`}
          style={{ maxHeight:180, overflowY:'auto' }}>
          {results.map(u => (
            <button type="button" key={u._id} onMouseDown={() => pick(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-red-600/10 transition-colors">
              {u.profilePhoto
                ? <img src={u.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0"/>
                : <div className="w-8 h-8 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 font-inter font-bold text-xs shrink-0">{u.name[0]}</div>}
              <div className="min-w-0 flex-1">
                <p className={`font-inter text-xs font-semibold ${L?'text-gray-900':'text-white'} truncate`}>{u.name}</p>
                <p className="font-inter text-[9px] text-gray-500">{u.department}{yr(u) ? ' · ' + yr(u) : ''}</p>
              </div>
              <span className="font-inter text-[8px] text-green-400 shrink-0 font-semibold bg-green-500/10 px-1.5 py-0.5 rounded-full">Registered</span>
            </button>
          ))}
        </div>
      )}
      {required && !q.trim() && <p className="font-inter text-[9px] text-red-400 mt-1">Photographer name is required</p>}
    </div>
  )
}
