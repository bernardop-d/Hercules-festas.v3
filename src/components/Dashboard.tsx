import { useState, useMemo } from 'react'
import type { Aluguel } from '../types'
import { fmtMoney, fmtData } from '../utils/format'
import { STATUS_META, STATUS_CYCLE, type StatusKey } from '../utils/status'
import { exportCsv } from '../utils/csv'
import { KPICard } from './KPICard'
import { RentalTable, type SortKey } from './RentalTable'

interface Props {
  alugueis:          Aluguel[]
  onEdit:            (a: Aluguel) => void
  onTogglePago:      (id: number, pago: boolean) => void
  onStatusChange:    (id: number, status: string) => void
  onConfirmar:       (a: Aluguel) => void
  onRecusar:         (id: number) => void
  onConfirmarPix:    (a: Aluguel) => void
}

type FiltroStatus = 'todos' | StatusKey

const PRE_STATUSES = new Set(['aguardando', 'em_negociacao', 'aguardando_pagamento', 'confirmado_parcial'])

export function Dashboard({ alugueis, onEdit, onTogglePago, onStatusChange, onConfirmar, onRecusar, onConfirmarPix }: Props) {
  const [busca,        setBusca]        = useState('')
  const [filtroPago,   setFiltroPago]   = useState<'todos' | 'pendente' | 'pago'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroData,   setFiltroData]   = useState<'todos' | 'hoje' | 'ontem' | '7dias' | '1mes'>('todos')
  const [showAtrasados,    setShowAtrasados]    = useState(true)
  const [showAguardando,   setShowAguardando]   = useState(true)
  const [showNegociacao,   setShowNegociacao]   = useState(true)
  const [showPixPendente,  setShowPixPendente]  = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const today             = new Date().toISOString().split('T')[0]
  function dateRangeFilter(a: Aluguel) {
    if (filtroData === 'todos') return true
    const d = a.data_entrega
    if (!d) return false
    if (filtroData === 'hoje')  return d === today
    if (filtroData === 'ontem') {
      const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
      return d === ontem.toISOString().split('T')[0]
    }
    if (filtroData === '7dias') {
      const lim = new Date(); lim.setDate(lim.getDate() - 6)
      return d >= lim.toISOString().split('T')[0] && d <= today
    }
    if (filtroData === '1mes') {
      const lim = new Date(); lim.setDate(lim.getDate() - 29)
      return d >= lim.toISOString().split('T')[0] && d <= today
    }
    return true
  }
  const aguardando        = alugueis.filter(a => a.status === 'aguardando' || a.status === 'aguardando_pagamento')
  const emNegociacao      = alugueis.filter(a => a.status === 'em_negociacao')
  const confirmadoParcial = alugueis.filter(a => a.status === 'confirmado_parcial')
  const atrasados         = alugueis.filter(a => !a.pago && a.data_entrega && a.data_entrega < today && !PRE_STATUSES.has(a.status))
  const hoje              = alugueis.filter(a => a.data_entrega === today)

  const confirmados = alugueis.filter(a => !PRE_STATUSES.has(a.status))
  const recebido    = confirmados.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const aberto      = confirmados.filter(a => !a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const faturamento = recebido + aberto

  const filtered = useMemo(() => {
    const list = alugueis.filter(a => {
      // Pré-confirmações têm banners próprios; só aparecem aqui se filtro explícito
      if (filtroStatus === 'todos' && PRE_STATUSES.has(a.status)) return false
      if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase()) && !a.contato?.includes(busca)) return false
      if (filtroPago === 'pago'     &&  !a.pago) return false
      if (filtroPago === 'pendente' &&   a.pago) return false
      if (filtroStatus !== 'todos'  && a.status !== filtroStatus) return false
      if (!dateRangeFilter(a)) return false
      return true
    })
    if (!sortKey) return list
    return [...list].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'nome')         { va = a.nome;         vb = b.nome }
      if (sortKey === 'data_entrega') { va = a.data_entrega; vb = b.data_entrega }
      if (sortKey === 'status')       { va = a.status;       vb = b.status }
      if (sortKey === 'total')        { va = a.total || 0;   vb = b.total || 0 }
      if (sortKey === 'pago')         { va = a.pago ? 1 : 0; vb = b.pago ? 1 : 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [alugueis, busca, filtroPago, filtroStatus, filtroData, today, sortKey, sortDir])

  const inputCls = `bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
    font-sans text-[0.82rem] text-ink placeholder:text-ink3
    focus:outline-none focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6 transition-all`

  return (
    <div className="animate-fade-up">

      {/* Cabeçalho */}
      <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
              Dashboard
            </h1>
            <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
              Visão geral dos aluguéis
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={`${inputCls} flex-1 min-w-0`}
          />
          <select
            value={filtroPago}
            onChange={e => setFiltroPago(e.target.value as typeof filtroPago)}
            aria-label="Filtrar por pagamento"
            className={`${inputCls} cursor-pointer shrink-0`}
          >
            <option value="todos">Pagamento</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos</option>
          </select>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}
            aria-label="Filtrar por status"
            className={`${inputCls} cursor-pointer shrink-0`}
          >
            <option value="todos">Status</option>
            {STATUS_CYCLE.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select
            value={filtroData}
            onChange={e => setFiltroData(e.target.value as typeof filtroData)}
            aria-label="Filtrar por data"
            className={`${inputCls} cursor-pointer shrink-0`}
          >
            <option value="todos">Período</option>
            <option value="hoje">Hoje{hoje.length > 0 ? ` (${hoje.length})` : ''}</option>
            <option value="ontem">Ontem</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="1mes">Último mês</option>
          </select>
        </div>
      </div>

      {/* Solicitações aguardando confirmação */}
      {showAguardando && aguardando.length > 0 && (
        <div className="mb-5 bg-orange-400/[0.05] border border-orange-400/25 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-orange-400/15">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-orange-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="font-mono text-[0.68rem] font-semibold text-orange-400 uppercase tracking-[0.06em]">
                {aguardando.length} solicitaç{aguardando.length > 1 ? 'ões aguardando' : 'ão aguardando'} confirmação
              </span>
            </div>
            <button type="button" onClick={() => setShowAguardando(false)}
              className="text-orange-400/50 hover:text-orange-400 transition-colors cursor-pointer text-sm">
              ✕
            </button>
          </div>
          <div className="divide-y divide-orange-400/10">
            {aguardando.map(a => (
              <div key={a.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-orange-400/5 transition-colors gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans font-semibold text-[0.85rem] text-ink">{a.nome}</span>
                      {a.contato && (
                        <span className="font-mono text-[0.65rem] text-ink3">{a.contato}</span>
                      )}
                    </div>
                    {a.data_entrega && (
                      <span className="font-mono text-[0.65rem] text-orange-400/70">
                        Evento: {fmtData(a.data_entrega)}
                      </span>
                    )}
                    {a.obs && (
                      <p className="font-sans text-[0.72rem] text-ink3 mt-0.5 italic truncate max-w-[260px]"
                        title={a.obs}>{a.obs}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[0.82rem] font-semibold text-ink">
                    R$ {(a.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button type="button" onClick={() => onEdit(a)}
                    className="px-2.5 py-1 rounded-sm border border-[var(--c-border)] text-ink2
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-bg3 hover:text-ink hover:border-[var(--c-border2)] transition-all">
                    Ver
                  </button>
                  <button type="button" onClick={() => onConfirmar(a)}
                    className="px-2.5 py-1 rounded-sm border border-green-400/30 text-green-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-green-400/10 transition-all whitespace-nowrap">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => onRecusar(a.id)}
                    className="px-2.5 py-1 rounded-sm border border-red-400/30 text-red-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-red-400/10 transition-all">
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner: Em negociação via WhatsApp */}
      {showNegociacao && emNegociacao.length > 0 && (
        <div className="mb-5 bg-yellow-400/[0.05] border border-yellow-400/25 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-400/15">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="font-mono text-[0.68rem] font-semibold text-yellow-400 uppercase tracking-[0.06em]">
                {emNegociacao.length} pedido{emNegociacao.length > 1 ? 's' : ''} em negociação via WhatsApp
              </span>
            </div>
            <button type="button" onClick={() => setShowNegociacao(false)}
              className="text-yellow-400/50 hover:text-yellow-400 transition-colors cursor-pointer text-sm">✕</button>
          </div>
          <div className="divide-y divide-yellow-400/10">
            {emNegociacao.map(a => (
              <div key={a.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-yellow-400/5 transition-colors gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-[0.85rem] text-ink">{a.nome}</span>
                    {a.contato && <span className="font-mono text-[0.65rem] text-ink3">{a.contato}</span>}
                  </div>
                  {a.data_entrega && (
                    <span className="font-mono text-[0.65rem] text-yellow-400/70">
                      Evento: {fmtData(a.data_entrega)}
                    </span>
                  )}
                  {a.obs && (
                    <p className="font-sans text-[0.72rem] text-ink3 mt-0.5 italic truncate max-w-[260px]"
                      title={a.obs}>{a.obs}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[0.82rem] font-semibold text-ink">
                    R$ {(a.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button type="button" onClick={() => onEdit(a)}
                    className="px-2.5 py-1 rounded-sm border border-[var(--c-border)] text-ink2
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-bg3 hover:text-ink hover:border-[var(--c-border2)] transition-all">Ver</button>
                  <button type="button" onClick={() => onConfirmar(a)}
                    className="px-2.5 py-1 rounded-sm border border-green-400/30 text-green-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-green-400/10 transition-all whitespace-nowrap">Confirmar</button>
                  <button type="button" onClick={() => onRecusar(a.id)}
                    className="px-2.5 py-1 rounded-sm border border-red-400/30 text-red-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-red-400/10 transition-all">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner: PIX aguardando verificação */}
      {showPixPendente && confirmadoParcial.length > 0 && (
        <div className="mb-5 bg-teal-400/[0.05] border border-teal-400/25 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-teal-400/15">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-teal-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="font-mono text-[0.68rem] font-semibold text-teal-400 uppercase tracking-[0.06em]">
                {confirmadoParcial.length} PIX aguardando verificação (50% antecipado)
              </span>
            </div>
            <button type="button" onClick={() => setShowPixPendente(false)}
              className="text-teal-400/50 hover:text-teal-400 transition-colors cursor-pointer text-sm">✕</button>
          </div>
          <div className="divide-y divide-teal-400/10">
            {confirmadoParcial.map(a => (
              <div key={a.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-teal-400/5 transition-colors gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-[0.85rem] text-ink">{a.nome}</span>
                    {a.contato && <span className="font-mono text-[0.65rem] text-ink3">{a.contato}</span>}
                  </div>
                  {a.data_entrega && (
                    <span className="font-mono text-[0.65rem] text-teal-400/70">
                      Evento: {fmtData(a.data_entrega)}
                    </span>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-[0.65rem] text-teal-400 font-semibold">
                      PIX declarado: R$ {((a.total || 0) / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="font-mono text-[0.62rem] text-ink3">
                      · total: R$ {(a.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => onEdit(a)}
                    className="px-2.5 py-1 rounded-sm border border-[var(--c-border)] text-ink2
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-bg3 hover:text-ink hover:border-[var(--c-border2)] transition-all">Ver</button>
                  <button type="button" onClick={() => onConfirmarPix(a)}
                    className="px-2.5 py-1 rounded-sm border border-teal-400/30 text-teal-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-teal-400/10 transition-all whitespace-nowrap">✓ Confirmar PIX</button>
                  <button type="button" onClick={() => onRecusar(a.id)}
                    className="px-2.5 py-1 rounded-sm border border-red-400/30 text-red-400
                               font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                               hover:bg-red-400/10 transition-all">Cancelar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de pedidos em atraso */}
      {showAtrasados && atrasados.length > 0 && (
        <div className="mb-5 bg-red-400/[0.05] border border-red-400/25 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-400/15">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="font-mono text-[0.68rem] font-semibold text-red-400 uppercase tracking-[0.06em]">
                {atrasados.length} pedido{atrasados.length > 1 ? 's' : ''} em atraso — pagamento pendente
              </span>
            </div>
            <button type="button" onClick={() => setShowAtrasados(false)}
              className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer text-sm">
              ✕
            </button>
          </div>
          <div className="divide-y divide-red-400/10">
            {atrasados.map(a => {
              const dias = Math.floor(
                (Date.now() - new Date(a.data_entrega + 'T00:00:00').getTime()) / 86_400_000
              )
              return (
                <div key={a.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-red-400/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-sans font-semibold text-[0.85rem] text-ink">{a.nome}</span>
                    <span className="font-mono text-[0.68rem] text-red-400/80">
                      {dias}d de atraso · previsto {fmtData(a.data_entrega)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[0.82rem] font-semibold text-ink">
                      R$ {(a.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button type="button" onClick={() => onEdit(a)}
                      className="px-2.5 py-1 rounded-sm border border-red-400/30 text-red-400
                                 font-mono text-[0.65rem] cursor-pointer uppercase tracking-[0.04em]
                                 hover:bg-red-400/10 transition-all whitespace-nowrap">
                      Ver pedido
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-2">
        <KPICard label="Total de aluguéis"  value={confirmados.length}                       delay={50}  />
        <KPICard label="Em aberto"           value={fmtMoney(aberto)}    variant="red"     delay={100} />
        <KPICard label="Recebido"            value={fmtMoney(recebido)}  variant="green"   delay={150} />
        <KPICard label="Faturamento total"   value={fmtMoney(faturamento)} variant="accent" delay={200} />
      </div>

      {/* Status pills rápidos + CSV */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUS_CYCLE.map(s => {
            const count = alugueis.filter(a => a.status === s).length
            const meta  = STATUS_META[s]
            const ativo = filtroStatus === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroStatus(ativo ? 'todos' : s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border
                            font-mono text-[0.65rem] font-semibold uppercase tracking-[0.05em]
                            cursor-pointer transition-all
                            ${ativo ? meta.color : 'border-[var(--c-border)] text-ink3 hover:border-[var(--c-border2)] hover:text-ink2'}`}
              >
                {meta.label}
                <span className={`px-1.5 py-0.5 rounded-sm ${ativo ? 'bg-black/20' : 'bg-white/5'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          title="Exportar tabela filtrada como CSV"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[var(--c-border)]
                     font-mono text-[0.65rem] text-ink2 cursor-pointer uppercase tracking-[0.05em]
                     hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all shrink-0"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          CSV
        </button>
      </div>

      {/* Tabela */}
      <RentalTable
        alugueis={filtered}
        onEdit={onEdit}
        onTogglePago={onTogglePago}
        onStatusChange={onStatusChange}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {filtered.length > 0 && (
        <p className="mt-3 text-right font-mono text-[0.65rem] text-ink3">
          {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== alugueis.length && ` de ${alugueis.length}`}
        </p>
      )}
    </div>
  )
}
