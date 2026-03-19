interface Props {
  label: string
  value: string | number
  variant?: 'default' | 'green' | 'red' | 'accent'
  delay?: number
}

const variantClass: Record<string, string> = {
  default: 'text-ink',
  green:   'text-green-400',
  red:     'text-red-400',
  accent:  'text-accent',
  // backwards compat
  amber:   'text-accent',
}

export function KPICard({ label, value, variant = 'default', delay = 0 }: Props) {
  return (
    <div
      className="relative overflow-hidden bg-bg2 border border-[var(--c-border)]
                 rounded-lg p-5 group hover:border-[var(--c-border2)] transition-colors
                 animate-kpi-in"
      style={{ '--kpi-delay': `${delay}ms` } as React.CSSProperties}
    >
      {/* Linha de acento no topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-[var(--c-border2)]
                      group-hover:bg-accent/30 transition-colors" />

      <span className="font-mono text-[0.65rem] text-ink3 uppercase tracking-[0.1em] block mb-2">
        {label}
      </span>
      <strong className={`font-mono text-[1.35rem] font-semibold tracking-[-0.02em] ${variantClass[variant] ?? variantClass.default}`}>
        {value}
      </strong>
    </div>
  )
}
