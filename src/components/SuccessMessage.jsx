import { Check } from './Icons'

export default function SuccessMessage({ onClose }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 md:p-12 animate-slide-up relative overflow-hidden">
      <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />

      <div className="relative z-10 w-24 h-24 md:w-32 md:h-32 mb-8 rounded-full border-2 border-dashed border-red-500 flex items-center justify-center animate-spin-slow">
        <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-red-900/20 flex items-center justify-center border border-white/20">
          <Check size={48} className="text-white animate-quick-zoom" />
        </div>
      </div>

      <h2 className="font-cine text-4xl md:text-6xl text-white uppercase tracking-widest mb-4 glitch-text">Welcome</h2>
      <h3 className="font-tech text-xl md:text-2xl text-red-500 tracking-[0.3em] uppercase mb-8">To The Family</h3>

      <div className="font-mono text-xs md:text-sm text-gray-500 tracking-wider mb-8 flex gap-4">
        <span>ISO: 100</span><span>f/1.8</span><span>1/1000s</span>
      </div>

      <button onClick={onClose} className="group relative px-8 py-3 overflow-hidden border border-white/20 hover:border-red-600 transition-colors">
        <span className="relative z-10 font-tech text-xl tracking-widest text-white">CONTINUE</span>
        <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>

      <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/50" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/50" />
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/50" />
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/50" />
    </div>
  )
}
