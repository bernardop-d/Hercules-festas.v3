import { useState } from 'react'
import type { ItemDict } from '../types'
import { fmt } from '../utils/format'

interface Props {
  precos: Record<string, number>
  values: ItemDict
  onChange: (values: ItemDict) => void
  maxHeight?: string
}

export function ItemSelector({ precos, values, onChange, maxHeight = '520px' }: Props) {
  const [busca, setBusca] = useState('')

  const filteredEntries = Object.entries(precos).filter(([item]) =>
    !busca || item.toLowerCase().includes(busca.toLowerCase())
  )

  const handleQty = (item: string, raw: string) => {
    const qty = Math.max(0, parseInt(raw) || 0)
    const next = { ...values }
    if (qty > 0) next[item] = qty
    else delete next[item]
    onChange(next)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-mono text-[0.65rem] font-semibold text-ink3 uppercase tracking-[0.1em]">
          Itens disponíveis
        </h3>
        <input
          type="text"
          placeholder="Filtrar..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="bg-bg3 border border-[var(--c-border)] rounded px-2.5 py-1.5
                     font-sans text-[0.78rem] text-ink placeholder:text-ink3
                     focus:outline-none focus:border-accent/40
                     focus:ring-[3px] focus:ring-accent/6 transition-all
                     max-w-[150px]"
        />
      </div>

      {/* Lista */}
      <div
        className="overflow-y-auto flex flex-col gap-1 pr-1"
        style={{ maxHeight }}
      >
        {filteredEntries.map(([item, preco]) => {
          const qty = values[item] || 0
          const selected = qty > 0
          return (
            <div
              key={item}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-sm border
                         transition-all
                         ${selected
                           ? 'border-accent/30 bg-accent/5'
                           : 'border-[var(--c-border)] bg-white/[0.02] hover:border-[var(--c-border2)] hover:bg-white/[0.04]'
                         }`}
            >
              <span className={`flex-1 text-[0.78rem] ${selected ? 'text-ink' : 'text-ink2'}`}>
                {item}
              </span>
              <span className="font-mono text-[0.68rem] text-ink3 whitespace-nowrap">
                R$ {fmt(preco)}
              </span>
              <input
                type="number"
                min={0}
                value={qty || ''}
                placeholder="0"
                onChange={e => handleQty(item, e.target.value)}
                className={`w-12 px-2 py-1 text-center font-mono text-[0.78rem] rounded-sm
                            border bg-bg3 transition-all focus:outline-none
                            ${selected
                              ? 'border-accent/40 text-accent'
                              : 'border-[var(--c-border)] text-ink'
                            }
                            focus:border-accent/60`}
              />
            </div>
          )
        })}

        {filteredEntries.length === 0 && (
          <p className="text-center py-8 text-ink3 font-mono text-[0.72rem]">
            Nenhum item encontrado.
          </p>
        )}
      </div>
    </div>
  )
}
