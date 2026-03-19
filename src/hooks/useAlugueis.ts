import { useState, useCallback, useEffect } from 'react'
import type { Aluguel, RentalPayload } from '../types'

const API = '/api'

export interface PrecosOps {
  criar:     (nome: string, preco: number) => Promise<void>
  atualizar: (nome: string, preco: number) => Promise<void>
  excluir:   (nome: string)               => Promise<void>
}

export function useAlugueis() {
  const [alugueis, setAlugueis] = useState<Aluguel[]>([])
  const [precos,   setPrecos]   = useState<Record<string, number>>({})
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // ── Preços ─────────────────────────────────────────────────
  const carregarPrecos = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/precos`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Record<string, number> = await res.json()
      setPrecos(data)
    } catch {
      // não-crítico no carregamento inicial
    }
  }, [])

  const precosOps: PrecosOps = {
    criar: async (nome, preco) => {
      const res = await fetch(`${API}/precos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, preco }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao salvar preço.')
      await carregarPrecos()
    },
    atualizar: async (nome, preco) => {
      const res = await fetch(`${API}/precos/${encodeURIComponent(nome)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preco }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao atualizar preço.')
      await carregarPrecos()
    },
    excluir: async (nome) => {
      const res = await fetch(`${API}/precos/${encodeURIComponent(nome)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao excluir item.')
      await carregarPrecos()
    },
  }

  // ── Aluguéis ───────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/alugueis`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Aluguel[] = await res.json()
      setAlugueis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pedidos.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh silencioso a cada 60 segundos
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API}/alugueis`)
        if (!res.ok) return
        const data: Aluguel[] = await res.json()
        setAlugueis(data)
      } catch {
        // falha silenciosa no refresh automático
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const criar = async (payload: RentalPayload): Promise<{ total: number }> => {
    const res = await fetch(`${API}/alugueis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao criar pedido.')
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
    if (!res.ok) throw new Error(data.erro || 'Erro ao salvar alterações.')
    await carregar()
  }

  const atualizarStatus = async (id: number, status: string): Promise<void> => {
    const res = await fetch(`${API}/alugueis/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Erro ao atualizar status.')
    }
    // atualiza localmente sem round-trip completo
    setAlugueis(prev =>
      prev.map(a => a.id === id ? { ...a, status } : a)
    )
  }

  const togglePagamento = async (id: number, pago: boolean): Promise<void> => {
    const res = await fetch(`${API}/alugueis/${id}/pagamento`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Erro ao atualizar pagamento.')
    }
    setAlugueis(prev =>
      prev.map(a => a.id === id ? { ...a, pago: pago ? 1 : 0 } : a)
    )
  }

  const excluir = async (id: number): Promise<void> => {
    const res = await fetch(`${API}/alugueis/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Erro ao excluir pedido.')
    }
    await carregar()
  }

  return {
    alugueis,
    precos,
    loading,
    error,
    carregarPrecos,
    carregar,
    criar,
    atualizar,
    atualizarStatus,
    togglePagamento,
    excluir,
    precosOps,
  }
}
