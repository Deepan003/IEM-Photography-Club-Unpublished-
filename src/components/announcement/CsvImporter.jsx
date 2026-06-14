import { useState, useRef } from 'react'
import { Ic } from './_icons.jsx'
import { isEmail } from './_tokens.js'

let _Papa, _XLSX
async function loadPapa() { if (!_Papa) _Papa = (await import('papaparse')).default; return _Papa }
async function loadXLSX() { if (!_XLSX) _XLSX = await import('xlsx'); return _XLSX }

function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}
function extractGid(url) {
  const m = url.match(/[#&?]gid=(\d+)/)
  return m ? m[1] : null
}
function analyseColumns(rows) {
  const sampleRows = rows.slice(0, 100)
  const cols = Object.keys(rows[0] || {})
  const emailScores = cols.map(c => {
    const vals = sampleRows.map(r => String(r[c]||'').trim())
    const hits  = vals.filter(v => isEmail(v)).length
    return { col: c, score: hits / Math.max(vals.filter(v=>v).length, 1) }
  }).sort((a,b) => b.score - a.score)
  const nameKW = ['name','full','first','last','person','contact','member','participant','student','user']
  const nameScores = cols.map(c => ({
    col: c,
    score: nameKW.some(k => c.toLowerCase().includes(k)) ? 1 : 0,
  })).sort((a,b) => b.score - a.score)
  return {
    cols,
    bestEmail: emailScores[0]?.score > 0.1 ? emailScores[0].col : '',
    bestName:  nameScores[0]?.score  > 0   ? nameScores[0].col  : '',
    emailConf: Math.round((emailScores[0]?.score||0)*100),
  }
}

export default function CsvImporter({ onImport, L }) {
  const [step,        setStep]        = useState('idle')
  const [srcType,     setSrcType]     = useState('file')
  const [sheetsUrl,   setSheetsUrl]   = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlErr,      setUrlErr]      = useState('')
  const [workbook,    setWorkbook]    = useState(null)
  const [sheetNames,  setSheetNames]  = useState([])
  const [activeSheet, setActiveSheet] = useState('')
  const [raw,         setRaw]         = useState([])
  const [cols,        setCols]        = useState([])
  const [emailCol,    setEmailCol]    = useState('')
  const [nameCol,     setNameCol]     = useState('')
  const [emailConf,   setEmailConf]   = useState(0)
  const [mapped,      setMapped]      = useState([])
  const [selected,    setSelected]    = useState(new Set())
  const fileRef = useRef(null)

  const loadRows = rows => {
    if (!rows.length) return
    const { cols: c, bestEmail, bestName, emailConf: ec } = analyseColumns(rows)
    setRaw(rows); setCols(c); setEmailCol(bestEmail); setNameCol(bestName); setEmailConf(ec); setStep('mapping')
  }

  const handleFile = async file => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'csv' || ext === 'txt') {
      const Papa = await loadPapa()
      Papa.parse(file, {
        header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim(),
        complete: r => { if (r.data.length) loadRows(r.data) },
      })
    } else if (['xlsx','xls','ods'].includes(ext)) {
      const XLSX = await loadXLSX()
      const reader = new FileReader()
      reader.onload = e => {
        const buf = new Uint8Array(e.target.result)
        const wb  = XLSX.read(buf, { type: 'array' })
        if (wb.SheetNames.length === 1) {
          loadRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' }))
        } else {
          const wb2 = { sheetNames: wb.SheetNames, getSheet: n => XLSX.utils.sheet_to_json(wb.Sheets[n], { defval:'' }) }
          setWorkbook(wb2); setSheetNames(wb.SheetNames); setActiveSheet(wb.SheetNames[0]); setStep('sheet-select')
        }
      }
      reader.readAsArrayBuffer(file)
    } else setUrlErr('Unsupported file type. Use .csv, .xlsx, .xls, or .ods.')
  }

  const handleSheetsUrl = async () => {
    setUrlErr(''); setFetchingUrl(true)
    try {
      const id  = extractSheetId(sheetsUrl)
      if (!id) throw new Error('Could not find a spreadsheet ID. Paste the full Google Sheets URL.')
      const gid = extractGid(sheetsUrl) || '0'
      const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Could not fetch. Make sure the sheet is set to "Anyone with the link can view".')
      const text = await resp.text()
      const Papa = await loadPapa()
      const res  = Papa.parse(text, { header:true, skipEmptyLines:'greedy', transformHeader:h=>h.trim() })
      if (!res.data.length) throw new Error('Sheet appears empty.')
      loadRows(res.data)
    } catch (e) { setUrlErr(e.message) }
    finally { setFetchingUrl(false) }
  }

  const doMapping = () => {
    if (!emailCol) return
    const contacts = raw
      .map(r => ({ email: String(r[emailCol]||'').trim().toLowerCase(), name: nameCol ? String(r[nameCol]||'').trim() : '' }))
      .filter(c => isEmail(c.email))
      .filter((c,i,a) => a.findIndex(x=>x.email===c.email)===i)
    setMapped(contacts); setSelected(new Set(contacts.map(c=>c.email))); setStep('preview')
  }

  const finalImport = () => {
    onImport(mapped.filter(c=>selected.has(c.email)).map(c=>({...c,type:'external'})))
    setStep('done')
  }

  if (step === 'idle') return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1.5 rounded-xl"
        style={{background: L?'rgba(0,0,0,0.04)':'rgba(220,38,38,0.04)', border:`1px solid ${L?'rgba(0,0,0,0.06)':'rgba(220,38,38,0.1)'}`}}>
        {[['file',<Ic.Import width={12} height={12} />,'Upload File'],['sheets',<Ic.Link width={12} height={12} />,'Google Sheets']].map(([t,icon,l])=>(
          <button key={t} onClick={() => setSrcType(t)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-inter text-[12px] font-medium transition-all active:scale-[0.97]"
            style={srcType===t
              ? { background:'rgba(220,38,38,0.2)', border:'1px solid rgba(220,38,38,0.4)', color:'#fca5a5' }
              : { color: L?'#9ca3af':'#6b7280' }}>
            {icon} {l}
          </button>
        ))}
      </div>

      {srcType === 'file' && (
        <div className="relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group"
          style={{borderColor: L?'rgba(0,0,0,0.12)':'rgba(220,38,38,0.18)', background: L?'rgba(0,0,0,0.02)':'rgba(220,38,38,0.02)'}}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods,.txt" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.28)'}}>
            <Ic.Import width={20} height={20} className="text-red-400" />
          </div>
          <p className={`font-inter font-semibold text-sm ${L?'text-gray-700':'text-gray-300'}`}>Drop a file or click to browse</p>
          <p className={`font-inter text-[12px] mt-2 leading-relaxed ${L?'text-gray-500':'text-gray-400'}`}>
            .csv · .xlsx · .xls · .ods — any layout, any number of columns<br/>
            Email columns auto-detected · Multi-sheet Excel shows sheet selector
          </p>
        </div>
      )}

      {srcType === 'sheets' && (
        <div className="space-y-3">
          <div className="rounded-xl p-4" style={{background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.2)'}}>
            <p className="font-inter text-xs font-semibold text-blue-300 mb-1.5">How to use</p>
            <p className="font-inter text-[12px] text-blue-400 leading-relaxed">
              1. Open your Google Sheet → Share → "Anyone with the link" → Viewer<br/>
              2. Copy the URL from the address bar and paste it below
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Ic.Link width={13} height={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={sheetsUrl} onChange={e => { setSheetsUrl(e.target.value); setUrlErr('') }}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl font-mono text-[13px] outline-none transition-all
                  ${L?'bg-black/5 border border-black/10 text-gray-800 placeholder-gray-400':'bg-white/5 border border-white/10 text-white placeholder-gray-600'}`}
                style={{boxShadow:'inset 0 2px 4px rgba(0,0,0,0.15)'}} />
            </div>
            <button onClick={handleSheetsUrl} disabled={!sheetsUrl.trim()||fetchingUrl}
              className="flex items-center gap-2 px-4 rounded-xl font-inter text-xs font-semibold text-white transition-all disabled:opacity-50 active:scale-[0.97]"
              style={{background:'rgba(220,38,38,0.18)',border:'1px solid rgba(220,38,38,0.4)',boxShadow:'0 2px 16px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',minHeight:'42px'}}>
              {fetchingUrl ? '…' : <><Ic.Import width={13} height={13} />Import</>}
            </button>
          </div>
          {urlErr && <p className="font-inter text-xs text-red-400">{urlErr}</p>}
        </div>
      )}
    </div>
  )

  if (step === 'sheet-select') return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
        <p className="font-inter text-xs font-semibold text-amber-300 mb-3">
          This workbook has {sheetNames.length} sheets — select one to import
        </p>
        <div className="flex flex-wrap gap-2">
          {sheetNames.map(n => (
            <button key={n} onClick={() => setActiveSheet(n)}
              className="px-3 py-1.5 rounded-xl font-inter text-xs font-medium border transition-all active:scale-[0.96]"
              style={activeSheet===n
                ? {background:'rgba(220,38,38,0.22)',border:'1px solid rgba(220,38,38,0.5)',color:'#fca5a5'}
                : {background: L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'}`, color: L?'#6b7280':'#6b7280'}}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { workbook && loadRows(workbook.getSheet(activeSheet)) }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-inter text-xs font-semibold text-white active:scale-[0.97]"
          style={{background:'rgba(220,38,38,0.18)',border:'1px solid rgba(220,38,38,0.4)',boxShadow:'0 2px 16px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
          Use "{activeSheet}"
        </button>
        <button onClick={() => setStep('idle')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-xs transition-all ${L?'bg-black/5 text-gray-600':'bg-white/5 text-gray-400'}`}>
          <Ic.Back width={12} height={12} /> Back
        </button>
      </div>
    </div>
  )

  if (step === 'mapping') return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.18)'}}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-inter text-xs font-semibold text-amber-300">{raw.length} rows loaded</p>
          {emailConf > 0 && (
            <span className={`font-inter text-[11px] px-2 py-0.5 rounded-full border font-medium
              ${emailConf>=60 ? 'bg-green-900/30 text-green-300 border-green-700/30' : 'bg-amber-900/30 text-amber-300 border-amber-700/30'}`}>
              {emailConf>=60 ? `Email detected (${emailConf}% confidence)` : `Low confidence — verify below`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[['Email Column *', emailCol, setEmailCol, true], ['Name Column', nameCol, setNameCol, false]].map(([lbl,val,set,req])=>(
            <div key={lbl}>
              <label className={`font-inter text-[11px] uppercase tracking-widest mb-1 block ${L?'text-gray-500':'text-gray-400'}`}>{lbl}</label>
              <div className="relative">
                <select value={val} onChange={e => set(e.target.value)}
                  className={`w-full appearance-none px-3 py-2 pr-7 rounded-xl text-[13px] font-inter outline-none
                    ${L?'bg-black/5 border border-black/10 text-gray-800':'bg-white/5 border border-white/10 text-white'}`}>
                  <option value="">{req ? 'Select column…' : 'None'}</option>
                  {cols.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Ic.ChevDown width={12} height={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl" style={{border:`1px solid ${L?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)'}`}}>
          <table className="w-full text-[12px] font-inter">
            <thead>
              <tr style={{background: L?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)'}}>
                {cols.slice(0,6).map(c=>(
                  <th key={c} className={`px-3 py-2 text-left font-semibold whitespace-nowrap
                    ${c===emailCol?'text-red-400':c===nameCol?'text-blue-400':L?'text-gray-500':'text-gray-400'}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raw.slice(0,3).map((r,i)=>(
                <tr key={i} className={`border-t ${L?'border-black/5':'border-white/5'}`}>
                  {cols.slice(0,6).map(c=>(
                    <td key={c} className={`px-3 py-1.5 max-w-[110px] truncate
                      ${c===emailCol?'text-red-300':c===nameCol?'text-blue-300':L?'text-gray-700':'text-gray-400'}`}>
                      {String(r[c]||'')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={doMapping} disabled={!emailCol}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-inter text-xs font-semibold text-white transition-all disabled:opacity-40 active:scale-[0.97]"
          style={{background:'rgba(220,38,38,0.18)',border:'1px solid rgba(220,38,38,0.4)',boxShadow:'0 2px 16px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
          <Ic.Search width={13} height={13} /> Extract contacts
        </button>
        <button onClick={() => setStep('idle')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-xs transition-all ${L?'bg-black/5 text-gray-600':'bg-white/5 text-gray-400'}`}>
          <Ic.Back width={12} height={12} /> Back
        </button>
      </div>
    </div>
  )

  if (step === 'preview') return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`font-inter text-xs ${L?'text-gray-600':'text-gray-400'}`}>
          <span className="font-bold text-red-400">{selected.size}</span> / {mapped.length} contacts selected
          <span className={`ml-2 ${L?'text-gray-400':'text-gray-400'}`}>(duplicates removed)</span>
        </p>
        <div className="flex gap-2">
          {[['All', ()=>setSelected(new Set(mapped.map(c=>c.email)))], ['None', ()=>setSelected(new Set())]].map(([l,fn])=>(
            <button key={l} onClick={fn}
              className={`font-inter text-[12px] px-2.5 py-1 rounded-lg transition-all ${L?'bg-black/5 hover:bg-black/8 text-gray-600':'bg-white/5 hover:bg-white/8 text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto rounded-xl divide-y"
        style={{border:`1px solid ${L?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)'}`, scrollbarWidth:'thin'}}>
        {mapped.map(c => (
          <label key={c.email}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${L?'hover:bg-black/3':'hover:bg-white/3'}`}>
            <input type="checkbox" checked={selected.has(c.email)}
              onChange={e => setSelected(p => { const n=new Set(p); e.target.checked?n.add(c.email):n.delete(c.email); return n })}
              className="accent-red-600 rounded" />
            {c.name && <p className={`font-inter text-[13px] font-medium truncate w-32 ${L?'text-gray-800':'text-gray-200'}`}>{c.name}</p>}
            <p className="font-inter text-[12px] text-gray-400 truncate flex-1">{c.email}</p>
          </label>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <button onClick={finalImport} disabled={!selected.size}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-inter text-xs font-semibold text-white transition-all disabled:opacity-40 active:scale-[0.97]"
          style={{background:'rgba(220,38,38,0.18)',border:'1px solid rgba(220,38,38,0.4)',boxShadow:'0 2px 16px rgba(220,38,38,0.16), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
          <Ic.Check width={13} height={13} /> Add {selected.size} as recipients
        </button>
        <button onClick={()=>setStep('mapping')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-xs transition-all ${L?'bg-black/5 text-gray-600':'bg-white/5 text-gray-400'}`}>
          <Ic.Back width={12} height={12} /> Remap
        </button>
        <button onClick={()=>setStep('idle')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-xs transition-all ${L?'bg-black/5 text-gray-600':'bg-white/5 text-gray-400'}`}>
          <Ic.Import width={12} height={12} /> New import
        </button>
      </div>
    </div>
  )

  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{background:'rgba(5,150,105,0.15)',border:'1px solid rgba(5,150,105,0.3)'}}>
        <Ic.Check width={20} height={20} className="text-emerald-400" />
      </div>
      <p className={`font-inter text-sm font-semibold ${L?'text-gray-700':'text-gray-300'}`}>Contacts added to recipients</p>
      <button onClick={() => setStep('idle')} className="font-inter text-xs text-red-400 mt-2 hover:underline">Import more</button>
    </div>
  )
}
