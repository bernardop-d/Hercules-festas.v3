export interface Aluguel {
  id: number
  nome: string
  contato: string
  endereco: string
  data_entrega: string
  itens: string
  total: number
  subtotal: number
  frete: number
  pago: number   // SQLite: 0 | 1
  criado_em: string
}

export type View = 'dashboard' | 'novo'

export type ItemDict = Record<string, number>

export interface RentalPayload {
  nome: string
  contato: string
  endereco: string
  data_entrega: string
  frete: number
  pago: boolean
  itens: ItemDict
}
