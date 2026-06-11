export const neo = {
  card: (L) => ({
    background:    L ? 'rgba(252,248,248,0.99)' : 'rgba(8,3,3,0.96)',
    border:        `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(220,38,38,0.1)'}`,
    boxShadow:     L
      ? '6px 6px 14px rgba(0,0,0,0.07), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.95)'
      : '0 4px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 80px rgba(220,38,38,0.03)',
    borderRadius:  '20px',
  }),
  inner: (L) => ({
    background: L ? 'rgba(0,0,0,0.03)' : 'rgba(220,38,38,0.03)',
    border:     `1px solid ${L ? 'rgba(0,0,0,0.07)' : 'rgba(220,38,38,0.1)'}`,
    borderRadius: '14px',
  }),
  activetab: (L) => ({
    background: L ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.14)',
    border:     '1px solid rgba(220,38,38,0.35)',
    boxShadow:  L ? 'inset 2px 2px 4px rgba(220,38,38,0.1), inset -1px -1px 3px rgba(255,255,255,0.6)' : 'inset 2px 2px 5px rgba(0,0,0,0.4), 0 0 10px rgba(220,38,38,0.15)',
    borderRadius: '12px',
  }),
}

export const FOLDER_COLORS = ['#dc2626','#d97706','#059669','#2563eb','#db2777','#0891b2','#7c3aed']

export const fmt      = d => new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
export const fmtShort = d => new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
export const isEmail  = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
