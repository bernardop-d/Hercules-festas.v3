/* ============================================================
   Hércules Festas — script.js
   Conecta ao backend Python via fetch (API REST)
   ============================================================ */

const API = '/api';

/* ── Estado ──────────────────────────────────────────────── */
let alugueis     = [];
let precos       = {};
let editTarget   = null;
let deleteTarget = null;

/* ── Utilitários ─────────────────────────────────────────── */
const fmt     = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function showFeedback(msg, tipo) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className   = 'feedback ' + tipo;
  setTimeout(() => { el.className = 'feedback'; }, 4000);
}

/* ── Navegação entre views ───────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});

/* ── Preços: carrega e monta itens no formulário novo ───── */
async function carregarPrecos() {
  const res = await fetch(`${API}/precos`);
  precos    = await res.json();
  montarItens('grupoItens', 'buscaItem');
}

function montarItens(grupoId, buscaId, valores = {}) {
  const grupo = document.getElementById(grupoId);
  const filtro = document.getElementById(buscaId)?.value.toLowerCase() || '';
  grupo.innerHTML = '';

  for (const [item, preco] of Object.entries(precos)) {
    if (filtro && !item.toLowerCase().includes(filtro)) continue;
    const qty = valores[item] || 0;
    const row = document.createElement('div');
    row.className = 'item-row' + (qty > 0 ? ' selecionado' : '');
    row.dataset.item = item;
    row.innerHTML = `
      <span class="item-nome">${item}</span>
      <span class="item-preco">R$ ${fmt(preco)}</span>
      <input class="item-qty" type="number" min="0" value="${qty}"
             data-item="${item}" data-preco="${preco}" />
    `;
    grupo.appendChild(row);
  }

  // Listener de quantidade
  grupo.querySelectorAll('.item-qty').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('.item-row');
      const qty = parseInt(input.value) || 0;
      row.classList.toggle('selecionado', qty > 0);
      if (grupoId === 'grupoItens')     atualizarResumo();
      if (grupoId === 'grupoItensEdit') atualizarResumoEdit();
    });
  });
}

/* Busca de item no formulário novo */
document.getElementById('buscaItem').addEventListener('input', () => {
  montarItens('grupoItens', 'buscaItem');
});

/* Busca de item no formulário de edição */
document.getElementById('buscaItemEdit').addEventListener('input', () => {
  const valores = coletarItens('grupoItensEdit');
  montarItens('grupoItensEdit', 'buscaItemEdit', valores);
});

/* ── Coleta itens de um grupo ────────────────────────────── */
function coletarItens(grupoId) {
  const dict = {};
  document.querySelectorAll(`#${grupoId} .item-qty`).forEach(input => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) dict[input.dataset.item] = qty;
  });
  return dict;
}

/* ── Resumo: formulário novo ─────────────────────────────── */
function atualizarResumo() {
  let subtotal = 0;
  document.querySelectorAll('#grupoItens .item-qty').forEach(input => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) subtotal += parseFloat(input.dataset.preco) * qty;
  });
  const frete = parseFloat(document.getElementById('frete').value) || 0;
  document.getElementById('rSubtotal').textContent = 'R$ ' + fmt(subtotal);
  document.getElementById('rFrete').textContent    = 'R$ ' + fmt(frete);
  document.getElementById('rTotal').textContent    = 'R$ ' + fmt(subtotal + frete);
}
document.getElementById('frete').addEventListener('input', atualizarResumo);

/* ── Resumo: modal de edição ─────────────────────────────── */
function atualizarResumoEdit() {
  let subtotal = 0;
  document.querySelectorAll('#grupoItensEdit .item-qty').forEach(input => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) subtotal += parseFloat(input.dataset.preco) * qty;
  });
  const frete = parseFloat(document.getElementById('editFrete').value) || 0;
  document.getElementById('editRSubtotal').textContent = 'R$ ' + fmt(subtotal);
  document.getElementById('editRFrete').textContent    = 'R$ ' + fmt(frete);
  document.getElementById('editRTotal').textContent    = 'R$ ' + fmt(subtotal + frete);
}
document.getElementById('editFrete').addEventListener('input', atualizarResumoEdit);

/* ── Carregar e renderizar aluguéis ──────────────────────── */
async function carregarAlugueis() {
  const res = await fetch(`${API}/alugueis`);
  alugueis  = await res.json();
  renderizar();
  atualizarKPIs();
  atualizarSidebar();
}

function renderizar() {
  const busca  = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const tbody  = document.getElementById('tbody');
  const empty  = document.getElementById('emptyMsg');

  const lista = alugueis.filter(a => {
    const matchBusca = !busca ||
      a.nome.toLowerCase().includes(busca) ||
      (a.contato && a.contato.includes(busca));
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'pago'     &&  a.pago) ||
      (filtro === 'pendente' && !a.pago);
    return matchBusca && matchFiltro;
  });

  tbody.innerHTML = '';
  empty.style.display = lista.length === 0 ? 'block' : 'none';

  lista.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="td-id">#${String(a.id).padStart(4, '0')}</div>
        <div class="td-nome">${a.nome}</div>
      </td>
      <td>${a.contato || '—'}</td>
      <td>${fmtData(a.data_entrega)}</td>
      <td class="td-mono">R$ ${fmt(a.frete || 0)}</td>
      <td class="td-mono"><strong>R$ ${fmt(a.total || 0)}</strong></td>
      <td>
        <span class="badge ${a.pago ? 'badge-pago' : 'badge-pendente'}">
          ${a.pago ? '✓ Pago' : '○ Pendente'}
        </span>
      </td>
      <td class="td-acoes">
        <button class="btn-toggle" data-id="${a.id}" data-pago="${a.pago ? 1 : 0}">
          ${a.pago ? 'Pendente' : 'Marcar pago'}
        </button>
        <button class="btn-ver" data-id="${a.id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ── KPIs e Sidebar ──────────────────────────────────────── */
function atualizarKPIs() {
  const recebido    = alugueis.filter(a =>  a.pago).reduce((s, a) => s + (a.total || 0), 0);
  const aberto      = alugueis.filter(a => !a.pago).reduce((s, a) => s + (a.total || 0), 0);
  document.getElementById('kpiTotal').textContent       = alugueis.length;
  document.getElementById('kpiRecebido').textContent    = 'R$ ' + fmt(recebido);
  document.getElementById('kpiAberto').textContent      = 'R$ ' + fmt(aberto);
  document.getElementById('kpiFaturamento').textContent = 'R$ ' + fmt(recebido + aberto);
}

function atualizarSidebar() {
  const recebido = alugueis.filter(a => a.pago).reduce((s, a) => s + (a.total || 0), 0);
  document.getElementById('sbAtivos').textContent    = alugueis.length;
  document.getElementById('sbPendentes').textContent = alugueis.filter(a => !a.pago).length;
  document.getElementById('sbRecebido').textContent  = 'R$ ' + fmt(recebido);
}

/* ── Filtros e busca ─────────────────────────────────────── */
document.getElementById('busca').addEventListener('input', renderizar);
document.getElementById('filtroStatus').addEventListener('change', renderizar);

/* ── Toggle rápido de pagamento na tabela ────────────────── */
document.getElementById('tbody').addEventListener('click', async e => {
  const btnToggle = e.target.closest('.btn-toggle');
  if (btnToggle) {
    const id   = btnToggle.dataset.id;
    const pago = btnToggle.dataset.pago === '1' ? 0 : 1;
    await fetch(`${API}/alugueis/${id}/pagamento`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago }),
    });
    await carregarAlugueis();
    return;
  }

  // Botão "Editar"
  const btnVer = e.target.closest('.btn-ver');
  if (btnVer) abrirModalEdit(parseInt(btnVer.dataset.id));
});

/* ── Modal de edição ─────────────────────────────────────── */
function abrirModalEdit(id) {
  const a = alugueis.find(x => x.id === id);
  if (!a) return;
  editTarget = id;

  document.getElementById('modalEditTitulo').textContent =
    `Editar #${String(id).padStart(4,'0')} — ${a.nome}`;

  // Preenche campos
  document.getElementById('editNome').value     = a.nome || '';
  document.getElementById('editContato').value  = a.contato || '';
  document.getElementById('editEndereco').value = a.endereco || '';
  document.getElementById('editData').value     = a.data_entrega || '';
  document.getElementById('editFrete').value    = a.frete || 0;
  document.getElementById('editPago').checked   = !!a.pago;

  // Parseia itens existentes para preencher quantidades
  // Formato salvo: "Item (x2) — R$ 500,00, ..."
  const valoresAtuais = {};
  if (a.itens && a.itens !== 'Nenhum item') {
    a.itens.split(', ').forEach(trecho => {
      const match = trecho.match(/^(.+?) \(x(\d+)\)/);
      if (match) valoresAtuais[match[1]] = parseInt(match[2]);
    });
  }

  montarItens('grupoItensEdit', 'buscaItemEdit', valoresAtuais);
  atualizarResumoEdit();

  document.getElementById('modalEditOverlay').classList.add('open');
}

function fecharModalEdit() {
  document.getElementById('modalEditOverlay').classList.remove('open');
  editTarget = null;
}

document.getElementById('btnFecharEdit').addEventListener('click', fecharModalEdit);
document.getElementById('btnCancelarEdit').addEventListener('click', fecharModalEdit);
document.getElementById('modalEditOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalEditOverlay')) fecharModalEdit();
});

/* ── Salvar edição ───────────────────────────────────────── */
document.getElementById('btnSalvarEdit').addEventListener('click', async () => {
  const nome = document.getElementById('editNome').value.trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }

  const payload = {
    nome,
    contato:      document.getElementById('editContato').value.trim(),
    endereco:     document.getElementById('editEndereco').value.trim(),
    data_entrega: document.getElementById('editData').value,
    frete:        parseFloat(document.getElementById('editFrete').value) || 0,
    pago:         document.getElementById('editPago').checked,
    itens:        coletarItens('grupoItensEdit'),
  };

  const btn = document.getElementById('btnSalvarEdit');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const res  = await fetch(`${API}/alugueis/${editTarget}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) { alert(data.erro || 'Erro ao salvar.'); return; }

    fecharModalEdit();
    await carregarAlugueis();

  } catch {
    alert('Erro de conexão.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar alterações';
  }
});

/* ── Excluir via modal de edição ─────────────────────────── */
document.getElementById('btnExcluirEdit').addEventListener('click', async () => {
  if (!editTarget) return;
  const a = alugueis.find(x => x.id === editTarget);
  if (!confirm(`Excluir aluguel de ${a?.nome}? Esta ação não pode ser desfeita.`)) return;

  await fetch(`${API}/alugueis/${editTarget}`, { method: 'DELETE' });
  fecharModalEdit();
  await carregarAlugueis();
});

/* ── Submit novo aluguel ─────────────────────────────────── */
document.getElementById('btnSubmit').addEventListener('click', async () => {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) { showFeedback('Nome é obrigatório.', 'erro'); return; }

  const payload = {
    nome,
    contato:      document.getElementById('contato').value.trim(),
    endereco:     document.getElementById('endereco').value.trim(),
    data_entrega: document.getElementById('data_entrega').value,
    frete:        parseFloat(document.getElementById('frete').value) || 0,
    pago:         document.getElementById('pago').checked,
    itens:        coletarItens('grupoItens'),
  };

  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Registrando...';

  try {
    const res  = await fetch(`${API}/alugueis`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { showFeedback(data.erro || 'Erro.', 'erro'); return; }

    showFeedback(`Registrado! Total: R$ ${fmt(data.total)}`, 'ok');
    ['nome','contato','endereco','data_entrega','frete'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('pago').checked = false;
    montarItens('grupoItens', 'buscaItem');
    atualizarResumo();
    await carregarAlugueis();

  } catch {
    showFeedback('Erro de conexão.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrar aluguel';
  }
});

/* ── Init ────────────────────────────────────────────────── */
(async () => {
  await carregarPrecos();
  await carregarAlugueis();
})();


/* ============================================================
   IMPRESSÃO E PDF
   ============================================================ */

const WHATSAPP_NUMBER = '5521976758520'; // número do Bernardo

/* ── Monta HTML do pedido (usado na impressão e no PDF) ── */
function montarHtmlPedido(a) {
  const fmt2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const data = a.data_entrega
    ? new Date(a.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—';

  const itensHtml = (a.itens && a.itens !== 'Nenhum item')
    ? a.itens.split(', ').map(i => `<li>${i}</li>`).join('')
    : '<li>Nenhum item</li>';

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;font-size:14px;color:#111;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <h1 style="font-size:22px;font-weight:700;margin:0;">🎉 Hércules Festas</h1>
          <p style="color:#666;margin:4px 0 0;font-size:12px;">Gestão de Aluguéis</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px;color:#666;margin:0;">Pedido</p>
          <p style="font-size:18px;font-weight:700;margin:2px 0 0;">#${String(a.id).padStart(4,'0')}</p>
        </div>
      </div>

      <hr style="border:none;border-top:2px solid #000;margin-bottom:20px;" />

      <table style="width:100%;margin-bottom:20px;">
        <tr>
          <td style="width:50%;vertical-align:top;">
            <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Cliente</p>
            <p style="font-weight:700;font-size:15px;margin:0 0 4px;">${a.nome}</p>
            <p style="margin:2px 0;font-size:13px;">${a.contato || '—'}</p>
          </td>
          <td style="width:50%;vertical-align:top;">
            <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Entrega</p>
            <p style="font-size:13px;margin:2px 0;">${data}</p>
            <p style="font-size:13px;margin:2px 0;">${a.endereco || '—'}</p>
          </td>
        </tr>
      </table>

      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Itens</p>
      <ul style="margin:0 0 20px;padding:0 0 0 18px;font-size:13px;line-height:2;">
        ${itensHtml}
      </ul>

      <hr style="border:none;border-top:1px solid #ddd;margin-bottom:16px;" />

      <table style="width:100%;font-size:14px;">
        <tr>
          <td style="color:#666;padding:4px 0;">Subtotal</td>
          <td style="text-align:right;font-weight:500;">R$ ${fmt2(a.subtotal || 0)}</td>
        </tr>
        <tr>
          <td style="color:#666;padding:4px 0;">Frete</td>
          <td style="text-align:right;font-weight:500;">R$ ${fmt2(a.frete || 0)}</td>
        </tr>
        <tr style="border-top:2px solid #000;">
          <td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td>
          <td style="text-align:right;font-weight:700;font-size:16px;padding-top:8px;">R$ ${fmt2(a.total || 0)}</td>
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
  `;
}

/* ── Imprimir ────────────────────────────────────────────── */
document.getElementById('btnImprimir').addEventListener('click', () => {
  if (!editTarget) return;
  const a = alugueis.find(x => x.id === editTarget);
  if (!a) return;

  const printArea = document.getElementById('printArea');
  printArea.innerHTML  = montarHtmlPedido(a);
  printArea.style.display = 'block';
  window.print();
  printArea.style.display = 'none';
  printArea.innerHTML  = '';
});

/* ── Gerar PDF e enviar link por WhatsApp ────────────────── */
document.getElementById('btnWhatsapp').addEventListener('click', async () => {
  if (!editTarget) return;
  const a = alugueis.find(x => x.id === editTarget);
  if (!a) return;

  const btn = document.getElementById('btnWhatsapp');
  btn.disabled = true;
  btn.textContent = 'Gerando...';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Renderiza o HTML do pedido numa div temporária
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;background:white;';
    tmp.innerHTML = montarHtmlPedido(a);
    document.body.appendChild(tmp);

    await doc.html(tmp, {
      callback: function(pdf) {
        document.body.removeChild(tmp);

        // Baixa o PDF
        const nomeArquivo = `Hercules_Pedido_${String(a.id).padStart(4,'0')}_${a.nome.replace(/\s+/g,'_')}.pdf`;
        pdf.save(nomeArquivo);

        // Monta mensagem para WhatsApp
        const fmt2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const data = a.data_entrega
          ? new Date(a.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')
          : '—';

        const msg = encodeURIComponent(
`🎉 *Hércules Festas — Pedido #${String(a.id).padStart(4,'0')}*

*Cliente:* ${a.nome}
*Contato:* ${a.contato || '—'}
*Endereço:* ${a.endereco || '—'}
*Data de entrega:* ${data}

*Itens:*
${(a.itens && a.itens !== 'Nenhum item') ? a.itens.split(', ').map(i => `• ${i}`).join('\n') : '• Nenhum item'}

*Subtotal:* R$ ${fmt2(a.subtotal || 0)}
*Frete:* R$ ${fmt2(a.frete || 0)}
*Total:* R$ ${fmt2(a.total || 0)}

*Pagamento:* ${a.pago ? '✓ Recebido' : '○ Pendente'}

_O PDF foi gerado e está disponível para download._`
        );

        // Abre WhatsApp com a mensagem
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');

        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Enviar por WhatsApp`;
      },
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 600,
    });

  } catch (err) {
    console.error(err);
    alert('Erro ao gerar PDF. Tente usar o botão Imprimir como alternativa.');
    btn.disabled = false;
    btn.textContent = 'Enviar por WhatsApp';
  }
});