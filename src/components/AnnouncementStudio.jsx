import { useState, useEffect } from 'react'
import { Ic } from './announcement/_icons.jsx'
import BroadcastTab   from './announcement/BroadcastTab.jsx'
import ComposeMailTab from './announcement/ComposeMailTab.jsx'
import { settingsApi } from '../api/api.js'

export default function AnnouncementStudio({ L, isCoordinator = false, isAdmin = false }) {
  const [mainTab, setMainTab] = useState('broadcast')
  const [coordAllowed, setCoordAllowed] = useState(false)
  const [togglingCoord, setTogglingCoord] = useState(false)

  // Admins/core fetch the current coordinator permission to show the toggle
  useEffect(() => {
    if (!isAdmin) return
    settingsApi.coordPermissions()
      .then(d => setCoordAllowed(d.permissions?.canSendAnnouncements ?? false))
      .catch(() => {})
  }, [isAdmin])

  const toggleCoord = async () => {
    setTogglingCoord(true)
    try {
      await settingsApi.patch('coordinator.canSendAnnouncements', !coordAllowed)
      setCoordAllowed(v => !v)
    } catch {}
    finally { setTogglingCoord(false) }
  }

  const mainTabs = [
    { id:'broadcast',    Icon:Ic.Broadcast, label:'Broadcast',   desc:'Send to club members'     },
    ...(!isCoordinator ? [{ id:'compose-mail', Icon:Ic.Mail, label:'Compose Mail', desc:'Custom email with import' }] : []),
  ]

  return (
    <div className="space-y-6 pb-10">
      {/* Coordinator access toggle — only for admin/core */}
      {isAdmin && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border auth-glass ${L?'border-black/8':'border-white/8'}`}>
          <div className="min-w-0">
            <p className={`font-inter text-sm font-semibold ${L?'text-gray-800':'text-gray-200'}`}>Coordinator access to Announcements</p>
            <p className="font-inter text-[11px] text-gray-500 mt-0.5">When enabled, coordinators can access and send from the Announcement tab in their dashboard</p>
          </div>
          <button onClick={toggleCoord} disabled={togglingCoord}
            className={`shrink-0 ml-4 flex items-center gap-2 px-4 py-2 rounded-xl font-inter text-xs font-semibold border transition-all active:scale-[0.97] disabled:opacity-50 ${
              coordAllowed
                ? 'bg-green-600/20 text-green-400 border-green-600/40'
                : L ? 'bg-black/5 text-gray-500 border-black/10' : 'bg-white/5 text-gray-500 border-white/10'
            }`}
            style={coordAllowed ? { boxShadow:'0 0 12px rgba(22,163,74,0.2)' } : {}}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${coordAllowed?'bg-green-400':'bg-gray-500'}`}
              style={coordAllowed ? { boxShadow:'0 0 6px rgba(74,222,128,0.7)' } : {}} />
            {togglingCoord ? 'Saving…' : (coordAllowed ? 'ON — click to disable' : 'OFF — click to enable')}
          </button>
        </div>
      )}

      {!isCoordinator && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mainTabs.map(t => {
            const active = mainTab === t.id
            return (
              <button key={t.id} onClick={() => setMainTab(t.id)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 active:scale-[0.98] auth-glass border ${
                  active ? 'border-red-600/40' : L ? 'border-black/8' : 'border-white/8'
                }`}
                style={active ? { background: L ? 'rgba(220,38,38,0.07)' : 'rgba(220,38,38,0.10)' } : {}}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all`}
                  style={active
                    ? { background:'rgba(220,38,38,0.2)', border:'1px solid rgba(220,38,38,0.38)' }
                    : { background: L?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.05)', border:`1px solid ${L?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)'}` }}>
                  <t.Icon width={18} height={18} className={active ? 'text-red-400' : L ? 'text-gray-400' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-inter font-semibold text-sm ${active ? (L?'text-red-600':'text-red-400') : L?'text-gray-800':'text-white'}`}>{t.label}</p>
                  <p className={`font-inter text-[12px] mt-0.5 ${active ? 'text-red-400/80' : 'text-gray-500'}`}>{t.desc}</p>
                </div>
                {active && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" style={{boxShadow:'0 0 6px rgba(220,38,38,0.8)'}} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Always mounted — CSS display preserves state when switching tabs */}
      <div style={{ display: mainTab === 'broadcast' ? 'block' : 'none' }}>
        <BroadcastTab L={L} />
      </div>
      {!isCoordinator && (
        <div style={{ display: mainTab === 'compose-mail' ? 'block' : 'none' }}>
          <ComposeMailTab L={L} />
        </div>
      )}
    </div>
  )
}
