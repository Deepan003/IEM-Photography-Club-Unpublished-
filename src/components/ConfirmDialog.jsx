import { createPortal } from 'react-dom'
import GlassButton from './GlassButton.jsx'

export default function ConfirmDialog({
  open,
  title       = 'Are you sure?',
  message     = 'This action cannot be undone.',
  confirmLabel= 'Confirm',
  cancelLabel = 'Cancel',
  danger      = true,
  loading     = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div
        className="relative auth-glass rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-white/10"
        style={{ animation:'confirmIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}>

        {/* Icon */}
        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-900/40' : 'bg-blue-900/30'}`}>
          {danger
            ? <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            : <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        </div>

        {/* Text */}
        <h3 className="font-clash font-bold text-base sm:text-lg text-white text-center mb-2">{title}</h3>
        <p className="font-inter text-xs sm:text-sm text-gray-400 text-center leading-relaxed mb-5 sm:mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-2.5 sm:gap-3">
          <GlassButton
            onClick={onCancel}
            className="flex-1 font-inter text-sm"
            style={{ borderRadius:'12px', minHeight:'42px' }}>
            {cancelLabel}
          </GlassButton>
          <GlassButton
            onClick={onConfirm}
            variant={danger ? 'red' : 'default'}
            disabled={loading}
            className="flex-1 font-inter text-sm font-semibold"
            style={{ borderRadius:'12px', minHeight:'42px' }}>
            {loading ? '…' : confirmLabel}
          </GlassButton>
        </div>
      </div>

      <style>{`
        @keyframes confirmIn {
          from { opacity:0; transform:scale(0.88) translateY(8px); }
          to   { opacity:1; transform:scale(1)    translateY(0);   }
        }
      `}</style>
    </div>,
    document.body
  )
}
