import { useEffect } from 'react'
import type { Aluguel, View } from './types'
import { useState } from 'react'
import { useDarkMode } from './hooks/useDarkMode'
import { useAlugueis } from './hooks/useAlugueis'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { NovoAluguel } from './components/NovoAluguel'
import { ModalEdit } from './components/ModalEdit'

export function App() {
  const { dark, toggle } = useDarkMode(true)
  const [view, setView]             = useState<View>('dashboard')
  const [editTarget, setEditTarget] = useState<Aluguel | null>(null)

  const {
    alugueis,
    precos,
    loading,
    carregarPrecos,
    carregar,
    criar,
    atualizar,
    togglePagamento,
    excluir,
  } = useAlugueis()

  useEffect(() => {
    carregarPrecos()
    carregar()
  }, [carregarPrecos, carregar])

  const stats = {
    ativos:    alugueis.length,
    pendentes: alugueis.filter(a => !a.pago).length,
    recebido:  alugueis.filter(a => a.pago).reduce((s, a) => s + (a.total || 0), 0),
  }

  return (
    <div className="flex min-h-screen bg-bg font-sans text-ink text-[13px] leading-relaxed">
      <Sidebar
        view={view}
        onViewChange={v => { setView(v) }}
        stats={stats}
        dark={dark}
        onToggleDark={toggle}
      />

      {/* Conteúdo principal */}
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
              onTogglePago={togglePagamento}
            />
          ) : (
            <NovoAluguel
              precos={precos}
              onSubmit={async payload => {
                const data = await criar(payload)
                setView('dashboard')
                return data
              }}
            />
          )}
        </div>
      </main>

      {/* Modal de edição */}
      {editTarget && (
        <ModalEdit
          aluguel={editTarget}
          precos={precos}
          onClose={() => setEditTarget(null)}
          onSave={atualizar}
          onDelete={async id => {
            await excluir(id)
            setEditTarget(null)
          }}
        />
      )}

      {/* Área de impressão */}
      <div id="print-area" />
    </div>
  )
}
