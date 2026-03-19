import { useState } from 'react'
import type { ItemDict, RentalPayload } from '../types'
import { ClientForm, type FormData } from './ClientForm'
import { ItemSelector } from './ItemSelector'
import { OrderSummary } from './OrderSummary'

interface Props {
  precos: Record<string, number>
  onSubmit: (payload: RentalPayload) => Promise<{ total: number }>
}

const emptyForm = (): FormData => ({
  nome: '',
  contato: '',
  endereco: '',
  data_entrega: '',
  frete: '',
  pago: false,
})

export function NovoAluguel({ precos, onSubmit }: Props) {
  const [form, setForm]       = useState<FormData>(emptyForm())
  const [itens, setItens]     = useState<ItemDict>({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  const frete    = parseFloat(form.frete) || 0
  const subtotal = Object.entries(itens).reduce((acc, [item, qty]) => {
    return acc + (precos[item] || 0) * qty
  }, 0)
  const total = subtotal + frete

  const showFeedback = (msg: string, tipo: 'ok' | 'erro') => {
    setFeedback({ msg, tipo })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      showFeedback('Nome é obrigatório.', 'erro')
      return
    }
    if (Object.keys(itens).length === 0) {
      showFeedback('Adicione pelo menos um item ao pedido.', 'erro')
      return
    }

    setLoading(true)
    try {
      const data = await onSubmit({
        nome:         form.nome.trim(),
        contato:      form.contato.trim(),
        endereco:     form.endereco.trim(),
        data_entrega: form.data_entrega,
        frete,
        pago:         form.pago,
        itens,
      })
      showFeedback(`Registrado! Total: R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'ok')
      setForm(emptyForm())
      setItens({})
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Erro de conexão.', 'erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Cabeçalho */}
      <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
        <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
          Novo Aluguel
        </h1>
        <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
          Preencha os dados e selecione os itens
        </p>
      </div>

      {/* Layout em 2 colunas */}
      <div className="grid grid-cols-[1fr_1.1fr] gap-5 items-start
                      max-[900px]:grid-cols-1">

        {/* Coluna esquerda: dados do cliente + resumo */}
        <div className="flex flex-col gap-3.5">
          <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-[22px]
                          hover:border-[var(--c-border2)] transition-colors">
            <h3 className="font-mono text-[0.65rem] font-semibold text-ink3 uppercase
                           tracking-[0.1em] mb-[18px] pb-3 border-b border-[var(--c-border)]">
              Dados do cliente
            </h3>
            <ClientForm data={form} onChange={setForm} />
          </div>

          <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-[22px]
                          hover:border-[var(--c-border2)] transition-colors">
            <h3 className="font-mono text-[0.65rem] font-semibold text-ink3 uppercase
                           tracking-[0.1em] mb-4 pb-3 border-b border-[var(--c-border)]">
              Resumo do pedido
            </h3>

            <div className="mb-4">
              <OrderSummary subtotal={subtotal} frete={frete} total={total} />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4
                         bg-accent text-white font-bold text-[0.82rem] rounded-sm
                         border border-accent cursor-pointer
                         hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                         transition-all"
            >
              {loading ? 'Registrando...' : 'Registrar aluguel'}
            </button>

            {feedback && (
              <div className={`mt-2.5 font-mono text-[0.72rem] text-center px-3 py-2
                               rounded-sm tracking-[0.03em] border
                               ${feedback.tipo === 'ok'
                                 ? 'text-green-400 bg-green-400/10 border-green-400/20'
                                 : 'text-red-400 bg-red-400/10 border-red-400/20'
                               }`}>
                {feedback.msg}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita: itens */}
        <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-[22px]
                        hover:border-[var(--c-border2)] transition-colors
                        max-h-[620px] flex flex-col max-[900px]:max-h-[380px]">
          <ItemSelector
            precos={precos}
            values={itens}
            onChange={setItens}
          />
        </div>
      </div>
    </div>
  )
}
