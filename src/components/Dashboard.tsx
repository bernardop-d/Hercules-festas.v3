import { useState } from 'react'
import type { Aluguel } from '../types'
import { fmtMoney, fmtData } from '../utils/format'
import { STATUS_META, STATUS_CYCLE, type StatusKey } from '../utils/status'
import { exportCsv } from '../utils/csv'
import { KPICard } from './KPICard'
import { RentalTable } from './RentalTable'

interface Props {
  alugueis:       Aluguel[]
  onEdit:         (a: Aluguel) => void
  onTogglePago:   (id: number, pago: boolean) => void
  onStatusChange: (id: number, status: string) => void
}

type FiltroStatus = 'todos' | StatusKey

export function Dashboard({ alugueis, onEdit, onTogglePago, onStatusChange }: Props) {
  const [busca,        setBusca]        = useState('')
  const [filtroPago,   setFiltroPago]   = useState<'todos' | 'pendente' | 'pago'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [somenteHoje,  setSomenteHoje]  = useState(false)
  const [showAtrasados, setShowAtrasados] = useState(true)

  const today     = new Date().toISOString().split('T')[0]
  const atrasados = alugueis.filter(a => !a.pago && a.data_entrega && a.data_entrega < today)
  const hoje      = alugueis.filter(a => a.data_entrega === today)

  const recebido    = alugueis.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const aberto      = alugueis.filter(a => !a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const faturamento = recebido + aberto

  const filtered = alugueis.filter(a => {
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase()) && !a.contato?.includes(busca)) return false
    if (filtroPago === 'pago'     &&  !a.pago) return false
    if (filtroPago === 'pendente' &&   a.pago) return false
    if (filtroStatus !== 'todos'  && a.status !== filtroStatus) return false
    if (somenteHoje && a.data_entrega !== today) return false
    return true
  })

  const inputCls = `bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
    font-sans text-[0.82rem] text-ink placeholder:text-ink3
    focus:outline-none focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6 transition-all`

  return (
    <div className="animate-fade-up">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6
                      pb-5 border-b border-[var(--c-border)]">
        <div>
          <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
            Dashboard
          </h1>
          <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
            Visão geral dos aluguéis
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={`${inputCls} max-w-[200px] w-full`}
          />
          <select
            value={filtroPago}
            onChange={e => setFiltroPago(e.target.value as typeof filtroPago)}
            aria-label="Filtrar por pagamento"
            className={`${inputCls} max-w-[130px] cursor-pointer`}
          >
            <option value="todos">Pagamento</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos</option>
          </select>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}
            aria-label="Filtrar por status"
            className={`${inputCls} max-w-[130px] cursor-pointer`}
          >
            <option value="todos">Status</option>
            {STATUS_CYCLE.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSomenteHoje(v => !v)}
            className={`px-3 py-2 rounded border font-mono text-[0.72rem] font-semibold
                        uppercase tracking-[0.05em] cursor-pointer transition-all whitespace-nowrap
                        ${somenteHoje
                          ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                          : 'border-[var(--c-border)] text-ink2 hover:border-amber-400/30 hover:text-amber-400'
                        }`}
          >
            Hoje {hoje.length > 0 && `(${hoje.length})`}
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            title="Exportar tabela filtrada como CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-[var(--c-border)]
                       font-mono text-[0.72rem] text-ink2 cursor-pointer uppercase tracking-[0.05em]
                       hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
        </div>
      </div>

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
        <KPICard label="Total de aluguéis"  value={alugueis.length}                       delay={50}  />
        <KPICard label="Em aberto"           value={fmtMoney(aberto)}    variant="red"     delay={100} />
        <KPICard label="Recebido"            value={fmtMoney(recebido)}  variant="green"   delay={150} />
        <KPICard label="Faturamento total"   value={fmtMoney(faturamento)} variant="accent" delay={200} />
      </div>

      {/* Status pills rápidos */}
      <div className="flex gap-2 mb-4 flex-wrap">
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

      {/* Tabela */}
      <RentalTable
        alugueis={filtered}
        onEdit={onEdit}
        onTogglePago={onTogglePago}
        onStatusChange={onStatusChange}
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
