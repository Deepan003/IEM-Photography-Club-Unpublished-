import { useState, useEffect } from 'react'
import PageLayout    from '../components/PageLayout.jsx'
import { socialApi } from '../api/api.js'
import { useTheme }  from '../App.jsx'

const PLATFORM_META = {
  instagram: { color: 'from-purple-500 to-pink-500', label: 'Instagram' },
  facebook:  { color: 'from-blue-600 to-blue-500',   label: 'Facebook'  },
  twitter:   { color: 'from-sky-500 to-blue-500',    label: 'Twitter'   },
  youtube:   { color: 'from-red-600 to-red-500',     label: 'YouTube'   },
  email:     { color: 'from-gray-600 to-gray-500',   label: 'Email'     },
  other:     { color: 'from-gray-700 to-gray-600',   label: 'Link'      },
}

export default function JoinUsPage() {
  const { theme }              = useTheme()
  const [links,   setLinks]    = useState([])
  const [loading, setLoading]  = useState(true)
  const L = theme === 'light'

  useEffect(() => {
    socialApi.list().then(d => setLinks(d.links)).finally(() => setLoading(false))
  }, [])

  return (
    <PageLayout
      title="Join Us"
      subtitle="Be part of a community that sees the world through a different lens. Connect with us, join the club, and start your photography journey."
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        <div className="space-y-3">
          {loading ? (
            <p className={`py-8 text-center font-inter text-sm animate-pulse ${L ? 'text-gray-400' : 'text-gray-600'}`}>Loading…</p>
          ) : links.length === 0 ? (
            <p className={`py-8 text-center font-inter text-sm ${L ? 'text-gray-400' : 'text-gray-600'}`}>Social links will appear here soon.</p>
          ) : links.map(link => {
            const meta = PLATFORM_META[link.platform] || PLATFORM_META.other
            return (
              <a
                key={link._id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn glass-btn-light flex items-center gap-4 px-5 w-full text-left"
                style={{ borderRadius:'16px', minHeight:'60px' }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-xl shrink-0`}>
                  {link.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-clash font-semibold text-sm ${L ? 'text-gray-900' : 'text-white'}`}>{link.label}</p>
                  <p className={`font-inter text-[11px] truncate ${L ? 'text-gray-500' : 'text-gray-500'}`}>{link.url}</p>
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500 shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )
          })}
        </div>

        <div className={`mt-12 p-6 rounded-2xl auth-glass border ${L ? 'border-black/7' : 'border-white/7'} text-center`}>
          <p className={`font-clash text-xl font-semibold mb-2 ${L ? 'text-gray-900' : 'text-white'}`}>Ready to join?</p>
          <p className={`font-inter text-sm mb-5 ${L ? 'text-gray-500' : 'text-gray-400'}`}>Create your account to become part of IEM Photography Club.</p>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-auth'))}
            className="glass-btn glass-btn-red glass-pill px-8 font-inter text-sm font-medium tracking-[0.08em] uppercase"
            style={{ minHeight:'48px' }}>
            Create Account
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
