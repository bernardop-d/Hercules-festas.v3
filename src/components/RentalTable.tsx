import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from '../utils/format'

interface Props {
  alugueis: Aluguel[]
  onEdit: (a: Aluguel) => void
  onTogglePago: (id: number, pago: boolean) => void
}

export function RentalTable({ alugueis, onEdit, onTogglePago }: Props) {
  return (
    <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-bg">
            <tr>
              {['Cliente', 'Contato', 'Entrega', 'Frete', 'Total', 'Pagamento', 'Ações'].map(h => (
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
            {alugueis.map(a => (
              <tr key={a.id}
                className="border-b border-[var(--c-border)] last:border-0
                           hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 align-middle">
                  <div className="font-mono text-[0.65rem] text-accent tracking-[0.05em] mb-0.5">
                    #{padId(a.id)}
                  </div>
                  <div className="font-sans font-semibold text-[0.88rem] text-ink">
                    {a.nome}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle text-[0.82rem] text-ink2">
                  {a.contato || '—'}
                </td>
                <td className="px-4 py-3 align-middle text-[0.82rem] text-ink2">
                  {fmtData(a.data_entrega)}
                </td>
                <td className="px-4 py-3 align-middle font-mono text-[0.8rem] text-ink2">
                  R$ {fmt(a.frete || 0)}
                </td>
                <td className="px-4 py-3 align-middle font-mono text-[0.8rem] text-ink">
                  <strong>R$ {fmt(a.total || 0)}</strong>
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
            ))}
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
