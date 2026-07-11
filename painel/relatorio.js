// =============================================
//  RELATÓRIO MENSAL — AutoPrime
//  relatorio.js
//
//  Lê os dados do mesmo localStorage
//  que o painel usa. Basta abrir este
//  arquivo no mesmo navegador do painel.
//
//  Quando migrar pro Firebase, só troca
//  as funções carregarCarros() e
//  carregarFinanceiro() abaixo.
// =============================================

const KEY_CARROS     = 'autoprime_carros';
const KEY_FINANCEIRO = 'autoprime_financeiro';

const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── DADOS PADRÃO (caso o painel ainda não tenha salvo nada) ─
const CARROS_EXEMPLO = [
  { marca:'Volkswagen', modelo:'Gol 1.6', ano:2021, cor:'Prata', status:'vendido', preco:'R$ 58.900' },
  { marca:'Fiat', modelo:'Strada Volcano', ano:2023, cor:'Branco', status:'vendido', preco:'R$ 147.900' },
  { marca:'Toyota', modelo:'Corolla XEi', ano:2020, cor:'Preto', status:'disponivel', preco:'R$ 118.900' },
];

const FINANCEIRO_EXEMPLO = [
  { id:1, tipo:'receita', desc:'Venda Corolla XEi 2020',    cat:'Venda de veículo',   val:118900, data:'2025-05-03' },
  { id:2, tipo:'receita', desc:'Entrada Onix Plus',          cat:'Entrada / Sinal',    val:5000,   data:'2025-05-07' },
  { id:3, tipo:'despesa', desc:'Combustível frota',          cat:'Combustível',         val:350,    data:'2025-05-08' },
  { id:4, tipo:'despesa', desc:'Aluguel do mês',             cat:'Aluguel / Sede',     val:2800,   data:'2025-05-10' },
  { id:5, tipo:'despesa', desc:'Comissão vendedor',          cat:'Salário / Comissão', val:1500,   data:'2025-05-03' },
  { id:6, tipo:'receita', desc:'Financiamento Gol aprovado', cat:'Financiamento',      val:58900,  data:'2025-05-15' },
  { id:7, tipo:'despesa', desc:'Documentação transferência', cat:'Documentação',       val:420,    data:'2025-05-15' },
  { id:8, tipo:'receita', desc:'Venda Strada Volcano CD',    cat:'Venda de veículo',   val:147900, data:'2025-05-20' },
  { id:9, tipo:'despesa', desc:'Marketing redes sociais',    cat:'Marketing',          val:600,    data:'2025-05-22' },
];

// ─── CARREGAR DADOS DO LOCALSTORAGE ──────────
function carregarCarros() {
  try {
    const s = localStorage.getItem(KEY_CARROS);
    if (s) { const d = JSON.parse(s); if (Array.isArray(d) && d.length) return d; }
  } catch(e) {}
  return CARROS_EXEMPLO;
}

function carregarFinanceiro() {
  try {
    const s = localStorage.getItem(KEY_FINANCEIRO);
    if (s) { const d = JSON.parse(s); if (Array.isArray(d) && d.length) return d; }
  } catch(e) {}
  return FINANCEIRO_EXEMPLO;
}

// ─── UTILITÁRIOS ─────────────────────────────
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

// ─── POPULAR SELECT DE MESES ─────────────────
function populaMeses(lancamentos) {
  const sel = document.getElementById('sel-mes');
  const meses = [...new Set(lancamentos.map(l => l.data.slice(0, 7)))].sort().reverse();

  sel.innerHTML = meses.map(m =>
    `<option value="${m}">${mesExtenso(m)}</option>`
  ).join('');

  // Seleciona o mês mais recente por padrão
  if (meses.length) sel.value = meses[0];
}

// ─── RENDER DO RELATÓRIO ─────────────────────
function renderRelatorio() {
  const mes         = document.getElementById('sel-mes').value;
  const lancamentos = carregarFinanceiro();
  const carros      = carregarCarros();

  // Filtra pelo mês selecionado
  const lista = lancamentos.filter(l => l.data.startsWith(mes));
  const rec   = lista.filter(l => l.tipo === 'receita');
  const des   = lista.filter(l => l.tipo === 'despesa');

  const totRec = rec.reduce((s, l) => s + l.val, 0);
  const totDes = des.reduce((s, l) => s + l.val, 0);
  const lucro  = totRec - totDes;
  const mar    = totRec > 0 ? Math.round((lucro / totRec) * 100) : 0;

  // ── Atualiza período e cards ──
  document.getElementById('rel-periodo').textContent = mesExtenso(mes);
  document.getElementById('r-rec').textContent = fmt(totRec);
  document.getElementById('r-des').textContent = fmt(totDes);

  const lucroEl = document.getElementById('r-luc');
  lucroEl.textContent  = fmt(lucro);
  lucroEl.className    = 'rel-card-val ' + (lucro >= 0 ? 'green' : 'red');

  document.getElementById('r-mar').textContent = mar + '%';

  // ── Veículos vendidos ──
  // Mostra carros com status "vendido" do estoque
  // (no Firebase futuramente poderia filtrar por data de venda)
  const vendidos = carros.filter(c => c.status === 'vendido');
  const tabVendas = document.getElementById('tab-vendas');

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
        <td><strong>${c.marca} ${c.modelo}</strong></td>
        <td>${c.ano}</td>
        <td>${c.cor || '—'}</td>
        <td class="td-r green"><strong>${c.preco}</strong></td>
      </tr>`).join('');
  }

  // ── Tabela de receitas ──
  const tabRec = document.getElementById('tab-rec');
  if (!rec.length) {
    tabRec.innerHTML = `<tr><td colspan="4" style="color:var(--muted);padding:14px 8px;text-align:center;font-style:italic">Nenhuma receita no período</td></tr>`;
  } else {
    tabRec.innerHTML = [...rec]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(l => `
        <tr>
          <td><span class="badge badge-rec">${l.cat}</span></td>
          <td>${l.desc}</td>
          <td class="td-r" style="color:var(--muted)">${fmtData(l.data)}</td>
          <td class="td-r green"><strong>${fmt(l.val)}</strong></td>
        </tr>`).join('');
  }
  document.getElementById('tot-rec').textContent = fmt(totRec);

  // ── Tabela de despesas ──
  const tabDes = document.getElementById('tab-des');
  if (!des.length) {
    tabDes.innerHTML = `<tr><td colspan="4" style="color:var(--muted);padding:14px 8px;text-align:center;font-style:italic">Nenhuma despesa no período</td></tr>`;
  } else {
    tabDes.innerHTML = [...des]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(l => `
        <tr>
          <td><span class="badge badge-des">${l.cat}</span></td>
          <td>${l.desc}</td>
          <td class="td-r" style="color:var(--muted)">${fmtData(l.data)}</td>
          <td class="td-r red"><strong>${fmt(l.val)}</strong></td>
        </tr>`).join('');
  }
  document.getElementById('tot-des').textContent = fmt(totDes);

  // ── Resultado final ──
  const resEl  = document.getElementById('rel-resultado');
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

document.getElementById('rel-hoje').textContent  = dh;
document.getElementById('footer-data').textContent = 'Emitido em ' + dh;

// Popula o seletor de meses e renderiza
populaMeses(carregarFinanceiro());
renderRelatorio();