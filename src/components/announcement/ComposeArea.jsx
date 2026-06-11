import { useState, useRef } from 'react'
import { Ic } from './_icons.jsx'
import { AttachmentPill } from './_shared.jsx'
import RecipientField from './RecipientField.jsx'
import { uploadAttachment } from '../../api/api.js'

const MAX_ATTACH_BYTES = 50 * 1024 * 1024  // 50 MB

export default function ComposeArea({ subject, setSubject, content, setContent,
                                      attachments, setAttachments,
                                      ccEmails, setCcEmails, bccEmails, setBccEmails,
                                      showCcBcc, setShowCcBcc, L }) {
  const [uploading, setUploading] = useState(false)
  const [attachErr, setAttachErr] = useState('')
  const fileRef = useRef(null)

  const handleFiles = async files => {
    setAttachErr('')
    const toUpload = []
    const rejected = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACH_BYTES) { rejected.push(`${file.name} exceeds 50 MB`); continue }
      toUpload.push(file)
    }
    if (rejected.length) setAttachErr(rejected.join(' · '))
    if (!toUpload.length) return
    setUploading(true)
    try {
      const uploaded = []
      for (const file of toUpload) {
        const r = await uploadAttachment(file)
        if (r?.publicUrl) uploaded.push({ name: file.name, url: r.publicUrl, size: file.size, mime: file.type })
      }
      setAttachments(a => [...a, ...uploaded])
    } catch (e) {
      setAttachErr(e.message || 'Upload failed')
    }
    finally { setUploading(false) }
  }

  const inputCls = `w-full px-4 py-3 rounded-xl font-inter text-sm outline-none transition-all ${
    L ? 'bg-black/4 border border-black/10 text-gray-900 placeholder-gray-400 focus:border-red-400'
      : 'bg-white/4 border border-white/10 text-white placeholder-gray-500 focus:border-red-500'
  }`
  const inputStyle = { boxShadow:'inset 0 2px 6px rgba(0,0,0,0.18)', colorScheme: L?'light':'dark' }

  return (
    <div className="space-y-3">
      {/* Subject */}
      <div>
        <label className={`font-inter text-[11px] uppercase tracking-widest mb-1.5 block font-semibold ${L?'text-gray-500':'text-gray-400'}`}>
          Subject <span className="text-red-400">*</span>
        </label>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="E.g. Photography Walk — This Weekend!"
          autoComplete="off" autoCorrect="off" spellCheck={false} name="announce-subject-field"
          className={inputCls} style={inputStyle} />
      </div>

      {/* CC / BCC toggle */}
      <div className="flex items-center gap-2">
        {[['cc','+ CC'], ['bcc','+ BCC']].map(([k,l]) => (
          <button key={k} onClick={() => setShowCcBcc(s=>({...s,[k]:!s[k]}))}
            className={`font-inter text-[12px] px-2.5 py-1 rounded-lg border transition-all font-medium active:scale-[0.96]
              ${showCcBcc[k]
                ? 'bg-red-700/30 border-red-600/40 text-red-300'
                : L ? 'border-black/10 text-gray-500 hover:bg-black/5' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}>
            {l}
          </button>
        ))}
      </div>
      {showCcBcc.cc && (
        <RecipientField label="CC" chips={ccEmails.map(e=>({email:e,name:e,type:'external'}))}
          onChange={arr => setCcEmails(arr.map(c=>c.email))} L={L}
          placeholder="Add CC email…" allowMemberSearch />
      )}
      {showCcBcc.bcc && (
        <RecipientField label="BCC" chips={bccEmails.map(e=>({email:e,name:e,type:'external'}))}
          onChange={arr => setBccEmails(arr.map(c=>c.email))} L={L}
          placeholder="Add BCC email…" allowMemberSearch />
      )}

      {/* Body */}
      <div>
        <label className={`font-inter text-[11px] uppercase tracking-widest mb-1.5 block font-semibold ${L?'text-gray-500':'text-gray-400'}`}>
          Message body
          <span className={`normal-case font-normal ml-2 ${L?'text-gray-400':'text-gray-500'}`}>HTML supported — bare links auto-convert</span>
        </label>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={7}
          placeholder={"Write your message here…\n\nPaste links like www.google.com — they'll become clickable automatically."}
          autoComplete="off" autoCorrect="off" spellCheck={false} name="announce-body-field"
          className={`${inputCls} font-mono text-[13px] leading-relaxed resize-y min-h-[140px]`}
          style={inputStyle} />
      </div>

      {/* Attachments */}
      <div>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className={`font-inter text-[11px] uppercase tracking-widest font-semibold ${L?'text-gray-500':'text-gray-400'}`}>Attachments</span>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className={`flex items-center gap-1.5 font-inter text-[12px] px-3 py-1.5 rounded-lg border transition-all active:scale-[0.96]
              ${L?'border-black/10 text-gray-600 hover:bg-black/5':'border-white/10 text-gray-400 hover:bg-white/5'}`}>
            <Ic.Attach width={12} height={12} />
            {uploading ? 'Uploading…' : 'Attach files'}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </div>
        {attachErr && (
          <p className="font-inter text-[11px] text-red-400 mb-1.5">{attachErr}</p>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att,i) => (
              <AttachmentPill key={i} att={att} L={L} onRemove={() => setAttachments(a=>a.filter((_,j)=>j!==i))} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
