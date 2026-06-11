import { useEffect, useRef } from 'react'
import { getToken } from '../../api/auth.js'

/**
 * Autosaves a draft when the user hides the page (tab switch / browser minimize)
 * or closes/navigates away (beforeunload with keepalive fetch).
 *
 * getPayload() — call each time to get the current draft body, or null if nothing to save.
 * draftIdRef   — a React ref kept in sync with the current draft's _id (null = unsaved).
 * setDraftId   — state setter to update the component when a new draft _id is returned.
 */
export function useAutoSaveDraft(getPayload, draftIdRef, setDraftId) {
  const payloadFnRef = useRef(getPayload)
  // Always keep the ref pointing at the freshest closure so we read current state values
  useEffect(() => { payloadFnRef.current = getPayload })

  useEffect(() => {
    const save = async (keepalive = false) => {
      const payload = payloadFnRef.current()
      if (!payload) return
      const token = getToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      try {
        if (draftIdRef.current) {
          await fetch(`/api/announce/drafts/${draftIdRef.current}`, {
            method: 'PATCH', headers, body: JSON.stringify(payload), keepalive,
          })
        } else {
          const res = await fetch('/api/announce/drafts', {
            method: 'POST', headers, body: JSON.stringify(payload), keepalive,
          })
          if (res.ok) {
            const d = await res.json()
            if (d.draft?._id) {
              draftIdRef.current = d.draft._id
              setDraftId(d.draft._id)
            }
          }
        }
      } catch {}
    }

    const onHide    = () => { if (document.hidden) save(false) }
    const onUnload  = () => save(true)

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, []) // empty deps — intentional, all live values accessed via refs
}
