import { useState, useCallback, useRef, useEffect } from 'react'
import { Ic } from './_icons.jsx'
import { isEmail } from './_tokens.js'
import { Avatar } from './_shared.jsx'
import { announceApi } from '../../api/api.js'

export const PRESETS = [
  { id:'all',          label:'All Members',   Icon: Ic.Users  },
  { id:'cores',        label:'All Core',      Icon: Ic.Star   },
  { id:'coordinators', label:'Coordinators',  Icon: Ic.Dot    },
  { id:'stream',       label:'By Stream',     Icon: Ic.Sheet  },
  { id:'year',         label:'By Year',       Icon: Ic.Search },
  { id:'custom',       label:'Custom',        Icon: Ic.Plus   },
]

export const STREAMS = ['BBA','BTECH','MTECH','BCA','LLB','MBA','OTHER']

export function PresetButtons({ value, onChange, L }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map(({ id, label, Icon }) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-[12px] font-semibold tracking-[0.02em] transition-all duration-150 active:scale-[0.96]"
            style={on
              ? { background:'rgba(220,38,38,0.16)', border:'1px solid rgba(220,38,38,0.4)', color:'#fca5a5', boxShadow:'inset 2px 2px 5px rgba(0,0,0,0.25)' }
              : { background: L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.05)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.09)'}`, color: L?'#6b7280':'#6b7280' }}>
            <Icon width={12} height={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function RecipientField({ label, chips, onChange, L, placeholder='Add email or name…', allowMemberSearch=false }) {
  const [input,   setInput]   = useState('')
  const [results, setResults] = useState([])
  const [busy,    setBusy]    = useState(false)
  const [open,    setOpen]    = useState(false)
  const debRef  = useRef(null)
  const boxRef  = useRef(null)

  // Close the dropdown on any click/tap outside this field
  useEffect(() => {
    const onDown = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  // Clean up any pending debounce timer on unmount
  useEffect(() => () => clearTimeout(debRef.current), [])

  const search = useCallback(q => {
    if (!allowMemberSearch) return
    clearTimeout(debRef.current)
    if (!q.trim()) { setResults([]); setBusy(false); return }
    debRef.current = setTimeout(async () => {
      setBusy(true)
      try { const d = await announceApi.memberSearch(q); setResults(d.users || []) }
      catch { setResults([]) }
      finally { setBusy(false) }
    }, 280)
  }, [allowMemberSearch])

  const addChip = chip => {
    if (!chip.email) return
    if (!chips.find(c => c.email === chip.email)) onChange([...chips, chip])
    setInput(''); setResults([]); setOpen(false)
  }
  const removeChip = email => onChange(chips.filter(c => c.email !== email))
  const handleKey  = e => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const v = input.trim().replace(/,$/, '')
      if (isEmail(v)) addChip({ email: v, name: v, type: 'external' })
    }
    if (e.key === 'Escape') { setOpen(false); setResults([]) }
    if (e.key === 'Backspace' && !input && chips.length) removeChip(chips[chips.length-1].email)
  }

  const showDropdown = open && (results.length > 0 || busy)

  return (
    <div ref={boxRef}>
      {label && <label className={`font-inter text-[12px] uppercase tracking-widest mb-1.5 block ${L?'text-gray-500':'text-gray-400'}`}>{label}</label>}
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl min-h-[42px] items-start cursor-text transition-all"
          onClick={() => setOpen(true)}
          style={{
            background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)',
          }}>
          {chips.map(c => (
            <span key={c.email} className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full font-inter text-[13px] font-medium"
              style={{background:'rgba(220,38,38,0.18)',border:'1px solid rgba(220,38,38,0.38)',color:'#fca5a5'}}>
              {c.photo && <Avatar name={c.name} photo={c.photo} size={16} />}
              <span className="max-w-[130px] truncate">{c.name && c.name !== c.email ? c.name : c.email}</span>
              <button onClick={(e) => { e.stopPropagation(); removeChip(c.email) }} className="opacity-50 hover:opacity-100 transition-opacity">
                <Ic.X width={10} height={10} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <Ic.Search width={12} height={12} className={`shrink-0 ${L?'text-gray-400':'text-gray-400'}`} />
            <input value={input}
              onFocus={() => setOpen(true)}
              onChange={e => { const v = e.target.value; setInput(v); setOpen(true); search(v) }}
              onKeyDown={handleKey}
              placeholder={chips.length ? '' : placeholder}
              className={`flex-1 bg-transparent text-[14px] font-inter outline-none min-w-0
                ${L?'text-gray-800 placeholder-gray-400':'text-white placeholder-gray-500'}`} />
          </div>
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{
              background: L ? '#fff' : '#0e0505',
              border: `1px solid ${L?'rgba(0,0,0,0.1)':'rgba(220,38,38,0.2)'}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.08)',
            }}>
            <div className="max-h-[260px] overflow-y-auto" style={{scrollbarWidth:'thin'}}>
              {busy && results.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3">
                  <Ic.Search width={12} height={12} className="text-gray-500 animate-pulse" />
                  <span className="font-inter text-[13px] text-gray-400">Searching members…</span>
                </div>
              )}
              {results.map(u => (
                <button key={u._id}
                  onMouseDown={e => { e.preventDefault(); addChip({email:u.email,name:u.name,photo:u.profilePhoto,type:'user',userId:u._id}) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${L?'hover:bg-black/4':'hover:bg-white/4'}`}>
                  <Avatar name={u.name} photo={u.profilePhoto} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-inter text-[14px] font-semibold truncate ${L?'text-gray-900':'text-white'}`}>{u.name}</p>
                    <p className="font-inter text-[12px] text-gray-400 truncate">{u.department} · {u.email}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-inter uppercase font-bold tracking-wide
                    ${u.role==='core'?'bg-amber-900/40 text-amber-300 border border-amber-700/40':u.role==='coordinator'?'bg-blue-900/40 text-blue-300 border border-blue-700/40':'bg-gray-800 text-gray-400 border border-gray-700/40'}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
