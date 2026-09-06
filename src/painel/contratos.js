// =============================================
//  MÓDULO DE CONTRATOS — RevendaOS
//  contratos.js — Firebase modular
//
//  Gera contrato de compra e venda de veículo
//  puxando automaticamente os dados do carro já
//  cadastrado no estoque; o usuário só preenche
//  os dados do cliente comprador e a forma de
//  pagamento. Documento final é impresso/salvo
//  como PDF via window.print() (mesmo padrão do
//  relatorio.js — sem dependências novas).
// =============================================
import { esc, escAttr } from '../shared/seguranca.js';
import { getOrgContext, orgCollection, orgDoc } from '../shared/tenant.js';
import { auth } from '../shared/firebase.js';
import {
  query, orderBy, getDocs, addDoc, deleteDoc, Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ─── ESTADO ──────────────────────────────────
let carros    = [];
let contratos = [];
let orgCtx    = null;

// ─── UTILITÁRIOS ─────────────────────────────
function fmtDataBR(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function nomeVeiculo(c) {
  if (!c) return '';
  return `${c.marca} ${c.modelo} ${c.ano}`;
}

function parseMoedaLivre(v) {
  if (!v) return 0;
  const limpo = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

function fmtMoeda(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    orgCtx = await getOrgContext();

    const carSnap = await getDocs(query(await orgCollection('carros'), orderBy('criadoEm', 'desc')));
    carros = carSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Preenche o dropdown de veículos assim que os carros carregarem,
    // independente do que acontecer com a busca de contratos logo abaixo
    // (ex.: regras do Firestore ainda não publicadas) — um erro ali não
    // pode travar o formulário de novo contrato.
    popularSelectVeiculos();
    const orgNomeEl = document.getElementById('f-org-nome');
    if (orgNomeEl && orgCtx.orgNome) orgNomeEl.value = orgCtx.orgNome;
  } catch (e) {
    console.error('Erro ao carregar veículos:', e);
    const sel = document.getElementById('f-carro');
    if (sel) sel.innerHTML = `<option value="">Erro ao carregar veículos</option>`;
  }

  // Busca de contratos isolada: se falhar (ex. regra do Firestore
  // ainda não publicada), só a lista de contratos fica com erro —
  // o formulário de novo contrato continua funcionando normalmente.
  try {
    const conSnap = await getDocs(query(await orgCollection('contratos'), orderBy('criadoEm', 'desc')));
    contratos = conSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderListaContratos();
  } catch (e) {
    console.error('Erro ao carregar contratos:', e);
    const listaEl = document.getElementById('lista-contratos');
    if (listaEl) listaEl.innerHTML = `<div class="contratos-vazio">Erro ao carregar contratos. Verifique se as regras do Firestore foram publicadas (firebase deploy --only firestore:rules).</div>`;
  }
}

// ─── SELECT DE VEÍCULOS ──────────────────────
function popularSelectVeiculos() {
  const sel = document.getElementById('f-carro');
  if (!sel) return;

  // Mostra só carros disponíveis ou reservados — vendido não deveria gerar contrato novo
  const disponiveis = carros.filter(c => (c.situacao || 'disponivel') !== 'vendido');

  if (!disponiveis.length) {
    sel.innerHTML = `<option value="">Nenhum veículo disponível no estoque</option>`;
    return;
  }

  sel.innerHTML = `<option value="">Selecione...</option>` + disponiveis.map(c =>
    `<option value="${escAttr(c.id)}">${esc(nomeVeiculo(c))} — ${esc(c.preco || '')}</option>`
  ).join('');
}

function atualizarPreviewVeiculo() {
  const id = document.getElementById('f-carro').value;
  const preview = document.getElementById('preview-veiculo');
  const carro = carros.find(c => c.id === id);

  if (!carro) {
    preview.innerHTML = 'Selecione um veículo acima';
    return;
  }

  preview.innerHTML = `
    <strong>${esc(nomeVeiculo(carro))}</strong> ·
    ${esc(carro.km || '—')} km · ${esc(carro.cor || '—')} · ${esc(carro.cambio || '—')} ·
    ${esc(carro.combustivel || '—')}${carro.aceitaTroca ? ' · Aceita troca' : ''}
  `;

  // Preenche o preço de venda sugerido com o preço de tabela do carro
  const precoEl = document.getElementById('f-preco-venda');
  if (precoEl && !precoEl.value) precoEl.value = carro.preco || '';
}
window.atualizarPreviewVeiculo = atualizarPreviewVeiculo;

// ─── ALTERNÂNCIA DE CAMPOS CONFORME PAGAMENTO ─
function alternarCamposPagamento() {
  const forma = document.getElementById('f-forma-pagamento').value;
  document.getElementById('campo-financiado').style.display = forma === 'financiado' ? '' : 'none';
  document.getElementById('campo-troca').style.display      = forma === 'troca' ? '' : 'none';
}
window.alternarCamposPagamento = alternarCamposPagamento;

// ─── NAVEGAÇÃO ENTRE TELAS ───────────────────
function abrirFormulario() {
  document.getElementById('view-lista').style.display = 'none';
  document.getElementById('view-form').style.display  = '';
  document.getElementById('contrato-doc').classList.remove('ativo');
  document.getElementById('controles-doc').style.display = 'none';
  document.getElementById('btn-novo-contrato').style.display = 'none';
}
window.abrirFormulario = abrirFormulario;

function fecharFormulario() {
  document.getElementById('view-form').style.display  = 'none';
  document.getElementById('view-lista').style.display = '';
  document.getElementById('btn-novo-contrato').style.display = '';
}
window.fecharFormulario = fecharFormulario;

function voltarParaLista() {
  document.getElementById('contrato-doc').classList.remove('ativo');
  document.getElementById('controles-doc').style.display = 'none';
  document.getElementById('view-lista').style.display = '';
  document.getElementById('btn-novo-contrato').style.display = '';
}
window.voltarParaLista = voltarParaLista;

// ─── LISTA DE CONTRATOS SALVOS ────────────────
function renderListaContratos() {
  const el = document.getElementById('lista-contratos');
  if (!el) return;

  if (!contratos.length) {
    el.innerHTML = `<div class="contratos-vazio">Nenhum contrato gerado ainda. Clique em "Novo contrato" para começar.</div>`;
    return;
  }

  el.innerHTML = contratos.map(c => `
    <div class="contrato-item" onclick="visualizarContrato('${escAttr(c.id)}')">
      <div>
        <div class="contrato-item-veiculo">${esc(c.veiculoNome || 'Veículo')}</div>
        <div class="contrato-item-sub">${esc(c.clienteNome || 'Cliente não informado')} · ${esc(c.dataGeracao || '')}</div>
      </div>
      <div class="contrato-item-acoes">
        <button title="Excluir" onclick="event.stopPropagation();excluirContrato('${escAttr(c.id)}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ─── MONTA O TEXTO DO CONTRATO NA TELA ────────
function montarDocumento(dados) {
  document.getElementById('doc-subtitulo').textContent =
    `${dados.orgNome || 'Revenda'} — Emitido em ${dados.dataGeracao}`;

  document.getElementById('doc-partes').innerHTML =
    `<strong>VENDEDOR(A):</strong> ${esc(dados.orgNome || '—')}` +
    `${dados.orgDoc ? ', inscrito(a) sob o CNPJ/CPF nº ' + esc(dados.orgDoc) : ''}` +
    `${dados.orgEndereco ? ', com endereço em ' + esc(dados.orgEndereco) : ''}.` +
    `<br/><strong>COMPRADOR(A):</strong> ${esc(dados.clienteNome || '—')}` +
    `${dados.clienteCpf ? ', portador(a) do CPF nº ' + esc(dados.clienteCpf) : ''}` +
    `${dados.clienteRg ? ' e RG nº ' + esc(dados.clienteRg) : ''}` +
    `${dados.clienteEndereco ? ', residente em ' + esc(dados.clienteEndereco) : ''}` +
    `${dados.clienteTelefone ? ', telefone ' + esc(dados.clienteTelefone) : ''}.`;

  document.getElementById('doc-objeto').innerHTML =
    `O(A) VENDEDOR(A) vende ao(à) COMPRADOR(A), que compra em caráter irrevogável e irretratável, o veículo ` +
    `<strong>${esc(dados.veiculoNome)}</strong>, cor ${esc(dados.veiculoCor || '—')}, ` +
    `câmbio ${esc(dados.veiculoCambio || '—')}, combustível ${esc(dados.veiculoCombustivel || '—')}, ` +
    `com ${esc(dados.veiculoKm || '—')} km rodados, nas condições em que se encontra e conforme vistoria realizada pelo(a) COMPRADOR(A).`;

  let textoPagamento = `O valor total da venda é de <strong>${esc(fmtMoeda(dados.precoVenda))}</strong>, `;
  if (dados.formaPagamento === 'vista') {
    textoPagamento += 'a ser pago à vista, na forma combinada entre as partes.';
  } else if (dados.formaPagamento === 'financiado') {
    textoPagamento += `a ser quitado por meio de financiamento junto a ${esc(dados.financeira || 'instituição financeira a definir')}.`;
  } else if (dados.formaPagamento === 'troca') {
    textoPagamento += `sendo parte do pagamento realizado mediante a entrega, como parte do negócio, do veículo ${esc(dados.veiculoTroca || 'descrito em observações')}.`;
  }
  document.getElementById('doc-pagamento').innerHTML = textoPagamento;

  const obsWrap = document.getElementById('doc-obs-wrap');
  if (dados.obs) {
    obsWrap.style.display = '';
    document.getElementById('doc-obs').textContent = dados.obs;
  } else {
    obsWrap.style.display = 'none';
  }

  document.getElementById('doc-local-data').textContent =
    `${dados.orgCidade || 'Local não informado'}${dados.orgUf ? ' - ' + dados.orgUf : ''}, ${dados.dataGeracao}.`;

  document.getElementById('doc-assin-vendedor').textContent =
    `VENDEDOR(A) — ${dados.orgNome || ''}`;
  document.getElementById('doc-assin-comprador').textContent =
    `COMPRADOR(A) — ${dados.clienteNome || ''}`;
}

// ─── GERA CONTRATO (a partir do formulário) ───
async function gerarContrato() {
  const carroId = document.getElementById('f-carro').value;
  const carro = carros.find(c => c.id === carroId);

  const clienteNome = document.getElementById('f-cli-nome').value.trim();

  if (!carro) { alert('Selecione um veículo.'); return; }
  if (!clienteNome) { alert('Informe o nome do cliente comprador.'); return; }

  const hoje = fmtDataBR(new Date());

  const dados = {
    orgNome:      document.getElementById('f-org-nome').value.trim(),
    orgDoc:       document.getElementById('f-org-doc').value.trim(),
    orgEndereco:  document.getElementById('f-org-endereco').value.trim(),
    orgCidade:    orgCtx?.orgCidade || '',
    orgUf:        orgCtx?.orgUf || '',

    clienteNome,
    clienteCpf:       document.getElementById('f-cli-cpf').value.trim(),
    clienteRg:        document.getElementById('f-cli-rg').value.trim(),
    clienteEndereco:  document.getElementById('f-cli-endereco').value.trim(),
    clienteTelefone:  document.getElementById('f-cli-telefone').value.trim(),

    veiculoId:            carro.id,
    veiculoNome:          nomeVeiculo(carro),
    veiculoCor:           carro.cor || '',
    veiculoCambio:        carro.cambio || '',
    veiculoCombustivel:   carro.combustivel || '',
    veiculoKm:            carro.km || '',

    precoVenda:      parseMoedaLivre(document.getElementById('f-preco-venda').value),
    formaPagamento:  document.getElementById('f-forma-pagamento').value,
    financeira:      document.getElementById('f-financeira').value.trim(),
    veiculoTroca:    document.getElementById('f-veiculo-troca').value.trim(),
    obs:             document.getElementById('f-obs').value.trim(),

    dataGeracao: hoje,
  };

  montarDocumento(dados);

  // Salva no Firestore pra ficar no histórico da revenda
  try {
    await addDoc(await orgCollection('contratos'), {
      ...dados,
      criadoEm: Timestamp.now(),
    });
    // Recarrega a lista em segundo plano (não bloqueia a visualização do contrato gerado)
    const conSnap = await getDocs(query(await orgCollection('contratos'), orderBy('criadoEm', 'desc')));
    contratos = conSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderListaContratos();
  } catch (e) {
    console.error('Erro ao salvar contrato:', e);
    // Mesmo se salvar falhar, deixa o usuário ver/imprimir o contrato já montado
  }

  document.getElementById('view-form').style.display = 'none';
  document.getElementById('contrato-doc').classList.add('ativo');
  document.getElementById('controles-doc').style.display = '';
}
window.gerarContrato = gerarContrato;

// ─── VISUALIZA CONTRATO JÁ SALVO ──────────────
function visualizarContrato(id) {
  const dados = contratos.find(c => c.id === id);
  if (!dados) return;

  montarDocumento(dados);
  document.getElementById('view-lista').style.display = 'none';
  document.getElementById('btn-novo-contrato').style.display = 'none';
  document.getElementById('contrato-doc').classList.add('ativo');
  document.getElementById('controles-doc').style.display = '';
}
window.visualizarContrato = visualizarContrato;

// ─── EXCLUI CONTRATO ──────────────────────────
async function excluirContrato(id) {
  if (!confirm('Excluir este contrato? Essa ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(await orgDoc('contratos', id));
    contratos = contratos.filter(c => c.id !== id);
    renderListaContratos();
  } catch (e) {
    console.error('Erro ao excluir contrato:', e);
    alert('Não foi possível excluir o contrato. Tente novamente.');
  }
}
window.excluirContrato = excluirContrato;