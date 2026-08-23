// =============================================
//  SITE PÚBLICO v2 — AutoPrime
//  main.js — Firebase modular + carrossel de fotos
// =============================================
import { db } from '../shared/firebase.js';
import { esc, escAttr, escUrl } from '../shared/seguranca.js';
import { collection, doc, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

// ─── ESTADO ──────────────────────────────────
const EMOJIS = { Volkswagen:'🚗',Fiat:'🚙',Toyota:'🚘',Chevrolet:'🚗',Hyundai:'🚗',Jeep:'🚙',Honda:'🚗',Renault:'🚗',Ford:'🚗',Nissan:'🚗',Mitsubishi:'🚙',Kia:'🚗' };

let todosCarros  = [];
let filtroAtivo  = 'todos';
let carroAtivo   = null;
let fotoAtiva    = 0;
let buscaTexto   = '';
let paginaAtual  = 1;
const POR_PAGINA = 12;

function getEmoji(m) { return EMOJIS[m] || '🚗'; }

// ─── NAVBAR SCROLL ───────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 60);
});

// ─── RESOLVE A ORGANIZATION PELO SLUG ────────
// O site é público e não exige login, então descobrimos "qual
// revenda é essa" pela URL: ?loja=autoprime-garibaldi
// Sem o parâmetro, cai no slug padrão (uso atual, revenda única).
// O ID do documento da organization É o slug (ver onboarding.js).
const SLUG_PADRAO = 'autoprime-garibaldi';
const params = new URLSearchParams(window.location.search);
const orgSlug = params.get('loja') || SLUG_PADRAO;

async function iniciarSite() {
  const orgSnap = await getDoc(doc(db, 'organizations', orgSlug));
  if (!orgSnap.exists()) {
    document.getElementById('car-grid').innerHTML = `
      <div class="estoque-vazio"><i class="ti ti-building-store"></i><p>Revenda não encontrada.</p></div>`;
    return;
  }

  aplicarBrandingDaRevenda(orgSnap.data());

  const carrosQuery = query(
    collection(db, 'organizations', orgSlug, 'carros'),
    orderBy('criadoEm', 'desc')
  );

  onSnapshot(carrosQuery, snap => {
    todosCarros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid();
  }, err => {
    document.getElementById('car-grid').innerHTML = `
      <div class="estoque-vazio">
        <i class="ti ti-wifi-off"></i>
        <p>Não foi possível carregar o estoque.</p>
      </div>`;
  });
}

// Troca o nome fixo "AutoPrime" pelo nome real da revenda em
// todo lugar que aparece na página: aba do navegador, logo da
// navbar, rodapé e frase de destaque do topo.
//
// OBS: endereço, WhatsApp e a história do "fundador" continuam
// fixos — são conteúdos específicos de cada revenda que ainda
// não têm campo próprio no cadastro (fica pra uma próxima etapa,
// quando adicionarmos um "perfil da revenda" no onboarding).
function aplicarBrandingDaRevenda(org) {
  const nome = org.nome || 'Minha Revenda';

  document.title = `${nome} — Seminovos com Procedência`;

  // O logo é escrito em duas partes com cores diferentes (ex:
  // "AUTO" + "PRIME" em <span>). Divide o nome ao meio das
  // palavras pra manter esse mesmo efeito visual com qualquer nome.
  const palavras = nome.toUpperCase().split(' ');
  const meio = Math.ceil(palavras.length / 2);
  const parte1 = palavras.slice(0, meio).join(' ');
  const parte2 = palavras.slice(meio).join(' ');

  document.querySelectorAll('.nav-logo, .footer-logo').forEach(el => {
    el.innerHTML = parte2
      ? `${esc(parte1)}<span>${esc(parte2)}</span>`
      : esc(parte1);
  });

  const eyebrowEl = document.querySelector('.hero-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = `${nome} · Seminovos Premium`;

  const labelDiffEl = document.querySelectorAll('.section-label')[1]; // "Por que a AutoPrime"
  if (labelDiffEl) labelDiffEl.textContent = `Por que a ${nome}`;

  const footerCopyEl = document.querySelector('.footer-copy');
  if (footerCopyEl) {
    const ano = new Date().getFullYear();
    footerCopyEl.textContent = `© ${ano} ${nome} · Todos os direitos reservados`;
  }
}

iniciarSite();

// ─── FILTROS ─────────────────────────────────
document.getElementById('filtros').addEventListener('click', e => {
  const btn = e.target.closest('.filtro');
  if (!btn) return;
  document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtivo = btn.dataset.filtro;
  paginaAtual = 1;
  renderGrid();
});

// ─── BUSCA ───────────────────────────────────
document.getElementById('busca-estoque').addEventListener('input', e => {
  buscaTexto = e.target.value.trim().toLowerCase();
  paginaAtual = 1;
  renderGrid();
});

// ─── RENDER GRID ─────────────────────────────
function renderGrid() {
  const grid = document.getElementById('car-grid');

  let lista = todosCarros.filter(c => c.status !== 'vendido');
  if (filtroAtivo !== 'todos') lista = lista.filter(c => c.status === filtroAtivo);
  if (buscaTexto) {
    lista = lista.filter(c =>
      `${c.marca} ${c.modelo} ${c.ano}`.toLowerCase().includes(buscaTexto)
    );
  }

  if (!lista.length) {
    grid.innerHTML = `<div class="estoque-vazio"><i class="ti ti-car-off"></i><p>Nenhum veículo encontrado.</p></div>`;
    document.getElementById('estoque-cta').style.display = 'none';
    document.getElementById('paginacao').innerHTML = '';
    return;
  }

  document.getElementById('estoque-cta').style.display = 'block';

  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const paginaLista = lista.slice(inicio, inicio + POR_PAGINA);

  const statusLabel = { disponivel:'Disponível', reservado:'Reservado' };

  grid.innerHTML = paginaLista.map(c => {
    const temFoto  = c.fotos && c.fotos.length > 0;
    const fotoSrc  = temFoto ? c.fotos[0] : null;
    const qtdFotos = c.fotos ? c.fotos.length : 0;

    return `
      <div class="car-card" onclick="abrirModal('${escAttr(c.id)}')">
        <div class="car-card-foto">
          ${fotoSrc
            ? `<img src="${escUrl(fotoSrc)}" alt="${esc(c.marca)} ${esc(c.modelo)}" loading="lazy"/>`
            : getEmoji(c.marca)}
          <div class="car-card-badge badge-${escAttr(c.status)}">${esc(statusLabel[c.status] || '')}</div>
          ${qtdFotos > 1 ? `<div class="car-card-fotos-count"><i class="ti ti-camera"></i> ${qtdFotos}</div>` : ''}
        </div>
        <div class="car-card-body">
          <div class="car-card-marca">${esc(c.marca)} · ${esc(c.ano)}</div>
          <div class="car-card-modelo">${esc(c.modelo)}</div>
          <div class="car-card-specs">
            <div class="spec"><i class="ti ti-road"></i>${esc(c.km)} km</div>
            <div class="spec"><i class="ti ti-settings"></i>${esc(c.cambio)}</div>
            <div class="spec"><i class="ti ti-droplet"></i>${esc(c.comb)}</div>
            ${c.troca !== 'nao' ? `<div class="spec"><i class="ti ti-arrows-exchange"></i>Aceita troca</div>` : ''}
          </div>
          <hr class="car-card-divider"/>
          <div class="car-card-preco-row">
            <div class="car-card-preco">${esc(c.preco)}</div>
            <button class="car-card-btn"><i class="ti ti-eye"></i> Ver detalhes</button>
          </div>
        </div>
      </div>`;
  }).join('');

  renderPaginacao(totalPaginas);
}

function renderPaginacao(totalPaginas) {
  const el = document.getElementById('paginacao');
  if (totalPaginas <= 1) { el.innerHTML = ''; return; }

  const baseStyle   = 'min-width:36px;height:36px;border-radius:8px;border:1px solid #e4e4e7;background:#fff;cursor:pointer;font-family:inherit;font-size:13px';
  const activeStyle = baseStyle + ';background:#18181b;color:#fff;border-color:#18181b';

  let botoes = `<button style="${baseStyle}" ${paginaAtual===1?'disabled':''} onclick="irParaPagina(${paginaAtual-1})"><i class="ti ti-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPaginas; i++) {
    botoes += `<button style="${i===paginaAtual?activeStyle:baseStyle}" onclick="irParaPagina(${i})">${i}</button>`;
  }
  botoes += `<button style="${baseStyle}" ${paginaAtual===totalPaginas?'disabled':''} onclick="irParaPagina(${paginaAtual+1})"><i class="ti ti-chevron-right"></i></button>`;
  el.innerHTML = botoes;
}

function irParaPagina(p) {
  paginaAtual = p;
  renderGrid();
  document.getElementById('estoque').scrollIntoView({ behavior:'smooth' });
}

// ─── MODAL E CARROSSEL ───────────────────────
function abrirModal(id) {
  const c = todosCarros.find(x => x.id === id);
  if (!c) return;
  carroAtivo = c;
  fotoAtiva  = 0;

  renderGaleria();
  renderInfoModal(c);

  document.getElementById('modal-overlay').classList.add('aberto');
  document.body.style.overflow = 'hidden';
}

function renderGaleria() {
  const c      = carroAtivo;
  const fotos  = c.fotos && c.fotos.length ? c.fotos : [];
  const temFoto = fotos.length > 0;

  const mgMain = document.getElementById('mg-main');
  if (temFoto) {
    mgMain.innerHTML = `<img src="${escUrl(fotos[fotoAtiva])}" alt="${esc(c.marca)} ${esc(c.modelo)}"/>`;
  } else {
    mgMain.innerHTML = getEmoji(c.marca);
  }

  document.getElementById('mg-counter').textContent = temFoto
    ? `${fotoAtiva + 1} / ${fotos.length}` : '';
  document.getElementById('mg-counter').style.display = temFoto ? 'block' : 'none';

  const prev = document.getElementById('mg-prev');
  const next = document.getElementById('mg-next');
  if (!temFoto || fotos.length <= 1) {
    prev.classList.add('hidden');
    next.classList.add('hidden');
  } else {
    prev.classList.toggle('hidden', fotoAtiva === 0);
    next.classList.toggle('hidden', fotoAtiva === fotos.length - 1);
  }

  const thumbs = document.getElementById('mg-thumbs');
  if (!temFoto || fotos.length <= 1) {
    thumbs.style.display = 'none';
  } else {
    thumbs.style.display = 'flex';
    thumbs.innerHTML = fotos.map((f, i) => `
      <img
        src="${escUrl(f)}"
        class="mg-thumb ${i === fotoAtiva ? 'active' : ''}"
        onclick="irParaFoto(${i})"
        alt="Foto ${i+1}"
      />`).join('');
  }
}

function mudarFoto(dir) {
  const fotos = carroAtivo?.fotos || [];
  fotoAtiva = Math.max(0, Math.min(fotos.length - 1, fotoAtiva + dir));
  renderGaleria();
}

function irParaFoto(i) {
  fotoAtiva = i;
  renderGaleria();
}

document.addEventListener('keydown', e => {
  if (!carroAtivo) return;
  if (e.key === 'ArrowLeft')  mudarFoto(-1);
  if (e.key === 'ArrowRight') mudarFoto(1);
  if (e.key === 'Escape')     fecharModal(null, true);
});

function renderInfoModal(c) {
  const troca = { sim:'✓ Aceita troca', mais:'✓ Aceita com volta', nao:'' }[c.troca] || '';
  const status = { disponivel:'🟢 Disponível', reservado:'🟡 Reservado' }[c.status] || '';

  const msgWpp = encodeURIComponent(
    `Olá! Vi o site e tenho interesse no ${c.marca} ${c.modelo} ${c.ano} (${c.preco}). Ainda disponível?`
  );

  document.getElementById('modal-info').innerHTML = `
    <div class="mi-left">
      <div class="mi-marca">${esc(c.marca)} · ${esc(c.ano)} · ${esc(status)}</div>
      <div class="mi-modelo">${esc(c.modelo)}</div>
      <div class="mi-specs">
        <div class="mi-spec"><span class="mi-spec-label">Quilometragem</span><span class="mi-spec-val">${esc(c.km)} km</span></div>
        <div class="mi-spec"><span class="mi-spec-label">Câmbio</span><span class="mi-spec-val">${esc(c.cambio)}</span></div>
        <div class="mi-spec"><span class="mi-spec-label">Combustível</span><span class="mi-spec-val">${esc(c.comb)}</span></div>
        <div class="mi-spec"><span class="mi-spec-label">Cor</span><span class="mi-spec-val">${esc(c.cor)}</span></div>
        ${troca ? `<div class="mi-spec"><span class="mi-spec-label">Troca</span><span class="mi-spec-val">${esc(troca)}</span></div>` : ''}
      </div>
      ${c.desc ? `<p class="mi-desc">${esc(c.desc)}</p>` : ''}
    </div>
    <div class="mi-right">
      <div class="mi-preco">${esc(c.preco)}</div>
      <a class="btn-wpp-modal" href="https://wa.me/5554999999999?text=${msgWpp}" target="_blank">
        <i class="ti ti-brand-whatsapp"></i> Tenho interesse
      </a>
    </div>`;
}

function fecharModal(event, forcar) {
  if (!forcar && event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('aberto');
  document.body.style.overflow = '';
  carroAtivo = null;
}

// ─── EXPOSTAS AO HTML (onclick inline no index.html/modal) ───
// Necessário porque módulos ES não jogam funções no escopo
// global automaticamente. Isso é o que substitui o antigo
// comportamento de script solto.
window.abrirModal   = abrirModal;
window.fecharModal  = fecharModal;
window.mudarFoto    = mudarFoto;
window.irParaFoto   = irParaFoto;
window.irParaPagina = irParaPagina;
