const App = (function(){
  let BOOKS = [];
  let AV    = [];
  let GAMES = [];

  const el = (sel) => document.querySelector(sel);
  const app = el('#app');

  function setYear(){ const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear(); }
  function scrollTop(){ window.scrollTo({top:0, behavior:'smooth'}); }
  function initTopButton(){ const b = document.getElementById('btn-topo'); if (b) b.addEventListener('click', scrollTop); }

  async function loadData(){
    BOOKS = await fetchJSON('data/analises.json', 'analises');
    AV    = await fetchJSON('data/audiovisual.json', 'audiovisual');
    GAMES = await fetchJSON('data/jogos.json', 'jogos');
  }
  async function fetchJSON(path, key){
    try{
      const res = await fetch(path);
      if(!res.ok) throw new Error('Falha ao carregar ' + path);
      const j = await res.json();
      return j[key] || [];
    }catch(e){
      console.error(e);
      return [];
    }
  }

  function formatDate(iso){
    if(!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', {year:'numeric', month:'short'});
  }

  function cardTemplate(item, routePrefix){
    const src = (item.cover && item.cover.trim()!=='') ? item.cover : '';
    const img = src
      ? `<img src="${src}" alt="Capa: ${item.title}" loading="lazy">`
      : `<div class="cover-fallback" aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;opacity:.9">${(item.title||'?').slice(0,1).toUpperCase()}</div>`;
    const tags = (item.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('');
    const date = item.date ? `<span>${formatDate(item.date)}</span>` : '';
    return `
      <article class="card">
        <a href="#/${routePrefix}/${item.slug}" aria-label="Abrir ${item.title}">
          <div class="cover">${img}<span class="badge">Leitura</span></div>
          <div class="card-body">
            <h3 class="card-title">${item.title}</h3>
            <div class="card-meta">${item.author || ''}${item.author && date ? ' • ' : ''}${date}</div>
            <div class="tags">${tags}</div>
          </div>
        </a>
      </article>
    `;
  }

  function renderList(list, options){
    const { title, subtitle, searchParam, routePrefix } = options;
    document.title = `${title} — Análises | Murilo P de Quevedo`;
    const search = new URLSearchParams(location.search).get(searchParam) || '';
    app.innerHTML = `
      <section class="hero">
        <h2>${title}</h2>
        <p class="small">${subtitle}</p>
      </section>
      <div class="search-bar">
        <input id="q" type="search" placeholder="Buscar por título, autor ou tag..." value="${search}" aria-label="Buscar">
        <button id="limpar">Limpar</button>
      </div>
      <section id="grid" class="grid" aria-live="polite"></section>
      <div id="vazio" class="empty hidden">Nada encontrado. Tente outro termo.</div>
    `;

    const input = el('#q');
    const grid = el('#grid');
    const vazio = el('#vazio');
    const limpar = el('#limpar');

    function applyFilter(){
      const q = (input.value||'').toLowerCase().trim();
      const filtered = list.filter(a => {
        const hay = `${a.title} ${a.author||''} ${(a.tags||[]).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
      grid.innerHTML = filtered.map(item => cardTemplate(item, routePrefix)).join('');
      vazio.classList.toggle('hidden', filtered.length>0);

      const url = new URL(window.location);
      if(q){ url.searchParams.set(searchParam, q);} else { url.searchParams.delete(searchParam); }
      history.replaceState(null, '', url);
    }

    input.addEventListener('input', applyFilter);
    limpar.addEventListener('click', () => { input.value=''; input.focus(); applyFilter(); });

    grid.innerHTML = list.map(item => cardTemplate(item, routePrefix)).join('');
  }

  async function renderDetail(slug, dataset, folder, pageTitlePrefix){
    const item = (dataset||[]).find(a => a.slug === slug);
    if(!item){ app.innerHTML = `<div class="empty">Conteúdo não encontrado.</div>`; return; }
    document.title = `${item.title} — ${pageTitlePrefix} | Murilo P de Quevedo`;

    const res = await fetch(`${folder}/${slug}.html?ts=${Date.now()}`);
    const html = res.ok ? await res.text() : '<p>Não foi possível carregar o conteúdo.</p>';

    app.innerHTML = `
      <article class="article">
        <header>
          <a class="btn-secondary" href="index.html#/${folder==='analises' ? '' : folder}">&larr; Voltar</a>
          <h1>${item.title}</h1>
          <div class="meta">${item.author||''}${item.author && item.date ? ' • ' : ''}${formatDate(item.date)||''}</div>
          <div class="controls">
            <button class="btn" id="copyLink">Copiar link</button>
          </div>
        </header>
        <section class="content" id="article-content"></section>
        <p class="small">Tags: ${(item.tags||[]).map(t=>`#${t}`).join(' ')}</p>
      </article>
    `;
    el('#article-content').innerHTML = html;
    el('#copyLink').addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(()=>{
        el('#copyLink').textContent='Link copiado!';
        setTimeout(()=> el('#copyLink').textContent='Copiar link', 1500);
      });
    });
    scrollTop();
  }

  function router(){
    const h = location.hash || '#/';
    const parts = h.split('/');            // ["#", "", "audiovisual", "slug?"]
    const route = parts[1] || '';
    const slug  = parts[2];

    // LISTAS
    if(route === ''){
      renderList(BOOKS, { title:'Livros curtos, ideias densas', subtitle:'Clique em um livro para ler a análise.', searchParam:'q',  routePrefix:'analise' });
      return;
    }
    if(route === 'audiovisual' && !slug){
      renderList(AV,    { title:'Ver é pensar',                     subtitle:'Clique em um título para ler a análise.', searchParam:'qa', routePrefix:'audiovisual' });
      return;
    }
    if(route === 'jogos' && !slug){
      renderList(GAMES, { title:'Sentir é a primeira mecânica',                           subtitle:'Clique em um jogo para ler a análise.',   searchParam:'qj', routePrefix:'jogo' });
      return;
    }

    // DETALHES
    if(route === 'analise'     && slug){ renderDetail(slug, BOOKS, 'analises',    'Livro');        return; }
    if(route === 'audiovisual' && slug){ renderDetail(slug, AV,    'audiovisual', 'Audiovisual');  return; }
    if(route === 'jogo'        && slug){ renderDetail(slug, GAMES, 'jogos',       'Jogo');         return; }

    // fallback
    renderList(BOOKS, { title:'Livros curtos, ideias densas', subtitle:'Clique em um livro para ler a análise.', searchParam:'q', routePrefix:'analise' });
  }

  async function start(){
    setYear();
    initTopButton();
    await loadData();
    window.addEventListener('hashchange', router);
    router();
  }

  return { start };
})();

App.start();