import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from './format'

const L = 20   // margem esquerda (mm)
const R = 190  // margem direita (mm)
const W = 210  // largura A4 (mm)

export async function generatePdf(a: Aluguel): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
  const data = fmtData(a.data_entrega)

  const itens = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ')
    : ['Nenhum item']

  let y = 22

  // ── Cabeçalho ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('Hercules Festas', L, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Gestao de Alugueis', L, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Pedido', R, y, { align: 'right' })
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(`#${padId(a.id)}`, R, y + 6, { align: 'right' })

  y += 14

  // linha separadora grossa
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.6)
  doc.line(L, y, R, y)
  y += 8

  // ── Dados do cliente ───────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('CLIENTE', L, y)
  doc.text('ENTREGA', W / 2, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(a.nome, L, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(data, W / 2, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  if (a.contato) doc.text(a.contato, L, y)
  if (a.endereco) doc.text(a.endereco, W / 2, y)

  y += 10

  // linha separadora fina
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 7

  // ── Itens ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('ITENS', L, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  for (const item of itens) {
    doc.text(`- ${item}`, L, y)
    y += 7
  }

  y += 2

  // linha separadora fina
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 7

  // ── Totais ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('Subtotal', L, y)
  doc.setTextColor(30, 30, 30)
  doc.text(`R$ ${fmt(a.subtotal || 0)}`, R, y, { align: 'right' })
  y += 7

  doc.setTextColor(100, 100, 100)
  doc.text('Frete', L, y)
  doc.setTextColor(30, 30, 30)
  doc.text(`R$ ${fmt(a.frete || 0)}`, R, y, { align: 'right' })
  y += 5

  // linha total (grossa)
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.6)
  doc.line(L, y, R, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text('Total', L, y)
  doc.text(`R$ ${fmt(a.total || 0)}`, R, y, { align: 'right' })
  y += 12

  // ── Status de pagamento ────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  if (a.pago) {
    doc.setTextColor(22, 163, 74)
    doc.text('[PAGO] Pagamento recebido', L, y)
  } else {
    doc.setTextColor(220, 38, 38)
    doc.text('[PENDENTE] Aguardando pagamento', L, y)
  }

  // ── Rodapé ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} - Hercules Festas`,
    W / 2,
    280,
    { align: 'center' }
  )

  const fileName = `Hercules_Pedido_${padId(a.id)}_${a.nome.replace(/\s+/g, '_')}.pdf`
  doc.save(fileName)
}

// ─────────────────────────────────────────────────────────────
// Nota Fiscal
// ─────────────────────────────────────────────────────────────

export interface NotaFiscalData {
  nome:          string
  cpfCnpj:       string
  endereco:      string
  descricao:     string
  valor:         string
  codigoServico: string
}

export async function generateNotaFiscal(a: Aluguel, nf: NotaFiscalData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const valor = parseFloat(nf.valor) || a.total || 0

  let y = 22

  // ── Cabeçalho ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('Hercules Festas', L, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Nota Fiscal de Servico', L, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Pedido', R, y, { align: 'right' })
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(`#${padId(a.id)}`, R, y + 6, { align: 'right' })

  y += 14

  // linha separadora grossa
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.6)
  doc.line(L, y, R, y)
  y += 8

  // ── Cliente ────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('CLIENTE', L, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text(nf.nome || a.nome, L, y)
  y += 6

  if (nf.cpfCnpj) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`CPF/CNPJ: ${nf.cpfCnpj}`, L, y)
    y += 5
  }

  if (nf.endereco) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`Endereco: ${nf.endereco}`, L, y)
    y += 5
  }

  y += 5

  // linha separadora fina
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 7

  // ── Serviço ────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('SERVICO', L, y)
  y += 5

  // Tabela de serviço
  const colDesc  = L
  const colCod   = 110
  const colValor = R

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Descricao', colDesc, y)
  doc.text('Cod. Servico', colCod, y)
  doc.text('Valor', colValor, y, { align: 'right' })
  y += 4

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(L, y, R, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)

  // quebra de linha longa na descrição
  const descLines = doc.splitTextToSize(nf.descricao || 'Aluguel de itens para festa', 80)
  doc.text(descLines, colDesc, y)
  doc.text(nf.codigoServico || '—', colCod, y)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${fmt(valor)}`, colValor, y, { align: 'right' })
  y += descLines.length * 5 + 5

  // linha separadora fina
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 7

  // ── Itens do pedido ────────────────────────────────────────
  const itens = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ')
    : ['Nenhum item']

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('ITENS DO PEDIDO', L, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  for (const item of itens) {
    doc.text(`- ${item}`, L, y)
    y += 5
  }

  y += 5

  // linha separadora fina
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 7

  // ── Totais ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('Subtotal', L, y)
  doc.setTextColor(30, 30, 30)
  doc.text(`R$ ${fmt(a.subtotal || 0)}`, R, y, { align: 'right' })
  y += 6

  doc.setTextColor(100, 100, 100)
  doc.text('Frete', L, y)
  doc.setTextColor(30, 30, 30)
  doc.text(`R$ ${fmt(a.frete || 0)}`, R, y, { align: 'right' })
  y += 4

  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.6)
  doc.line(L, y, R, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text('Total', L, y)
  doc.text(`R$ ${fmt(valor)}`, R, y, { align: 'right' })
  y += 10

  // ── Status de pagamento ────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  if (a.pago) {
    doc.setTextColor(22, 163, 74)
    doc.text('[PAGO] Pagamento recebido', L, y)
  } else {
    doc.setTextColor(220, 38, 38)
    doc.text('[PENDENTE] Aguardando pagamento', L, y)
  }

  // ── Rodapé ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} - Hercules Festas`,
    W / 2,
    280,
    { align: 'center' }
  )

  const fileName = `NF_Hercules_${padId(a.id)}_${(nf.nome || a.nome).replace(/\s+/g, '_')}.pdf`
  doc.save(fileName)
}

/** Formata número para E.164 brasileiro (sem o +). */
function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length === 12 || digits.length === 13) return digits
  return null
}

export function openWhatsapp(a: Aluguel): void {
  const data = fmtData(a.data_entrega)

  const itensTexto = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ').map(i => `• ${i}`).join('\n')
    : '• Nenhum item'

  const msg = encodeURIComponent(
`🎉 *Hércules Festas — Pedido #${padId(a.id)}*

*Cliente:* ${a.nome}
*Contato:* ${a.contato || '—'}
*Endereço:* ${a.endereco || '—'}
*Data de entrega:* ${data}

*Itens:*
${itensTexto}

*Subtotal:* R$ ${fmt(a.subtotal || 0)}
*Frete:* R$ ${fmt(a.frete || 0)}
*Total:* R$ ${fmt(a.total || 0)}

*Pagamento:* ${a.pago ? '✓ Recebido' : '○ Pendente'}`
  )

  const phone = formatPhone(a.contato || '')
  const url   = phone
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`

  window.open(url, '_blank')
}
