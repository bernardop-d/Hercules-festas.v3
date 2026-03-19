export type StatusKey =
  | 'aguardando'
  | 'em_negociacao'
  | 'aguardando_pagamento'
  | 'confirmado_parcial'
  | 'confirmado'
  | 'separado'
  | 'em_entrega'
  | 'devolvido'

/** Ciclo operacional normal — não inclui os status de pré-confirmação */
export const STATUS_CYCLE: StatusKey[] = [
  'confirmado',
  'separado',
  'em_entrega',
  'devolvido',
]

export const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  aguardando: {
    label: 'Aguardando',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  },
  em_negociacao: {
    label: 'Negociando',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  },
  aguardando_pagamento: {
    label: 'PIX pendente',
    color: 'text-sky-400 bg-sky-400/10 border-sky-400/25',
  },
  confirmado_parcial: {
    label: 'Pago 50%',
    color: 'text-teal-400 bg-teal-400/10 border-teal-400/25',
  },
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
  if (idx === -1) return 'confirmado'
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

export function getStatusMeta(s?: string) {
  return STATUS_META[(s as StatusKey)] ?? STATUS_META.aguardando
}
