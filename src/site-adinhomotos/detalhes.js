// =============================================
//  SITE ADINHO MOTOS — detalhes.js
//  Mesma trava de ORG_SLUG fixo do main.js.
// =============================================
import { db } from '../shared/firebase.js';
import { esc, escAttr, escUrl } from '../shared/seguranca.js';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';

const ORG_SLUG = 'adinho-motos-espumoso'; // mesmo valor do main.js

const money = v => {
  const n = Number(String(v).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? esc(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};

async function iniciar() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'index.html'; return; }

  const carroSnap = await getDoc(doc(db, 'organizations', ORG_SLUG, 'carros', id));
  if (!carroSnap.exists()) {
    document.querySelector('main').innerHTML = '<p style="padding:40px 20px">Moto não encontrada.</p>';
    return;
  }
  const c = { id: carroSnap.id, ...carroSnap.data() };

  document.title = `${c.marca} ${c.modelo} | Adinho Motos`;
  document.querySelector('#crumb').textContent = `${c.marca} ${c.modelo}`;
  document.querySelector('#brand').textContent = (c.marca || '').toUpperCase();
  document.querySelector('#name').textContent = c.modelo || '';
  document.querySelector('#meta').innerHTML = `${esc(c.ano)} · ${esc(c.km)} km<br>${esc(c.cambio)} · ${esc(c.comb)}`;
  document.querySelector('#price').textContent = money(c.preco);
  document.querySelector('#description').textContent = c.desc ||
    `${c.marca} ${c.modelo} selecionada pela Adinho Motos, com procedência, revisão e documentação em dia. Consulte nossa equipe para conhecer todos os detalhes.`;
  document.querySelector('#whatsapp').href =
    `https://wa.me/5554991184936?text=${encodeURIComponent(`Olá! Vi o site e tenho interesse na ${c.marca} ${c.modelo} (${c.preco}). Ainda disponível?`)}`;

  document.querySelector('#specs').innerHTML = [
    ['Marca', c.marca], ['Modelo', c.modelo], ['Ano', c.ano], ['Quilometragem', c.km ? `${c.km} km` : ''],
    ['Câmbio', c.cambio], ['Combustível', c.comb], ['Cor', c.cor], ['Troca', c.troca === 'sim' ? 'Aceita' : c.troca === 'mais' ? 'Aceita com volta' : 'Não aceita'],
  ].map(([a, b]) => `<div><span>${esc(a)}</span>${esc(b || 'Consultar')}</div>`).join('');

  const fotos = c.fotos && c.fotos.length ? c.fotos : [];
  const main = document.querySelector('#main-image');
  if (fotos.length) {
    main.src = escUrl(fotos[0]);
    main.alt = `${c.marca} ${c.modelo}`;
  }
  document.querySelector('#thumbs').innerHTML = fotos.map((f, i) => `
    <button class="${i === 0 ? 'active' : ''}"><img src="${escUrl(f)}" alt="Foto ${i + 1}"></button>`).join('');
  document.querySelectorAll('#thumbs button').forEach((btn, i) => btn.onclick = () => {
    main.src = escUrl(fotos[i]);
    document.querySelectorAll('#thumbs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // relacionados
  const todosSnap = await getDocs(query(collection(db, 'organizations', ORG_SLUG, 'carros'), orderBy('criadoEm', 'desc')));
  const relacionados = todosSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.id !== c.id && x.status !== 'vendido')
    .slice(0, 3);

  document.querySelector('#related-grid').innerHTML = relacionados.map(x => `
    <article class="car-card">
      <a href="detalhes.html?id=${escAttr(x.id)}">
        <div class="car-image">${x.fotos?.[0] ? `<img src="${escUrl(x.fotos[0])}" alt="${esc(x.marca)} ${esc(x.modelo)}">` : ''}</div>
      </a>
      <div class="car-info">
        <div class="car-brand">${esc(x.marca)}</div>
        <div class="car-name">${esc(x.modelo)}</div>
        <div class="car-detail">${esc(x.ano)} · ${esc(x.km)} km</div>
        <div class="price">${money(x.preco)}</div>
        <a class="button button-outline" href="detalhes.html?id=${escAttr(x.id)}">Ver detalhes</a>
      </div>
    </article>`).join('');
}

iniciar();
