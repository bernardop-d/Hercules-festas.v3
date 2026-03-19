import type { jsPDF as JsPDF } from 'jspdf'
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
// Nota Fiscal de Serviços
// ─────────────────────────────────────────────────────────────

export interface NotaFiscalData {
  // Identificação
  numero:        string
  dataEmissao:   string   // ISO date
  competencia:   string   // "MM/AAAA"

  // Prestador
  prestadorCnpj: string
  prestadorIM:   string   // Inscrição Municipal

  // Tomador
  nome:          string
  cpfCnpj:       string
  endereco:      string
  municipio:     string
  uf:            string
  email:         string
  telefone:      string

  // Serviço
  descricao:     string
  codigoServico: string
  valorBruto:    string
  aliquotaISS:   string   // percentual, ex: "5"
  issRetido:     boolean

  // Extras
  observacoes:   string
}

// ── helpers internos ──────────────────────────────────────────

/** Desenha um bloco com título de seção + borda */
function nfBlock(
  doc: JsPDF,
  titulo: string,
  x: number, y: number, w: number, h: number,
) {
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.rect(x, y, w, h)
  // faixa de título
  doc.setFillColor(235, 240, 255)
  doc.rect(x, y, w, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(60, 80, 160)
  doc.text(titulo.toUpperCase(), x + 2, y + 4.2)
}

/** Rótulo + valor dentro de um bloco */
function nfField(
  doc: JsPDF,
  label: string, value: string,
  x: number, y: number, maxWidth = 80,
) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(120, 120, 120)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(25, 25, 25)
  const lines = doc.splitTextToSize(value || '—', maxWidth)
  doc.text(lines, x, y + 3.5)
  return lines.length
}

function fmtIso(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── PDF principal ─────────────────────────────────────────────

export async function generateNotaFiscal(a: Aluguel, nf: NotaFiscalData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })

  const valorBruto  = parseFloat(nf.valorBruto) || a.total || 0
  const aliq        = parseFloat(nf.aliquotaISS) || 0
  const valorISS    = valorBruto * aliq / 100
  const valorLiq    = nf.issRetido ? valorBruto - valorISS : valorBruto

  // ─── Cabeçalho principal ───────────────────────────────────
  // Barra azul topo
  doc.setFillColor(60, 100, 200)
  doc.rect(0, 0, 210, 18, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('HERCULES FESTAS', L, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 215, 255)
  doc.text('Aluguel de Itens para Festas e Eventos', L, 15.5)

  // Bloco NF número (canto direito)
  doc.setFillColor(30, 65, 160)
  doc.rect(145, 0, 65, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(180, 200, 255)
  doc.text('NOTA FISCAL DE SERVICOS', 177.5, 6, { align: 'center' })
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(nf.numero ? `N° ${nf.numero}` : 'RASCUNHO', 177.5, 14.5, { align: 'center' })

  let y = 24

  // ─── Bloco de identificação (data, competência) ────────────
  const BW = 170  // largura dos blocos
  nfBlock(doc, 'Identificacao', L, y, BW, 20)
  // 3 colunas
  nfField(doc, 'Data de Emissao',   fmtIso(nf.dataEmissao), L + 2, y + 9, 50)
  nfField(doc, 'Competencia',       nf.competencia || '—',  L + 55, y + 9, 40)
  nfField(doc, 'Pedido Ref.',       `#${padId(a.id)}`,      L + 110, y + 9, 50)
  y += 25

  // ─── Bloco prestador ───────────────────────────────────────
  nfBlock(doc, 'Prestador de Servicos', L, y, BW, 26)
  nfField(doc, 'Razao Social / Nome',     'Hercules Festas',       L + 2,   y + 9, 80)
  nfField(doc, 'CNPJ',                    nf.prestadorCnpj || '—', L + 90,  y + 9, 40)
  nfField(doc, 'Inscricao Municipal',     nf.prestadorIM || '—',   L + 130, y + 9, 38)
  y += 31

  // ─── Bloco tomador ─────────────────────────────────────────
  nfBlock(doc, 'Tomador de Servicos (Cliente)', L, y, BW, 36)
  // linha 1
  const nLines = nfField(doc, 'Nome / Razao Social', nf.nome || a.nome, L + 2, y + 9, 95)
  nfField(doc, 'CPF / CNPJ', nf.cpfCnpj || '—', L + 100, y + 9, 68)
  // linha 2
  const endY = y + 9 + nLines * 4 + 5
  nfField(doc, 'Endereco', nf.endereco || a.endereco || '—', L + 2, endY, 95)
  nfField(doc, 'Municipio', nf.municipio || '—', L + 100, endY, 35)
  nfField(doc, 'UF', nf.uf || '—', L + 140, endY, 10)
  // linha 3
  const contY = endY + 9
  nfField(doc, 'E-mail', nf.email || '—', L + 2, contY, 80)
  nfField(doc, 'Telefone', nf.telefone || a.contato || '—', L + 100, contY, 68)
  y += 41

  // ─── Bloco discriminação dos serviços ──────────────────────
  const itens = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ')
    : []

  const itensStr  = itens.length ? itens.join('; ') : ''
  const descFull  = [nf.descricao || 'Aluguel de itens para festa', itensStr]
    .filter(Boolean).join('\n\nItens: ')

  const descLinesArr = doc.splitTextToSize(descFull, BW - 4)
  const descBoxH     = Math.max(24, descLinesArr.length * 4 + 12)

  nfBlock(doc, 'Discriminacao dos Servicos', L, y, BW, descBoxH)
  nfField(doc, 'Codigo do Servico (municipal)', nf.codigoServico || '—', L + 2, y + 9, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(25, 25, 25)
  doc.text(descLinesArr, L + 2, y + 18)
  y += descBoxH + 5

  // ─── Bloco valores ─────────────────────────────────────────
  nfBlock(doc, 'Valores', L, y, BW, 38)

  const vc = [L + 2, L + 40, L + 80, L + 118]  // colunas
  const labY  = y + 9
  const valY  = y + 13

  // cabeçalho mini-tabela
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 100, 100)
  doc.text('Valor Bruto', vc[0], labY)
  doc.text('Aliquota ISS (%)', vc[1], labY)
  doc.text('Valor ISS (R$)', vc[2], labY)
  doc.text('ISS Retido', vc[3], labY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(25, 25, 25)
  doc.text(`R$ ${fmt(valorBruto)}`,     vc[0], valY)
  doc.text(`${aliq.toFixed(2)} %`,      vc[1], valY)
  doc.text(`R$ ${fmt(valorISS)}`,       vc[2], valY)
  doc.text(nf.issRetido ? 'Sim' : 'Nao', vc[3], valY)

  // linha separando
  doc.setDrawColor(200, 200, 210)
  doc.setLineWidth(0.2)
  doc.line(L + 1, y + 22, L + BW - 1, y + 22)

  // Total líquido em destaque
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text('VALOR LIQUIDO (R$)', L + 2, y + 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 80, 200)
  doc.text(`R$ ${fmt(valorLiq)}`, L + 2, y + 35.5)

  // Status pagamento
  if (a.pago) {
    doc.setFillColor(22, 163, 74, 0.1)
    doc.setDrawColor(22, 163, 74)
  } else {
    doc.setFillColor(220, 38, 38, 0.1)
    doc.setDrawColor(220, 38, 38)
  }
  doc.setLineWidth(0.3)
  doc.roundedRect(L + 110, y + 26, 58, 9, 1.5, 1.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(a.pago ? 22 : 220, a.pago ? 163 : 38, a.pago ? 74 : 38)
  doc.text(
    a.pago ? 'PAGAMENTO RECEBIDO' : 'AGUARDANDO PAGAMENTO',
    L + 139, y + 31.5, { align: 'center' }
  )

  y += 43

  // ─── Observações ───────────────────────────────────────────
  if (nf.observacoes) {
    nfBlock(doc, 'Observacoes', L, y, BW, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    const obsLines = doc.splitTextToSize(nf.observacoes, BW - 4)
    doc.text(obsLines, L + 2, y + 10)
    y += 23
  }

  // ─── Rodapé ────────────────────────────────────────────────
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(L, 282, R, 282)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} — Hercules Festas — Este documento nao substitui a NFS-e emitida pelo municipio`,
    W / 2, 286, { align: 'center' }
  )

  const fileName = `NFS_Hercules_${nf.numero ? nf.numero + '_' : ''}${padId(a.id)}_${(nf.nome || a.nome).replace(/\s+/g, '_')}.pdf`
  doc.save(fileName)
}

/** Formata número para E.164 brasileiro (sem o +). */
function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length === 12 || digits.length === 13) return digits
  return null
}

const PIX_KEY = '18780137776'

export function openWhatsapp(a: Aluguel): void {
  const data = fmtData(a.data_entrega)

  const itensTexto = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ').map(i => `  • ${i}`).join('\n')
    : '  • Nenhum item'

  const pagamentoBloco = a.pago
    ? `✅ *Pagamento já recebido. Obrigado!*`
    : `💳 *Pagamento pendente*
━━━━━━━━━━━━━━━━━━━━━
🔑 *Chave PIX:* \`${PIX_KEY}\`
💰 *Valor:* R$ ${fmt(a.total || 0)}
━━━━━━━━━━━━━━━━━━━━━
Após o pagamento, nos envie o comprovante por aqui. 🙏`

  const msg = encodeURIComponent(
`🎉 *Hércules Festas — Pedido #${padId(a.id)}*

👤 *Cliente:* ${a.nome}
📍 *Endereço:* ${a.endereco || '—'}
📅 *Data de entrega:* ${data}

📦 *Itens:*
${itensTexto}

💵 Subtotal: R$ ${fmt(a.subtotal || 0)}
🚚 Frete: R$ ${fmt(a.frete || 0)}
*Total: R$ ${fmt(a.total || 0)}*

${pagamentoBloco}`
  )

  const phone = formatPhone(a.contato || '')
  const url   = phone
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`

  window.open(url, '_blank')
}

export function openWhatsappConfirmacao(a: Aluguel): void {
  const data = fmtData(a.data_entrega)

  const itensTexto = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ').map(i => `  • ${i}`).join('\n')
    : '  • Nenhum item'

  const total    = a.total || 0
  const entrada  = total / 2

  const msg = encodeURIComponent(
`✅ *Hércules Festas — Pedido Confirmado! #${padId(a.id)}*

Olá, *${a.nome}*! Seu pedido foi confirmado. 🎉

📅 *Data de entrega:* ${data}
${a.endereco ? `📍 *Endereço:* ${a.endereco}\n` : ''}
📦 *Itens:*
${itensTexto}

*Total: R$ ${fmt(total)}*

━━━━━━━━━━━━━━━━━━━━━
💳 *Para garantir sua reserva, pague 50% agora:*

🔑 *Chave PIX:* \`${PIX_KEY}\`
💰 *Valor da entrada (50%):* R$ ${fmt(entrada)}

Os outros R$ ${fmt(entrada)} são pagos na entrega. 🙏
━━━━━━━━━━━━━━━━━━━━━
Após o pagamento, nos envie o comprovante por aqui. Qualquer dúvida é só chamar! 😊`
  )

  const phone = formatPhone(a.contato || '')
  const url   = phone
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`

  window.open(url, '_blank')
}

export function openWhatsappRejeicao(a: Aluguel): void {
  const data = fmtData(a.data_entrega)

  const msg = encodeURIComponent(
`Olá, *${a.nome}*! 😔

Infelizmente não será possível realizar a locação para o dia *${data}* devido à alta demanda nessa data.

Pedimos desculpas pelo transtorno. Caso queira verificar outra data disponível, é só nos chamar por aqui! 🎉

*— Equipe Hércules Festas*`
  )

  const phone = formatPhone(a.contato || '')
  const url   = phone
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`

  window.open(url, '_blank')
}
