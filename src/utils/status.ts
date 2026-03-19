export type StatusKey = 'confirmado' | 'separado' | 'em_entrega' | 'devolvido'

export const STATUS_CYCLE: StatusKey[] = [
  'confirmado',
  'separado',
  'em_entrega',
  'devolvido',
]

export const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  confirmado: {
    label: 'Confirmado',
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  },
  separado: {
    label: 'Separado',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  },
  em_entrega: {
    label: 'Em entrega',
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/25',
  },
  devolvido: {
    label: 'Devolvido',
    color: 'text-green-400 bg-green-400/10 border-green-400/25',
  },
}

export function nextStatus(current: string): StatusKey {
  const idx = STATUS_CYCLE.indexOf(current as StatusKey)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

export function getStatusMeta(s?: string) {
  return STATUS_META[(s as StatusKey) ?? 'confirmado'] ?? STATUS_META.confirmado
}
