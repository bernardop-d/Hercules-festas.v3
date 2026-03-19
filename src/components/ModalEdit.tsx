import { useState, useEffect, useCallback } from 'react'
import type { Aluguel, ItemDict, RentalPayload } from '../types'
import { padId } from '../utils/format'
import { printOrder, openWhatsapp } from '../utils/pdf'
import { ClientForm, type FormData } from './ClientForm'
import { ItemSelector } from './ItemSelector'
import { OrderSummary } from './OrderSummary'
import { parseItens } from '../utils/format'

interface Props {
  aluguel: Aluguel
  precos: Record<string, number>
  onClose: () => void
  onSave: (id: number, payload: RentalPayload) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function ModalEdit({ aluguel, precos, onClose, onSave, onDelete }: Props) {
  const [form, setForm]   = useState<FormData>({
    nome:         aluguel.nome,
    contato:      aluguel.contato || '',
    endereco:     aluguel.endereco || '',
    data_entrega: aluguel.data_entrega || '',
    frete:        String(aluguel.frete || 0),
    pago:         !!aluguel.pago,
  })
  const [itens, setItens]           = useState<ItemDict>(() => parseItens(aluguel.itens))
  const [saving, setSaving] = useState(false)

  const frete    = parseFloat(form.frete) || 0
  const subtotal = Object.entries(itens).reduce((acc, [item, qty]) => {
    return acc + (precos[item] || 0) * qty
  }, 0)
  const total = subtotal + frete

  useEffect(() => {
    setForm({
      nome:         aluguel.nome,
      contato:      aluguel.contato || '',
      endereco:     aluguel.endereco || '',
      data_entrega: aluguel.data_entrega || '',
      frete:        String(aluguel.frete || 0),
      pago:         !!aluguel.pago,
    })
    setItens(parseItens(aluguel.itens))
  }, [aluguel])

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleSave = async () => {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      await onSave(aluguel.id, {
        nome:         form.nome.trim(),
        contato:      form.contato.trim(),
        endereco:     form.endereco.trim(),
        data_entrega: form.data_entrega,
        frete,
        pago:         form.pago,
        itens,
      })
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Excluir aluguel de ${aluguel.nome}? Esta ação não pode ser desfeita.`)) return
    await onDelete(aluguel.id)
    onClose()
  }

  const buildCurrentAluguel = (): Aluguel => ({
    ...aluguel,
    nome:         form.nome,
    contato:      form.contato,
    endereco:     form.endereco,
    data_entrega: form.data_entrega,
    frete,
    subtotal,
    total,
    pago:         form.pago ? 1 : 0,
    itens: Object.entries(itens)
      .filter(([, q]) => q > 0)
      .map(([item, q]) => `${item} (x${q}) — R$ ${((precos[item] || 0) * q).toFixed(2).replace('.', ',')}`)
      .join(', ') || 'Nenhum item',
  })

  const handleWhatsapp = () => openWhatsapp(buildCurrentAluguel())

  const handlePrint = () => printOrder(buildCurrentAluguel())

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center
                 justify-center z-[999] animate-fade-up"
      onClick={handleOverlay}
    >
      <div className="bg-bg2 border border-[var(--c-border2)] rounded-lg
                      max-w-[880px] w-[95%]
                      shadow-[0_24px_80px_rgba(0,0,0,0.6)]
                      animate-modal-in flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px]
                        border-b border-[var(--c-border)]">
          <h3 className="font-sans text-[0.95rem] font-bold tracking-[-0.01em] text-ink">
            Editar #{padId(aluguel.id)} — {aluguel.nome}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink3 hover:text-ink transition-colors text-lg cursor-pointer
                       p-1 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-[22px] overflow-y-auto flex-1">
          <div className="grid grid-cols-[1fr_1.1fr] gap-[22px] max-[700px]:grid-cols-1">

            {/* Coluna esquerda: dados */}
            <div className="flex flex-col gap-3">
              <h4 className="font-mono text-[0.62rem] font-semibold text-ink3 uppercase
                             tracking-[0.1em] pb-2.5 border-b border-[var(--c-border)]">
                Dados do cliente
              </h4>
              <ClientForm data={form} onChange={setForm} />

              <div className="mt-2 pt-3 border-t border-[var(--c-border)]">
                <OrderSummary subtotal={subtotal} frete={frete} total={total} />
              </div>
            </div>

            {/* Coluna direita: itens */}
            <div>
              <ItemSelector
                precos={precos}
                values={itens}
                onChange={setItens}
                maxHeight="400px"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-[22px] py-4
                        border-t border-[var(--c-border)] flex-wrap">
          {/* Esquerda */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-sm border border-[var(--c-border)]
                       text-ink2 text-[0.82rem] font-semibold cursor-pointer
                       hover:text-ink hover:border-[var(--c-border2)] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-sm border border-red-400/30
                       text-red-400 text-[0.82rem] font-semibold cursor-pointer
                       hover:bg-red-400/10 transition-all"
          >
            Excluir
          </button>

          {/* Direita */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm
                         border border-[var(--c-border)] text-ink2 text-[0.78rem]
                         font-semibold cursor-pointer hover:text-ink
                         hover:border-[var(--c-border2)] hover:bg-bg3 transition-all"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsapp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm
                         bg-[#25d366] text-white text-[0.78rem] font-bold
                         border border-[#25d366] cursor-pointer
                         hover:bg-[#1ebe5d] hover:shadow-[0_0_16px_rgba(37,211,102,0.3)]
                         transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar por WhatsApp
            </button>

            {/* Salvar */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-sm bg-accent text-white text-[0.82rem]
                         font-bold border border-accent cursor-pointer
                         hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
