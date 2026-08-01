// =============================================
//  RELATÓRIO MENSAL — AutoPrime
//  relatorio.js — lendo do Firebase Firestore
// =============================================

const firebaseConfig = {
  apiKey:            "AIzaSyDzJP-XF37RCedf_wN7svLg1YZ82u3ULF8",
  authDomain:        "painelrevenda-2bc8b.firebaseapp.com",
  projectId:         "painelrevenda-2bc8b",
  storageBucket:     "painelrevenda-2bc8b.firebasestorage.app",
  messagingSenderId: "57821691298",
  appId:             "1:57821691298:web:04198c179330458a3ac6fb"
};

// Inicializa só se ainda não foi inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db   = firebase.firestore();
const auth = firebase.auth();

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
  return iso.split('-').reverse().join('/');
}

function mesExtenso(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return MESES_NOME[parseInt(m, 10) - 1] + ' / ' + y;
}

// ─── VERIFICA LOGIN ──────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    carregarDados();
  }
});

// ─── CARREGA DADOS DO FIREBASE ───────────────
async function carregarDados() {
  try {
    // Carrega financeiro
    const finSnap = await db.collection('financeiro').orderBy('data', 'desc').get();
    lancamentos = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Carrega carros
    const carSnap = await db.collection('carros').orderBy('criadoEm', 'desc').get();
    carros = carSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Popula o seletor de meses e renderiza
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
  const meses = [...new Set(lancamentos.map(l => l.data.slice(0, 7)))].sort().reverse();

  sel.innerHTML = meses.map(m =>
    `<option value="${escAttr(m)}">${esc(mesExtenso(m))}</option>`
  ).join('');

  if (meses.length) sel.value = meses[0];
}

// ─── RENDER DO RELATÓRIO ─────────────────────
function renderRelatorio() {
  const mes   = document.getElementById('sel-mes').value;
  if (!mes) return;

  const lista  = lancamentos.filter(l => l.data.startsWith(mes));
  const rec    = lista.filter(l => l.tipo === 'receita');
  const des    = lista.filter(l => l.tipo === 'despesa');
  const totRec = rec.reduce((s, l) => s + l.val, 0);
  const totDes = des.reduce((s, l) => s + l.val, 0);
  const lucro  = totRec - totDes;
  const mar    = totRec > 0 ? Math.round((lucro / totRec) * 100) : 0;

  // Período e cards
  document.getElementById('rel-periodo').textContent = mesExtenso(mes);
  document.getElementById('r-rec').textContent = fmt(totRec);
  document.getElementById('r-des').textContent = fmt(totDes);

  const lucroEl = document.getElementById('r-luc');
  lucroEl.textContent = fmt(lucro);
  lucroEl.className   = 'rel-card-val ' + (lucro >= 0 ? 'green' : 'red');

  document.getElementById('r-mar').textContent = mar + '%';

  // Veículos vendidos
  const vendidos   = carros.filter(c => c.status === 'vendido');
  const tabVendas  = document.getElementById('tab-vendas');

  if (!vendidos.length) {
    tabVendas.innerHTML = `
      <tr>
        <td colspan="4" style="color:var(--muted);padding:14px 8px;text-align:center;font-style:italic">
          Nenhum veículo com status "Vendido" no estoque
        </td>
      </tr>`;
  } else {
    tabVendas.innerHTML = vendidos.map(c => `
      <tr>
        <td><strong>${esc(c.marca)} ${esc(c.modelo)}</strong></td>
        <td>${esc(c.ano)}</td>
        <td>${esc(c.cor || '—')}</td>
        <td class="td-r green"><strong>${esc(c.preco)}</strong></td>
      </tr>`).join('');
  }

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
          <td class="td-r green"><strong>${fmt(l.val)}</strong></td>
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
          <td class="td-r red"><strong>${fmt(l.val)}</strong></td>
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

// ─── INICIALIZAÇÃO ────────────────────────────
const hoje = new Date();
const dh   = hoje.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });

document.getElementById('rel-hoje').textContent     = dh;
document.getElementById('footer-data').textContent  = 'Emitido em ' + dh;