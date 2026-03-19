import type { View } from '../types'
import { fmtMoney } from '../utils/format'

interface Props {
  view: View
  onViewChange: (v: View) => void
  stats: { ativos: number; pendentes: number; recebido: number; hoje: number; aguardando: number }
}

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    view: 'novo',
    label: 'Novo Aluguel',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    view: 'nota-fiscal',
    label: 'Nota Fiscal',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    view: 'precos',
    label: 'Preços',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
]

export function Sidebar({ view, onViewChange, stats }: Props) {
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 bg-bg2 border-r border-[var(--c-border)] flex flex-col z-50 overflow-hidden">
      {/* Linha decorativa no topo */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-[22px] border-b border-[var(--c-border)]">
        <div className="w-9 h-9 bg-accent/10 border border-accent/30 text-accent rounded
                        flex items-center justify-center font-mono text-[0.7rem] font-semibold
                        tracking-wider flex-shrink-0">
          HF
        </div>
        <div>
          <strong className="block font-sans text-[0.9rem] font-bold tracking-tight text-ink">
            Hércules Festas
          </strong>
          <span className="font-mono text-[0.62rem] text-ink3 tracking-[0.08em] uppercase">
            Gestão de Aluguéis
          </span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 flex flex-col gap-0.5 p-3">
        {NAV_ITEMS.map(item => (
          <button
            type="button"
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-left w-full text-[0.82rem]
                        font-medium transition-all cursor-pointer
                        ${view === item.view
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'bg-transparent text-ink2 border border-transparent hover:bg-bg3 hover:text-ink'
                        }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer com stats */}
      <div className="p-5 border-t border-[var(--c-border)] space-y-0">
        {[
          { label: 'Total ativo',     value: String(stats.ativos),     color: '' },
          { label: 'Aguardando',    value: String(stats.aguardando), color: stats.aguardando > 0 ? 'text-orange-400' : '' },
          { label: 'Entregas hoje', value: String(stats.hoje),       color: stats.hoje > 0 ? 'text-amber-400' : '' },
          { label: 'Pendentes',     value: String(stats.pendentes),  color: 'text-red-400' },
          { label: 'Recebido',      value: fmtMoney(stats.recebido), color: 'text-green-400' },
        ].map(s => (
          <div key={s.label}
            className="flex justify-between items-center py-[5px] border-b border-[var(--c-border)] last:border-0">
            <span className="text-[0.75rem] text-ink2">{s.label}</span>
            <strong className={`font-mono text-[0.78rem] font-semibold ${s.color || 'text-ink'}`}>
              {s.value}
            </strong>
          </div>
        ))}

      </div>
    </aside>
  )
}
