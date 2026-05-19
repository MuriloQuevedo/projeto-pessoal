const App = (function () {
  let BOOKS = [];
  let AV = [];
  let GAMES = [];
  let CHARS = [];
  let ALL_ITEMS = [];

  const el = (sel) => document.querySelector(sel);
  const app = el("#app");

  // ==========================================
  // UTILITÁRIOS
  // ==========================================
  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTopButton() {
    const b = document.getElementById("btn-topo");
    if (b) b.addEventListener("click", scrollTop);
  }

  // Gera uma cor HSL baseada na string (para itens sem capa)
  function getHashColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 40%, 25%)`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { year: "numeric", month: "short" });
  }

  function sortItems(list, method) {
    const arr = list.slice();
    if (method === 'az') return arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (method === 'za') return arr.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    if (method === 'new') return arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (method === 'old') return arr.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return arr;
  }

  // ==========================================
  // CARREGAMENTO DE DADOS
  // ==========================================
  async function fetchJSON(path, key) {
    try {
      const res = await fetch(`${path}?ts=${Date.now()}`); // Anti-cache
      if (!res.ok) throw new Error("Falha ao carregar " + path);
      const j = await res.json();
      return j[key] || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function loadData() {
    BOOKS = await fetchJSON("data/analises.json", "analises");
    AV = await fetchJSON("data/audiovisual.json", "audiovisual"); 
    GAMES = await fetchJSON("data/jogos.json", "jogos"); 
    CHARS = await fetchJSON("data/personagens.json", "personagens");
    
    // Mapeia o prefixo de rota para criar um array global unificado
    const mapType = (arr, prefix) => arr.map(i => ({ ...i, routePrefix: prefix }));
    ALL_ITEMS = [
      ...mapType(BOOKS, "analise"),
      ...mapType(AV, "audiovisual"),
      ...mapType(GAMES, "jogo"),
      ...mapType(CHARS, "personagem")
    ];
  }

  // ==========================================
  // TEMPLATES
  // ==========================================
  function cardTemplate(item, overrideRoutePrefix = null) {
    const prefix = overrideRoutePrefix || item.routePrefix;
    const src = item.cover && item.cover.trim() !== "" ? item.cover : "";
    const fallbackColor = getHashColor(item.title || "A");
    
    const img = src
      ? `<img src="${src}" alt="Capa: ${item.title}" loading="lazy">`
      : `<div aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold;color:rgba(255,255,255,0.2);background:${fallbackColor}">${(item.title || "?").slice(0, 1).toUpperCase()}</div>`;
    
    const tags = (item.tags || []).map((t) => 
      `<button class="tag" onclick="event.preventDefault(); location.hash='#/${prefix}?q=${encodeURIComponent(t)}'">${t}</button>`
    ).join("");
    
    const date = item.date ? `<span>${formatDate(item.date)}</span>` : "";
    
    return `
      <article class="card">
        <a href="#/${prefix}/${item.slug}" aria-label="Abrir ${item.title}" style="display:contents">
          <div class="cover">${img}</div>
          <div class="card-body">
            <h3 class="card-title">${item.title}</h3>
            <div class="card-meta">${item.author || ""}${item.author && date ? " • " : ""}${date}</div>
            <div class="tags" onclick="event.stopPropagation()">${tags}</div>
          </div>
        </a>
      </article>
    `;
  }

  // ==========================================
  // RENDERIZAÇÃO DE PÁGINAS
  // ==========================================

  // 1. Página Inicial (Acervo Global - Impessoal)
  function renderHome() {
    document.title = "Análises e Ideias | Murilo Quevedo";
    
    app.innerHTML = `
      <section class="hero" style="border:none; margin-top:40px;">
        <h2>Acervo de Análises</h2>
        <p style="font-size:1.1rem; color:var(--muted); max-width:700px;">
          Um arquivo de ideias e ensaios sobre literatura, audiovisual, jogos e personagens. Reflexões diretas focadas na obra.
        </p>
      </section>

      <div class="toolbar" style="margin-top:0;">
        <div class="search-bar">
          <input id="qGlobal" type="search" placeholder="Buscar em todo o acervo..." aria-label="Busca Global">
          <button id="btnGlobal" class="btn">Buscar</button>
        </div>
      </div>

      <section id="gridGlobal" class="grid"></section>
      <div id="vazioGlobal" class="empty hidden"></div>
    `;

    const input = el("#qGlobal");
    const btn = el("#btnGlobal");
    const grid = el("#gridGlobal");
    const vazio = el("#vazioGlobal");

    const recents = sortItems(ALL_ITEMS, 'new').slice(0, 8);
    grid.innerHTML = recents.map(item => cardTemplate(item)).join("");

    function doGlobalSearch() {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        grid.innerHTML = recents.map(item => cardTemplate(item)).join("");
        vazio.classList.add("hidden");
        return;
      }
      
      const filtered = ALL_ITEMS.filter((a) => {
        const hay = `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });

      if (filtered.length > 0) {
        grid.innerHTML = filtered.map(item => cardTemplate(item)).join("");
        vazio.classList.add("hidden");
      } else {
        grid.innerHTML = "";
        vazio.innerHTML = `Nenhum resultado para "<strong>${q}</strong>".`;
        vazio.classList.remove("hidden");
      }
    }

    input.addEventListener("keyup", (e) => { if (e.key === "Enter") doGlobalSearch(); });
    btn.addEventListener("click", doGlobalSearch);
  }

  // 2. Listas de Categorias
  function renderList(list, options) {
    const { title, subtitle, routePrefix, notice } = options;
    document.title = `${title} — Murilo Quevedo`;
    
    const searchParam = new URLSearchParams(location.hash.split('?')[1] || "").get('q') || "";
    
    app.innerHTML = `
      <section class="hero">
        <h2>${title} <span id="item-count" class="hero-stats small">— ${list.length}</span></h2>
        <p class="small">${subtitle}</p>
      </section>

      ${notice ? `<div class="notice" role="note">${notice}</div>` : ""}

      <div class="toolbar">
        <div class="search-bar">
          <input id="q" type="search" placeholder="Buscar título, autor ou tag..." value="${searchParam}">
        </div>
        <select id="sortOrder" aria-label="Ordenar">
          <option value="az">A-Z</option>
          <option value="za">Z-A</option>
          <option value="new">Mais Recentes</option>
          <option value="old">Mais Antigos</option>
        </select>
      </div>

      <section id="grid" class="grid" aria-live="polite"></section>
      <div id="vazio" class="empty hidden"></div>
    `;

    const input = el("#q");
    const sortSelect = el("#sortOrder");
    const grid = el("#grid");
    const vazio = el("#vazio");
    const countEl = el("#item-count");

    function applyFilter() {
      const q = (input.value || "").toLowerCase().trim();
      const method = sortSelect.value;
      
      let filtered = list.filter((a) => {
        const hay = `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });

      filtered = sortItems(filtered, method);
      countEl.textContent = q ? `— ${filtered.length} de ${list.length}` : `— ${list.length}`;

      if (filtered.length > 0) {
        grid.innerHTML = filtered.map((item) => cardTemplate(item, routePrefix)).join("");
        vazio.classList.add("hidden");
      } else {
        grid.innerHTML = "";
        const shuffled = [...list].sort(() => 0.5 - Math.random()).slice(0, 3);
        const suggestionHTML = shuffled.length > 0 
            ? `<br><br><p>Que tal esses?</p><div class="grid" style="margin-top:16px; text-align:left;">${shuffled.map(i => cardTemplate(i, routePrefix)).join('')}</div>`
            : '';
        vazio.innerHTML = `Nada encontrado para "<strong>${q}</strong>". ${suggestionHTML}`;
        vazio.classList.remove("hidden");
      }

      const baseHash = location.hash.split('?')[0];
      const newHash = q ? `${baseHash}?q=${encodeURIComponent(q)}` : baseHash;
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }

    input.addEventListener("input", applyFilter);
    sortSelect.addEventListener("change", applyFilter);
    applyFilter();
  }

  // 3. Detalhe do Artigo
  async function renderDetail(slug, dataset, folder, pageTitlePrefix) {
    const item = (dataset || []).find((a) => a.slug === slug);
    if (!item) {
      app.innerHTML = `<div class="empty">Conteúdo não encontrado.</div>`;
      return;
    }
    document.title = `${item.title} — ${pageTitlePrefix} | Murilo Quevedo`;

    const res = await fetch(`${folder}/${slug}.html?ts=${Date.now()}`);
    const html = res.ok ? await res.text() : "<p>Não foi possível carregar o conteúdo.</p>";

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || tempDiv.innerText || "";
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    const coverHTML = item.cover ? `
      <div class="article-cover-wrap">
        <div class="article-cover-bg" style="background-image: url('${item.cover}')"></div>
        <img class="article-cover-img" src="${item.cover}" alt="Capa">
      </div>
    ` : '';

    const currentTags = item.tags || [];
    const relatedItems = ALL_ITEMS.filter(a => 
      a.slug !== item.slug && 
      (a.tags || []).some(t => currentTags.includes(t))
    ).slice(0, 3);

    const relatedHTML = relatedItems.length > 0 ? `
      <section class="related-section">
        <h3>Pode te interessar também</h3>
        <div class="grid" style="margin-bottom:0;">
          ${relatedItems.map(i => cardTemplate(i, i.routePrefix)).join('')}
        </div>
      </section>
    ` : '';

    app.innerHTML = `
      <article class="article">
        <header>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <a class="btn-secondary" href="javascript:history.back()">&larr; Voltar</a>
            <button id="toggleReadingMode" class="btn-leitura">📖 Modo Foco</button>
          </div>
          ${coverHTML}
          <h1>${item.title}</h1>
          <div class="meta">
            ${item.author ? `<span>✍️ ${item.author}</span>` : ""}
            ${item.date ? `<span>📅 ${formatDate(item.date)}</span>` : ""}
            <span class="read-time">⏳ ~${readTime} min</span>
          </div>
          <div class="toolbar" style="margin-top: 16px;">
            <button class="btn" id="shareBtn">🔗 Compartilhar</button>
          </div>
        </header>
        
        <div id="toc-container"></div>
        
        <section class="content" id="article-content"></section>
        
        <div style="margin-top:40px; padding-top:20px; border-top:1px solid var(--border)">
          <p class="small">Tags: ${(item.tags || []).map((t) => `<span class="tag" style="cursor:default">#${t}</span>`).join(" ")}</p>
        </div>

        ${relatedHTML}
      </article>
    `;
    
    const contentEl = el("#article-content");
    contentEl.innerHTML = html;

    const headings = contentEl.querySelectorAll("h2");
    if (headings.length > 0) {
      const tocList = Array.from(headings).map((h, i) => {
        const id = h.id || `secao-${i}`;
        h.id = id;
        // Trocamos o href="#" padrão por um data-target para evitar a mudança na URL
        return `<li><a href="#" data-target="${id}" class="toc-link">${h.textContent}</a></li>`;
      }).join("");
      
      el("#toc-container").innerHTML = `
        <nav class="toc">
          <strong>Neste ensaio</strong>
          <ul>${tocList}</ul>
        </nav>
      `;

      // Intercepta o clique para fazer o scroll manual e suave
      const tocLinks = el("#toc-container").querySelectorAll('.toc-link');
      tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault(); // Impede a alteração da rota (hash) na URL
          const targetId = link.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }

    const btnReading = el("#toggleReadingMode");
    if (btnReading) {
      btnReading.addEventListener("click", () => {
        document.body.classList.toggle("reading-mode");
        if (document.body.classList.contains("reading-mode")) {
          btnReading.textContent = "Sair do Modo Foco ✖";
        } else {
          btnReading.textContent = "📖 Modo Foco";
        }
      });
    }

    const shareBtn = el("#shareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${item.title} | Murilo Quevedo`,
              url: window.location.href
            });
          } catch (e) { console.log("Compartilhamento cancelado"); }
        } else {
          navigator.clipboard.writeText(location.href).then(() => {
            shareBtn.textContent = "Link copiado!";
            setTimeout(() => (shareBtn.textContent = "🔗 Compartilhar"), 2000);
          });
        }
      });
    }

    const bar = document.getElementById("readProgress");
    if (bar) bar.style.width = "0%";
    scrollTop();
  }

  // ==========================================
  // ROTEAMENTO E EVENTOS GLOBAIS
  // ==========================================
  function router() {
    const h = location.hash.split('?')[0] || "#/";
    const parts = h.split("/");
    const route = parts[1] || "";
    const slug = parts[2];

    if (route === "") return renderHome();
    
    if (route === "livros" && !slug) return renderList(BOOKS, { title: "Livros", subtitle: "Ideias densas sobre obras curtas ou clássicas.", routePrefix: "analise" });
    if (route === "audiovisual" && !slug) return renderList(AV, { title: "Audiovisual", subtitle: "Ver é pensar.", routePrefix: "audiovisual" });
    if (route === "jogos" && !slug) return renderList(GAMES, { title: "Jogos", subtitle: "Sentir é a primeira mecânica.", routePrefix: "jogo" });
    if (route === "personagens" && !slug) return renderList(CHARS, { title: "Personagens", subtitle: "Estudos de personalidade.", routePrefix: "personagem", notice: `ℹ️ Escritos com apoio de referências externas.` });

    if (route === "analise" && slug) return renderDetail(slug, BOOKS, "analises", "Livro");
    if (route === "audiovisual" && slug) return renderDetail(slug, AV, "audiovisual", "Audiovisual");
    if (route === "jogo" && slug) return renderDetail(slug, GAMES, "jogos", "Jogo");
    if (route === "personagem" && slug) return renderDetail(slug, CHARS, "personagens", "Personagem");

    renderHome();
  }

  function initReadProgress() {
    const bar = document.getElementById("readProgress");
    if (!bar) return;
    const onScroll = () => {
      const cont = document.querySelector(".article .content") || document.body;
      const rect = cont.getBoundingClientRect();
      const top = Math.max(0, -rect.top); 
      const total = Math.max(1, cont.scrollHeight - window.innerHeight);
      const pct = Math.min(100, (top / total) * 100);
      bar.style.width = pct + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", () => {
      bar.style.width = "0%";
      setTimeout(onScroll, 50);
    });
    setTimeout(onScroll, 100);
  }

  // Atalho global para busca (tecla '/')
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const searchBox = document.querySelector('input[type="search"]');
      if (searchBox) {
        searchBox.focus();
        searchBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  async function start() {
    initTopButton();
    await loadData();
    window.addEventListener("hashchange", router);
    router();
    initReadProgress();
  }

  return { start };
})();

App.start();