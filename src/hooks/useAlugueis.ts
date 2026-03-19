import { useState, useCallback } from 'react'
import type { Aluguel, RentalPayload } from '../types'

const API = '/api'

export function useAlugueis() {
  const [alugueis, setAlugueis] = useState<Aluguel[]>([])
  const [precos, setPrecos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const carregarPrecos = useCallback(async () => {
    const res = await fetch(`${API}/precos`)
    const data: Record<string, number> = await res.json()
    setPrecos(data)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/alugueis`)
      const data: Aluguel[] = await res.json()
      setAlugueis(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = async (payload: RentalPayload): Promise<{ total: number }> => {
    const res = await fetch(`${API}/alugueis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao criar.')
    await carregar()
    return data as { total: number }
  }

  const atualizar = async (id: number, payload: RentalPayload): Promise<void> => {
    const res = await fetch(`${API}/alugueis/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao salvar.')
    await carregar()
  }

  const togglePagamento = async (id: number, pago: boolean): Promise<void> => {
    await fetch(`${API}/alugueis/${id}/pagamento`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago: pago ? 1 : 0 }),
    })
    await carregar()
  }

  const excluir = async (id: number): Promise<void> => {
    await fetch(`${API}/alugueis/${id}`, { method: 'DELETE' })
    await carregar()
  }

  return {
    alugueis,
    precos,
    loading,
    carregarPrecos,
    carregar,
    criar,
    atualizar,
    togglePagamento,
    excluir,
  }
}
