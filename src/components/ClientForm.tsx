interface FormData {
  nome:         string
  contato:      string
  endereco:     string
  data_entrega: string
  frete:        string
  pago:         boolean
  obs:          string
}

interface Props {
  data:     FormData
  onChange: (data: FormData) => void
}

const inputCls = `
  bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
  font-sans text-[0.82rem] text-ink placeholder:text-ink3 w-full
  focus:outline-none focus:border-accent/40
  focus:ring-[3px] focus:ring-accent/6 transition-all
`

const labelCls = `
  font-mono text-[0.65rem] font-medium text-ink3
  uppercase tracking-[0.08em]
`

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function ClientForm({ data, onChange }: Props) {
  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const raw   = field === 'pago' ? (e.target as HTMLInputElement).checked : e.target.value
    const value = field === 'contato' ? maskPhone(raw as string) : raw
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Nome *</label>
          <input
            type="text"
            value={data.nome}
            onChange={set('nome')}
            placeholder="Nome completo"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Contato</label>
          <input
            type="text"
            value={data.contato}
            onChange={set('contato')}
            placeholder="(21) 99999-9999"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Endereço de entrega</label>
        <input
          type="text"
          value={data.endereco}
          onChange={set('endereco')}
          placeholder="Rua, número, bairro"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Data de entrega *</label>
          <input
            type="date"
            value={data.data_entrega}
            onChange={set('data_entrega')}
            min={new Date().toISOString().split('T')[0]}
            required
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Frete (R$)</label>
          <input
            type="number"
            value={data.frete}
            onChange={set('frete')}
            min={0}
            step={0.01}
            placeholder="0,00"
            className={inputCls}
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm
                        border border-[var(--c-border)] cursor-pointer
                        text-ink2 text-[0.82rem] font-sans
                        hover:border-accent/30 hover:text-accent
                        transition-all mt-1">
        <input
          type="checkbox"
          checked={data.pago}
          onChange={e => onChange({ ...data, pago: e.target.checked })}
          title="Pagamento já recebido"
          className="w-3.5 h-3.5 accent-[var(--blue)] cursor-pointer"
        />
        <span>Pagamento já recebido</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Observações</label>
        <textarea
          value={data.obs}
          onChange={set('obs')}
          placeholder="Portão azul, ligar antes, 3º andar sem elevador..."
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  )
}

export type { FormData }
