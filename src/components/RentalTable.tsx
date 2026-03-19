import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from '../utils/format'
import { getStatusMeta, nextStatus } from '../utils/status'

interface Props {
  alugueis:       Aluguel[]
  onEdit:         (a: Aluguel) => void
  onTogglePago:   (id: number, pago: boolean) => void
  onStatusChange: (id: number, status: string) => void
}

export function RentalTable({ alugueis, onEdit, onTogglePago, onStatusChange }: Props) {
  return (
    <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-bg">
            <tr>
              {['Cliente', 'Entrega', 'Status', 'Total', 'Pagamento', 'Ações'].map(h => (
                <th key={h}
                  className="text-left px-4 py-2.5 font-mono text-[0.62rem] font-medium
                             text-ink3 uppercase tracking-[0.1em]
                             border-b border-[var(--c-border)] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alugueis.map(a => {
              const meta = getStatusMeta(a.status)
              const today = new Date().toISOString().split('T')[0]
              const isHoje = a.data_entrega === today
              const isAtrasado = !a.pago && a.data_entrega && a.data_entrega < today

              return (
                <tr key={a.id}
                  className={`border-b border-[var(--c-border)] last:border-0 transition-colors
                              ${isAtrasado ? 'bg-red-400/[0.03]' : 'hover:bg-white/[0.02]'}`}>

                  <td className="px-4 py-3 align-middle">
                    <div className="font-mono text-[0.65rem] text-accent tracking-[0.05em] mb-0.5">
                      #{padId(a.id)}
                    </div>
                    <div className="font-sans font-semibold text-[0.88rem] text-ink">
                      {a.nome}
                    </div>
                    {a.contato && (
                      <div className="font-mono text-[0.65rem] text-ink3 mt-0.5">
                        {a.contato}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    <span className={`font-sans text-[0.82rem] ${isAtrasado ? 'text-red-400' : isHoje ? 'text-amber-400 font-semibold' : 'text-ink2'}`}>
                      {fmtData(a.data_entrega)}
                    </span>
                    {isHoje && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-sm bg-amber-400/10
                                       border border-amber-400/25 font-mono text-[0.55rem]
                                       text-amber-400 uppercase tracking-[0.05em]">
                        hoje
                      </span>
                    )}
                    {isAtrasado && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-sm bg-red-400/10
                                       border border-red-400/25 font-mono text-[0.55rem]
                                       text-red-400 uppercase tracking-[0.05em]">
                        atraso
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <button
                      type="button"
                      title="Clique para avançar o status"
                      onClick={() => onStatusChange(a.id, nextStatus(a.status))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm
                                  font-mono text-[0.62rem] font-semibold tracking-[0.04em]
                                  uppercase border cursor-pointer whitespace-nowrap
                                  hover:opacity-80 active:scale-95 transition-all
                                  ${meta.color}`}
                    >
                      {meta.label}
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="opacity-60">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>

                  <td className="px-4 py-3 align-middle font-mono text-[0.82rem] text-ink font-semibold whitespace-nowrap">
                    R$ {fmt(a.total || 0)}
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm
                                     font-mono text-[0.65rem] font-semibold tracking-[0.05em]
                                     uppercase whitespace-nowrap border
                                     ${a.pago
                                       ? 'bg-green-400/10 text-green-400 border-green-400/20'
                                       : 'bg-red-400/10 text-red-400 border-red-400/20'
                                     }`}>
                      {a.pago ? '✓ Pago' : '○ Pendente'}
                    </span>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex gap-1.5 items-center">
                      <button
                        type="button"
                        onClick={() => onTogglePago(a.id, !a.pago)}
                        className="px-2.5 py-1 rounded-sm border border-[var(--c-border)]
                                   font-mono text-[0.65rem] font-medium tracking-[0.03em]
                                   text-ink2 uppercase cursor-pointer
                                   hover:border-accent hover:text-accent
                                   hover:bg-accent/5 transition-all whitespace-nowrap"
                      >
                        {a.pago ? 'Pendente' : 'Marcar pago'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        className="px-2.5 py-1 rounded-sm border border-[var(--c-border)]
                                   font-mono text-[0.65rem] tracking-[0.03em]
                                   text-ink2 uppercase cursor-pointer
                                   hover:bg-bg3 hover:text-ink hover:border-[var(--c-border2)]
                                   transition-all"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {alugueis.length === 0 && (
        <div className="text-center py-12 text-ink3 font-mono text-[0.75rem] tracking-[0.05em]">
          Nenhum aluguel encontrado.
        </div>
      )}
    </div>
  )
}
