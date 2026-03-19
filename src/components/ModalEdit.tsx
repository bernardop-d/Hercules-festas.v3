import { useState, useEffect, useCallback, useRef } from 'react'
import type { Aluguel, ItemDict, RentalPayload } from '../types'
import { padId } from '../utils/format'
import { generatePdf, openWhatsapp } from '../utils/pdf'
import { ClientForm, type FormData } from './ClientForm'
import { ItemSelector } from './ItemSelector'
import { OrderSummary } from './OrderSummary'
import { parseItens } from '../utils/format'
import { STATUS_CYCLE, STATUS_META, getStatusMeta } from '../utils/status'

interface Props {
  aluguel:     Aluguel
  precos:      Record<string, number>
  onClose:     () => void
  onSave:      (id: number, payload: RentalPayload) => Promise<void>
  onDelete:    (id: number) => Promise<void>
  onDuplicate: (payload: RentalPayload) => Promise<void>
  onError:     (msg: string) => void
}

function buildForm(a: Aluguel): FormData {
  return {
    nome:         a.nome,
    contato:      a.contato      || '',
    endereco:     a.endereco     || '',
    data_entrega: a.data_entrega || '',
    frete:        String(a.frete || 0),
    pago:         !!a.pago,
    obs:          a.obs          || '',
  }
}

export function ModalEdit({ aluguel, precos, onClose, onSave, onDelete, onDuplicate, onError }: Props) {
  const [form,   setForm]   = useState<FormData>(() => buildForm(aluguel))
  const [itens,  setItens]  = useState<ItemDict>(() => parseItens(aluguel.itens))
  const [status, setStatus] = useState(aluguel.status || 'confirmado')

  const [saving,         setSaving]         = useState(false)
  const [pdfLoading,     setPdfLoading]     = useState(false)
  const [duplicating,    setDuplicating]    = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)

  // Referência para detectar alterações não salvas
  const pristine = useRef({ form: buildForm(aluguel), itens: parseItens(aluguel.itens), status: aluguel.status || 'confirmado' })

  useEffect(() => {
    const f = buildForm(aluguel)
    const it = parseItens(aluguel.itens)
    const st = aluguel.status || 'confirmado'
    setForm(f)
    setItens(it)
    setStatus(st)
    pristine.current = { form: f, itens: it, status: st }
  }, [aluguel.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty =
    JSON.stringify(form)  !== JSON.stringify(pristine.current.form)  ||
    JSON.stringify(itens) !== JSON.stringify(pristine.current.itens) ||
    status !== pristine.current.status

  // Fechar com Esc (pede confirmação se houver alterações)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (isDirty && !confirm('Há alterações não salvas. Deseja sair sem salvar?')) return
    onClose()
  }, [isDirty, onClose])

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const frete    = parseFloat(form.frete) || 0
  const subtotal = Object.entries(itens).reduce(
    (acc, [item, qty]) => acc + (precos[item] || 0) * qty, 0
  )
  const total = subtotal + frete

  const buildPayload = (): RentalPayload => ({
    nome:         form.nome.trim(),
    contato:      form.contato.trim(),
    endereco:     form.endereco.trim(),
    data_entrega: form.data_entrega,
    frete,
    pago:         form.pago,
    itens,
    status,
    obs:          form.obs.trim(),
  })

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
    status,
    obs:          form.obs,
    itens: Object.entries(itens)
      .filter(([, q]) => q > 0)
      .map(([item, q]) =>
        `${item} (x${q}) — R$ ${((precos[item] || 0) * q).toFixed(2).replace('.', ',')}`
      )
      .join(', ') || 'Nenhum item',
  })

  const handleSave = async () => {
    if (!form.nome.trim())    { onError('Nome é obrigatório.'); return }
    if (!form.data_entrega)   { onError('Data de entrega é obrigatória.'); return }
    setSaving(true)
    try {
      await onSave(aluguel.id, buildPayload())
      onClose()
    } catch { /* App.tsx exibe o toast */ } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setConfirmDelete(false)
    try { await onDelete(aluguel.id) } catch { /* App.tsx exibe o toast */ }
  }

  const handleDuplicate = async () => {
    if (!confirmDuplicate) { setConfirmDuplicate(true); return }
    setConfirmDuplicate(false)
    setDuplicating(true)
    try {
      await onDuplicate({ ...buildPayload(), pago: false, data_entrega: '' })
      onClose()
    } catch { /* App.tsx exibe o toast */ } finally { setDuplicating(false) }
  }

  const mapsUrl = form.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.endereco)}`
    : null

  const handleWhatsapp    = () => openWhatsapp(buildCurrentAluguel())
  const handleGeneratePdf = async () => {
    setPdfLoading(true)
    try { await generatePdf(buildCurrentAluguel()) } finally { setPdfLoading(false) }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center
                 justify-center z-[999] animate-fade-up"
      onClick={handleOverlay}
    >
      <div className="bg-bg2 border border-[var(--c-border2)] rounded-lg
                      max-w-[900px] w-[95%] shadow-[0_24px_80px_rgba(0,0,0,0.6)]
                      animate-modal-in flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px]
                        border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="font-sans text-[0.95rem] font-bold tracking-[-0.01em] text-ink truncate">
              Editar #{padId(aluguel.id)} — {aluguel.nome}
            </h3>
            <span className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-sm border font-mono
                              text-[0.6rem] font-semibold uppercase tracking-[0.05em]
                              ${getStatusMeta(status).color}`}>
              {getStatusMeta(status).label}
            </span>
            {isDirty && (
              <span className="flex-shrink-0 font-mono text-[0.6rem] text-amber-400 uppercase tracking-[0.05em]">
                · não salvo
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Fechar (Esc)"
            className="flex-shrink-0 text-ink3 hover:text-ink transition-colors
                       text-lg cursor-pointer p-1 leading-none ml-3"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-[22px] overflow-y-auto flex-1">
          <div className="grid grid-cols-[1fr_1.1fr] gap-[22px] max-[700px]:grid-cols-1">

            {/* Esquerda: dados */}
            <div className="flex flex-col gap-3">
              <h4 className="font-mono text-[0.62rem] font-semibold text-ink3 uppercase
                             tracking-[0.1em] pb-2.5 border-b border-[var(--c-border)]">
                Dados do cliente
              </h4>
              <ClientForm data={form} onChange={setForm} />

              {/* Link Google Maps */}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[0.68rem]
                             text-accent/70 hover:text-accent transition-colors w-fit"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Abrir rota no Google Maps
                </a>
              )}

              {/* Status */}
              <div className="pt-3 border-t border-[var(--c-border)]">
                <p className="font-mono text-[0.62rem] text-ink3 uppercase tracking-[0.08em] mb-2">
                  Status do pedido
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_CYCLE.map(s => {
                    const meta = STATUS_META[s]
                    const ativo = status === s
                    return (
                      <button key={s} type="button" onClick={() => setStatus(s)}
                        className={`px-3 py-1.5 rounded-sm border font-mono text-[0.65rem]
                                    font-semibold uppercase tracking-[0.04em] cursor-pointer
                                    transition-all
                                    ${ativo
                                      ? meta.color
                                      : 'border-[var(--c-border)] text-ink3 hover:text-ink2 hover:border-[var(--c-border2)]'
                                    }`}>
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--c-border)]">
                <OrderSummary subtotal={subtotal} frete={frete} total={total} />
              </div>
            </div>

            {/* Direita: itens */}
            <div>
              <ItemSelector precos={precos} values={itens} onChange={setItens} maxHeight="420px" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-[22px] py-4
                        border-t border-[var(--c-border)] flex-wrap">
          <button type="button" onClick={handleClose}
            className="px-4 py-2.5 rounded-sm border border-[var(--c-border)]
                       text-ink2 text-[0.82rem] font-semibold cursor-pointer
                       hover:text-ink hover:border-[var(--c-border2)] transition-all">
            Cancelar
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.7rem] text-red-400">Confirmar exclusão?</span>
              <button type="button" onClick={handleDelete}
                className="px-3 py-2 rounded-sm border border-red-400/50 bg-red-400/10
                           text-red-400 text-[0.78rem] font-bold cursor-pointer hover:bg-red-400/20 transition-all">
                Sim, excluir
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-sm border border-[var(--c-border)] text-ink2
                           text-[0.78rem] cursor-pointer hover:text-ink transition-all">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={handleDelete}
              className="px-4 py-2.5 rounded-sm border border-red-400/30
                         text-red-400 text-[0.82rem] font-semibold cursor-pointer
                         hover:bg-red-400/10 transition-all">
              Excluir
            </button>
          )}

          {confirmDuplicate ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.7rem] text-ink2">Duplicar pedido?</span>
              <button type="button" onClick={handleDuplicate} disabled={duplicating}
                className="px-3 py-2 rounded-sm border border-accent/40 bg-accent/10
                           text-accent text-[0.78rem] font-bold cursor-pointer hover:bg-accent/20
                           disabled:opacity-40 transition-all">
                {duplicating ? 'Duplicando...' : 'Confirmar'}
              </button>
              <button type="button" onClick={() => setConfirmDuplicate(false)}
                className="px-3 py-2 rounded-sm border border-[var(--c-border)] text-ink2
                           text-[0.78rem] cursor-pointer hover:text-ink transition-all">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={handleDuplicate} disabled={duplicating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-sm
                         border border-[var(--c-border)] text-ink2 text-[0.78rem] font-semibold
                         cursor-pointer hover:border-accent/40 hover:text-accent hover:bg-accent/5
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {duplicating ? 'Duplicando...' : 'Duplicar'}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button type="button" onClick={handleGeneratePdf} disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm
                         border border-[var(--c-border)] text-ink2 text-[0.78rem] font-semibold
                         cursor-pointer hover:text-ink hover:border-[var(--c-border2)] hover:bg-bg3
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              {pdfLoading ? 'Gerando...' : 'Gerar PDF'}
            </button>

            <button type="button" onClick={handleWhatsapp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm
                         bg-[#25d366] text-white text-[0.78rem] font-bold border border-[#25d366]
                         cursor-pointer hover:bg-[#1ebe5d] hover:shadow-[0_0_16px_rgba(37,211,102,0.3)]
                         transition-all">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>

            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-2.5 rounded-sm bg-accent text-white text-[0.82rem] font-bold
                         border border-accent cursor-pointer
                         hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
