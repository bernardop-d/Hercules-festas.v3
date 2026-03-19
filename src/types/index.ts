export interface Aluguel {
  id:           number
  nome:         string
  contato:      string
  endereco:     string
  data_entrega: string
  itens:        string
  total:        number
  subtotal:     number
  frete:        number
  pago:         number   // 0 | 1
  status:       string   // 'confirmado' | 'separado' | 'em_entrega' | 'devolvido'
  obs:          string
  criado_em:    string
}

export type View = 'dashboard' | 'novo' | 'nota-fiscal' | 'precos'

export type ItemDict = Record<string, number>

export interface RentalPayload {
  nome:         string
  contato:      string
  endereco:     string
  data_entrega: string
  frete:        number
  pago:         boolean
  itens:        ItemDict
  status?:      string
  obs?:         string
}
