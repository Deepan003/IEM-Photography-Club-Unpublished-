import { useState } from 'react'
import { Ic } from './_icons.jsx'
import { FOLDER_COLORS, isEmail } from './_tokens.js'
import { Avatar, Empty } from './_shared.jsx'
import CsvImporter from './CsvImporter.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { announceApi } from '../../api/api.js'

const innerStyle = (L) => ({
  background: L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
  border: `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '14px',
})

const inputCls = (L) =>
  `w-full px-3 py-2.5 rounded-xl text-sm font-inter outline-none transition-all ${
    L ? 'bg-black/5 border border-black/10 text-gray-800 placeholder-gray-400 focus:border-red-400'
      : 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-red-500'
  }`

const actionBtn = (L) =>
  `flex items-center gap-1.5 font-inter text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-[0.96] ${
    L ? 'bg-black/5 border border-black/10 text-gray-600 hover:bg-black/8'
      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/8'
  }`

export default function FolderPanel({ folders, onRefresh, onUseFolderContacts, L }) {
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState(FOLDER_COLORS[0])
  const [newDesc,     setNewDesc]     = useState('')
  const [openFolder,  setOpenFolder]  = useState(null)

  // Folder edit state
  const [editingId,  setEditingId]  = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editDesc,   setEditDesc]   = useState('')
  const [editColor,  setEditColor]  = useState(FOLDER_COLORS[0])

  // Manual add contact
  const [delFolderConfirm, setDelFolderConfirm] = useState(null)
  const [addingId,  setAddingId]  = useState(null)
  const [addName,   setAddName]   = useState('')
  const [addEmail,  setAddEmail]  = useState('')
  const [addErr,    setAddErr]    = useState('')

  // Inline contact edit: { folderId, allContacts, idx, name, email }
  const [editContact, setEditContact] = useState(null)
  const [editErr,     setEditErr]     = useState('')

  // CSV import for a specific folder
  const [csvFolderId, setCsvFolderId] = useState(null)

  // ── Folder CRUD ─────────────────────────────────────────────────────────────
  const create = async () => {
    if (!newName.trim()) return
    await announceApi.createFolder({ name: newName.trim(), description: newDesc.trim(), color: newColor, contacts: [] })
    setCreating(false); setNewName(''); setNewDesc(''); onRefresh()
  }

  const del = id => setDelFolderConfirm(id)

  const startEdit = f => {
    setEditingId(f._id); setEditName(f.name); setEditDesc(f.description || ''); setEditColor(f.color || FOLDER_COLORS[0])
  }

  const saveEdit = async () => {
    if (!editName.trim()) return
    await announceApi.updateFolder(editingId, { name: editName.trim(), description: editDesc.trim(), color: editColor })
    setEditingId(null); onRefresh()
  }

  // ── Contact CRUD ─────────────────────────────────────────────────────────────
  const removeContact = async (f, email) => {
    await announceApi.updateFolder(f._id, { contacts: f.contacts.filter(c => c.email !== email) })
    onRefresh()
  }

  const startAdd = id => { setAddingId(id); setAddName(''); setAddEmail(''); setAddErr('') }

  const submitAdd = async f => {
    const email = addEmail.trim().toLowerCase()
    if (!isEmail(email)) { setAddErr('Enter a valid email address.'); return }
    if (f.contacts.some(c => c.email === email)) { setAddErr('Already in this folder.'); return }
    await announceApi.addFolderContacts(f._id, [{ name: addName.trim() || email, email, type: 'external' }])
    setAddingId(null); setAddErr(''); onRefresh()
  }

  const startEditContact = (f, idx) => {
    const c = f.contacts[idx]
    setEditContact({ folderId: f._id, allContacts: f.contacts, idx, name: c.name || '', email: c.email })
    setEditErr('')
  }

  const saveEditContact = async () => {
    const email = editContact.email.trim().toLowerCase()
    if (!isEmail(email)) { setEditErr('Enter a valid email address.'); return }
    const duplicate = editContact.allContacts.some((c, i) => i !== editContact.idx && c.email === email)
    if (duplicate) { setEditErr('Another contact already has this email.'); return }
    const updated = editContact.allContacts.map((c, i) =>
      i === editContact.idx
        ? { ...c, name: editContact.name.trim() || email, email }
        : c
    )
    await announceApi.updateFolder(editContact.folderId, { contacts: updated })
    setEditContact(null); setEditErr(''); onRefresh()
  }

  const handleCsvImport = async (contacts, folder) => {
    const existing = new Set(folder.contacts.map(c => c.email))
    const toAdd = contacts.filter(c => c.email && !existing.has(c.email))
    if (toAdd.length) await announceApi.addFolderContacts(folder._id, toAdd)
    setCsvFolderId(null); onRefresh()
  }

  // ── Shared form buttons ───────────────────────────────────────────────────────
  const SaveBtn = ({ onClick, disabled, label }) => (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-inter text-xs font-semibold text-white disabled:opacity-40 active:scale-[0.97] transition-all"
      style={{ background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.4)', boxShadow:'0 2px 12px rgba(220,38,38,0.16),inset 0 1px 0 rgba(255,255,255,0.08)' }}>
      <Ic.Check width={12} height={12} /> {label}
    </button>
  )

  const CancelBtn = ({ onClick }) => (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-xl font-inter text-xs font-medium transition-all ${L ? 'bg-black/5 text-gray-600 hover:bg-black/8' : 'bg-white/5 text-gray-400 hover:bg-white/8'}`}>
      Cancel
    </button>
  )

  const ColorPicker = ({ value, onChange }) => (
    <div className="flex items-center gap-2">
      <span className={`font-inter text-[12px] font-semibold ${L ? 'text-gray-500' : 'text-gray-400'}`}>Color</span>
      <div className="flex gap-1.5">
        {FOLDER_COLORS.map(c => (
          <button key={c} onClick={() => onChange(c)}
            className="w-5 h-5 rounded-full transition-all active:scale-[0.9]"
            style={{ background: c, outline: value === c ? '2px solid white' : 'none', outlineOffset: '2px', transform: value === c ? 'scale(1.2)' : 'scale(1)' }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`font-inter text-[12px] uppercase tracking-widest font-semibold ${L ? 'text-gray-500' : 'text-gray-400'}`}>
          Contact Folders ({folders.length})
        </p>
        <button onClick={() => setCreating(c => !c)}
          className="flex items-center gap-1.5 font-inter text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-[0.96]"
          style={{ background:'rgba(220,38,38,0.14)', border:'1px solid rgba(220,38,38,0.3)', color:'#f87171' }}>
          <Ic.Plus width={12} height={12} /> New folder
        </button>
      </div>

      {/* Create folder form */}
      {creating && (
        <div className="rounded-2xl p-4 space-y-3" style={innerStyle(L)}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Folder name"
            className={inputCls(L)} autoFocus />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className={inputCls(L)} />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <SaveBtn onClick={create} disabled={!newName.trim()} label="Create" />
            <CancelBtn onClick={() => { setCreating(false); setNewName(''); setNewDesc('') }} />
          </div>
        </div>
      )}

      {folders.length === 0 && !creating && (
        <Empty Icon={Ic.Folder} text="No folders yet. Create one to save contacts." L={L} />
      )}

      {/* Folder list */}
      <div className="space-y-2">
        {folders.map(f => (
          <div key={f._id}
            className={`auth-glass rounded-2xl border overflow-hidden transition-all ${L ? 'border-black/8' : 'border-white/8'}`}>

            {/* Folder header row */}
            <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
              onClick={() => setOpenFolder(openFolder === f._id ? null : f._id)}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: f.color + '1a', border: `1px solid ${f.color}38` }}>
                <Ic.Folder width={16} height={16} style={{ color: f.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-inter font-semibold text-[14px] ${L ? 'text-gray-900' : 'text-white'}`}>{f.name}</p>
                {f.description && <p className="font-inter text-[12px] text-gray-400 truncate">{f.description}</p>}
              </div>
              <span className={`font-inter text-[12px] shrink-0 font-medium ${L ? 'text-gray-400' : 'text-gray-500'}`}>
                {f.contacts.length} contacts
              </span>
              <Ic.ChevDown width={14} height={14}
                className={`shrink-0 text-gray-500 transition-transform duration-200 ${openFolder === f._id ? 'rotate-180' : ''}`} />
            </div>

            {/* Expanded body */}
            {openFolder === f._id && (
              <div className={`border-t px-4 pb-4 pt-3 space-y-3 ${L ? 'border-black/8' : 'border-white/8'}`}>

                {/* Edit folder metadata form */}
                {editingId === f._id ? (
                  <div className="rounded-xl p-4 space-y-3" style={innerStyle(L)}>
                    <p className={`font-inter text-[11px] uppercase tracking-widest font-semibold ${L ? 'text-gray-500' : 'text-gray-400'}`}>
                      Edit folder
                    </p>
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Folder name"
                      className={inputCls(L)} />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)"
                      className={inputCls(L)} />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex gap-2">
                      <SaveBtn onClick={saveEdit} disabled={!editName.trim()} label="Save changes" />
                      <CancelBtn onClick={() => setEditingId(null)} />
                    </div>
                  </div>
                ) : (
                  /* Folder action buttons */
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => startEdit(f)} className={actionBtn(L)}>
                      <Ic.Draft width={11} height={11} /> Edit folder
                    </button>
                    <button onClick={() => addingId === f._id ? setAddingId(null) : startAdd(f._id)}
                      className="flex items-center gap-1.5 font-inter text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-[0.96]"
                      style={{ background:'rgba(220,38,38,0.09)', border:'1px solid rgba(220,38,38,0.22)', color:'#f87171' }}>
                      <Ic.Plus width={11} height={11} />
                      {addingId === f._id ? 'Cancel add' : 'Add contact'}
                    </button>
                    <button onClick={() => setCsvFolderId(csvFolderId === f._id ? null : f._id)}
                      className={actionBtn(L)}>
                      <Ic.Import width={11} height={11} />
                      {csvFolderId === f._id ? 'Cancel CSV' : 'Import CSV'}
                    </button>
                  </div>
                )}

                {/* Manual add contact form */}
                {addingId === f._id && editingId !== f._id && (
                  <div className="rounded-xl p-4 space-y-3" style={innerStyle(L)}>
                    <p className={`font-inter text-[11px] uppercase tracking-widest font-semibold ${L ? 'text-gray-500' : 'text-gray-400'}`}>
                      Add contact
                    </p>
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Name (optional)"
                        className={inputCls(L)} />
                      <input value={addEmail} onChange={e => { setAddEmail(e.target.value); setAddErr('') }}
                        placeholder="Email address *" className={inputCls(L)} />
                    </div>
                    {addErr && <p className="font-inter text-[12px] text-red-400">{addErr}</p>}
                    <div className="flex gap-2">
                      <SaveBtn onClick={() => submitAdd(f)} disabled={!addEmail.trim()} label="Add to folder" />
                      <CancelBtn onClick={() => setAddingId(null)} />
                    </div>
                  </div>
                )}

                {/* CSV import form */}
                {csvFolderId === f._id && (
                  <div className="rounded-xl p-4" style={innerStyle(L)}>
                    <p className={`font-inter text-[11px] uppercase tracking-widest font-semibold mb-3 ${L ? 'text-gray-500' : 'text-gray-400'}`}>
                      Import from CSV / Sheet
                    </p>
                    <CsvImporter L={L} onImport={contacts => handleCsvImport(contacts, f)} />
                  </div>
                )}

                {/* Contact list */}
                {f.contacts.length > 0 ? (
                  <>
                    <div className="max-h-[260px] overflow-y-auto space-y-0.5 pr-0.5" style={{ scrollbarWidth:'thin' }}>
                      {f.contacts.map((c, i) => (
                        <div key={c.email + i}>
                          {/* Inline edit form for this contact */}
                          {editContact?.folderId === f._id && editContact.idx === i ? (
                            <div className="rounded-xl p-3 space-y-2.5 my-1" style={innerStyle(L)}>
                              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                <input value={editContact.name}
                                  onChange={e => setEditContact(s => ({ ...s, name: e.target.value }))}
                                  placeholder="Name"
                                  className={inputCls(L)} />
                                <input value={editContact.email}
                                  onChange={e => { setEditContact(s => ({ ...s, email: e.target.value })); setEditErr('') }}
                                  placeholder="Email address"
                                  className={inputCls(L)} />
                              </div>
                              {editErr && <p className="font-inter text-[12px] text-red-400">{editErr}</p>}
                              <div className="flex gap-2">
                                <SaveBtn onClick={saveEditContact} disabled={!editContact.email.trim()} label="Save contact" />
                                <CancelBtn onClick={() => { setEditContact(null); setEditErr('') }} />
                              </div>
                            </div>
                          ) : (
                            /* Normal contact row */
                            <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl group transition-colors ${L ? 'hover:bg-black/4' : 'hover:bg-white/4'}`}>
                              <Avatar name={c.name || c.email} size={26} />
                              <div className="flex-1 min-w-0">
                                {c.name && c.name !== c.email && (
                                  <p className={`font-inter text-[13px] font-semibold truncate ${L ? 'text-gray-800' : 'text-gray-200'}`}>{c.name}</p>
                                )}
                                <p className="font-inter text-[12px] text-gray-400 truncate">{c.email}</p>
                              </div>
                              {/* Action icons — visible on hover */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => startEditContact(f, i)} title="Edit contact"
                                  className={`p-1.5 rounded-lg transition-colors ${L ? 'text-gray-400 hover:text-blue-500 hover:bg-blue-500/10' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-400/10'}`}>
                                  <Ic.Draft width={12} height={12} />
                                </button>
                                <button onClick={() => removeContact(f, c.email)} title="Remove from folder"
                                  className={`p-1.5 rounded-lg transition-colors ${L ? 'text-gray-400 hover:text-red-500 hover:bg-red-500/10' : 'text-gray-600 hover:text-red-400 hover:bg-red-400/10'}`}>
                                  <Ic.Trash width={12} height={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Use all contacts button */}
                    <button onClick={() => onUseFolderContacts(f.contacts.map(c => ({ ...c, type:'external' })))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-inter text-[13px] font-semibold text-white active:scale-[0.97] transition-all"
                      style={{ background:'rgba(220,38,38,0.18)', border:'1px solid rgba(220,38,38,0.4)', boxShadow:'0 2px 14px rgba(220,38,38,0.16),inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                      <Ic.Users width={13} height={13} />
                      Use all {f.contacts.length} contacts as recipients
                    </button>
                  </>
                ) : (
                  <p className={`font-inter text-xs text-center py-3 ${L ? 'text-gray-400' : 'text-gray-500'}`}>
                    No contacts yet. Add manually or import from CSV.
                  </p>
                )}

                {/* Delete folder */}
                <button onClick={() => del(f._id)}
                  className={`flex items-center justify-center gap-1.5 w-full font-inter text-[12px] transition-colors py-1 ${L ? 'text-gray-400 hover:text-red-500' : 'text-gray-600 hover:text-red-400'}`}>
                  <Ic.Trash width={11} height={11} /> Delete folder
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!delFolderConfirm}
        title="Delete folder?"
        message="This folder and all its contacts will be permanently deleted."
        confirmLabel="Yes, Delete"
        onConfirm={async () => { await announceApi.deleteFolder(delFolderConfirm); setDelFolderConfirm(null); onRefresh() }}
        onCancel={() => setDelFolderConfirm(null)}
      />
    </div>
  )
}
