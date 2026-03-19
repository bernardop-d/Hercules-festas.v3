export const fmt = (v: number): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtMoney = (v: number): string => 'R$ ' + fmt(v)

export const fmtData = (s: string): string =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export const padId = (id: number): string => String(id).padStart(4, '0')

/** Parses stored item string → { itemName: qty }
 *  Format: "Pula-pula médio (x2) — R$ 500,00, ..."
 */
export const parseItens = (itensStr: string): Record<string, number> => {
  const dict: Record<string, number> = {}
  if (!itensStr || itensStr === 'Nenhum item') return dict
  itensStr.split(', ').forEach(trecho => {
    const match = trecho.match(/^(.+?) \(x(\d+)\)/)
    if (match) dict[match[1]] = parseInt(match[2])
  })
  return dict
}
