import { useState } from 'react'
import type { Aluguel } from '../types'
import { fmtMoney } from '../utils/format'
import { KPICard } from './KPICard'
import { RentalTable } from './RentalTable'

interface Props {
  alugueis: Aluguel[]
  onEdit: (a: Aluguel) => void
  onTogglePago: (id: number, pago: boolean) => void
}

export function Dashboard({ alugueis, onEdit, onTogglePago }: Props) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'pago'>('todos')

  const recebido    = alugueis.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const aberto      = alugueis.filter(a => !a.pago).reduce((s, a) => s + (a.total || 0), 0)
  const faturamento = recebido + aberto

  const filtered = alugueis.filter(a => {
    const matchBusca = !busca ||
      a.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (a.contato?.includes(busca))
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'pago'     &&  a.pago) ||
      (filtro === 'pendente' && !a.pago)
    return matchBusca && matchFiltro
  })

  const inputCls = `
    bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
    font-sans text-[0.82rem] text-ink placeholder:text-ink3
    focus:outline-none focus:border-accent/40
    focus:ring-[3px] focus:ring-accent/6 transition-all
  `

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
            className={`${inputCls} max-w-[220px] w-full`}
          />
          <select
            value={filtro}
            onChange={e => setFiltro(e.target.value as 'todos' | 'pendente' | 'pago')}
            aria-label="Filtrar por pagamento"
            className={`${inputCls} max-w-[140px] cursor-pointer`}
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-2">
        <KPICard label="Total de aluguéis" value={alugueis.length}                       delay={50}  />
        <KPICard label="Em aberto"          value={fmtMoney(aberto)}    variant="red"     delay={100} />
        <KPICard label="Recebido"           value={fmtMoney(recebido)}  variant="green"   delay={150} />
        <KPICard label="Faturamento total"  value={fmtMoney(faturamento)} variant="accent" delay={200} />
      </div>

      {/* Tabela */}
      <RentalTable
        alugueis={filtered}
        onEdit={onEdit}
        onTogglePago={onTogglePago}
      />
    </div>
  )
}
