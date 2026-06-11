// Soft neomorphic banner pointing visitors to a Google Drive folder holding the full photo set
export default function DriveLinkBanner({ link, label = 'For the entire gallery, visit the Google Drive', L }) {
  if (!link) return null
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl px-5 py-4 mb-6 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: L ? 'rgba(238,238,242,0.92)' : 'rgba(16,16,20,0.92)',
        boxShadow: L
          ? '6px 6px 16px rgba(0,0,0,0.08), -6px -6px 16px rgba(255,255,255,0.78), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '6px 6px 18px rgba(0,0,0,0.6), -4px -4px 12px rgba(255,255,255,0.025), inset 0 1px 0 rgba(255,255,255,0.04)',
        border: `1px solid ${L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}`,
      }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{ background:'linear-gradient(135deg, rgba(66,133,244,0.16), rgba(52,168,83,0.12))', border:'1px solid rgba(66,133,244,0.22)' }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <path d="M7.71 3.5L1.15 15l3.43 6 6.57-11.5z" fill="#34A853"/>
          <path d="M16.29 3.5h-8.6l6.56 11.5h8.58z" fill="#FFBA00"/>
          <path d="M22.85 15l-3.42-6h-8.58l3.42 6z" fill="#4285F4"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-inter text-[13px] font-semibold ${L ? 'text-gray-800' : 'text-gray-100'}`}>{label}</p>
        <p className="font-inter text-[11px] text-gray-500 truncate mt-0.5">{link}</p>
      </div>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
        className={`shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 ${L ? 'text-gray-400' : 'text-gray-500'}`}>
        <path d="M7 17L17 7M17 7H8M17 7v9"/>
      </svg>
    </a>
  )
}
