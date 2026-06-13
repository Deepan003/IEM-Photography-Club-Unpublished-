import { Link } from 'react-router-dom'
import { useTheme } from '../App.jsx'

export default function NotFoundPage() {
  const { L } = useTheme()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: L ? '#eef1f7' : '#08080c' }}
    >
      {/* Glass card */}
      <div
        className="w-full max-w-sm text-center rounded-3xl p-10"
        style={{
          background: L
            ? 'rgba(236,240,248,0.88)'
            : 'rgba(14,14,20,0.85)',
          border: L
            ? '1px solid rgba(255,255,255,0.90)'
            : '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: L
            ? '8px 8px 24px rgba(163,177,200,0.40), -5px -5px 14px rgba(255,255,255,0.85)'
            : '0 8px 40px rgba(0,0,0,0.55)',
        }}
      >
        {/* Camera icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(220,38,38,0.10)',
              border: '1.5px solid rgba(220,38,38,0.22)',
            }}
          >
            <svg
              width={36}
              height={36}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>

        {/* 404 number */}
        <p
          className="font-breathing italic font-bold mb-1"
          style={{ fontSize: '5rem', lineHeight: 1, color: '#dc2626', letterSpacing: '-2px' }}
        >
          404
        </p>

        {/* Title */}
        <p
          className={`font-clash font-semibold text-xl mb-2 ${L ? 'text-gray-900' : 'text-white'}`}
        >
          Page not found
        </p>

        {/* Subtitle */}
        <p
          className={`font-inter text-sm mb-8 leading-relaxed ${L ? 'text-gray-500' : 'text-gray-400'}`}
        >
          Looks like this frame is out of focus.
          <br />
          Let&apos;s get you back to the gallery.
        </p>

        {/* Go Home button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-inter font-semibold text-sm px-6 py-3 rounded-xl transition-all active:scale-95 hover:scale-[1.03]"
          style={{
            background: '#dc2626',
            color: '#fff',
            boxShadow: '0 4px 18px rgba(220,38,38,0.38)',
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Go Home
        </Link>
      </div>

      {/* Club watermark */}
      <p
        className="mt-8 font-inter text-[10px] uppercase tracking-widest"
        style={{ color: L ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)' }}
      >
        IEM Photography Club
      </p>
    </div>
  )
}
