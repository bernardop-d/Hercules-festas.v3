import { useEffect } from 'react'
import type { Aluguel, View } from './types'
import { useState } from 'react'
import { useDarkMode }  from './hooks/useDarkMode'
import { useAlugueis }  from './hooks/useAlugueis'
import { useToast }     from './hooks/useToast'
import { Sidebar }      from './components/Sidebar'
import { Dashboard }    from './components/Dashboard'
import { NovoAluguel }  from './components/NovoAluguel'
import { ModalEdit }    from './components/ModalEdit'
import { NotaFiscal }   from './components/NotaFiscal'
import { Precos }       from './components/Precos'
import { Toaster }      from './components/Toaster'
import { openWhatsapp, openWhatsappConfirmacao, openWhatsappRejeicao } from './utils/pdf'

export function App() {
  const { dark, toggle } = useDarkMode(true)
  const [view, setView]             = useState<View>('dashboard')
  const [editTarget, setEditTarget] = useState<Aluguel | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const { toasts, toast, dismiss } = useToast()

  const {
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
  } = useAlugueis()

  useEffect(() => {
    carregarPrecos()
    carregar()
  }, [carregarPrecos, carregar])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().split('T')[0]

  const stats = {
    ativos:     alugueis.length,
    aguardando: alugueis.filter(a => ['aguardando','em_negociacao','aguardando_pagamento','confirmado_parcial'].includes(a.status)).length,
    pendentes:  alugueis.filter(a => !a.pago).length,
    recebido:   alugueis.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0),
    hoje:       alugueis.filter(a => a.data_entrega === today).length,
  }

  const handleConfirmar = async (aluguel: Aluguel) => {
    try {
      await atualizarStatus(aluguel.id, 'confirmado')
      toast.success(`Pedido de ${aluguel.nome} confirmado!`)
      openWhatsappConfirmacao({ ...aluguel, status: 'confirmado' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao confirmar pedido.')
    }
  }

  const handleConfirmarPix = async (aluguel: Aluguel) => {
    try {
      await atualizarStatus(aluguel.id, 'confirmado')
      toast.success(`PIX confirmado! Pedido de ${aluguel.nome} em andamento.`)
      openWhatsappConfirmacao({ ...aluguel, status: 'confirmado' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao confirmar PIX.')
    }
  }

  const handleRecusar = async (id: number) => {
    if (!window.confirm('Recusar esta solicitação? Será enviada uma mensagem no WhatsApp do cliente e o pedido será excluído.')) return
    const aluguel = alugueis.find(a => a.id === id)
    try {
      await excluir(id)
      toast.success('Solicitação recusada.')
      if (aluguel) openWhatsappRejeicao(aluguel)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recusar pedido.')
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    const aluguel = alugueis.find(a => a.id === id)
    try {
      await atualizarStatus(id, newStatus)
      if (newStatus === 'devolvido' && aluguel && !aluguel.pago) {
        if (window.confirm(`"${aluguel.nome}" foi devolvido.\nEnviar cobrança pelo WhatsApp agora?`)) {
          openWhatsapp(aluguel)
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status.')
    }
  }

  return (
    <div className="flex min-h-screen bg-bg font-sans text-ink text-[13px] leading-relaxed">
      <Sidebar
        view={view}
        onViewChange={v => setView(v)}
        stats={stats}
      />

      <main className="ml-64 flex-1 min-h-screen flex flex-col">

        {/* Topbar */}
        <div className="h-12 border-b border-[var(--c-border)] bg-bg2 flex items-center justify-end px-6 gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            title="Atualizar dados"
            onClick={async () => {
              setRefreshing(true)
              try {
                await Promise.all([carregar(), carregarPrecos()])
                toast.success('Dados atualizados.')
              } catch {
                toast.error('Erro ao atualizar.')
              } finally {
                setRefreshing(false)
              }
            }}
            className="flex items-center gap-1.5 px-3 h-7 rounded border border-[var(--c-border)]
                       font-mono text-[0.7rem] text-ink2 cursor-pointer
                       hover:border-[var(--c-border2)] hover:text-ink transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              className={refreshing ? 'animate-spin' : ''}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>

          <button type="button" onClick={toggle} title={dark ? 'Modo claro' : 'Modo escuro'}
            className="w-7 h-7 flex items-center justify-center rounded border border-[var(--c-border)]
                       text-ink3 cursor-pointer hover:border-[var(--c-border2)] hover:text-ink2 transition-colors">
            {dark ? (
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        <div className="p-7 flex-1 max-[700px]:p-4">
          {loading && alugueis.length === 0 ? (
            <div className="flex items-center justify-center h-64
                            font-mono text-[0.75rem] text-ink3 tracking-[0.05em]">
              Carregando...
            </div>
          ) : view === 'dashboard' ? (
            <Dashboard
              alugueis={alugueis}
              onEdit={setEditTarget}
              onTogglePago={async (id, pago) => {
                try {
                  await togglePagamento(id, pago)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao atualizar pagamento.')
                }
              }}
              onStatusChange={handleStatusChange}
              onConfirmar={handleConfirmar}
              onRecusar={handleRecusar}
              onConfirmarPix={handleConfirmarPix}
            />
          ) : view === 'nota-fiscal' ? (
            <NotaFiscal alugueis={alugueis} />
          ) : view === 'precos' ? (
            <Precos
              precos={precos}
              ops={precosOps}
              onSuccess={msg => toast.success(msg)}
              onError={msg => toast.error(msg)}
            />
          ) : (
            <NovoAluguel
              precos={precos}
              onError={msg => toast.error(msg)}
              onSubmit={async payload => {
                try {
                  const data = await criar(payload)
                  toast.success('Pedido criado com sucesso!')
                  setView('dashboard')
                  return data
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao criar pedido.')
                  throw e
                }
              }}
            />
          )}
        </div>
      </main>

      {editTarget && (
        <ModalEdit
          aluguel={editTarget}
          precos={precos}
          onClose={() => setEditTarget(null)}
          onError={msg => toast.error(msg)}
          onSave={async (id, payload) => {
            try {
              await atualizar(id, payload)
              toast.success('Alterações salvas.')
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Erro ao salvar.')
              throw e
            }
          }}
          onDelete={async id => {
            try {
              await excluir(id)
              setEditTarget(null)
              toast.success('Pedido excluído.')
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Erro ao excluir.')
              throw e
            }
          }}
          onDuplicate={async payload => {
            try {
              await criar(payload)
              toast.success(`Pedido de ${editTarget.nome} duplicado!`)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Erro ao duplicar.')
              throw e
            }
          }}
        />
      )}

      <Toaster toasts={toasts} dismiss={dismiss} />
      <div id="print-area" />
    </div>
  )
}
