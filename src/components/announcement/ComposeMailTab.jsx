import { useState, useCallback, useEffect, useRef } from 'react'
import { Ic } from './_icons.jsx'
import { SectionLabel, PaneTabs, Empty, SendBtn, SaveDraftBtn, SentItem, DraftItem, MailSendOverlay, PreviewRecipientsModal, RateLimitNotice } from './_shared.jsx'
import RecipientField from './RecipientField.jsx'
import ComposeArea from './ComposeArea.jsx'
import CsvImporter from './CsvImporter.jsx'
import FolderPanel from './FolderPanel.jsx'
import { announceApi, uploadFileToS3 } from '../../api/api.js'
import { useAutoSaveDraft } from './_useAutoSave.js'

const innerStyle = (L) => ({
  background: L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
  border: `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '12px',
})

const FOLDER_COLORS_LOCAL = ['#dc2626','#d97706','#059669','#2563eb','#db2777','#0891b2','#7c3aed']

function FolderPickerInline({ folders, onAdd, open, onToggle, L }) {
  if (!folders.length) return null
  return (
    <div className="relative">
      <button onClick={onToggle}
        className="flex items-center gap-2 font-inter text-[12px] font-semibold px-3 py-2 rounded-xl border transition-all active:scale-[0.96]"
        style={open
          ? { background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.4)', color:'#fca5a5' }
          : { background:L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.05)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'}`, color:L?'#6b7280':'#6b7280' }}>
        <Ic.Folder width={12} height={12} />
        From folder
        <Ic.ChevDown width={10} height={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl overflow-hidden z-10 relative"
          style={{ background:L?'rgba(255,255,255,0.96)':'rgba(10,4,4,0.97)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.08)'}`, boxShadow:'0 12px 40px rgba(0,0,0,0.35)' }}>
          <p className={`px-3 pt-2.5 pb-1 font-inter text-[10px] uppercase tracking-widest font-semibold ${L?'text-gray-400':'text-gray-500'}`}>
            Select a folder
          </p>
          {folders.map(f => (
            <button key={f._id} onClick={() => onAdd(f)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${L?'hover:bg-black/5':'hover:bg-white/5'}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background:f.color+'1a', border:`1px solid ${f.color}38` }}>
                <Ic.Folder width={12} height={12} style={{ color:f.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-inter text-[13px] font-semibold truncate ${L?'text-gray-800':'text-white'}`}>{f.name}</p>
                <p className="font-inter text-[11px] text-gray-400">{f.contacts.length} contacts</p>
              </div>
              <Ic.Plus width={12} height={12} className="text-red-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ComposeMailTab({ L }) {
  const [toChips,    setToChips]    = useState([])
  const [subject,    setSubject]    = useState('')
  const [content,    setContent]    = useState('')
  const [ccEmails,   setCcEmails]   = useState([])
  const [bccEmails,  setBccEmails]  = useState([])
  const [attachments,setAttachments]= useState([])
  const [showCcBcc,  setShowCcBcc]  = useState({ cc:false, bcc:false })
  const [busy,       setBusy]       = useState(false)
  const [sendPhase,  setSendPhase]  = useState(null)
  const [overlayOut, setOverlayOut] = useState(false)
  const [sentCount,  setSentCount]  = useState(0)
  const [savingDraft,setSavingDraft]= useState(false)
  const [draftId,    setDraftId]    = useState(null)
  const [msg,        setMsg]        = useState({ text:'', ok:false })
  const [pane,       setPane]       = useState('compose')
  const [history,    setHistory]    = useState([])
  const [drafts,     setDrafts]     = useState([])
  const [folders,    setFolders]    = useState([])
  const [showImport,       setShowImport]       = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [importedContacts, setImportedContacts] = useState([])
  const [saveToFolder,     setSaveToFolder]     = useState(false)
  const [newFolderName,    setNewFolderName]     = useState('')
  const [saveToExisting,   setSaveToExisting]   = useState('')

  const draftIdRef = useRef(null)
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  const fetchHistory = useCallback(async()=>{ try{ const d=await announceApi.history(); setHistory(d.announcements||[]) }catch{} },[])
  const fetchDrafts  = useCallback(async()=>{ try{ const d=await announceApi.getDrafts(); setDrafts(d.drafts||[]) }catch{} },[])
  const fetchFolders = useCallback(async()=>{ try{ const d=await announceApi.getFolders(); setFolders(d.folders||[]) }catch{} },[])
  useEffect(()=>{ fetchHistory(); fetchDrafts(); fetchFolders() },[fetchHistory,fetchDrafts,fetchFolders])

  // ── Auto-save on tab switch / leave ────────────────────────────────────────
  useAutoSaveDraft(
    () => {
      if (!subject.trim() && !content.trim() && !toChips.length) return null
      return { kind:'compose', subject, content, toRecipients:toChips, ccEmails, bccEmails, attachments }
    },
    draftIdRef,
    setDraftId,
  )

  const handleCsvImport = contacts => {
    setImportedContacts(contacts)
    setToChips(p => { const ex=new Set(p.map(c=>c.email)); return [...p,...contacts.filter(c=>!ex.has(c.email))] })
    setShowImport(false)
  }

  const handleFolderAdd = folder => {
    const ex = new Set(toChips.map(c => c.email))
    const toAdd = folder.contacts.filter(c => c.email && !ex.has(c.email)).map(c => ({ ...c, type:'external' }))
    setToChips(p => [...p, ...toAdd])
    setShowFolderPicker(false)
  }

  // Preview modal: recipients are the current toChips
  const previewRecipients = toChips.map(c => ({ name: c.name || c.email, email: c.email }))
  const handlePreviewConfirm = confirmedEmails => {
    setToChips(toChips.filter(c => confirmedEmails.has(c.email)))
    setShowPreviewModal(false)
  }

  const saveFolder = async() => {
    if(!importedContacts.length) return
    try {
      if(saveToExisting) {
        const f=folders.find(f=>f._id===saveToExisting)
        if(f) { const m=[...f.contacts]; const ex=new Set(m.map(c=>c.email)); importedContacts.forEach(c=>{if(!ex.has(c.email))m.push(c)}); await announceApi.updateFolder(saveToExisting,{contacts:m}) }
      } else if(newFolderName.trim()) { await announceApi.createFolder({name:newFolderName,contacts:importedContacts,color:FOLDER_COLORS_LOCAL[0]}) }
      fetchFolders(); setNewFolderName(''); setSaveToExisting(''); setSaveToFolder(false)
    } catch(e) { console.error(e) }
  }

  const send = async() => {
    if(!subject.trim()) return setMsg({text:'Subject required.',ok:false})
    if(!content.trim()) return setMsg({text:'Message required.',ok:false})
    if(!toChips.length) return setMsg({text:'Add at least one recipient.',ok:false})
    setBusy(true); setMsg({text:'',ok:false})
    setSendPhase('sending'); setOverlayOut(false)
    try {
      const d=await announceApi.composeSend({subject,content,toRecipients:toChips,ccEmails,bccEmails,attachments,draftId})
      setSentCount(d.announcement.recipientCount)
      setSendPhase('sent')
      setMsg({text:'Sent to ' + d.announcement.recipientCount + ' recipient(s).',ok:true})
      setToChips([]); setSubject(''); setContent(''); setCcEmails([]); setBccEmails([]); setAttachments([]); setDraftId(null)
      draftIdRef.current = null
      setShowCcBcc({cc:false,bcc:false}); fetchHistory(); fetchDrafts()
      setTimeout(()=>setOverlayOut(true), 1450)
      setTimeout(()=>{ setSendPhase(null); setOverlayOut(false) }, 1780)
    } catch(e) { setMsg({text:e.message,ok:false}); setSendPhase(null) }
    finally { setBusy(false) }
  }

  const saveDraft = async() => {
    setSavingDraft(true)
    try {
      const b={kind:'compose',subject,content,toRecipients:toChips,ccEmails,bccEmails,attachments}
      if(draftId) await announceApi.updateDraft(draftId,b)
      else { const d=await announceApi.saveDraft(b); setDraftId(d.draft._id); draftIdRef.current=d.draft._id }
      setMsg({text:'Draft saved.',ok:true}); fetchDrafts()
    } catch(e) { setMsg({text:e.message,ok:false}) }
    finally { setSavingDraft(false) }
  }

  const loadDraft = d => {
    setSubject(d.subject==='(no subject)'?'':d.subject); setContent(d.content); setToChips(d.toRecipients||[])
    setCcEmails(d.ccEmails||[]); setBccEmails(d.bccEmails||[]); setAttachments(d.attachments||[]); setDraftId(d._id)
    draftIdRef.current = d._id
    if((d.ccEmails||[]).length) setShowCcBcc(s=>({...s,cc:true}))
    if((d.bccEmails||[]).length) setShowCcBcc(s=>({...s,bcc:true}))
    setPane('compose')
  }

  const paneTabs = [
    { id:'compose', label:'Compose', icon:Ic.Mail,   badge:0 },
    { id:'sent',    label:'Sent',    icon:Ic.Sent,   badge: history.filter(a=>a.kind==='compose').length },
    { id:'drafts',  label:'Drafts',  icon:Ic.Save,   badge: drafts.filter(d=>d.kind==='compose').length },
    { id:'folders', label:'Folders', icon:Ic.Folder, badge: folders.length },
  ]

  return (
    <div className="space-y-5">
      {showPreviewModal && (
        <PreviewRecipientsModal
          recipients={previewRecipients}
          onConfirm={handlePreviewConfirm}
          onClose={() => setShowPreviewModal(false)}
          L={L}
        />
      )}

      <PaneTabs tabs={paneTabs} active={pane} onChange={setPane} L={L} />

      {pane === 'compose' && (
        <div className={`relative auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
          <MailSendOverlay phase={sendPhase} leaving={overlayOut} recipientCount={sentCount} L={L} />
          <SectionLabel icon={Ic.Mail} title="Compose Email" subtitle="Send to any email — members, external or imported" L={L} />
          <div className="p-4 sm:p-5">
            {/* 2-col on large screens */}
            <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-5 space-y-4 lg:space-y-0">

              {/* Left — recipients + import + limit notice */}
              <div className="space-y-3">
                <RateLimitNotice L={L} />

                <div className="space-y-3 rounded-xl p-4" style={innerStyle(L)}>
                  <RecipientField label="To *" chips={toChips} onChange={setToChips} L={L}
                    placeholder="Type email or search member by name…" allowMemberSearch />

                  {/* Toolbar */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <button onClick={() => { setShowImport(s=>!s); setShowFolderPicker(false) }}
                      className="flex items-center gap-2 font-inter text-[12px] font-semibold px-3 py-2 rounded-xl border transition-all active:scale-[0.96]"
                      style={showImport
                        ? { background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.4)', color:'#fca5a5' }
                        : { background:L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.05)', border:`1px solid ${L?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'}`, color:L?'#6b7280':'#6b7280' }}>
                      <Ic.Import width={12} height={12} />
                      Import CSV / Sheet
                    </button>

                    <FolderPickerInline folders={folders} open={showFolderPicker}
                      onToggle={() => { setShowFolderPicker(s=>!s); setShowImport(false) }}
                      onAdd={handleFolderAdd} L={L} />

                    {toChips.length > 0 && (
                      <button onClick={() => setShowPreviewModal(true)}
                        className="flex items-center gap-1.5 font-inter text-[12px] font-semibold px-3 py-2 rounded-xl border transition-all active:scale-[0.96]"
                        style={{ background:'rgba(220,38,38,0.09)', border:'1px solid rgba(220,38,38,0.22)', color:'#f87171' }}>
                        <Ic.Eye width={12} height={12} />
                        Preview ({toChips.length})
                      </button>
                    )}

                    {toChips.length > 0 && !showPreviewModal && (
                      <span className={`font-inter text-[12px] self-center ${L?'text-gray-500':'text-gray-400'}`}>
                        {toChips.length} recipient{toChips.length!==1?'s':''} added
                      </span>
                    )}
                    {importedContacts.length > 0 && !saveToFolder && (
                      <button onClick={() => setSaveToFolder(true)}
                        className="flex items-center gap-1.5 font-inter text-[12px] px-3 py-2 rounded-xl border transition-all active:scale-[0.96]"
                        style={{ background:'rgba(220,38,38,0.09)', border:'1px solid rgba(220,38,38,0.22)', color:'#f87171' }}>
                        <Ic.Folder width={12} height={12} /> Save to folder
                      </button>
                    )}
                    {draftId && (
                      <span className="ml-auto font-inter text-[11px] text-amber-400 bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-700/30">
                        Editing draft
                      </span>
                    )}
                  </div>

                  {showImport && (
                    <div className="rounded-xl p-3" style={innerStyle(L)}>
                      <CsvImporter onImport={handleCsvImport} L={L} />
                    </div>
                  )}

                  {saveToFolder && importedContacts.length > 0 && (
                    <div className="rounded-xl p-3 space-y-3" style={innerStyle(L)}>
                      <p className="font-inter text-xs font-semibold text-red-400">
                        Save {importedContacts.length} imported contacts to folder
                      </p>
                      {folders.length > 0 && (
                        <div className="relative">
                          <select value={saveToExisting} onChange={e=>setSaveToExisting(e.target.value)}
                            className={`w-full appearance-none px-3 py-2.5 pr-8 rounded-xl text-sm font-inter outline-none ${L?'bg-black/5 border border-black/10 text-gray-800':'bg-white/5 border border-white/10 text-white'}`}>
                            <option value="">New folder…</option>
                            {folders.map(f=><option key={f._id} value={f._id}>{f.name} ({f.contacts.length} existing)</option>)}
                          </select>
                          <Ic.ChevDown width={12} height={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                      )}
                      {!saveToExisting && (
                        <input value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} placeholder="New folder name"
                          className={`w-full px-3 py-2.5 rounded-xl text-sm font-inter outline-none ${L?'bg-black/5 border border-black/10 text-gray-800':'bg-white/5 border border-white/10 text-white'}`} />
                      )}
                      <div className="flex gap-2">
                        <button onClick={saveFolder} disabled={!saveToExisting&&!newFolderName.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-inter text-xs font-semibold text-white disabled:opacity-40 active:scale-[0.97]"
                          style={{ background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.4)' }}>
                          <Ic.Check width={12} height={12} /> Save folder
                        </button>
                        <button onClick={()=>setSaveToFolder(false)}
                          className={`px-4 py-2 rounded-xl font-inter text-xs ${L?'bg-black/5 text-gray-600':'bg-white/5 text-gray-400'}`}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right — compose area + actions */}
              <div className="space-y-4">
                <ComposeArea subject={subject} setSubject={setSubject} content={content} setContent={setContent}
                  attachments={attachments} setAttachments={setAttachments}
                  ccEmails={ccEmails} setCcEmails={setCcEmails} bccEmails={bccEmails} setBccEmails={setBccEmails}
                  showCcBcc={showCcBcc} setShowCcBcc={setShowCcBcc} L={L} />

                {msg.text && (
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-[13px]
                    ${msg.ok ? 'bg-emerald-900/20 border border-emerald-700/30 text-emerald-300' : 'bg-red-900/20 border border-red-700/30 text-red-300'}`}>
                    {msg.ok ? <Ic.Check width={13} height={13} /> : <Ic.X width={13} height={13} />}
                    {msg.text}
                  </div>
                )}

                <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                  <SendBtn onClick={send} busy={busy} label="Send Email" />
                  <SaveDraftBtn onClick={saveDraft} busy={savingDraft} L={L} />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {pane === 'sent' && (
        <div className="space-y-3">
          {history.filter(a=>a.kind==='compose').length===0
            ? <Empty Icon={Ic.Sent} text="No emails sent yet." L={L} />
            : history.filter(a=>a.kind==='compose').map(a=>(
                <SentItem key={a._id} a={a} L={L} onReuse={a2=>{setSubject(a2.subject);setContent(a2.content);setPane('compose')}}
                  onDelete={async id=>{ if(!confirm('Move this email to bin?')) return; await announceApi.binItem(id); fetchHistory() }} />
              ))
          }
        </div>
      )}

      {pane === 'drafts' && (
        <div className="space-y-3">
          {drafts.filter(d=>d.kind==='compose').length===0
            ? <Empty Icon={Ic.Save} text="No drafts saved." L={L} />
            : drafts.filter(d=>d.kind==='compose').map(d=>(
                <DraftItem key={d._id} d={d} onEdit={loadDraft} L={L}
                  onDelete={async id=>{ await announceApi.deleteDraft(id); fetchDrafts(); if(draftId===id){ setDraftId(null); draftIdRef.current=null } }} />
              ))
          }
        </div>
      )}

      {pane === 'folders' && (
        <FolderPanel folders={folders} onRefresh={fetchFolders} L={L}
          onUseFolderContacts={contacts=>{
            setToChips(p=>{const ex=new Set(p.map(c=>c.email));return[...p,...contacts.filter(c=>!ex.has(c.email))]})
            setPane('compose')
          }} />
      )}
    </div>
  )
}
