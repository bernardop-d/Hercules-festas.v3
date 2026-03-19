import { useState } from 'react'
import type { PrecosOps } from '../hooks/useAlugueis'
import { fmt } from '../utils/format'

interface Props {
  precos:    Record<string, number>
  ops:       PrecosOps
  onSuccess: (msg: string) => void
  onError:   (msg: string) => void
}

const INPUT = `w-full bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
  font-sans text-[0.82rem] text-ink placeholder:text-ink3
  focus:outline-none focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6 transition-all`

const LABEL = `font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.06em] mb-1 block`

export function Precos({ precos, ops, onSuccess, onError }: Props) {
  const [busca,      setBusca]      = useState('')
  const [editNome,   setEditNome]   = useState<string | null>(null)
  const [editPreco,  setEditPreco]  = useState('')
  const [novoNome,   setNovoNome]   = useState('')
  const [novoPreco,  setNovoPreco]  = useState('')
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const items = Object.entries(precos)
    .filter(([n]) => !busca || n.toLowerCase().includes(busca.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))

  async function handleSaveEdit(nome: string) {
    const preco = parseFloat(editPreco)
    if (isNaN(preco) || preco < 0) { onError('Preço inválido.'); return }
    setLoadingKey(nome)
    try {
      await ops.atualizar(nome, preco)
      setEditNome(null)
      onSuccess(`Preço de "${nome}" atualizado.`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao atualizar.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function handleDelete(nome: string) {
    if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return
    setLoadingKey(nome)
    try {
      await ops.excluir(nome)
      onSuccess(`"${nome}" removido.`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function handleCreate() {
    const nome  = novoNome.trim()
    const preco = parseFloat(novoPreco)
    if (!nome)           { onError('Nome é obrigatório.');  return }
    if (isNaN(preco) || preco < 0) { onError('Preço inválido.'); return }
    if (precos[nome] !== undefined) { onError('Já existe um item com esse nome.'); return }
    setLoadingKey('__new__')
    try {
      await ops.criar(nome, preco)
      setNovoNome('')
      setNovoPreco('')
      onSuccess(`"${nome}" adicionado.`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="animate-fade-up">

      {/* Cabeçalho */}
      <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
        <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
          Tabela de Preços
        </h1>
        <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
          Gerencie os itens e preços disponíveis para locação
        </p>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5 items-start max-[900px]:grid-cols-1">

        {/* Lista */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Buscar item..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={INPUT}
          />

          <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg">
                <tr>
                  {['Item', 'Preço', ''].map(h => (
                    <th key={h}
                      className="text-left px-4 py-2.5 font-mono text-[0.62rem] font-medium
                                 text-ink3 uppercase tracking-[0.1em] border-b border-[var(--c-border)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(([nome, preco]) => {
                  const isEditing = editNome === nome
                  const isLoading = loadingKey === nome
                  return (
                    <tr key={nome}
                      className="border-b border-[var(--c-border)] last:border-0
                                 hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-2.5 font-sans text-[0.85rem] text-ink">{nome}</td>
                      <td className="px-4 py-2.5 w-36">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPreco}
                            onChange={e => setEditPreco(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  handleSaveEdit(nome)
                              if (e.key === 'Escape') setEditNome(null)
                            }}
                            autoFocus
                            className={INPUT}
                          />
                        ) : (
                          <span className="font-mono text-[0.85rem] text-ink">
                            R$ {fmt(preco)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          {isEditing ? (
                            <>
                              <button type="button"
                                onClick={() => handleSaveEdit(nome)}
                                disabled={isLoading}
                                className="px-2.5 py-1 rounded-sm bg-accent text-white font-mono
                                           text-[0.65rem] font-semibold cursor-pointer
                                           hover:bg-accent-hover transition-all
                                           disabled:opacity-40 disabled:cursor-not-allowed">
                                {isLoading ? '...' : 'Salvar'}
                              </button>
                              <button type="button"
                                onClick={() => setEditNome(null)}
                                className="px-2.5 py-1 rounded-sm border border-[var(--c-border)]
                                           text-ink2 font-mono text-[0.65rem] cursor-pointer
                                           hover:text-ink transition-all">
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button"
                                onClick={() => { setEditNome(nome); setEditPreco(String(preco)) }}
                                disabled={isLoading || loadingKey !== null}
                                className="px-2.5 py-1 rounded-sm border border-[var(--c-border)]
                                           text-ink2 font-mono text-[0.65rem] cursor-pointer
                                           hover:border-accent hover:text-accent hover:bg-accent/5
                                           disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                Editar
                              </button>
                              <button type="button"
                                onClick={() => handleDelete(nome)}
                                disabled={isLoading || loadingKey !== null}
                                className="px-2.5 py-1 rounded-sm border border-red-400/20
                                           text-red-400/70 font-mono text-[0.65rem] cursor-pointer
                                           hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/40
                                           disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                {isLoading ? '...' : 'Excluir'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="text-center py-12 text-ink3 font-mono text-[0.75rem] tracking-[0.05em]">
                Nenhum item encontrado.
              </div>
            )}
          </div>

          <p className="font-mono text-[0.65rem] text-ink3 text-right">
            {Object.keys(precos).length} itens cadastrados
          </p>
        </div>

        {/* Painel: Adicionar novo */}
        <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--c-border)]">
            <p className="font-mono text-[0.65rem] font-semibold text-accent uppercase tracking-[0.1em]">
              Novo item
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className={LABEL}>Nome do item</label>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex: Tobogã grande"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Preço (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={novoPreco}
                onChange={e => setNovoPreco(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="0,00"
                className={INPUT}
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loadingKey === '__new__'}
              className="w-full py-2.5 bg-accent text-white font-bold text-[0.82rem]
                         rounded-sm border border-accent cursor-pointer
                         hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loadingKey === '__new__' ? 'Adicionando...' : '+ Adicionar item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
