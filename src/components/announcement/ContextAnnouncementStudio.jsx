import { useState, useEffect, useCallback, useRef } from 'react'
import { Ic } from './_icons.jsx'
import { SectionLabel, PaneTabs, Empty, SendBtn, SaveDraftBtn, SentItem, DraftItem, MailSendOverlay, RateLimitNotice } from './_shared.jsx'
import ComposeArea from './ComposeArea.jsx'
import { announceApi } from '../../api/api.js'
import { useAutoSaveDraft } from './_useAutoSave.js'

const innerStyle = (L) => ({
  background: L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
  border: `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '12px',
})

/**
 * Full email announcement machinery scoped to a single event / competition / activity.
 * Props:
 *   contextType  — 'event' | 'competition' | 'activity'
 *   contextId    — MongoDB ID string
 *   canAnnounce  — whether the current user may compose + send
 *   isPrivileged — admin or core (shows coordinator toggle)
 *   coordCanAnnounce — current value of the per-context coordinator toggle
 *   onCoordToggle    — (bool) => void  — called when admin toggles coordinator access
 *   L            — light mode flag
 */
export default function ContextAnnouncementStudio({
  contextType, contextId, canAnnounce, isPrivileged,
  coordCanAnnounce, onCoordToggle, L,
}) {
  const [subject,     setSubject]     = useState('')
  const [content,     setContent]     = useState('')
  const [ccEmails,    setCcEmails]    = useState([])
  const [bccEmails,   setBccEmails]   = useState([])
  const [attachments, setAttachments] = useState([])
  const [showCcBcc,   setShowCcBcc]   = useState({ cc: false, bcc: false })
  const [busy,        setBusy]        = useState(false)
  const [sendPhase,   setSendPhase]   = useState(null)
  const [overlayOut,  setOverlayOut]  = useState(false)
  const [sentCount,   setSentCount]   = useState(0)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftId,     setDraftId]     = useState(null)
  const [msg,         setMsg]         = useState({ text: '', ok: false })
  const [pane,        setPane]        = useState(canAnnounce ? 'compose' : 'history')
  const [history,     setHistory]     = useState([])
  const [drafts,      setDrafts]      = useState([])
  const [recipientCount, setRecipientCount] = useState(null)

  const draftIdRef = useRef(null)
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  const fetchHistory = useCallback(async () => {
    try {
      const d = await announceApi.ctxHistory(contextType, contextId)
      setHistory(d.announcements || [])
    } catch {}
  }, [contextType, contextId])

  const fetchDrafts = useCallback(async () => {
    if (!canAnnounce) return
    try {
      const d = await announceApi.ctxGetDrafts(contextType, contextId)
      setDrafts(d.drafts || [])
    } catch {}
  }, [contextType, contextId, canAnnounce])

  const fetchRecipientCount = useCallback(async () => {
    if (!canAnnounce) return
    try {
      const d = await announceApi.ctxPreview(contextType, contextId)
      setRecipientCount(d.count)
    } catch {}
  }, [contextType, contextId, canAnnounce])

  useEffect(() => {
    fetchHistory()
    fetchDrafts()
    fetchRecipientCount()
  }, [fetchHistory, fetchDrafts, fetchRecipientCount])

  // Auto-save draft when user leaves the page
  useAutoSaveDraft(
    () => {
      if (!canAnnounce) return null
      if (!subject.trim() && !content.trim()) return null
      return {
        kind: 'broadcast', subject, content, ccEmails, bccEmails, attachments,
        contextType, contextId,
      }
    },
    draftIdRef,
    setDraftId,
  )

  const send = async () => {
    if (!subject.trim()) return setMsg({ text: 'Subject is required.', ok: false })
    if (!content.trim()) return setMsg({ text: 'Content is required.', ok: false })
    setBusy(true); setMsg({ text: '', ok: false })
    setSendPhase('sending'); setOverlayOut(false)
    try {
      const d = await announceApi.ctxSend(contextType, contextId, {
        subject, content, ccEmails, bccEmails, attachments, draftId,
      })
      setSentCount(d.announcement.recipientCount)
      setSendPhase('sent')
      setMsg({ text: `Sent to ${d.announcement.recipientCount} recipient(s).`, ok: true })
      setSubject(''); setContent(''); setCcEmails([]); setBccEmails([])
      setAttachments([]); setDraftId(null); draftIdRef.current = null
      setShowCcBcc({ cc: false, bcc: false })
      fetchHistory(); fetchDrafts()
      setTimeout(() => setOverlayOut(true), 1450)
      setTimeout(() => { setSendPhase(null); setOverlayOut(false) }, 1780)
    } catch (e) { setMsg({ text: e.message, ok: false }); setSendPhase(null) }
    finally { setBusy(false) }
  }

  const saveDraft = async () => {
    setSavingDraft(true)
    try {
      const b = { kind: 'broadcast', subject, content, ccEmails, bccEmails, attachments, contextType, contextId }
      if (draftId) {
        await announceApi.ctxUpdateDraft(contextType, contextId, draftId, b)
      } else {
        const d = await announceApi.ctxSaveDraft(contextType, contextId, b)
        setDraftId(d.draft._id); draftIdRef.current = d.draft._id
      }
      setMsg({ text: 'Draft saved.', ok: true }); fetchDrafts()
    } catch (e) { setMsg({ text: e.message, ok: false }) }
    finally { setSavingDraft(false) }
  }

  const loadDraft = d => {
    setSubject(d.subject === '(no subject)' ? '' : d.subject)
    setContent(d.content)
    setCcEmails(d.ccEmails || []); setBccEmails(d.bccEmails || [])
    setAttachments(d.attachments || []); setDraftId(d._id); draftIdRef.current = d._id
    if ((d.ccEmails || []).length) setShowCcBcc(s => ({ ...s, cc: true }))
    if ((d.bccEmails || []).length) setShowCcBcc(s => ({ ...s, bcc: true }))
    setPane('compose')
  }

  const paneTabs = canAnnounce
    ? [
        { id: 'compose', label: 'Compose', icon: Ic.Draft,     badge: 0 },
        { id: 'history', label: 'Sent',    icon: Ic.Sent,      badge: history.length },
        { id: 'drafts',  label: 'Drafts',  icon: Ic.Save,      badge: drafts.length },
      ]
    : [{ id: 'history', label: 'Announcements', icon: Ic.Broadcast, badge: 0 }]

  const recipSubtitle = recipientCount !== null
    ? `${recipientCount} enrolled member${recipientCount !== 1 ? 's' : ''} will receive this`
    : 'Sending to enrolled members'

  return (
    <div className="space-y-5">

      {/* Coordinator access toggle — admin/core only */}
      {isPrivileged && onCoordToggle && (
        <div className={`flex items-center justify-between py-2.5 px-4 auth-glass rounded-xl border ${L ? 'border-black/8' : 'border-white/8'}`}>
          <div>
            <p className={`font-inter text-xs font-semibold ${L ? 'text-gray-800' : 'text-gray-200'}`}>Coordinator access</p>
            <p className="font-inter text-[10px] text-gray-500 mt-0.5">Allow coordinators to send announcements in this section</p>
          </div>
          <div className="flex gap-1.5">
            {[[true, 'On'], [false, 'Off']].map(([val, lbl]) => {
              const active = val ? coordCanAnnounce !== false : coordCanAnnounce === false
              return (
                <button key={lbl} onClick={() => onCoordToggle(val)}
                  className={`px-3 py-1 rounded-lg font-inter text-[10px] font-semibold border transition-colors ${
                    active ? 'bg-red-600/20 text-red-400 border-red-600/40' : L ? 'bg-black/5 text-gray-500 border-black/10' : 'bg-white/5 text-gray-500 border-white/10'
                  }`}>{lbl}</button>
              )
            })}
          </div>
        </div>
      )}

      <PaneTabs tabs={paneTabs} active={pane} onChange={setPane} L={L} />

      {/* Compose pane */}
      {canAnnounce && pane === 'compose' && (
        <div className={`relative auth-glass rounded-2xl border overflow-hidden ${L ? 'border-black/8' : 'border-white/8'}`}>
          <MailSendOverlay phase={sendPhase} leaving={overlayOut} recipientCount={sentCount} L={L} />
          <SectionLabel icon={Ic.Broadcast} title="Send Announcement" subtitle={recipSubtitle} L={L} />

          <div className="p-4 sm:p-5">
            <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-5 space-y-4 lg:space-y-0">

              {/* Left — info + limit notice */}
              <div className="space-y-3">
                <RateLimitNotice L={L} />
                <div className="rounded-xl p-3 space-y-2" style={innerStyle(L)}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.28)' }}>
                      <Ic.Users width={13} height={13} className="text-red-400" />
                    </div>
                    <div>
                      <p className={`font-inter text-[12px] font-semibold ${L ? 'text-gray-800' : 'text-white'}`}>
                        {recipientCount !== null ? `${recipientCount} recipients` : 'Enrolled members'}
                      </p>
                      <p className="font-inter text-[10px] text-gray-500">All enrolled members of this {contextType}</p>
                    </div>
                  </div>
                  {draftId && (
                    <span className="inline-block font-inter text-[11px] text-amber-400 bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-700/30 w-full text-center">
                      Editing draft
                    </span>
                  )}
                </div>
              </div>

              {/* Right — compose area + actions */}
              <div className="space-y-4">
                <ComposeArea
                  subject={subject} setSubject={setSubject}
                  content={content} setContent={setContent}
                  attachments={attachments} setAttachments={setAttachments}
                  ccEmails={ccEmails} setCcEmails={setCcEmails}
                  bccEmails={bccEmails} setBccEmails={setBccEmails}
                  showCcBcc={showCcBcc} setShowCcBcc={setShowCcBcc}
                  L={L}
                />

                {msg.text && (
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-inter text-[13px] ${
                    msg.ok ? 'bg-emerald-900/20 border border-emerald-700/30 text-emerald-300' : 'bg-red-900/20 border border-red-700/30 text-red-300'
                  }`}>
                    {msg.ok ? <Ic.Check width={13} height={13} /> : <Ic.X width={13} height={13} />}
                    {msg.text}
                  </div>
                )}

                <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                  <SendBtn onClick={send} busy={busy} label="Send Announcement" />
                  <SaveDraftBtn onClick={saveDraft} busy={savingDraft} L={L} />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* History pane */}
      {pane === 'history' && (
        <div className="space-y-3">
          {history.length === 0
            ? <Empty Icon={Ic.Sent} text="No announcements sent yet." L={L} />
            : history.map(a => (
                <SentItem key={a._id} a={a} L={L}
                  onReuse={canAnnounce ? a2 => { setSubject(a2.subject); setContent(a2.content); setPane('compose') } : undefined}
                  onDelete={canAnnounce ? async id => {
                    if (!confirm('Move this to bin?')) return
                    await announceApi.binItem(id)
                    fetchHistory()
                  } : undefined}
                />
              ))
          }
        </div>
      )}

      {/* Drafts pane */}
      {canAnnounce && pane === 'drafts' && (
        <div className="space-y-3">
          {drafts.length === 0
            ? <Empty Icon={Ic.Save} text="No drafts saved." L={L} />
            : drafts.map(d => (
                <DraftItem key={d._id} d={d} onEdit={loadDraft} L={L}
                  onDelete={async id => {
                    await announceApi.ctxDeleteDraft(contextType, contextId, id)
                    fetchDrafts()
                    if (draftId === id) { setDraftId(null); draftIdRef.current = null }
                  }}
                />
              ))
          }
        </div>
      )}
    </div>
  )
}
