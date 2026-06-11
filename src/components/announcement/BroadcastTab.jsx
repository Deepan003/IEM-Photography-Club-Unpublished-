import { useState, useCallback, useEffect, useRef } from 'react'
import { Ic } from './_icons.jsx'
import { SectionLabel, PaneTabs, Empty, SendBtn, SaveDraftBtn, SentItem, DraftItem, MailSendOverlay, PreviewRecipientsModal, RateLimitNotice } from './_shared.jsx'
import RecipientField, { PresetButtons, STREAMS } from './RecipientField.jsx'
import ComposeArea from './ComposeArea.jsx'
import { announceApi } from '../../api/api.js'
import { useAutoSaveDraft } from './_useAutoSave.js'

const innerStyle = (L) => ({
  background: L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
  border: `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '12px',
})

const selectCls = (L) =>
  `w-full sm:w-56 appearance-none px-3 py-2.5 pr-8 rounded-xl text-sm font-inter outline-none transition-all ${
    L ? 'bg-black/5 border border-black/10 text-gray-800 focus:border-red-400'
      : 'bg-white/5 border border-white/10 text-white focus:border-red-500'
  }`

function FolderPickerInline({ folders, onAdd, open, onToggle, L }) {
  if (!folders.length) return null
  return (
    <div className="relative">
      <button onClick={onToggle}
        className="flex items-center gap-2 font-inter text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-[0.96]"
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

export default function BroadcastTab({ L }) {
  const [subject,     setSubject]     = useState('')
  const [content,     setContent]     = useState('')
  const [preset,      setPreset]      = useState('all')
  const [filterStream, setFStream]    = useState('')
  const [filterYear,   setFYear]      = useState('')
  const [customChips,  setCustomChips]= useState([])
  const [ccEmails,    setCcEmails]    = useState([])
  const [bccEmails,   setBccEmails]   = useState([])
  const [attachments, setAttachments] = useState([])
  const [showCcBcc,   setShowCcBcc]   = useState({ cc:false, bcc:false })
  const [history,     setHistory]     = useState([])
  const [drafts,      setDrafts]      = useState([])
  const [busy,        setBusy]        = useState(false)
  const [sendPhase,   setSendPhase]   = useState(null)
  const [overlayOut,  setOverlayOut]  = useState(false)
  const [sentCount,   setSentCount]   = useState(0)
  const [savingDraft, setSavingDraft] = useState(false)
  const [msg,         setMsg]         = useState({ text:'', ok:false })
  const [pane,        setPane]        = useState('compose')
  const [draftId,     setDraftId]     = useState(null)
  const [previewModal,      setPreviewModal]      = useState(false)
  const [previewRecipients, setPreviewRecipients] = useState([])
  const [confirmedSet,      setConfirmedSet]      = useState(null)
  const [folders,           setFolders]           = useState([])
  const [showFolderPicker,  setShowFolderPicker]  = useState(false)

  // Keep draftId in a ref for the auto-save hook (avoids stale closures)
  const draftIdRef = useRef(null)
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  const fetchHistory = useCallback(async()=>{ try{ const d=await announceApi.history(); setHistory(d.announcements||[]) }catch{} },[])
  const fetchDrafts  = useCallback(async()=>{ try{ const d=await announceApi.getDrafts(); setDrafts(d.drafts||[]) }catch{} },[])
  const fetchFolders = useCallback(async()=>{ try{ const d=await announceApi.getFolders(); setFolders(d.folders||[]) }catch{} },[])
  useEffect(()=>{ fetchHistory(); fetchDrafts(); fetchFolders() },[fetchHistory,fetchDrafts,fetchFolders])

  const filters    = preset==='stream'?{stream:filterStream}:preset==='year'?{year:Number(filterYear)}:{}
  const recPayload = () => preset==='custom' ? customChips : []

  const resetPreviewState = () => { setConfirmedSet(null); setPreviewRecipients([]) }

  // ── Auto-save on tab switch / leave ────────────────────────────────────────
  useAutoSaveDraft(
    () => {
      if (!subject.trim() && !content.trim()) return null
      return { kind:'broadcast', subject, content, recipientPreset:preset, filters, customRecipients:recPayload(), ccEmails, bccEmails, attachments }
    },
    draftIdRef,
    setDraftId,
  )

  const handleFolderAdd = folder => {
    const ex = new Set(customChips.map(c => c.email))
    const toAdd = folder.contacts.filter(c => c.email && !ex.has(c.email)).map(c => ({ ...c, type:'external' }))
    setCustomChips(p => [...p, ...toAdd])
    setShowFolderPicker(false)
    resetPreviewState()
  }

  const doPreview = async () => {
    try {
      const d = await announceApi.preview({ recipientPreset:preset, filters, customRecipients:recPayload() })
      setPreviewRecipients(d.recipients || (d.names||[]).map(n => ({ name:n, email:n })))
      setPreviewModal(true)
    } catch(e) { setMsg({text:e.message, ok:false}) }
  }

  const handlePreviewConfirm = confirmedEmails => {
    setConfirmedSet(confirmedEmails)
    setPreviewModal(false)
  }

  const saveDraft = async () => {
    setSavingDraft(true)
    try {
      const b = { kind:'broadcast', subject, content, recipientPreset:preset, filters, customRecipients:recPayload(), ccEmails, bccEmails, attachments }
      if(draftId) await announceApi.updateDraft(draftId, b)
      else { const d = await announceApi.saveDraft(b); setDraftId(d.draft._id) }
      setMsg({text:'Draft saved.', ok:true}); fetchDrafts()
    } catch(e) { setMsg({text:e.message, ok:false}) }
    finally { setSavingDraft(false) }
  }

  const send = async () => {
    if(!subject.trim()) return setMsg({text:'Subject is required.', ok:false})
    if(!content.trim()) return setMsg({text:'Content is required.', ok:false})
    if(preset==='stream' && !filterStream) return setMsg({text:'Select a stream.', ok:false})
    if(preset==='year'   && !filterYear)   return setMsg({text:'Select a year.', ok:false})
    if(preset==='custom' && !customChips.length) return setMsg({text:'Add at least one recipient.', ok:false})
    setBusy(true); setMsg({text:'', ok:false})
    setSendPhase('sending'); setOverlayOut(false)
    try {
      let sendOpts
      if (confirmedSet !== null) {
        const confirmed = previewRecipients.filter(r => confirmedSet.has(r.email))
        sendOpts = { subject, content, recipientPreset:'custom', filters:{}, customRecipients:confirmed, ccEmails, bccEmails, attachments, draftId }
      } else {
        sendOpts = { subject, content, recipientPreset:preset, filters, customRecipients:recPayload(), ccEmails, bccEmails, attachments, draftId }
      }
      const d = await announceApi.send(sendOpts)
      setSentCount(d.announcement.recipientCount)
      setSendPhase('sent')
      setMsg({text:'Sent to ' + d.announcement.recipientCount + ' recipient(s).', ok:true})
      setSubject(''); setContent(''); setCustomChips([])
      setCcEmails([]); setBccEmails([]); setAttachments([]); setDraftId(null)
      draftIdRef.current = null
      setShowCcBcc({cc:false, bcc:false}); resetPreviewState()
      fetchHistory(); fetchDrafts()
      setTimeout(()=>setOverlayOut(true), 1450)
      setTimeout(()=>{ setSendPhase(null); setOverlayOut(false) }, 1780)
    } catch(e) { setMsg({text:e.message, ok:false}); setSendPhase(null) }
    finally { setBusy(false) }
  }

  const loadDraft = d => {
    setSubject(d.subject==='(no subject)'?'':d.subject); setContent(d.content)
    setPreset(d.recipientPreset||'all'); setFStream(d.filters?.stream||''); setFYear(d.filters?.year||'')
    setCustomChips(d.customRecipients||[]); setCcEmails(d.ccEmails||[]); setBccEmails(d.bccEmails||[])
    setAttachments(d.attachments||[]); setDraftId(d._id); draftIdRef.current = d._id
    if((d.ccEmails||[]).length) setShowCcBcc(s=>({...s,cc:true}))
    if((d.bccEmails||[]).length) setShowCcBcc(s=>({...s,bcc:true}))
    setPane('compose')
  }

  const paneTabs = [
    { id:'compose', label:'Compose', icon:Ic.Draft, badge:0 },
    { id:'sent',    label:'Sent',    icon:Ic.Sent,  badge: history.filter(a=>a.kind==='broadcast').length },
    { id:'drafts',  label:'Drafts',  icon:Ic.Save,  badge: drafts.filter(d=>d.kind==='broadcast').length },
  ]

  return (
    <div className="space-y-5">
      {previewModal && (
        <PreviewRecipientsModal
          recipients={previewRecipients}
          onConfirm={handlePreviewConfirm}
          onClose={() => setPreviewModal(false)}
          L={L}
        />
      )}

      <PaneTabs tabs={paneTabs} active={pane} onChange={setPane} L={L} />

      {pane === 'compose' && (
        <div className={`relative auth-glass rounded-2xl border overflow-hidden ${L?'border-black/8':'border-white/8'}`}>
          <MailSendOverlay phase={sendPhase} leaving={overlayOut} recipientCount={sentCount} L={L} />
          <SectionLabel icon={Ic.Broadcast} title="Broadcast Announcement" subtitle="Send to club members by preset or custom recipients" L={L} />
          <div className="p-4 sm:p-5">
            {/* 2-col on large screens */}
            <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-5 space-y-5 lg:space-y-0">

              {/* Left — recipients + limit notice */}
              <div className="space-y-3">
                <RateLimitNotice L={L} />
                <div className="rounded-xl p-4 space-y-3" style={innerStyle(L)}>
                  <p className={`font-inter text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 ${L?'text-gray-500':'text-gray-400'}`}>
                    <Ic.Users width={11} height={11} /> Recipients
                    {draftId && <span className="ml-auto text-amber-400 font-bold text-[10px]">Editing draft</span>}
                  </p>
                  <PresetButtons value={preset} onChange={v => { setPreset(v); resetPreviewState() }} L={L} />

                  {preset === 'stream' && (
                    <div className="relative">
                      <select value={filterStream} onChange={e => { setFStream(e.target.value); resetPreviewState() }} className={selectCls(L)}>
                        <option value="">Select stream…</option>
                        {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <Ic.ChevDown width={12} height={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  )}

                  {preset === 'year' && (
                    <div className="relative">
                      <select value={filterYear} onChange={e => { setFYear(e.target.value); resetPreviewState() }} className={`${selectCls(L)} sm:w-48`}>
                        <option value="">Select year…</option>
                        {[1,2,3,4].map(y => <option key={y} value={y}>{['1st','2nd','3rd','4th'][y-1]} Year</option>)}
                      </select>
                      <Ic.ChevDown width={12} height={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  )}

                  {preset === 'custom' && (
                    <div className="space-y-2">
                      <RecipientField chips={customChips}
                        onChange={chips => { setCustomChips(chips); resetPreviewState() }}
                        L={L} placeholder="Type a name to search, or paste email…" allowMemberSearch />
                      <FolderPickerInline folders={folders} open={showFolderPicker}
                        onToggle={() => setShowFolderPicker(s => !s)} onAdd={handleFolderAdd} L={L} />
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={doPreview}
                      className={`flex items-center gap-1.5 font-inter text-[12px] px-3 py-1.5 rounded-xl border transition-all font-medium active:scale-[0.97]
                        ${L?'bg-black/4 border-black/10 text-gray-600 hover:bg-black/7':'bg-white/4 border-white/10 text-gray-400 hover:bg-white/7'}`}>
                      <Ic.Eye width={12} height={12} /> Preview recipients
                    </button>
                    {confirmedSet !== null && (
                      <div className="flex items-center gap-2">
                        <span className="font-inter text-[12px] font-semibold text-emerald-400">
                          {confirmedSet.size + ' confirmed'}
                        </span>
                        <button onClick={resetPreviewState}
                          className="font-inter text-[11px] text-gray-500 hover:text-red-400 transition-colors">
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
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
                  <SendBtn onClick={send} busy={busy} label="Send Broadcast" />
                  <SaveDraftBtn onClick={saveDraft} busy={savingDraft} L={L} />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {pane === 'sent' && (
        <div className="space-y-3">
          {history.filter(a=>a.kind==='broadcast').length === 0
            ? <Empty Icon={Ic.Sent} text="No broadcasts sent yet." L={L} />
            : history.filter(a=>a.kind==='broadcast').map(a => (
                <SentItem key={a._id} a={a} L={L} onReuse={a2=>{setSubject(a2.subject);setContent(a2.content);setPane('compose')}}
                  onDelete={async id=>{ if(!confirm('Move this email to bin?')) return; await announceApi.binItem(id); fetchHistory() }} />
              ))
          }
        </div>
      )}

      {pane === 'drafts' && (
        <div className="space-y-3">
          {drafts.filter(d=>d.kind==='broadcast').length === 0
            ? <Empty Icon={Ic.Save} text="No drafts saved." L={L} />
            : drafts.filter(d=>d.kind==='broadcast').map(d => (
                <DraftItem key={d._id} d={d} onEdit={loadDraft} L={L}
                  onDelete={async id => { await announceApi.deleteDraft(id); fetchDrafts(); if(draftId===id){ setDraftId(null); draftIdRef.current=null } }} />
              ))
          }
        </div>
      )}
    </div>
  )
}
