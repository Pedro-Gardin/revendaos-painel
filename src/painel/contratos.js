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

// ─── ALTERNÂNCIA DE TEXTO CONFORME TIPO (USADO / 0KM) ─
// Só ajusta o placeholder do KM pra deixar claro que 0km não precisa
// preencher rodagem; a diferença real de cláusulas acontece na hora
// de montar o documento (montarDocumento), conforme dados.tipoVeiculo.
function alternarClausulasPorTipo() {
  // reservado para eventuais ajustes visuais futuros no formulário
}
window.alternarClausulasPorTipo = alternarClausulasPorTipo;

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
  const eh0km = dados.tipoVeiculo === '0km';

  document.getElementById('doc-titulo').textContent =
    `Contrato de Compra e Venda de Veículo ${eh0km ? '0 KM' : 'Usado'}`;

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
    `câmbio ${esc(dados.veiculoCambio || '—')}, combustível ${esc(dados.veiculoCombustivel || '—')}` +
    `${!eh0km ? `, com ${esc(dados.veiculoKm || '—')} km rodados` : ''}.`;

  document.getElementById('doc-identificacao').innerHTML =
    `<strong>Identificação do veículo</strong> — Placa: ${esc(dados.veiculoPlaca || '—')} · ` +
    `Renavam: ${esc(dados.veiculoRenavam || '—')} · Chassi: ${esc(dados.veiculoChassi || '—')}.`;

  let textoPagamento = `O valor total da venda é de <strong>${esc(fmtMoeda(dados.precoVenda))}</strong>, `;
  if (dados.formaPagamento === 'vista') {
    textoPagamento += 'a ser pago à vista, na forma combinada entre as partes.';
  } else if (dados.formaPagamento === 'financiado') {
    textoPagamento += `a ser quitado por meio de financiamento junto a ${esc(dados.financeira || 'instituição financeira a definir')}.`;
  } else if (dados.formaPagamento === 'troca') {
    textoPagamento += `sendo parte do pagamento realizado mediante a entrega, como parte do negócio, do veículo ${esc(dados.veiculoTroca || 'descrito em observações')}.`;
  }
  document.getElementById('doc-pagamento').innerHTML = textoPagamento;

  document.getElementById('doc-vistoria').innerHTML = eh0km
    ? `Por se tratar de veículo 0 KM, o mesmo é entregue ao(à) COMPRADOR(A) em condição de fábrica, acompanhado da respectiva nota fiscal e demais documentos exigidos pelo fabricante/montadora.`
    : `O(A) COMPRADOR(A) declara ter vistoriado pessoalmente o veículo antes da assinatura deste contrato, aceitando-o no estado de uso, conservação e funcionamento em que se encontra, não cabendo reclamações posteriores quanto a condições visíveis no momento da vistoria.`;

  document.getElementById('doc-garantia').innerHTML = eh0km
    ? `Por se tratar de veículo 0 KM, a garantia aplicável é a de fábrica, conforme termos e prazos estabelecidos pelo próprio fabricante/montadora, não cabendo à VENDEDORA garantia adicional além da repassada pelo fabricante.`
    : `A VENDEDORA garante, pelo prazo legal, apenas os componentes internos de motor e câmbio, desde que não haja mau uso, alteração das características originais do veículo ou manutenção realizada fora da rede indicada pela VENDEDORA. Ficam fora da garantia: itens de desgaste natural (pastilhas e lonas de freio, discos, correias, bateria, amortecedores, molas e similares), componentes eletroeletrônicos, sistema de arrefecimento e manutenções de rotina. Qualquer serviço coberto pela garantia deve ser previamente orçado e aprovado pela VENDEDORA; manutenção feita por conta do(a) COMPRADOR(A) em oficina não indicada não será ressarcida.`;

  document.getElementById('doc-regularidade').innerHTML =
    `Tributos (IPVA/licenciamento): ${esc(dados.tributos || 'em dia')}. ` +
    `Multas e taxas em aberto: ${esc(dados.multas || 'nenhuma consta até a data deste contrato')}. ` +
    `Alienação fiduciária/outros registros impeditivos: ${esc(dados.alienacao || 'nenhum consta até a data deste contrato')}.`;

  document.getElementById('doc-foro').textContent =
    `Fica eleito o foro da comarca de ${dados.orgCidade || 'domicílio da VENDEDORA'}${dados.orgUf ? ' - ' + dados.orgUf : ''} para dirimir quaisquer dúvidas decorrentes deste contrato.`;

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

  const testWrap = document.getElementById('doc-testemunhas-wrap');
  if (dados.test1Nome || dados.test2Nome) {
    testWrap.style.display = '';
    document.getElementById('doc-test1').textContent =
      `Testemunha 1 — ${dados.test1Nome || ''}${dados.test1Doc ? ' — RG/CPF ' + dados.test1Doc : ''}`;
    document.getElementById('doc-test2').textContent =
      `Testemunha 2 — ${dados.test2Nome || ''}${dados.test2Doc ? ' — RG/CPF ' + dados.test2Doc : ''}`;
  } else {
    testWrap.style.display = 'none';
  }
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

    tipoVeiculo:          document.getElementById('f-tipo-veiculo').value,
    veiculoId:            carro.id,
    veiculoNome:          nomeVeiculo(carro),
    veiculoCor:           carro.cor || '',
    veiculoCambio:        carro.cambio || '',
    veiculoCombustivel:   carro.combustivel || '',
    veiculoKm:            carro.km || '',
    veiculoPlaca:         document.getElementById('f-placa').value.trim(),
    veiculoRenavam:       document.getElementById('f-renavam').value.trim(),
    veiculoChassi:        document.getElementById('f-chassi').value.trim(),

    precoVenda:      parseMoedaLivre(document.getElementById('f-preco-venda').value),
    formaPagamento:  document.getElementById('f-forma-pagamento').value,
    financeira:      document.getElementById('f-financeira').value.trim(),
    veiculoTroca:    document.getElementById('f-veiculo-troca').value.trim(),

    tributos:    document.getElementById('f-tributos').value.trim(),
    multas:      document.getElementById('f-multas').value.trim(),
    alienacao:   document.getElementById('f-alienacao').value.trim(),

    test1Nome:  document.getElementById('f-test1-nome').value.trim(),
    test1Doc:   document.getElementById('f-test1-doc').value.trim(),
    test2Nome:  document.getElementById('f-test2-nome').value.trim(),
    test2Doc:   document.getElementById('f-test2-doc').value.trim(),

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
