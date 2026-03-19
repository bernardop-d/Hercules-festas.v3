import { useState, useEffect } from 'react'
import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from '../utils/format'
import { generateNotaFiscal, type NotaFiscalData as NfData } from '../utils/pdf'

interface Props {
  alugueis: Aluguel[]
}

function emptyNf(a?: Aluguel | null): NfData {
  return {
    nome:          a?.nome     || '',
    cpfCnpj:       '',
    endereco:      a?.endereco || '',
    descricao:     'Aluguel de itens para festa',
    valor:         a ? String(a.total || 0) : '',
    codigoServico: '',
  }
}

function maskCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  // CNPJ: 00.000.000/0000-00
  if (d.length <= 12)
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

const FIELD_CLASS = `w-full bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
  font-sans text-[0.82rem] text-ink placeholder:text-ink3
  focus:outline-none focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6 transition-all`

const LABEL_CLASS = `font-mono text-[0.62rem] text-ink3 uppercase tracking-[0.06em] mb-1 block`

export function NotaFiscal({ alugueis }: Props) {
  const [busca, setBusca]             = useState('')
  const [selecionado, setSelecionado] = useState<Aluguel | null>(null)
  const [nf, setNf]                   = useState<NfData>(emptyNf())
  const [pdfLoading, setPdfLoading]   = useState(false)

  useEffect(() => {
    setNf(emptyNf(selecionado))
  }, [selecionado])

  const filtered = alugueis.filter(a =>
    !busca ||
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    String(a.id).includes(busca)
  )

  const set = (k: keyof NfData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = k === 'cpfCnpj' ? maskCpfCnpj(e.target.value) : e.target.value
    setNf(prev => ({ ...prev, [k]: val }))
  }

  const handleGerar = async () => {
    if (!selecionado) return
    setPdfLoading(true)
    try {
      await generateNotaFiscal(selecionado, nf)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Cabeçalho */}
      <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
        <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
          Nota Fiscal
        </h1>
        <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
          Selecione um pedido e preencha os dados para gerar a nota fiscal
        </p>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-5 items-start max-[960px]:grid-cols-1">

        {/* Lista de pedidos */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou nº do pedido..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
                       font-sans text-[0.82rem] text-ink placeholder:text-ink3
                       focus:outline-none focus:border-accent/40
                       focus:ring-[3px] focus:ring-accent/6 transition-all"
          />

          <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-bg">
                  <tr>
                    {['Pedido', 'Cliente', 'Entrega', 'Total', ''].map(h => (
                      <th key={h}
                        className="text-left px-4 py-2.5 font-mono text-[0.62rem] font-medium
                                   text-ink3 uppercase tracking-[0.1em]
                                   border-b border-[var(--c-border)] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const ativo = selecionado?.id === a.id
                    return (
                      <tr key={a.id}
                        className={`border-b border-[var(--c-border)] last:border-0 transition-colors
                                    ${ativo ? 'bg-accent/5' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-4 py-3 align-middle">
                          <span className="font-mono text-[0.7rem] text-accent">
                            #{padId(a.id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="font-sans font-semibold text-[0.85rem] text-ink">
                            {a.nome}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-[0.82rem] text-ink2">
                          {fmtData(a.data_entrega)}
                        </td>
                        <td className="px-4 py-3 align-middle font-mono text-[0.82rem] text-ink">
                          R$ {fmt(a.total || 0)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() => setSelecionado(ativo ? null : a)}
                            className={`px-3 py-1.5 rounded-sm border font-mono text-[0.65rem]
                                        font-semibold uppercase tracking-[0.04em] cursor-pointer
                                        transition-all whitespace-nowrap
                                        ${ativo
                                          ? 'bg-accent text-white border-accent'
                                          : 'border-[var(--c-border)] text-ink2 hover:border-accent hover:text-accent hover:bg-accent/5'
                                        }`}
                          >
                            {ativo ? '✓ Selecionado' : 'Selecionar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-ink3 font-mono text-[0.75rem] tracking-[0.05em]">
                Nenhum pedido encontrado.
              </div>
            )}
          </div>
        </div>

        {/* Painel lateral: formulário da NF */}
        <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
          {selecionado ? (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-[var(--c-border)] flex items-center justify-between">
                <div>
                  <p className="font-mono text-[0.62rem] text-accent tracking-[0.05em]">
                    #{padId(selecionado.id)}
                  </p>
                  <h3 className="font-sans font-bold text-[0.95rem] text-ink mt-0.5">
                    {selecionado.nome}
                  </h3>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm font-mono
                                  text-[0.62rem] font-semibold uppercase border
                                  ${selecionado.pago
                                    ? 'bg-green-400/10 text-green-400 border-green-400/20'
                                    : 'bg-red-400/10 text-red-400 border-red-400/20'
                                  }`}>
                  {selecionado.pago ? 'Pago' : 'Pendente'}
                </span>
              </div>

              {/* Formulário */}
              <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)]">

                {/* Seção: Cliente */}
                <div>
                  <p className="font-mono text-[0.65rem] font-semibold text-accent uppercase
                                 tracking-[0.1em] mb-3 pb-2 border-b border-[var(--c-border)]">
                    Cliente
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className={LABEL_CLASS}>Nome / Razão social</label>
                      <input
                        type="text"
                        value={nf.nome}
                        onChange={set('nome')}
                        placeholder="Nome completo ou razão social"
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>CPF ou CNPJ</label>
                      <input
                        type="text"
                        value={nf.cpfCnpj}
                        onChange={set('cpfCnpj')}
                        placeholder="000.000.000-00"
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Endereço</label>
                      <input
                        type="text"
                        value={nf.endereco}
                        onChange={set('endereco')}
                        placeholder="Rua, número, bairro, cidade"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção: Serviço */}
                <div>
                  <p className="font-mono text-[0.65rem] font-semibold text-accent uppercase
                                 tracking-[0.1em] mb-3 pb-2 border-b border-[var(--c-border)]">
                    Serviço
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className={LABEL_CLASS}>Descrição</label>
                      <textarea
                        value={nf.descricao}
                        onChange={set('descricao')}
                        placeholder="Ex: aluguel de cadeiras, mesas..."
                        rows={2}
                        className={`${FIELD_CLASS} resize-none`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Valor (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={nf.valor}
                        onChange={set('valor')}
                        placeholder="0,00"
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Código do serviço (municipal)</label>
                      <input
                        type="text"
                        value={nf.codigoServico}
                        onChange={set('codigoServico')}
                        placeholder="Ex: 09.01"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ação */}
              <div className="px-5 py-4 border-t border-[var(--c-border)]">
                <button
                  type="button"
                  onClick={handleGerar}
                  disabled={pdfLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5
                             bg-accent text-white font-bold text-[0.82rem]
                             rounded-sm border border-accent cursor-pointer
                             hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                             transition-all"
                >
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {pdfLoading ? 'Gerando...' : 'Gerar Nota Fiscal (PDF)'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                className="text-ink3 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-mono text-[0.72rem] text-ink3 tracking-[0.05em]">
                Selecione um pedido<br />para preencher a nota fiscal
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
