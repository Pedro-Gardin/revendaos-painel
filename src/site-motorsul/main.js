// =============================================
//  SITE MOTORSUL — main.js
//  Template exclusivo desta revenda.
//
//  IMPORTANTE: o slug abaixo é FIXO (não vem da URL).
//  Isso garante que essa página SEMPRE mostra o estoque
//  da Motorsul, mesmo que alguém tente trocar parâmetros
//  na URL — diferente do site padrão (src/site/main.js),
//  que lê ?loja= e por isso pode exibir qualquer revenda.
//  É essa "trava" que fecha o template pra só essa revenda.
// =============================================
import { db } from '../shared/firebase.js';
import { esc, escAttr, escUrl } from '../shared/seguranca.js';
import { collection, doc, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

// TODO: troque pelo ID real do documento em organizations/{orgId}
// (o mesmo slug usado no onboarding dessa revenda).
const ORG_SLUG = 'motorsul-espumoso';

let todosCarros = [];
let filtroMarca = '';
let filtroModelo = '';
let filtroPreco = '';
let filtroTexto = '';
const marcasSelecionadas = new Set();

const grid          = document.querySelector('#vehicle-grid');
const brandFilter    = document.querySelector('#brand-filter');
const modelFilter     = document.querySelector('#model-filter');
const priceFilter      = document.querySelector('#price-filter');
const textFilter        = document.querySelector('#text-filter');
const brandCheckboxesEl  = document.querySelector('#brand-checkboxes');

const money = v => {
  const n = Number(String(v).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? esc(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};

// ─── CARREGA DADOS DA REVENDA (branding) ─────
async function iniciarSite() {
  const orgSnap = await getDoc(doc(db, 'organizations', ORG_SLUG));
  if (orgSnap.exists()) {
    aplicarBrandingDaRevenda(orgSnap.data());
  }

  const carrosQuery = query(
    collection(db, 'organizations', ORG_SLUG, 'carros'),
    orderBy('criadoEm', 'desc')
  );

  onSnapshot(carrosQuery, snap => {
    todosCarros = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'vendido');
    montarFiltrosMarca();
    render();
  }, () => {
    grid.innerHTML = '<p>Não foi possível carregar o estoque no momento.</p>';
  });
}

function aplicarBrandingDaRevenda(org) {
  if (org.nome) {
    document.title = `${org.nome} | Veículos selecionados`;
    document.querySelectorAll('.brand strong').forEach(el => el.textContent = org.nome.toUpperCase());
  }
}

// ─── FILTROS DE MARCA/MODELO ─────────────────
function montarFiltrosMarca() {
  const marcas = [...new Set(todosCarros.map(c => c.marca).filter(Boolean))];

  brandFilter.innerHTML = '<option value="">Marca</option>' +
    marcas.map(m => `<option value="${escAttr(m)}">${esc(m)}</option>`).join('');

  brandCheckboxesEl.innerHTML = marcas.map(m => `
    <label class="check-label">
      <input type="checkbox" data-brand="${escAttr(m)}" ${marcasSelecionadas.has(m) ? 'checked' : ''}>
      ${esc(m)}
    </label>`).join('');

  atualizarModelos();
}

function atualizarModelos() {
  const marcaAtual = brandFilter.value;
  const modelos = [...new Set(
    todosCarros.filter(c => !marcaAtual || c.marca === marcaAtual).map(c => c.modelo).filter(Boolean)
  )];
  modelFilter.innerHTML = '<option value="">Modelo</option>' +
    modelos.map(m => `<option value="${escAttr(m)}">${esc(m)}</option>`).join('');
}

// ─── RENDER DA GRADE ──────────────────────────
function render() {
  let itens = [...todosCarros];

  if (filtroMarca)  itens = itens.filter(c => c.marca === filtroMarca);
  if (filtroModelo) itens = itens.filter(c => c.modelo === filtroModelo);
  if (filtroPreco) {
    const limite = Number(filtroPreco);
    itens = itens.filter(c => {
      const preco = Number(String(c.preco).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
      return limite === 999999 ? preco > 100000 : preco <= limite;
    });
  }
  if (filtroTexto) {
    const t = filtroTexto.toLowerCase();
    itens = itens.filter(c => `${c.marca} ${c.modelo}`.toLowerCase().includes(t));
  }
  if (marcasSelecionadas.size) {
    itens = itens.filter(c => marcasSelecionadas.has(c.marca));
  }

  grid.innerHTML = itens.map(cardHTML).join('') || '<p>Nenhum veículo encontrado com esses filtros.</p>';
  document.querySelector('#vehicle-count').textContent =
    `${itens.length} veículo${itens.length === 1 ? '' : 's'} disponível${itens.length === 1 ? '' : 'is'}`;

  document.querySelector('#sold-grid').innerHTML = todosCarros.slice(0, 6).map(c => `
    <div class="sold-card">
      <img src="${escUrl(c.fotos?.[0]) || ''}" alt="${esc(c.marca)} ${esc(c.modelo)}">
      <span>${esc(c.marca)} ${esc(c.modelo)}</span>
    </div>`).join('');
}

function cardHTML(c) {
  const foto = c.fotos && c.fotos.length ? escUrl(c.fotos[0]) : '';
  const statusLabel = { disponivel: 'DISPONÍVEL', reservado: 'RESERVADO' }[c.status] || '';
  const msgWpp = encodeURIComponent(`Olá! Tenho interesse no ${c.marca} ${c.modelo}`);

  return `
    <article class="car-card">
      <a href="detalhes.html?id=${escAttr(c.id)}" aria-label="Ver ${esc(c.marca)} ${esc(c.modelo)}">
        <div class="car-image">
          ${foto ? `<img src="${foto}" alt="${esc(c.marca)} ${esc(c.modelo)}" loading="lazy">` : ''}
          <span class="badge">${esc(statusLabel)}</span>
          <button class="favorite" type="button" aria-label="Favoritar veículo">♡</button>
        </div>
      </a>
      <div class="car-info">
        <div class="car-brand">${esc(c.marca)}</div>
        <div class="car-name">${esc(c.modelo)}</div>
        <div class="car-detail">${esc(c.ano)} · ${esc(c.km)} km<br>${esc(c.cambio)}</div>
        <div class="price">${money(c.preco)}</div>
        <div class="card-actions">
          <a class="button button-outline" href="detalhes.html?id=${escAttr(c.id)}">Ver detalhes</a>
          <a class="button whatsapp-card" href="https://wa.me/5554999999999?text=${msgWpp}" target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </div>
    </article>`;
}

// ─── EVENTOS ──────────────────────────────────
brandFilter.addEventListener('change', () => {
  filtroMarca = brandFilter.value;
  atualizarModelos();
  render();
});
modelFilter.addEventListener('change', () => { filtroModelo = modelFilter.value; render(); });
priceFilter.addEventListener('change', () => { filtroPreco = priceFilter.value; render(); });
textFilter.addEventListener('input', () => { filtroTexto = textFilter.value.trim(); render(); });

brandCheckboxesEl.addEventListener('change', e => {
  const input = e.target.closest('[data-brand]');
  if (!input) return;
  if (input.checked) marcasSelecionadas.add(input.dataset.brand);
  else marcasSelecionadas.delete(input.dataset.brand);
  render();
});

document.querySelector('#search-button').addEventListener('click', render);

function limpar() {
  brandFilter.value = ''; modelFilter.value = ''; priceFilter.value = ''; textFilter.value = '';
  filtroMarca = filtroModelo = filtroPreco = filtroTexto = '';
  marcasSelecionadas.clear();
  document.querySelectorAll('[data-brand]').forEach(i => i.checked = false);
  atualizarModelos();
  render();
}
document.querySelector('#clear-search').addEventListener('click', limpar);
document.querySelector('#clear-side-filters').addEventListener('click', limpar);

document.querySelector('.menu-button').addEventListener('click', event => {
  const nav = document.querySelector('.nav');
  nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open'));
});

iniciarSite();
