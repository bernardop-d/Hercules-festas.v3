import type { Aluguel } from '../types'
import { getStatusMeta } from './status'

function cell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

export function exportCsv(alugueis: Aluguel[], filename?: string) {
  const headers = [
    'ID', 'Cliente', 'Contato', 'Endereço',
    'Data de entrega', 'Status', 'Pago',
    'Itens', 'Subtotal', 'Frete', 'Total',
    'Criado em',
  ]

  const rows = alugueis.map(a => [
    a.id,
    a.nome,
    a.contato  || '',
    a.endereco || '',
    a.data_entrega || '',
    getStatusMeta(a.status).label,
    a.pago ? 'Sim' : 'Não',
    a.itens || '',
    (a.subtotal || 0).toFixed(2).replace('.', ','),
    (a.frete    || 0).toFixed(2).replace('.', ','),
    (a.total    || 0).toFixed(2).replace('.', ','),
    a.criado_em || '',
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell).join(';'))
    .join('\r\n')

  // BOM para Excel abrir corretamente em UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename ?? `Hercules_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
