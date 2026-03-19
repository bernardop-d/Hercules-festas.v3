import type { Aluguel } from '../types'
import { fmt, fmtData, padId } from './format'


export function buildOrderHtml(a: Aluguel): string {
  const data = fmtData(a.data_entrega)
  const itensHtml = a.itens && a.itens !== 'Nenhum item'
    ? a.itens.split(', ').map(i => `<li>${i}</li>`).join('')
    : '<li>Nenhum item</li>'

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;font-size:14px;color:#111;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;margin:0;">🎉 Hércules Festas</h1>
          <p style="color:#666;margin:4px 0 0;font-size:12px;">Gestão de Aluguéis</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px;color:#666;margin:0;">Pedido</p>
          <p style="font-size:18px;font-weight:700;margin:2px 0 0;">#${padId(a.id)}</p>
        </div>
      </div>
      <hr style="border:none;border-top:2px solid #000;margin-bottom:20px;" />
      <table style="width:100%;margin-bottom:20px;">
        <tr>
          <td style="width:50%;vertical-align:top;">
            <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Cliente</p>
            <p style="font-weight:700;font-size:15px;margin:0 0 4px;">${a.nome}</p>
            <p style="margin:2px 0;font-size:13px;">${a.contato || '—'}</p>
          </td>
          <td style="width:50%;vertical-align:top;">
            <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Entrega</p>
            <p style="font-size:13px;margin:2px 0;">${data}</p>
            <p style="font-size:13px;margin:2px 0;">${a.endereco || '—'}</p>
          </td>
        </tr>
      </table>
      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Itens</p>
      <ul style="margin:0 0 20px;padding:0 0 0 18px;font-size:13px;line-height:2;">${itensHtml}</ul>
      <hr style="border:none;border-top:1px solid #ddd;margin-bottom:16px;" />
      <table style="width:100%;font-size:14px;">
        <tr>
          <td style="color:#666;padding:4px 0;">Subtotal</td>
          <td style="text-align:right;font-weight:500;">R$ ${fmt(a.subtotal || 0)}</td>
        </tr>
        <tr>
          <td style="color:#666;padding:4px 0;">Frete</td>
          <td style="text-align:right;font-weight:500;">R$ ${fmt(a.frete || 0)}</td>
        </tr>
        <tr style="border-top:2px solid #000;">
          <td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td>
          <td style="text-align:right;font-weight:700;font-size:16px;padding-top:8px;">R$ ${fmt(a.total || 0)}</td>
        </tr>
      </table>
      <div style="margin-top:16px;padding:10px 14px;border-radius:6px;background:${a.pago ? '#f0fdf4' : '#fef2f2'};border:1px solid ${a.pago ? '#bbf7d0' : '#fecaca'};">
        <p style="margin:0;font-weight:600;color:${a.pago ? '#16a34a' : '#dc2626'};font-size:13px;">
          ${a.pago ? '✓ Pagamento recebido' : '○ Pagamento pendente'}
        </p>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#999;text-align:center;">
        Gerado em ${new Date().toLocaleString('pt-BR')} · Hércules Festas
      </p>
    </div>
  `
}

export function printOrder(a: Aluguel): void {
  const el = document.getElementById('print-area')
  if (!el) return
  el.innerHTML = buildOrderHtml(a)
  el.style.display = 'block'
  window.print()
  el.style.display = 'none'
  el.innerHTML = ''
}

/** Formata número para E.164 brasileiro (sem o +).
 *  Aceita formatos como (21) 99999-9999, 21999999999, 5521999999999, etc.
 *  Retorna null se não conseguir extrair um número válido.
 */
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
