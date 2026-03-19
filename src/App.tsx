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

export function App() {
  const { dark, toggle } = useDarkMode(true)
  const [view, setView]             = useState<View>('dashboard')
  const [editTarget, setEditTarget] = useState<Aluguel | null>(null)

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
    ativos:    alugueis.length,
    pendentes: alugueis.filter(a => !a.pago).length,
    recebido:  alugueis.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0),
    hoje:      alugueis.filter(a => a.data_entrega === today).length,
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await atualizarStatus(id, status)
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
        dark={dark}
        onToggleDark={toggle}
      />

      <main className="ml-64 flex-1 min-h-screen flex flex-col">
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
