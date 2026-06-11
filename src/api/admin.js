const BASE = '/api/admin'

async function req(method, path, body) {
  const token = localStorage.getItem('iempc_token')
  const res   = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const adminApi = {
  getPending: ()              => req('GET',    '/pending'),
  getUsers:   (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/users${q ? `?${q}` : ''}`)
  },
  approve:    (id)            => req('POST',   `/approve/${id}`),
  reject:     (id, reason)    => req('POST',   `/reject/${id}`,  { reason }),
  promote:    (id, role)      => req('POST',   `/promote/${id}`, { role }),
  demote:     (id)            => req('POST',   `/demote/${id}`),
  ban:        (id)            => req('POST',   `/ban/${id}`),
  unban:      (id)            => req('POST',   `/unban/${id}`),
  deleteUser: (id)            => req('DELETE', `/delete/${id}`),
}
