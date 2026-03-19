import { useState, useEffect } from 'react'
import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from '../utils/format'
import { generateNotaFiscal, type NotaFiscalData as NfData } from '../utils/pdf'

interface Props {
  alugueis: Aluguel[]
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}
function currentCompetencia() {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function emptyNf(a?: Aluguel | null): NfData {
  return {
    numero:        '',
    dataEmissao:   todayIso(),
    competencia:   currentCompetencia(),
    prestadorCnpj: '',
    prestadorIM:   '',
    nome:          a?.nome      || '',
    cpfCnpj:       '',
    endereco:      a?.endereco  || '',
    municipio:     '',
    uf:            'RJ',
    email:         '',
    telefone:      a?.contato   || '',
    descricao:     'Aluguel de itens para festa',
    codigoServico: '',
    valorBruto:    a ? String(a.total || 0) : '',
    aliquotaISS:   '5',
    issRetido:     false,
    observacoes:   '',
  }
}

function maskCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  if (d.length <= 12)
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

const INPUT = `w-full bg-bg3 border border-[var(--c-border)] rounded px-3 py-2
  font-sans text-[0.82rem] text-ink placeholder:text-ink3
  focus:outline-none focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6 transition-all`

const LABEL = `font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.06em] mb-1 block`

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="font-mono text-[0.62rem] font-semibold text-accent uppercase
                   tracking-[0.1em] mb-3 pb-2 border-b border-[var(--c-border)]">
      {children}
    </p>
  )
}

interface FieldProps {
  label: string
  children: React.ReactNode
  half?: boolean
}
function Field({ label, children, half }: FieldProps) {
  return (
    <div className={half ? 'flex-1 min-w-0' : undefined}>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  )
}

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

  function set(k: keyof NfData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = k === 'cpfCnpj' ? maskCpfCnpj(e.target.value) : e.target.value
      setNf(prev => ({ ...prev, [k]: val }))
    }
  }

  const valorBruto = parseFloat(nf.valorBruto) || 0
  const aliq       = parseFloat(nf.aliquotaISS) || 0
  const valorISS   = valorBruto * aliq / 100
  const valorLiq   = nf.issRetido ? valorBruto - valorISS : valorBruto

  async function handleGerar() {
    if (!selecionado) return
    setPdfLoading(true)
    try { await generateNotaFiscal(selecionado, nf) }
    finally { setPdfLoading(false) }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
        <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
          Nota Fiscal de Serviços
        </h1>
        <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
          Selecione um pedido e preencha os dados para gerar o documento
        </p>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-5 items-start max-[1000px]:grid-cols-1">

        {/* ── Lista de pedidos ─────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou nº do pedido..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={INPUT}
          />

          <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
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
                      <td className="px-4 py-3">
                        <span className="font-mono text-[0.7rem] text-accent">#{padId(a.id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans font-semibold text-[0.85rem] text-ink">{a.nome}</span>
                      </td>
                      <td className="px-4 py-3 text-[0.82rem] text-ink2">{fmtData(a.data_entrega)}</td>
                      <td className="px-4 py-3 font-mono text-[0.82rem] text-ink">
                        R$ {fmt(a.total || 0)}
                      </td>
                      <td className="px-4 py-3">
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
            {filtered.length === 0 && (
              <div className="text-center py-12 text-ink3 font-mono text-[0.75rem] tracking-[0.05em]">
                Nenhum pedido encontrado.
              </div>
            )}
          </div>
        </div>

        {/* ── Painel de preenchimento ───────────────────────────── */}
        <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
          {selecionado ? (
            <>
              {/* Header do pedido selecionado */}
              <div className="px-5 py-4 border-b border-[var(--c-border)] flex items-center justify-between bg-accent/5">
                <div>
                  <p className="font-mono text-[0.62rem] text-accent tracking-[0.05em]">
                    Pedido #{padId(selecionado.id)}
                  </p>
                  <h3 className="font-sans font-bold text-[0.95rem] text-ink mt-0.5">
                    {selecionado.nome}
                  </h3>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm font-mono
                                  text-[0.62rem] font-semibold uppercase border
                                  ${selecionado.pago
                                    ? 'bg-green-400/10 text-green-400 border-green-400/20'
                                    : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                  {selecionado.pago ? 'Pago' : 'Pendente'}
                </span>
              </div>

              {/* Formulário */}
              <div className="px-5 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-270px)]">

                {/* Identificação */}
                <div>
                  <SectionTitle>Identificação</SectionTitle>
                  <div className="flex gap-3">
                    <Field label="N° da Nota" half>
                      <input type="text" value={nf.numero} onChange={set('numero')}
                        placeholder="0001" className={INPUT} />
                    </Field>
                    <Field label="Data de emissão" half>
                      <input type="date" value={nf.dataEmissao} onChange={set('dataEmissao')}
                        title="Data de emissão" className={INPUT} />
                    </Field>
                    <Field label="Competência" half>
                      <input type="text" value={nf.competencia} onChange={set('competencia')}
                        placeholder="MM/AAAA" className={INPUT} />
                    </Field>
                  </div>
                </div>

                {/* Prestador */}
                <div>
                  <SectionTitle>Prestador de Serviços</SectionTitle>
                  <div className="mb-2 bg-bg3 rounded px-3 py-2 border border-[var(--c-border)]">
                    <span className="font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.06em]">Razão Social</span>
                    <p className="font-sans font-bold text-[0.85rem] text-ink mt-0.5">Hercules Festas</p>
                  </div>
                  <div className="flex gap-3">
                    <Field label="CNPJ" half>
                      <input type="text" value={nf.prestadorCnpj}
                        onChange={e => setNf(p => ({ ...p, prestadorCnpj: maskCpfCnpj(e.target.value) }))}
                        placeholder="00.000.000/0000-00" className={INPUT} />
                    </Field>
                    <Field label="Inscrição Municipal" half>
                      <input type="text" value={nf.prestadorIM} onChange={set('prestadorIM')}
                        placeholder="0000000" className={INPUT} />
                    </Field>
                  </div>
                </div>

                {/* Tomador */}
                <div>
                  <SectionTitle>Tomador de Serviços</SectionTitle>
                  <div className="space-y-3">
                    <Field label="Nome / Razão Social">
                      <input type="text" value={nf.nome} onChange={set('nome')}
                        placeholder="Nome completo ou razão social" className={INPUT} />
                    </Field>
                    <div className="flex gap-3">
                      <Field label="CPF / CNPJ" half>
                        <input type="text" value={nf.cpfCnpj} onChange={set('cpfCnpj')}
                          placeholder="000.000.000-00" className={INPUT} />
                      </Field>
                      <Field label="Telefone" half>
                        <input type="text" value={nf.telefone} onChange={set('telefone')}
                          placeholder="(21) 99999-9999" className={INPUT} />
                      </Field>
                    </div>
                    <Field label="Endereço">
                      <input type="text" value={nf.endereco} onChange={set('endereco')}
                        placeholder="Rua, número, bairro" className={INPUT} />
                    </Field>
                    <div className="flex gap-3">
                      <Field label="Município" half>
                        <input type="text" value={nf.municipio} onChange={set('municipio')}
                          placeholder="Rio de Janeiro" className={INPUT} />
                      </Field>
                      <Field label="UF" half>
                        <select value={nf.uf} onChange={set('uf')}
                          aria-label="UF" title="UF"
                          className={INPUT + ' cursor-pointer'}>
                          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                            'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
                            .map(s => <option key={s}>{s}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="E-mail">
                      <input type="email" value={nf.email} onChange={set('email')}
                        placeholder="cliente@email.com" className={INPUT} />
                    </Field>
                  </div>
                </div>

                {/* Serviço */}
                <div>
                  <SectionTitle>Serviço</SectionTitle>
                  <div className="space-y-3">
                    <Field label="Descrição">
                      <textarea value={nf.descricao} onChange={set('descricao')} rows={2}
                        placeholder="Aluguel de itens para festa..." className={INPUT + ' resize-none'} />
                    </Field>
                    <div className="flex gap-3">
                      <Field label="Código do serviço (municipal)" half>
                        <input type="text" value={nf.codigoServico} onChange={set('codigoServico')}
                          placeholder="09.01" className={INPUT} />
                      </Field>
                      <Field label="Valor bruto (R$)" half>
                        <input type="number" min="0" step="0.01" value={nf.valorBruto}
                          onChange={set('valorBruto')} placeholder="0,00" className={INPUT} />
                      </Field>
                    </div>
                    <div className="flex gap-3 items-end">
                      <Field label="Alíquota ISS (%)" half>
                        <input type="number" min="0" max="100" step="0.01" value={nf.aliquotaISS}
                          onChange={set('aliquotaISS')} placeholder="5" className={INPUT} />
                      </Field>
                      <Field label="ISS Retido?" half>
                        <label className="flex items-center gap-2 h-[38px] cursor-pointer">
                          <input type="checkbox" checked={nf.issRetido}
                            onChange={e => setNf(p => ({ ...p, issRetido: e.target.checked }))}
                            className="accent-[var(--blue)] w-4 h-4 cursor-pointer" />
                          <span className="font-sans text-[0.82rem] text-ink">Retido na fonte</span>
                        </label>
                      </Field>
                    </div>

                    {/* Preview dos valores calculados */}
                    <div className="bg-bg3 rounded border border-[var(--c-border)] p-3 grid grid-cols-3 gap-3">
                      <div>
                        <p className={LABEL}>Valor ISS</p>
                        <p className="font-mono text-[0.85rem] text-ink">R$ {fmt(valorISS)}</p>
                      </div>
                      <div>
                        <p className={LABEL}>Valor líquido</p>
                        <p className="font-mono text-[0.95rem] font-bold text-accent">R$ {fmt(valorLiq)}</p>
                      </div>
                      <div>
                        <p className={LABEL}>Valor bruto</p>
                        <p className="font-mono text-[0.85rem] text-ink">R$ {fmt(valorBruto)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <SectionTitle>Observações</SectionTitle>
                  <textarea value={nf.observacoes} onChange={set('observacoes')} rows={2}
                    placeholder="Informações adicionais, condições de pagamento..."
                    className={INPUT + ' resize-none'} />
                </div>
              </div>

              {/* Botão gerar */}
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
