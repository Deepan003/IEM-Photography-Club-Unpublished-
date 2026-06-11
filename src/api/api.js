/** Generic API client — all calls go through /api (Vite proxy in dev) */
import { getToken } from './auth.js'

async function req(method, path, body, isPublic = false) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token && !isPublic) headers['Authorization'] = `Bearer ${token}`

  const res  = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const get    = (path)       => req('GET',    path, null, true)
const authGet = (path)      => req('GET',    path)
const post   = (path, body) => req('POST',   path, body)
const put    = (path, body) => req('PUT',    path, body)
const patch  = (path, body) => req('PATCH',  path, body)
const del    = (path)       => req('DELETE', path)

// ── Upload helpers ────────────────────────────────────────────────────────────
// Sends file → Express server → S3 (server-side proxy).
// This avoids S3 CORS issues entirely — no bucket CORS config needed.
export async function uploadFileToS3(file, folder = 'uploads') {
  const token = getToken()
  const form  = new FormData()
  form.append('file',   file)
  form.append('folder', folder)

  const res  = await fetch('/api/upload/file', {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    form,
    // Note: do NOT set Content-Type manually — browser sets it with boundary
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data  // { key, publicUrl }
}

export async function uploadAttachment(file) {
  const token = getToken()
  const form  = new FormData()
  form.append('file', file)
  const res  = await fetch('/api/upload/attachment', {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data  // { key, publicUrl }
}

// ── Postcards ────────────────────────────────────────────────────────────────
export const postcardsApi = {
  getSections:    ()              => get('/api/postcards/sections'),
  createSection:  (body)          => post('/api/postcards/sections', body),
  deleteSection:  (id)            => del(`/api/postcards/sections/${id}`),
  list:           (params = {})   => get(`/api/postcards?${new URLSearchParams(params)}`),
  upload:         (body)          => post('/api/postcards', body),
  // Multi-image: body = { images:[{url,s3Key},...], section, caption }
  uploadCarousel: (body)          => post('/api/postcards', body),
  update:         (id, body)      => put(`/api/postcards/${id}`, body),
  delete:         (id)            => del(`/api/postcards/${id}`),
}

// ── Gallery ───────────────────────────────────────────────────────────────────
export const galleryApi = {
  getSections:      (params = {}) => get(`/api/gallery/sections?${new URLSearchParams(params)}`),
  createSection:    (body)        => post('/api/gallery/sections', body),
  deleteSection:    (id)          => del(`/api/gallery/sections/${id}`),
  getPhotos:        (params = {}) => get(`/api/gallery/photos?${new URLSearchParams(params)}`),
  addPhoto:         (body)        => post('/api/gallery/photos', body),
  updatePhoto:      (id, body)    => patch(`/api/gallery/photos/${id}`, body),
  deletePhoto:      (id)          => del(`/api/gallery/photos/${id}`),
  reorderPhotos:    (orderedIds, eventId) => put('/api/gallery/photos/reorder', { orderedIds, eventId }),
  getEventCinema:   ()            => get('/api/gallery/event-cinema'),
  searchMembers:    (q)           => authGet(`/api/gallery/member-search?q=${encodeURIComponent(q)}`),
  getCoordinators:  ()            => authGet('/api/gallery/coordinators'),
  setCoordinatorRole: (uid, role) => patch(`/api/gallery/coordinators/${uid}`, { role }),
}

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsApi = {
  list:              (params = {}) => get(`/api/events?${new URLSearchParams(params)}`),
  get:               (id)          => get(`/api/events/${id}`),
  create:            (body)        => post('/api/events', body),
  update:            (id, body)    => put(`/api/events/${id}`, body),
  delete:            (id)          => del(`/api/events/${id}`),
  addMember:         (id, body)    => post(`/api/events/${id}/members`, body),
  removeMember:      (id, uid)     => del(`/api/events/${id}/members/${uid}`),
  setMemberRole:     (id, uid, b)  => patch(`/api/events/${id}/members/${uid}/role`, b),
  getAnnouncements:  (id)          => authGet(`/api/events/${id}/announcements`),
  announce:          (id, body)    => post(`/api/events/${id}/announcements`, body),
  setGalleryOrder:   (id, body)    => patch(`/api/events/${id}/gallery-order`, body),
  setCoordPerms:     (id, body)    => patch(`/api/events/${id}/gallery-order`, body),
  setOpenToAll:      (id, body)    => patch(`/api/events/${id}/open-to-all`, body),
}

// ── Members ───────────────────────────────────────────────────────────────────
export const membersApi = {
  list:         ()     => get('/api/members'),
  listPassout:  ()     => get('/api/members/passout'),
  get:          (id)   => get(`/api/members/${id}`),
  updateMe:     (body) => patch('/api/members/me/profile', body),
}

// ── Core Committee ────────────────────────────────────────────────────────────
export const coreApi = {
  list:   ()       => get('/api/core'),
  create: (body)   => post('/api/core', body),
  update: (id, b)  => put(`/api/core/${id}`, b),
  delete: (id)     => del(`/api/core/${id}`),
}

// ── Social Links ──────────────────────────────────────────────────────────────
export const socialApi = {
  list:   ()        => get('/api/social'),
  all:    ()        => authGet('/api/social/all'),
  create: (body)    => post('/api/social', body),
  update: (id, b)   => put(`/api/social/${id}`, b),
  delete: (id)      => del(`/api/social/${id}`),
}

// ── Global Announcements ──────────────────────────────────────────────────────
export const announceApi = {
  // broadcast
  history:          ()        => authGet('/api/announce'),
  preview:          (body)    => post('/api/announce/preview', body),
  send:             (body)    => post('/api/announce/send', body),
  // drafts
  getDrafts:        ()        => authGet('/api/announce/drafts'),
  saveDraft:        (body)    => post('/api/announce/drafts', body),
  updateDraft:      (id, b)   => patch(`/api/announce/drafts/${id}`, b),
  deleteDraft:      (id)      => del(`/api/announce/drafts/${id}`),
  // compose email
  composeSend:      (body)    => post('/api/announce/compose/send', body),
  // bin (trash)
  getBin:           ()        => authGet('/api/announce/bin'),
  binItem:          (id)      => post(`/api/announce/${id}/bin`, {}),
  binBulk:          (ids)     => post('/api/announce/bin/bulk', { ids }),
  restoreItem:      (id)      => post(`/api/announce/${id}/restore`, {}),
  emptyBin:         ()        => del('/api/announce/bin'),
  deleteBinItem:    (id)      => del(`/api/announce/bin/${id}`),
  deleteBinBulk:    (ids)     => req('DELETE', '/api/announce/bin/bulk', { ids }, false),
  // contact folders
  getFolders:       ()        => authGet('/api/announce/folders'),
  createFolder:     (body)    => post('/api/announce/folders', body),
  updateFolder:     (id, b)   => patch(`/api/announce/folders/${id}`, b),
  addFolderContacts:(id, c)   => post(`/api/announce/folders/${id}/contacts`, { contacts: c }),
  deleteFolder:     (id)      => del(`/api/announce/folders/${id}`),
  // member search for chips
  memberSearch:     (q)       => authGet(`/api/announce/member-search?q=${encodeURIComponent(q)}`),
  // coordinator permission
  coordPermission:  ()        => authGet('/api/announce/coord-permission'),

  // context announcements (per event / competition / activity)
  ctxHistory:       (type, id) => authGet(`/api/announce/ctx/${type}/${id}`),
  ctxPreview:       (type, id) => authGet(`/api/announce/ctx/${type}/${id}/preview`),
  ctxSend:          (type, id, body) => post(`/api/announce/ctx/${type}/${id}/send`, body),
  ctxGetDrafts:     (type, id) => authGet(`/api/announce/ctx/${type}/${id}/drafts`),
  ctxSaveDraft:     (type, id, body) => post(`/api/announce/ctx/${type}/${id}/drafts`, body),
  ctxUpdateDraft:   (type, id, did, body) => patch(`/api/announce/ctx/${type}/${id}/drafts/${did}`, body),
  ctxDeleteDraft:   (type, id, did) => del(`/api/announce/ctx/${type}/${id}/drafts/${did}`),
}

// ── App Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  list:              ()              => authGet('/api/settings'),
  patch:             (key, val)      => patch(`/api/settings/${encodeURIComponent(key)}`, { value: val }),
  getSections:       ()              => get('/api/settings/sections'),
  setSectionVisible: (sectionId, v)  => patch('/api/settings/sections', { sectionId, visible: v }),
  coordPermissions:  ()              => authGet('/api/settings/coord-permissions'),
  getContent:        ()              => get('/api/settings/content'),
}

// ── Posts (member feed) ───────────────────────────────────────────────────────
export const postsApi = {
  feed:          (params = {}) => get(`/api/posts?${new URLSearchParams(params)}`),
  create:        (body)        => post('/api/posts', body),
  delete:        (id)          => del(`/api/posts/${id}`),
  like:          (id)          => post(`/api/posts/${id}/like`),
  comment:       (id, text)    => post(`/api/posts/${id}/comment`, { text }),
  deleteComment: (id, cid)     => del(`/api/posts/${id}/comment/${cid}`),
}

// ── Magazines ─────────────────────────────────────────────────────────────────
export const magazineApi = {
  // User
  list:           ()         => authGet('/api/magazines'),
  get:            (id)       => authGet(`/api/magazines/${id}`),
  create:         (body)     => post('/api/magazines', body),
  save:           (id, body) => put(`/api/magazines/${id}`, body),
  publish:        (id)       => patch(`/api/magazines/${id}/publish`, {}),
  unpublish:      (id)       => patch(`/api/magazines/${id}/unpublish`, {}),
  discardDraft:   (id)       => patch(`/api/magazines/${id}/discard-draft`, {}),
  delete:         (id)       => del(`/api/magazines/${id}`),
  // Public
  getPublished:   ()         => get('/api/magazines/published'),
  // Admin/Core
  adminListAll:   ()         => authGet('/api/magazines/admin/all'),
  adminDelete:    (id)       => del(`/api/magazines/admin/${id}`),
  sendPublishEmail: (id, body) => post(`/api/magazines/${id}/send-publish-email`, body),
  getPublic:        (id)       => get(`/api/magazines/public/${id}`),
  saveThumbnail:    (id, url)  => patch(`/api/magazines/${id}/thumbnail`, { thumbnailUrl: url }),
}

// ── Competitions ──────────────────────────────────────────────────────────────
export const competitionsApi = {
  list:                  (params = {}) => get(`/api/competitions?${new URLSearchParams(params)}`),
  get:                   (id)          => get(`/api/competitions/${id}`),
  create:                (body)        => post('/api/competitions', body),
  update:                (id, b)       => put(`/api/competitions/${id}`, b),
  delete:                (id)          => del(`/api/competitions/${id}`),
  publish:               (id, b)       => patch(`/api/competitions/${id}/publish`, b),
  // Gallery
  addGalleryPhoto:       (id, b)       => post(`/api/competitions/${id}/gallery`, b),
  deleteGalleryPhoto:    (id, pid)     => del(`/api/competitions/${id}/gallery/${pid}`),
  reorderGallery:        (id, ids)     => patch(`/api/competitions/${id}/gallery/reorder`, { orderedIds: ids }),
  // Winners
  addWinner:             (id, b)       => post(`/api/competitions/${id}/winners`, b),
  updateWinner:          (id, wid, b)  => patch(`/api/competitions/${id}/winners/${wid}`, b),
  deleteWinner:          (id, wid)     => del(`/api/competitions/${id}/winners/${wid}`),
  // Volunteers
  addVolunteer:          (id, uid)     => post(`/api/competitions/${id}/volunteers`, { userId: uid }),
  removeVolunteer:       (id, uid)     => del(`/api/competitions/${id}/volunteers/${uid}`),
  setVolunteerRole:      (id, uid, role) => patch(`/api/competitions/${id}/volunteers/${uid}/role`, { role }),
  // Announcements
  addAnnouncement:       (id, b)       => post(`/api/competitions/${id}/announcements`, b),
  deleteAnnouncement:    (id, aid)     => del(`/api/competitions/${id}/announcements/${aid}`),
  // Links
  addLink:               (id, b)       => post(`/api/competitions/${id}/links`, b),
  updateLink:            (id, lid, b)  => patch(`/api/competitions/${id}/links/${lid}`, b),
  deleteLink:            (id, lid)     => del(`/api/competitions/${id}/links/${lid}`),
  // Visibility
  setOpenToAll:          (id, v)       => patch(`/api/competitions/${id}/open-to-all`, { isOpenToAll: v }),
  // Coordinator permissions + status + gallery visibility
  setCoordPerms:         (id, body)    => patch(`/api/competitions/${id}/coord-perms`, body),
  setGalleryVisibility:  (id, val)     => patch(`/api/competitions/${id}/coord-perms`, { showInGallery: val }),
  setStatus:             (id, manual, status) => patch(`/api/competitions/${id}/coord-perms`, { manualStatus: manual, status }),
  // Submit entry
  submit:                (id, b)       => post(`/api/competitions/${id}/submit`, b),
}

export const activitiesApi = {
  list:             (params = {}) => get(`/api/activities?${new URLSearchParams(params)}`),
  get:              (id)          => get(`/api/activities/${id}`),
  create:           (body)        => post('/api/activities', body),
  update:           (id, b)       => put(`/api/activities/${id}`, b),
  delete:           (id)          => del(`/api/activities/${id}`),
  // Gallery
  addGalleryPhoto:  (id, b)       => post(`/api/activities/${id}/gallery`, b),
  deleteGalleryPhoto:(id, pid)    => del(`/api/activities/${id}/gallery/${pid}`),
  reorderGallery:   (id, ids)     => patch(`/api/activities/${id}/gallery/reorder`, { orderedIds: ids }),
  // Volunteers
  addVolunteer:     (id, uid)     => post(`/api/activities/${id}/volunteers`, { userId: uid }),
  removeVolunteer:  (id, uid)     => del(`/api/activities/${id}/volunteers/${uid}`),
  setVolunteerRole: (id, uid, role) => patch(`/api/activities/${id}/volunteers/${uid}/role`, { role }),
  // Announcements
  addAnnouncement:  (id, b)       => post(`/api/activities/${id}/announcements`, b),
  deleteAnnouncement:(id, aid)    => del(`/api/activities/${id}/announcements/${aid}`),
  // Links
  addLink:          (id, b)       => post(`/api/activities/${id}/links`, b),
  updateLink:       (id, lid, b)  => patch(`/api/activities/${id}/links/${lid}`, b),
  deleteLink:       (id, lid)     => del(`/api/activities/${id}/links/${lid}`),
  // Coordinator permissions + status + gallery visibility
  setCoordPerms:         (id, body)    => patch(`/api/activities/${id}/coord-perms`, body),
  setGalleryVisibility:  (id, val)     => patch(`/api/activities/${id}/coord-perms`, { showInGallery: val }),
  setStatus:             (id, manual, status) => patch(`/api/activities/${id}/coord-perms`, { manualStatus: manual, status }),
}
