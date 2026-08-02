// =============================================
//  PAINEL AUTOPRIME v2
//  app.js — com upload de fotos via Cloudinary
// =============================================
// ─── FIREBASE CONFIG ─────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDzJP-XF37RCedf_wN7svLg1YZ82u3ULF8",
  authDomain:        "painelrevenda-2bc8b.firebaseapp.com",
  projectId:         "painelrevenda-2bc8b",
  storageBucket:     "painelrevenda-2bc8b.firebasestorage.app",
  messagingSenderId: "57821691298",
  appId:             "1:57821691298:web:04198c179330458a3ac6fb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Coleções
const colCarros     = db.collection('carros');
const colFinanceiro = db.collection('financeiro');
const colGastos     = db.collection('gastos');
const colMetas      = db.collection('metas');
const colVendedores = db.collection('vendedores');
const colComissoes  = db.collection('comissoes');
const colCRM        = db.collection('crm');

// ─── CLOUDINARY CONFIG ───────────────────────
const CLOUDINARY_CLOUD = 'x2xybz4b';
const CLOUDINARY_PRESET = 'autoprime_upload'; // Unsigned preset (criamos abaixo)

// Faz upload de uma foto pro Cloudinary e retorna a URL permanente
async function uploadFoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'autoprime');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) throw new Error('Erro no upload da foto');
  const data = await res.json();
  return data.secure_url; // URL permanente na nuvem
}

// ─── CONSTANTES ──────────────────────────────
const EMOJIS = { Volkswagen:'🚗',Fiat:'🚙',Toyota:'🚘',Chevrolet:'🚗',Hyundai:'🚗',Jeep:'🚙',Honda:'🚗',Renault:'🚗',Ford:'🚗',Nissan:'🚗',Mitsubishi:'🚙',Kia:'🚗' };
const CATS_RECEITA = ['Venda de veículo','Entrada / Sinal','Financiamento','Serviço / Revisão','Outro'];
const CATS_DESPESA = ['Combustível','Manutenção veículo','Aluguel / Sede','Salário / Comissão','Marketing','Documentação','Compra de veículo','Impostos / Taxas','Outros'];
const COR_BARRAS   = ['#18181b','#3f3f46','#71717a','#a1a1aa','#d4d4d8'];

const PAGE_TITLES = {
  estoque:'Meu Estoque', adicionar:'Adicionar Veículo', custos:'Custo por Veículo',
  financeiro:'Financeiro', metas:'Metas e Comissões', crm:'CRM — Clientes'
};

// ─── ESTADO ──────────────────────────────────
let carros      = [];
let lancamentos = [];
let gastos      = [];
let vendedores  = [];
let comissoes   = [];
let leads       = [];
let fotosParaUpload = []; // arquivos File aguardando upload
let fotoUrls    = []; // previews locais
let tipoAtivo   = 'receita';
let custoCarroAtivo = null;
let crmFiltro   = 'todos';

// ─── UTILITÁRIOS ─────────────────────────────
function getEmoji(m)  { return EMOJIS[m] || '🚗'; }
function fmt(n)       { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
function hojeISO()    { return new Date().toISOString().slice(0,10); }
function fmtData(iso) { return iso.split('-').reverse().join('/'); }

function fmtCampo(el) {
  const n = el.value.replace(/\D/g,'');
  el.value = n ? 'R$ '+parseInt(n,10).toLocaleString('pt-BR') : '';
}

function parseMoeda(s) { return parseInt((s||'0').replace(/\D/g,''),10)||0; }

function fmt2(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

function mesLabel(ym) {
  const [y,m] = ym.split('-');
  return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(m,10)-1]+'/'+y;
}

function iniciais(nome) {
  return nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
}

function toast(msg, tipo) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.style.background = tipo==='erro' ? '#dc2626' : '#18181b';
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 3000);
}

function setStatus(ok) {
  const el = document.getElementById('sidebar-status');
  el.innerHTML = ok
    ? '<i class="ti ti-wifi" style="color:#16a34a"></i><span style="color:#16a34a">Conectado</span>'
    : '<i class="ti ti-wifi-off" style="color:#dc2626"></i><span style="color:#dc2626">Sem conexão</span>';
}

// ─── NAVEGAÇÃO ────────────────────────────────
function showPane(pane) {
  document.querySelectorAll('.pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pane-'+pane).classList.remove('hidden');
  document.getElementById('nav-'+pane).classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[pane] || pane;
  if (pane==='financeiro') { populaMeses(); renderFinanceiro(); }
  if (pane==='custos')     renderCustos();
  if (pane==='metas')      { renderMeta(); renderVendedores(); renderComissoes(); }
  if (pane==='crm')        renderCRM();
}

function setData() {
  const d = new Date();
  document.getElementById('topbar-date').textContent =
    d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}

// =============================================
//  MÓDULO 1 — ESTOQUE
// =============================================

function iniciarListenerCarros() {
  colCarros.orderBy('criadoEm','desc').onSnapshot(snap => {
    carros = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderEstoque();
    setStatus(true);
  }, ()=>setStatus(false));
}

function renderEstoque() {
  document.getElementById('cnt-total').textContent = carros.length;
  document.getElementById('cnt-disp').textContent  = carros.filter(c=>c.status==='disponivel').length;
  document.getElementById('cnt-res').textContent   = carros.filter(c=>c.status==='reservado').length;
  document.getElementById('cnt-vend').textContent  = carros.filter(c=>c.status==='vendido').length;

  const list = document.getElementById('car-list');
  if (!carros.length) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-car-off"></i><p>Nenhum veículo cadastrado.<br>Clique em <strong>Adicionar Veículo</strong> para começar.</p></div>`;
    return;
  }

  const labels = {disponivel:'Disponível',reservado:'Reservado',vendido:'Vendido'};
  list.innerHTML = carros.map(c=>`
    <div class="car-list-item">
      <div class="car-emoji">${c.fotos&&c.fotos[0]
        ? `<img src="${escUrl(c.fotos[0])}" style="width:48px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`
        : getEmoji(c.marca)}</div>
      <div class="car-info">
        <div class="car-nome">${esc(c.marca)} ${esc(c.modelo)} · ${esc(c.ano)}</div>
        <div class="car-sub">${esc(c.km)} km · ${esc(c.cor)} · ${esc(c.cambio)}</div>
      </div>
      <div class="car-preco">${esc(c.preco)}</div>
      <div class="car-badge badge-${escAttr(c.status)}">${esc(labels[c.status]||c.status)}</div>
      <div class="car-actions">
        <button class="btn-icon" onclick="alterarStatus('${escAttr(c.id)}','${escAttr(c.status)}')" title="Mudar situação"><i class="ti ti-refresh"></i></button>
        <button class="btn-icon del" onclick="excluirCarro('${escAttr(c.id)}')" title="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
}

async function alterarStatus(id, atual) {
  const ciclo  = ['disponivel','reservado','vendido'];
  const novo   = ciclo[(ciclo.indexOf(atual)+1)%3];
  try { await colCarros.doc(id).update({status:novo}); toast('Situação: '+novo); }
  catch(e) { toast('Erro ao atualizar','erro'); }
}

async function excluirCarro(id) {
  if (!confirm('Remover este veículo do estoque?')) return;
  try { await colCarros.doc(id).delete(); toast('Veículo removido'); }
  catch(e) { toast('Erro ao remover','erro'); }
}

// =============================================
//  MÓDULO 2 — ADICIONAR CARRO (com Cloudinary)
// =============================================

document.getElementById('file-input').addEventListener('change', function() {
  const preview = document.getElementById('fotos-preview');
  Array.from(this.files).forEach(file => {
    // Guarda o arquivo para upload posterior
    fotosParaUpload.push(file);

    // Preview local enquanto não sobe
    const url = URL.createObjectURL(file);
    fotoUrls.push(url);

    const wrap = document.createElement('div'); wrap.className='foto-thumb-wrap';
    const img  = document.createElement('img');  img.src=url; img.className='foto-thumb'; img.alt='Foto';
    const del  = document.createElement('button'); del.className='foto-del'; del.textContent='×';
    del.onclick = () => {
      const idx = fotoUrls.indexOf(url);
      if (idx > -1) { fotoUrls.splice(idx,1); fotosParaUpload.splice(idx,1); }
      wrap.remove();
    };
    wrap.appendChild(img); wrap.appendChild(del); preview.appendChild(wrap);
  });
  this.value = ''; // permite selecionar o mesmo arquivo novamente
});

async function salvarCarro() {
  const marca  = document.getElementById('f-marca').value.trim();
  const modelo = document.getElementById('f-modelo').value.trim();
  const ano    = document.getElementById('f-ano').value;
  const preco  = document.getElementById('f-preco').value.trim();
  if (!marca||!modelo||!ano||!preco) { toast('Preencha: marca, modelo, ano e preço','erro'); return; }

  const btnSalvar = document.querySelector('[onclick="salvarCarro()"]');
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Salvando fotos...';

  try {
    // Faz upload de todas as fotos pro Cloudinary
    let urlsNuvem = [];
    if (fotosParaUpload.length > 0) {
      toast('Enviando ' + fotosParaUpload.length + ' foto(s)...');
      urlsNuvem = await Promise.all(fotosParaUpload.map(f => uploadFoto(f)));
    }

    const custo = parseMoeda(document.getElementById('f-custo').value);

    const carro = {
      marca, modelo, ano:parseInt(ano,10),
      km:    document.getElementById('f-km').value    || '—',
      cor:   document.getElementById('f-cor').value   || '—',
      comb:  document.getElementById('f-comb').value,
      cambio:document.getElementById('f-cambio').value,
      desc:  document.getElementById('f-desc-car').value,
      preco, custo,
      troca: document.getElementById('f-troca').value,
      status:document.querySelector('input[name="status"]:checked').value,
      fotos: urlsNuvem, // URLs permanentes do Cloudinary
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await colCarros.add(carro);

    // Lança custo de aquisição no financeiro automaticamente
    if (custo > 0) {
      await colFinanceiro.add({
        tipo:'despesa', desc:`Compra ${marca} ${modelo} ${ano}`,
        cat:'Compra de veículo', val:custo, data:hojeISO(),
        carroId: ref.id,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    toast('Veículo salvo! Site já atualizado.');
    limparCarro();
    showPane('estoque');
  } catch(e) {
    toast('Erro: ' + e.message, 'erro');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="ti ti-device-floppy"></i> Salvar veículo';
  }
}

function limparCarro() {
  ['f-marca','f-modelo','f-ano','f-km','f-cor','f-desc-car','f-preco','f-custo']
    .forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('f-comb').selectedIndex=0;
  document.getElementById('f-cambio').selectedIndex=0;
  document.getElementById('f-troca').selectedIndex=0;
  document.getElementById('st-d').checked=true;
  document.getElementById('fotos-preview').innerHTML='';
  fotoUrls=[];
  fotosParaUpload=[];
}

// =============================================
//  MÓDULO 3 — CUSTO POR VEÍCULO
// =============================================

function iniciarListenerGastos() {
  colGastos.orderBy('criadoEm','desc').onSnapshot(snap=>{
    gastos = snap.docs.map(d=>({id:d.id,...d.data()}));
  });
}

function renderCustos() {
  const lista = document.getElementById('custos-lista');
  if (!carros.length) {
    lista.innerHTML=`<div class="empty-state"><i class="ti ti-car-off"></i><p>Nenhum veículo no estoque.</p></div>`;
    document.getElementById('custo-total').textContent='—';
    document.getElementById('custo-margem').textContent='—';
    document.getElementById('custo-qtd').textContent='—';
    return;
  }

  let totalInvestido=0, totalMargem=0, comCusto=0;

  lista.innerHTML = carros.map(c=>{
    const gastosC = gastos.filter(g=>g.carroId===c.id);
    const totalG  = gastosC.reduce((s,g)=>s+g.val,0);
    const custo   = (c.custo||0) + totalG;
    const preco   = parseMoeda(c.preco);
    const margem  = preco>0 ? Math.round(((preco-custo)/preco)*100) : 0;
    totalInvestido += custo;
    if (custo>0) { totalMargem+=margem; comCusto++; }

    return `
      <div class="custo-car-item">
        <div class="custo-car-header" onclick="toggleCustoItem('ci-${escAttr(c.id)}')">
          <span style="font-size:22px">${getEmoji(c.marca)}</span>
          <span class="custo-car-nome">${esc(c.marca)} ${esc(c.modelo)} ${esc(c.ano)} · ${esc(c.km)} km</span>
          <span style="font-size:12px;color:var(--muted);margin-right:8px">Preço: ${esc(c.preco)}</span>
          ${custo>0?`<span style="font-size:12px;color:var(--muted);margin-right:8px">Custo: ${fmt(custo)}</span>`:''}
          ${preco>0&&custo>0?`<span class="car-badge ${margem>=15?'badge-disponivel':'badge-reservado'}" style="margin-right:8px">Margem ${margem}%</span>`:''}
          <span class="custo-car-total">${custo>0?fmt(custo):'Sem custos'}</span>
          <button class="btn-primary-sm" onclick="event.stopPropagation();abrirCustoForm('${escAttr(c.id)}','${escAttr(c.marca+' '+c.modelo)}')">
            <i class="ti ti-plus"></i> Gasto
          </button>
        </div>
        <div class="custo-car-body" id="ci-${escAttr(c.id)}">
          ${c.custo>0?`<div class="custo-item-row"><span class="custo-item-tipo">Aquisição</span><span class="custo-item-desc">Compra do veículo</span><span class="custo-item-val">${fmt(c.custo)}</span></div>`:''}
          ${gastosC.map(g=>`
            <div class="custo-item-row">
              <span class="custo-item-tipo">${esc(g.tipo)}</span>
              <span class="custo-item-desc">${esc(g.desc)}</span>
              <span class="custo-item-val">${fmt(g.val)}</span>
              <button class="lanc-del" onclick="removerGasto('${escAttr(g.id)}')"><i class="ti ti-trash"></i></button>
            </div>`).join('')}
          ${gastosC.length===0&&!c.custo?`<p style="font-size:12px;color:var(--muted);padding:8px 0">Nenhum gasto registrado</p>`:''}
        </div>
      </div>`;
  }).join('');

  document.getElementById('custo-total').textContent  = fmt(totalInvestido);
  document.getElementById('custo-margem').textContent = comCusto>0 ? Math.round(totalMargem/comCusto)+'%' : '—';
  document.getElementById('custo-qtd').textContent    = comCusto;
}

function toggleCustoItem(id) {
  document.getElementById(id).classList.toggle('open');
}

function abrirCustoForm(carroId, nome) {
  custoCarroAtivo = carroId;
  document.getElementById('custo-form-titulo').textContent = 'Gasto em: '+nome;
  document.getElementById('custo-form-card').style.display = 'block';
  document.getElementById('custo-form-card').scrollIntoView({behavior:'smooth'});
}

function fecharCustoForm() {
  custoCarroAtivo = null;
  document.getElementById('custo-form-card').style.display='none';
  document.getElementById('custo-desc').value='';
  document.getElementById('custo-val').value='';
}

async function salvarGasto() {
  if (!custoCarroAtivo) return;
  const tipo = document.getElementById('custo-tipo').value;
  const desc = document.getElementById('custo-desc').value.trim();
  const val  = parseMoeda(document.getElementById('custo-val').value);
  if (!val) { toast('Informe o valor do gasto','erro'); return; }

  const carro = carros.find(c=>c.id===custoCarroAtivo);
  const nomeC = carro ? `${carro.marca} ${carro.modelo} ${carro.ano}` : 'Veículo';

  try {
    await colGastos.add({ carroId:custoCarroAtivo, tipo, desc:desc||tipo, val, criadoEm:firebase.firestore.FieldValue.serverTimestamp() });
    await colFinanceiro.add({ tipo:'despesa', desc:`${tipo} — ${nomeC}`, cat:'Manutenção veículo', val, data:hojeISO(), carroId:custoCarroAtivo, criadoEm:firebase.firestore.FieldValue.serverTimestamp() });
    toast('Gasto salvo e lançado no financeiro!');
    fecharCustoForm();
    renderCustos();
  } catch(e) { toast('Erro: '+e.message,'erro'); }
}

async function removerGasto(id) {
  if (!confirm('Remover este gasto?')) return;
  try { await colGastos.doc(id).delete(); renderCustos(); toast('Gasto removido'); }
  catch(e) { toast('Erro','erro'); }
}

// =============================================
//  MÓDULO 4 — FINANCEIRO
// =============================================

function iniciarListenerFinanceiro() {
  colFinanceiro.orderBy('data','desc').onSnapshot(snap=>{
    lancamentos = snap.docs.map(d=>({id:d.id,...d.data()}));
    populaMeses();
    renderFinanceiro();
  });
}

function setTipo(t) {
  tipoAtivo = t;
  document.getElementById('btn-rec').className = 'tipo-btn trec'+(t==='receita'?' active':'');
  document.getElementById('btn-des').className = 'tipo-btn tdes'+(t==='despesa'?' active':'');
  const cats = t==='receita' ? CATS_RECEITA : CATS_DESPESA;
  document.getElementById('fin-cat').innerHTML = cats.map(c=>`<option>${esc(c)}</option>`).join('');
}

function populaMeses() {
  const sel   = document.getElementById('fin-mes');
  const atual = sel.value;
  const meses = [...new Set(lancamentos.map(l=>l.data.slice(0,7)))].sort().reverse();
  sel.innerHTML = '<option value="todos">Todos os períodos</option>'+
    meses.map(m=>`<option value="${escAttr(m)}">${esc(mesLabel(m))}</option>`).join('');
  if (meses.includes(atual)) sel.value=atual;
  else if (meses.length) sel.value=meses[0];
}

function renderFinanceiro() {
  const mes   = document.getElementById('fin-mes').value;
  const lista = mes==='todos' ? lancamentos : lancamentos.filter(l=>l.data.startsWith(mes));
  const rec   = lista.filter(l=>l.tipo==='receita').reduce((s,l)=>s+l.val,0);
  const des   = lista.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+l.val,0);
  const sal   = rec-des;
  const mar   = rec>0?Math.round(sal/rec*100):0;

  document.getElementById('fin-rec').textContent = fmt(rec);
  document.getElementById('fin-des').textContent = fmt(des);
  document.getElementById('fin-sal').textContent = fmt(sal);
  document.getElementById('fin-sal').className   = 'stat-val '+(sal>=0?'green':'red');
  document.getElementById('fin-mar').textContent = mar+'%';

  const totCat={};
  lista.filter(l=>l.tipo==='despesa').forEach(l=>{ totCat[l.cat]=(totCat[l.cat]||0)+l.val; });
  const top5 = Object.entries(totCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxV = top5.length?top5[0][1]:1;
  document.getElementById('fin-barras').innerHTML = top5.length
    ? top5.map(([cat,val],i)=>`
        <div class="bar-row">
          <div class="bar-label" title="${esc(cat)}">${esc(cat.split(' ')[0])}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/maxV*100)}%;background:${COR_BARRAS[i%COR_BARRAS.length]}"></div></div>
          <div class="bar-val" style="color:${COR_BARRAS[i%COR_BARRAS.length]}">${fmt(val)}</div>
        </div>`).join('')
    : '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Sem despesas no período</div>';

  const corS = sal>=0?'var(--green)':'var(--red)';
  const cls  = sal>=0?'saldo-box saldo-pos':'saldo-box saldo-neg';
  document.getElementById('fin-resumo-detalhe').innerHTML=`
    <div class="resumo-linha"><span class="resumo-linha-label">Total receitas</span><span class="resumo-linha-val" style="color:var(--green)">${fmt(rec)}</span></div>
    <div class="resumo-linha"><span class="resumo-linha-label">Total despesas</span><span class="resumo-linha-val" style="color:var(--red)">${fmt(des)}</span></div>
    <div class="${cls}">
      <div><div class="saldo-label">Saldo líquido</div><div class="saldo-val" style="color:${corS}">${fmt(sal)}</div></div>
      <div style="text-align:right"><div class="saldo-label">Margem</div><div class="saldo-val" style="color:${corS}">${mar}%</div></div>
    </div>`;

  const listaEl = document.getElementById('fin-lista');
  if (!lista.length) { listaEl.innerHTML=`<div class="empty-state"><i class="ti ti-receipt-off"></i><p>Nenhum lançamento no período.</p></div>`; return; }
  listaEl.innerHTML = [...lista].sort((a,b)=>b.data.localeCompare(a.data)).map(l=>`
    <div class="lanc-row">
      <div class="lanc-icon ${l.tipo==='receita'?'rec':'des'}"><i class="ti ti-${l.tipo==='receita'?'arrow-up':'arrow-down'}"></i></div>
      <div class="lanc-desc"><div class="lanc-nome">${esc(l.desc)}</div><div class="lanc-cat">${esc(l.cat)}</div></div>
      <div class="lanc-data">${esc(fmtData(l.data))}</div>
      <div class="lanc-val ${l.tipo==='receita'?'rec':'des'}">${l.tipo==='receita'?'+':'-'}${fmt(l.val)}</div>
      <button class="lanc-del" onclick="removerLanc('${escAttr(l.id)}')"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}

async function adicionarLanc() {
  const desc = document.getElementById('fin-desc').value.trim();
  const val  = parseMoeda(document.getElementById('fin-val').value);
  const cat  = document.getElementById('fin-cat').value;
  const data = document.getElementById('fin-data').value || hojeISO();
  if (!desc||!val) { toast('Preencha descrição e valor','erro'); return; }
  try {
    await colFinanceiro.add({tipo:tipoAtivo,desc,cat,val,data,criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    document.getElementById('fin-desc').value='';
    document.getElementById('fin-val').value='';
    toast(tipoAtivo==='receita'?'Receita adicionada!':'Despesa registrada!');
  } catch(e) { toast('Erro: '+e.message,'erro'); }
}

async function removerLanc(id) {
  if (!confirm('Remover este lançamento?')) return;
  try { await colFinanceiro.doc(id).delete(); toast('Removido'); }
  catch(e) { toast('Erro','erro'); }
}

// =============================================
//  MÓDULO 5 — METAS E COMISSÕES
// =============================================

async function salvarMeta() {
  const valor    = parseMoeda(document.getElementById('meta-valor').value);
  const unidades = parseInt(document.getElementById('meta-unidades').value)||0;
  const mes      = document.getElementById('meta-mes').value;
  if (!mes||!valor) { toast('Preencha meta e mês','erro'); return; }
  try {
    await colMetas.doc(mes).set({valor,unidades,mes,criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    toast('Meta salva!'); renderMeta();
  } catch(e) { toast('Erro','erro'); }
}

async function renderMeta() {
  const mes = document.getElementById('meta-mes').value;
  if (!mes) return;
  try {
    const doc = await colMetas.doc(mes).get();
    if (!doc.exists) { document.getElementById('meta-progress').innerHTML=''; return; }
    const meta = doc.data();
    const recMes  = lancamentos.filter(l=>l.tipo==='receita'&&l.data.startsWith(mes)).reduce((s,l)=>s+l.val,0);
    const vendMes = carros.filter(c=>c.status==='vendido').length;
    const pctFat  = meta.valor>0 ? Math.min(Math.round(recMes/meta.valor*100),100) : 0;
    const pctVend = meta.unidades>0 ? Math.min(Math.round(vendMes/meta.unidades*100),100) : 0;
    document.getElementById('meta-progress').innerHTML=`
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">Faturamento</span>
          <span style="color:var(--muted)">${fmt(recMes)} / ${fmt(meta.valor)}</span>
        </div>
        <div class="meta-bar-wrap"><div class="meta-bar-fill" style="width:${pctFat}%"></div></div>
        <div class="meta-pct" style="color:${pctFat>=100?'var(--green)':'var(--muted)'}">${pctFat}% da meta</div>
      </div>
      ${meta.unidades?`
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">Vendas (unidades)</span>
          <span style="color:var(--muted)">${vendMes} / ${meta.unidades}</span>
        </div>
        <div class="meta-bar-wrap"><div class="meta-bar-fill" style="width:${pctVend}%"></div></div>
        <div class="meta-pct" style="color:${pctVend>=100?'var(--green)':'var(--muted)'}">${pctVend}% da meta</div>
      </div>`:''}`;
  } catch(e) {}
}

async function salvarVendedor() {
  const nome     = document.getElementById('vend-nome').value.trim();
  const comissao = parseFloat(document.getElementById('vend-comissao').value)||0;
  if (!nome) { toast('Informe o nome do vendedor','erro'); return; }
  try {
    await colVendedores.add({nome,comissao,criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    document.getElementById('vend-nome').value='';
    document.getElementById('vend-comissao').value='';
    toast('Vendedor cadastrado!'); renderVendedores();
  } catch(e) { toast('Erro','erro'); }
}

function iniciarListenerVendedores() {
  colVendedores.orderBy('nome').onSnapshot(snap=>{
    vendedores = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderVendedores();
    const sel = document.getElementById('vend-sel');
    if (sel) sel.innerHTML = vendedores.map(v=>`<option value="${escAttr(v.id)}">${esc(v.nome)} (${esc(v.comissao)}%)</option>`).join('');
  });
}

function renderVendedores() {
  const el = document.getElementById('vendedores-lista');
  if (!vendedores.length) { el.innerHTML=`<p style="font-size:12px;color:var(--muted)">Nenhum vendedor cadastrado.</p>`; return; }
  el.innerHTML = vendedores.map(v=>`
    <div class="vendedor-item">
      <div class="vend-avatar">${esc(iniciais(v.nome))}</div>
      <div class="vend-nome">${esc(v.nome)}</div>
      <div class="vend-pct">${esc(v.comissao)}% comissão</div>
      <button class="lanc-del" onclick="removerVendedor('${escAttr(v.id)}')"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}

async function removerVendedor(id) {
  if (!confirm('Remover vendedor?')) return;
  try { await colVendedores.doc(id).delete(); toast('Removido'); }
  catch(e) { toast('Erro','erro'); }
}

async function lancarComissao() {
  const vendId = document.getElementById('vend-sel').value;
  const venda  = parseMoeda(document.getElementById('vend-val-venda').value);
  if (!vendId||!venda) { toast('Selecione o vendedor e informe o valor da venda','erro'); return; }
  const vend = vendedores.find(v=>v.id===vendId);
  if (!vend) return;
  const comissaoVal = Math.round(venda*(vend.comissao/100));
  try {
    await colComissoes.add({ vendedorId:vendId, vendedorNome:vend.nome, venda, comissaoVal, comissaoPct:vend.comissao, data:hojeISO(), criadoEm:firebase.firestore.FieldValue.serverTimestamp() });
    await colFinanceiro.add({ tipo:'despesa', desc:`Comissão ${vend.nome}`, cat:'Salário / Comissão', val:comissaoVal, data:hojeISO(), criadoEm:firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('vend-val-venda').value='';
    toast(`Comissão de ${fmt(comissaoVal)} lançada para ${vend.nome}!`);
    renderComissoes();
  } catch(e) { toast('Erro','erro'); }
}

function iniciarListenerComissoes() {
  colComissoes.orderBy('criadoEm','desc').onSnapshot(snap=>{
    comissoes = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderComissoes();
  });
}

function renderComissoes() {
  const el = document.getElementById('comissoes-lista');
  if (!comissoes.length) { el.innerHTML=`<div class="empty-state" style="padding:20px"><i class="ti ti-receipt-off"></i><p>Nenhuma comissão lançada.</p></div>`; return; }
  el.innerHTML = comissoes.slice(0,20).map(c=>`
    <div class="comissao-item">
      <div class="vend-avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciais(c.vendedorNome))}</div>
      <div class="comissao-vend">${esc(c.vendedorNome)}</div>
      <div class="comissao-venda" style="font-size:12px">Venda: ${fmt(c.venda)}</div>
      <div class="comissao-val">+${fmt(c.comissaoVal)}</div>
      <div style="font-size:11px;color:var(--muted)">${esc(fmtData(c.data))}</div>
      <button class="lanc-del" onclick="removerComissao('${escAttr(c.id)}')"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}

async function removerComissao(id) {
  if (!confirm('Remover comissão?')) return;
  try { await colComissoes.doc(id).delete(); toast('Removido'); }
  catch(e) { toast('Erro','erro'); }
}

// =============================================
//  MÓDULO 6 — CRM
// =============================================

function iniciarListenerCRM() {
  colCRM.orderBy('criadoEm','desc').onSnapshot(snap=>{
    leads = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCRM();
  });
}

async function salvarLead() {
  const nome      = document.getElementById('crm-nome').value.trim();
  const wpp       = document.getElementById('crm-wpp').value.trim();
  const interesse = document.getElementById('crm-interesse').value.trim();
  const origem    = document.getElementById('crm-origem').value;
  const obs       = document.getElementById('crm-obs').value.trim();
  if (!nome) { toast('Informe o nome do cliente','erro'); return; }
  try {
    await colCRM.add({nome,wpp,interesse,origem,obs,status:'novo',criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    ['crm-nome','crm-wpp','crm-interesse','crm-obs'].forEach(id=>{ document.getElementById(id).value=''; });
    toast('Lead adicionado!');
  } catch(e) { toast('Erro','erro'); }
}

async function atualizarStatusLead(id, status) {
  try { await colCRM.doc(id).update({status}); toast('Status atualizado'); }
  catch(e) { toast('Erro','erro'); }
}

async function removerLead(id) {
  if (!confirm('Remover este lead?')) return;
  try { await colCRM.doc(id).delete(); toast('Lead removido'); }
  catch(e) { toast('Erro','erro'); }
}

function renderCRM() {
  document.getElementById('crm-total').textContent    = leads.length;
  document.getElementById('crm-contato').textContent  = leads.filter(l=>l.status==='contato'||l.status==='negociando').length;
  document.getElementById('crm-fechados').textContent = leads.filter(l=>l.status==='fechado').length;
  document.getElementById('crm-perdidos').textContent = leads.filter(l=>l.status==='perdido').length;

  const filtrados = crmFiltro==='todos' ? leads : leads.filter(l=>l.status===crmFiltro);
  const el = document.getElementById('crm-lista');

  if (!filtrados.length) { el.innerHTML=`<div class="empty-state"><i class="ti ti-users"></i><p>Nenhum lead encontrado.</p></div>`; return; }

  const badgeClass = {novo:'badge-novo',contato:'badge-contato',negociando:'badge-negociando',fechado:'badge-fechado',perdido:'badge-perdido'};
  const statusOpts = ['novo','contato','negociando','fechado','perdido'];

  el.innerHTML = filtrados.map(l=>`
    <div class="lead-item">
      <div class="lead-avatar">${esc(iniciais(l.nome))}</div>
      <div class="lead-info">
        <div class="lead-nome">${esc(l.nome)}</div>
        <div class="lead-sub">${l.wpp?'📱 '+esc(l.wpp)+' · ':''}${esc(l.origem)} · ${esc(l.interesse||'Interesse não informado')}</div>
        ${l.obs?`<div class="lead-obs">"${esc(l.obs)}"</div>`:''}
      </div>
      <select class="lead-status-sel" onchange="atualizarStatusLead('${escAttr(l.id)}',this.value)">
        ${statusOpts.map(s=>`<option value="${escAttr(s)}" ${l.status===s?'selected':''}>${esc(s.charAt(0).toUpperCase()+s.slice(1))}</option>`).join('')}
      </select>
      <span class="lead-badge ${badgeClass[l.status]||''}">${esc(l.status)}</span>
      ${l.wpp?`<a href="https://wa.me/55${escAttr(l.wpp.replace(/\D/g,''))}" target="_blank" class="btn-icon" title="WhatsApp"><i class="ti ti-brand-whatsapp"></i></a>`:''}
      <button class="btn-icon del" onclick="removerLead('${escAttr(l.id)}')" title="Remover"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}

document.querySelectorAll('.crm-filtro').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.crm-filtro').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    crmFiltro = btn.dataset.status;
    renderCRM();
  });
});

// =============================================
//  INICIALIZAÇÃO
// =============================================

setData();
document.getElementById('fin-data').value  = hojeISO();
document.getElementById('meta-mes').value  = hojeISO().slice(0,7);
setTipo('receita');

iniciarListenerCarros();
iniciarListenerFinanceiro();
iniciarListenerGastos();
iniciarListenerVendedores();
iniciarListenerComissoes();
iniciarListenerCRM();