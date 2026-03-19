import { fmtMoney } from '../utils/format'

interface Props {
  subtotal: number
  frete: number
  total: number
}

export function OrderSummary({ subtotal, frete, total }: Props) {
  return (
    <div className="space-y-0">
      {[
        { label: 'Subtotal', value: fmtMoney(subtotal) },
        { label: 'Frete',    value: fmtMoney(frete) },
      ].map(row => (
        <div key={row.label}
          className="flex justify-between items-center py-1.5
                     border-b border-[var(--c-border)] text-[0.82rem]">
          <span className="text-ink2">{row.label}</span>
          <span className="font-mono font-medium text-ink">{row.value}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-2.5 mt-1.5
                      border-t-2 border-[var(--c-border2)]">
        <span className="font-sans font-bold text-[0.95rem] text-ink">Total</span>
        <span className="font-mono font-semibold text-[1.2rem] text-accent">
          {fmtMoney(total)}
        </span>
      </div>
    </div>
  )
}
