// =============================================
//  RELATÓRIO MENSAL — RevendaOS
//  relatorio.js — Firebase modular
// =============================================
import { db, auth } from '../shared/firebase.js';
import { esc, escAttr } from '../shared/seguranca.js';
import { getOrgContext, orgCollection } from '../shared/tenant.js';
import { query, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ─── ESTADO ──────────────────────────────────
let lancamentos = [];
let carros      = [];

// ─── UTILITÁRIOS ─────────────────────────────
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmt(n) {
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
}

function fmtData(iso) {
  return typeof iso === 'string' ? iso.split('-').reverse().join('/') : 'Sem data';
}

function dataLancamentoValida(l) {
  return typeof l.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.data);
}

function valorLancamento(l) {
  return Number(l.val) || 0;
}

function mesExtenso(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return MESES_NOME[parseInt(m, 10) - 1] + ' / ' + y;
}

// ─── VERIFICA LOGIN ──────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    carregarDados();
  }
});

// ─── CARREGA DADOS DO FIREBASE ───────────────
async function carregarDados() {
  try {
    const ctx = await getOrgContext();
    const cidadeEl = document.getElementById('rel-cidade');
    if (cidadeEl) {
      cidadeEl.textContent = ctx.orgCidade
        ? `${ctx.orgCidade}${ctx.orgUf ? ' — ' + ctx.orgUf : ''}`
        : ''; // revenda sem cidade cadastrada ainda: não mostra nada, em vez de errado
    }
    const finSnap = await getDocs(query(await orgCollection('financeiro'), orderBy('data', 'desc')));
    lancamentos = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const carSnap = await getDocs(query(await orgCollection('carros'), orderBy('criadoEm', 'desc')));
    carros = carSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    populaMeses();
    renderRelatorio();
  } catch(e) {
    console.error('Erro ao carregar dados:', e);
    document.getElementById('rel-periodo').textContent = 'Erro ao carregar dados';
  }
}

// ─── POPULAR SELECT DE MESES ─────────────────
function populaMeses() {
  const sel   = document.getElementById('sel-mes');
  const meses = [...new Set(lancamentos.filter(dataLancamentoValida).map(l => l.data.slice(0, 7)))].sort().reverse();

  sel.innerHTML = meses.map(m =>
    `<option value="${escAttr(m)}">${esc(mesExtenso(m))}</option>`
  ).join('');

  if (meses.length) sel.value = meses[0];
}

// ─── RENDER DO RELATÓRIO ─────────────────────
function renderRelatorio() {
  const mes   = document.getElementById('sel-mes').value;
  if (!mes) return;

  const lista  = lancamentos.filter(l => dataLancamentoValida(l) && l.data.startsWith(mes));
  const rec    = lista.filter(l => l.tipo === 'receita');
  const des    = lista.filter(l => l.tipo === 'despesa');
  const totRec = rec.reduce((s, l) => s + valorLancamento(l), 0);
  const totDes = des.reduce((s, l) => s + valorLancamento(l), 0);
  const lucro  = totRec - totDes;
  const mar    = totRec > 0 ? Math.round((lucro / totRec) * 100) : 0;

  document.getElementById('rel-periodo').textContent = mesExtenso(mes);
  document.getElementById('r-rec').textContent = fmt(totRec);
  document.getElementById('r-des').textContent = fmt(totDes);

  const lucroEl = document.getElementById('r-luc');
  lucroEl.textContent = fmt(lucro);
  lucroEl.className   = 'rel-card-val ' + (lucro >= 0 ? 'green' : 'red');

  document.getElementById('r-mar').textContent = mar + '%';

  // Seção "Veículos vendidos no período" removida: a tabela de
  // Receitas abaixo já mostra cada venda (categoria "Venda de
  // veículo" + descrição), e não dá pra casar com precisão o
  // carro específico sem um vínculo carroId salvo no lançamento
  // manual do financeiro.
  const secaoVendas = document.getElementById('tab-vendas')?.closest('section, div.rel-section, .rel-bloco');
  if (secaoVendas) secaoVendas.style.display = 'none';

  // Receitas
  const tabRec = document.getElementById('tab-rec');
  if (!rec.length) {
    tabRec.innerHTML = `<tr><td colspan="4" style="color:var(--muted);padding:14px 8px;text-align:center;font-style:italic">Nenhuma receita no período</td></tr>`;
  } else {
    tabRec.innerHTML = [...rec]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(l => `
        <tr>
          <td><span class="badge badge-rec">${esc(l.cat)}</span></td>
          <td>${esc(l.desc)}</td>
          <td class="td-r" style="color:var(--muted)">${esc(fmtData(l.data))}</td>
          <td class="td-r green"><strong>${fmt(valorLancamento(l))}</strong></td>
        </tr>`).join('');
  }
  document.getElementById('tot-rec').textContent = fmt(totRec);

  // Despesas
  const tabDes = document.getElementById('tab-des');
  if (!des.length) {
    tabDes.innerHTML = `<tr><td colspan="4" style="color:var(--muted);padding:14px 8px;text-align:center;font-style:italic">Nenhuma despesa no período</td></tr>`;
  } else {
    tabDes.innerHTML = [...des]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(l => `
        <tr>
          <td><span class="badge badge-des">${esc(l.cat)}</span></td>
          <td>${esc(l.desc)}</td>
          <td class="td-r" style="color:var(--muted)">${esc(fmtData(l.data))}</td>
          <td class="td-r red"><strong>${fmt(valorLancamento(l))}</strong></td>
        </tr>`).join('');
  }
  document.getElementById('tot-des').textContent = fmt(totDes);

  // Resultado final
  const resEl = document.getElementById('rel-resultado');
  resEl.className = 'rel-resultado ' + (lucro >= 0 ? 'positivo' : 'negativo');

  const corRes = lucro >= 0 ? '#16A34A' : '#DC2626';
  document.getElementById('resultado-val').textContent = fmt(lucro);
  document.getElementById('resultado-val').style.color = corRes;
  document.getElementById('resultado-mar').textContent = mar + '%';
  document.getElementById('resultado-mar').style.color = corRes;
}

window.renderRelatorio = renderRelatorio;

// ─── INICIALIZAÇÃO ────────────────────────────
const hoje = new Date();
const dh   = hoje.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });

document.getElementById('rel-hoje').textContent     = dh;
document.getElementById('footer-data').textContent  = 'Emitido em ' + dh;
