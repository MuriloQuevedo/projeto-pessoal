const App = (function () {
  let BOOKS = [];
  let AV = [];
  let GAMES = [];
  let CHARS = [];
  let ALL_ITEMS = [];
  let activeTocCleanup = null;

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
    if (!b) return;
    b.addEventListener("click", scrollTop);
    const toggle = () => b.classList.toggle("visible", window.scrollY > 400);
    window.addEventListener("scroll", toggle, { passive: true });
    toggle();
  }

  /**
   * Dispara animação de fade-in no #app.
   * Remover e re-adicionar a classe força o browser a reiniciar
   * a animação mesmo que o elemento já existisse com ela.
   */
  function animatePageIn() {
    app.classList.remove("page-enter");
    void app.offsetHeight; // força reflow para reiniciar a animation
    app.classList.add("page-enter");
  }

  /** Remove o banner de retomada de leitura do DOM, se existir */
  function clearResumeBanner() {
    const b = document.querySelector(".resume-banner");
    if (b) b.remove();
  }

  /**
   * Exibe um banner fixo no rodapé com o progresso salvo.
   * O usuário pode pular para onde parou ou fechar.
   */
  function showResumeBanner(slug, savedPct) {
    clearResumeBanner();
    const banner = document.createElement("div");
    banner.className = "resume-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="resume-text">Você parou em ${Math.round(savedPct)}% deste artigo</span>
      <button class="resume-btn" id="resumeBtn">Continuar lendo</button>
      <button class="resume-close" id="resumeClose" aria-label="Fechar">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById("resumeBtn").addEventListener("click", () => {
      const cont = document.querySelector(".article .content");
      if (cont) {
        // contTop: distância do topo do conteúdo ao topo do documento
        const contTop = cont.getBoundingClientRect().top + window.scrollY;
        const total = Math.max(0, cont.scrollHeight - window.innerHeight);
        window.scrollTo({
          top: contTop + (savedPct / 100) * total,
          behavior: "smooth",
        });
      }
      clearResumeBanner();
    });
    document
      .getElementById("resumeClose")
      .addEventListener("click", clearResumeBanner);

    // Auto-fecha após 8 segundos
    setTimeout(clearResumeBanner, 8000);
  }

  function getHashGradient(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++)
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 45) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 35%, 20%), hsl(${h2}, 45%, 28%))`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { year: "numeric", month: "short" });
  }

  function sortItems(list, method) {
    const arr = list.slice();
    if (method === "az")
      return arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (method === "za")
      return arr.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    if (method === "new")
      return arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (method === "old")
      return arr.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return arr;
  }

  function getCategoryLabel(prefix) {
    const map = {
      analise: "Livro",
      audiovisual: "Audiovisual",
      jogo: "Jogo",
      personagem: "Personagem",
    };
    return map[prefix] || prefix;
  }

  function updateNavActive() {
    const route = location.hash.split("?")[0].split("/")[1] || "";
    const routeToNav = {
      livros: "livros",
      analise: "livros",
      audiovisual: "audiovisual",
      jogos: "jogos",
      jogo: "jogos",
      personagens: "personagens",
      personagem: "personagens",
    };
    const activeNav = routeToNav[route] || "";
    document.querySelectorAll(".nav a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const navRoute = (href.split("#")[1] || "").split("/")[1] || "";
      a.classList.toggle("nav-active", !!(navRoute && navRoute === activeNav));
    });
  }

  // ==========================================
  // CARREGAMENTO DE DADOS
  // ==========================================

  async function fetchJSON(path, key) {
    try {
      const res = await fetch(`${path}?ts=${Date.now()}`);
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
    const mapType = (arr, prefix) =>
      arr.map((i) => ({ ...i, routePrefix: prefix }));
    ALL_ITEMS = [
      ...mapType(BOOKS, "analise"),
      ...mapType(AV, "audiovisual"),
      ...mapType(GAMES, "jogo"),
      ...mapType(CHARS, "personagem"),
    ];
  }

  // ==========================================
  // TEMPLATES
  // ==========================================

  function cardTemplate(item, overrideRoutePrefix = null) {
    const prefix = overrideRoutePrefix || item.routePrefix;
    const src = item.cover && item.cover.trim() !== "" ? item.cover : "";
    const bg = getHashGradient(item.title || "A");
    const img = src
      ? `<img src="${src}" alt="Capa: ${item.title}" loading="lazy">`
      : `<div aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold;color:rgba(255,255,255,0.15);background:${bg}">${(item.title || "?").slice(0, 1).toUpperCase()}</div>`;
    const badge = `<span class="category-badge badge-${prefix}" aria-label="${getCategoryLabel(prefix)}">${getCategoryLabel(prefix)}</span>`;
    const tags = (item.tags || [])
      .map(
        (t) =>
          `<button class="tag" onclick="event.preventDefault();location.hash='#/${prefix}?q=${encodeURIComponent(t)}'">${t}</button>`,
      )
      .join("");
    const date = item.date ? `<span>${formatDate(item.date)}</span>` : "";
    return `
      <article class="card">
        <a href="#/${prefix}/${item.slug}" aria-label="Abrir ${item.title}" style="display:contents">
          <div class="cover">${img}${badge}</div>
          <div class="card-body">
            <h3 class="card-title">${item.title}</h3>
            <div class="card-meta">${item.author || ""}${item.author && date ? " • " : ""}${date}</div>
            <div class="tags" onclick="event.stopPropagation()">${tags}</div>
          </div>
        </a>
      </article>`;
  }

  // ==========================================
  // RENDERIZAÇÃO DE PÁGINAS
  // ==========================================

  // 1. Página Inicial
  function renderHome() {
    clearResumeBanner(); // limpa banner de artigo anterior se o usuário voltar
    document.title = "Análises e Ideias | Murilo Quevedo";

    // Cores espelham exatamente os badges dos cards para coerência visual
    const countMeta = [
      {
        n: BOOKS.length,
        label: "Livros",
        route: "livros",
        color: "var(--brand)",
      },
      {
        n: AV.length,
        label: "Audiovisual",
        route: "audiovisual",
        color: "var(--accent)",
      },
      { n: GAMES.length, label: "Jogos", route: "jogos", color: "#f97316" },
      {
        n: CHARS.length,
        label: "Personagens",
        route: "personagens",
        color: "#f43f5e",
      },
    ].filter((c) => c.n > 0);

    const countsHTML =
      countMeta.length > 0
        ? `
      <div class="hero-counts" aria-label="Tamanho do acervo">
        ${countMeta
          .map(
            (c) => `
          <a href="#/${c.route}" class="hero-count-item" style="--stat-color:${c.color}" aria-label="Ver todos: ${c.n} ${c.label}">
            <span class="hero-count-num">${c.n}</span>
            <span class="hero-count-label">${c.label}</span>
          </a>`,
          )
          .join("")}
      </div>`
        : "";

    app.innerHTML = `
      <section class="hero" style="border:none; margin-top:40px;">
        <span class="hero-accent" aria-hidden="true"></span>
        <h2>Acervo de Análises</h2>
        <p style="font-size:1.1rem; color:var(--muted); max-width:700px;">
          Um arquivo de ideias e ensaios sobre literatura, audiovisual, jogos e personagens. Reflexões diretas focadas na obra.
        </p>
        ${countsHTML}
      </section>

      <div class="toolbar" style="margin-top:20px;">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input id="qGlobal" type="search" placeholder="Buscar em todo o acervo..." aria-label="Busca global">
            <kbd class="search-key-hint" aria-hidden="true">/</kbd>
          </div>
          <button id="btnGlobal" class="btn btn-primary">Buscar</button>
        </div>
      </div>

      <p class="section-label" id="sectionLbl" style="margin-top:32px;">Recentes</p>
      <section id="gridGlobal" class="grid"></section>
      <div id="vazioGlobal" class="empty hidden"></div>
    `;
    animatePageIn();

    const input = el("#qGlobal");
    const btn = el("#btnGlobal");
    const grid = el("#gridGlobal");
    const vazio = el("#vazioGlobal");
    const sectionLbl = el("#sectionLbl");
    const recents = sortItems(ALL_ITEMS, "new").slice(0, 8);
    grid.innerHTML = recents.map((item) => cardTemplate(item)).join("");

    function doGlobalSearch() {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        grid.innerHTML = recents.map((item) => cardTemplate(item)).join("");
        vazio.classList.add("hidden");
        if (sectionLbl) sectionLbl.textContent = "Recentes";
        return;
      }
      const filtered = ALL_ITEMS.filter((a) => {
        const hay =
          `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
      if (filtered.length > 0) {
        grid.innerHTML = filtered.map((item) => cardTemplate(item)).join("");
        vazio.classList.add("hidden");
        if (sectionLbl)
          sectionLbl.textContent = `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`;
      } else {
        grid.innerHTML = "";
        vazio.innerHTML = `Nenhum resultado para "<strong>${q}</strong>".`;
        vazio.classList.remove("hidden");
        if (sectionLbl) sectionLbl.textContent = "Sem resultados";
      }
    }

    let debounceTimer;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doGlobalSearch, 300);
    });
    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") doGlobalSearch();
    });
    btn.addEventListener("click", doGlobalSearch);

    scrollTop(); // FIX: home sempre abre no topo ao navegar de volta
  }

  // 2. Listas de Categorias
  function renderList(list, options) {
    clearResumeBanner();
    const { title, subtitle, routePrefix, notice } = options;
    document.title = `${title} — Murilo Quevedo`;
    const searchParam =
      new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";

    app.innerHTML = `
      <section class="hero">
        <h2>${title} <span id="item-count" class="hero-stats small">— ${list.length}</span></h2>
        <p class="small">${subtitle}</p>
      </section>

      ${notice ? `<div class="notice" role="note">${notice}</div>` : ""}

      <div class="toolbar">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input id="q" type="search" placeholder="Buscar título, autor ou tag..." value="${searchParam}">
            <kbd class="search-key-hint" aria-hidden="true">/</kbd>
          </div>
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
    animatePageIn();

    const input = el("#q");
    const sortSel = el("#sortOrder");
    const grid = el("#grid");
    const vazio = el("#vazio");
    const countEl = el("#item-count");

    function applyFilter() {
      const q = (input.value || "").toLowerCase().trim();
      const method = sortSel.value;
      let filtered = list.filter((a) => {
        const hay =
          `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
      filtered = sortItems(filtered, method);
      countEl.textContent = q
        ? `— ${filtered.length} de ${list.length}`
        : `— ${list.length}`;
      if (filtered.length > 0) {
        grid.innerHTML = filtered
          .map((item) => cardTemplate(item, routePrefix))
          .join("");
        vazio.classList.add("hidden");
      } else {
        grid.innerHTML = "";
        const shuffled = [...list].sort(() => 0.5 - Math.random()).slice(0, 3);
        const suggHTML =
          shuffled.length > 0
            ? `<br><br><p>Que tal esses?</p><div class="grid" style="margin-top:16px;text-align:left;">${shuffled.map((i) => cardTemplate(i, routePrefix)).join("")}</div>`
            : "";
        vazio.innerHTML = `Nada encontrado para "<strong>${q}</strong>". ${suggHTML}`;
        vazio.classList.remove("hidden");
      }
      const baseHash = location.hash.split("?")[0];
      const newHash = q ? `${baseHash}?q=${encodeURIComponent(q)}` : baseHash;
      if (location.hash !== newHash) history.replaceState(null, "", newHash);
    }

    input.addEventListener("input", applyFilter);
    sortSel.addEventListener("change", applyFilter);
    applyFilter();

    scrollTop(); // FIX: lista sempre abre no topo ao navegar por categoria
  }

  // 3. Detalhe do Artigo
  async function renderDetail(slug, dataset, folder, pageTitlePrefix) {
    clearResumeBanner();
    if (activeTocCleanup) {
      activeTocCleanup();
      activeTocCleanup = null;
    }

    const item = (dataset || []).find((a) => a.slug === slug);
    if (!item) {
      app.innerHTML = `<div class="empty">Conteúdo não encontrado.</div>`;
      animatePageIn();
      return;
    }
    document.title = `${item.title} — ${pageTitlePrefix} | Murilo Quevedo`;

    const res = await fetch(`${folder}/${slug}.html?ts=${Date.now()}`);
    const html = res.ok
      ? await res.text()
      : "<p>Não foi possível carregar o conteúdo.</p>";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const wordCount = (tempDiv.textContent || "")
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    const coverHTML = item.cover
      ? `
      <div class="article-cover-wrap">
        <div class="article-cover-bg" style="background-image:url('${item.cover}')"></div>
        <img class="article-cover-img" src="${item.cover}" alt="Capa de ${item.title}">
      </div>`
      : "";

    const currentTags = item.tags || [];
    const relatedItems = ALL_ITEMS.filter(
      (a) =>
        a.slug !== item.slug &&
        (a.tags || []).some((t) => currentTags.includes(t)),
    ).slice(0, 3);
    const relatedHTML =
      relatedItems.length > 0
        ? `
      <section class="related-section">
        <h3>Pode te interessar também</h3>
        <div class="grid" style="margin-bottom:0;">
          ${relatedItems.map((i) => cardTemplate(i, i.routePrefix)).join("")}
        </div>
      </section>`
        : "";

    // Ícones SVG inline — stroke="currentColor" herda a cor do elemento pai
    const iEdit = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
    const iCal = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const iClock = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iShare = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
    const iFocus = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
    // Ícones para âncoras de seção
    const iLink = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const iCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

    app.innerHTML = `
      <article class="article">
        <header>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <a class="btn-secondary" href="javascript:history.back()">← Voltar</a>
            <button id="toggleReadingMode" class="btn-leitura">${iFocus} Modo Foco</button>
          </div>
          ${coverHTML}
          <h1>${item.title}</h1>
          <div class="meta">
            ${item.author ? `<span class="meta-label">${iEdit} ${item.author}</span>` : ""}
            ${item.date ? `<span class="meta-label">${iCal} ${formatDate(item.date)}</span>` : ""}
            <span class="read-time">${iClock} ~${readTime} min</span>
          </div>
          <div class="toolbar" style="margin-top:16px;">
            <button class="btn btn-primary" id="shareBtn">${iShare} Compartilhar</button>
          </div>
        </header>

        <div id="toc-container"></div>
        <section class="content" id="article-content"></section>

        <div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--border)">
          <p class="small">Tags: ${(item.tags || []).map((t) => `<span class="tag" style="cursor:default">#${t}</span>`).join(" ")}</p>
        </div>
        ${relatedHTML}
      </article>
    `;
    animatePageIn();

    const contentEl = el("#article-content");
    contentEl.innerHTML = html;

    const headings = contentEl.querySelectorAll("h2");
    if (headings.length > 0) {
      // Atribui IDs e monta sumário.
      // IMPORTANTE: h.textContent é lido ANTES de qualquer filho ser adicionado,
      // por isso as âncoras são criadas em loop separado logo abaixo.
      const tocList = Array.from(headings)
        .map((h, i) => {
          const id = h.id || `secao-${i}`;
          h.id = id;
          return `<li><a href="#" data-target="${id}" class="toc-link">${h.textContent}</a></li>`;
        })
        .join("");

      el("#toc-container").innerHTML = `
        <nav class="toc" aria-label="Índice do artigo">
          <strong>Neste ensaio</strong>
          <ul>${tocList}</ul>
        </nav>`;

      const tocLinks = el("#toc-container").querySelectorAll(".toc-link");
      tocLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const target = document.getElementById(
            link.getAttribute("data-target"),
          );
          if (target)
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      // Rastreamento de seção ativa via scroll
      const headingArr = Array.from(headings);
      function updateActiveToc() {
        const scrollY = window.scrollY + 130;
        let activeId = null;
        for (const h of headingArr) {
          if (h.offsetTop <= scrollY) activeId = h.id;
        }
        tocLinks.forEach((link) =>
          link.classList.toggle(
            "toc-link--active",
            link.getAttribute("data-target") === activeId,
          ),
        );
      }
      window.addEventListener("scroll", updateActiveToc, { passive: true });
      activeTocCleanup = () =>
        window.removeEventListener("scroll", updateActiveToc);
      updateActiveToc();

      // ── Âncoras de seção ──────────────────────────────────────────────
      // Um ícone de link aparece ao hover de cada h2.
      // Copia uma URL com ?section=<id> que o roteador sabe interpretar.
      headings.forEach((h) => {
        const anchor = document.createElement("a");
        anchor.className = "heading-anchor";
        anchor.href = "#";
        anchor.title = "Copiar link para esta seção";
        anchor.setAttribute("aria-label", "Copiar link para esta seção");
        anchor.innerHTML = iLink;

        anchor.addEventListener("click", (e) => {
          e.preventDefault();
          // Monta URL de deep link para a seção específica dentro deste artigo
          const sectionUrl = `${location.origin}${location.pathname}${location.hash.split("?")[0]}?section=${h.id}`;

          const markCopied = () => {
            anchor.innerHTML = iCheck;
            anchor.classList.add("copied");
            setTimeout(() => {
              anchor.innerHTML = iLink;
              anchor.classList.remove("copied");
            }, 1500);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(sectionUrl)
              .then(markCopied)
              .catch(() => prompt("Copie o link:", sectionUrl));
          } else {
            // Fallback para browsers sem Clipboard API
            const ta = document.createElement("textarea");
            Object.assign(ta.style, { position: "fixed", opacity: "0" });
            ta.value = sectionUrl;
            document.body.appendChild(ta);
            ta.select();
            try {
              document.execCommand("copy");
              markCopied();
            } catch {
              prompt("Copie o link:", sectionUrl);
            }
            ta.remove();
          }
        });

        h.appendChild(anchor);
      });
    }

    // Modo Foco
    const btnReading = el("#toggleReadingMode");
    if (btnReading) {
      btnReading.addEventListener("click", () => {
        document.body.classList.toggle("reading-mode");
        const active = document.body.classList.contains("reading-mode");
        btnReading.innerHTML = active
          ? `${iFocus} Sair do Foco`
          : `${iFocus} Modo Foco`;
      });
    }

    // Compartilhar
    const shareBtn = el("#shareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${item.title} | Murilo Quevedo`,
              url: location.href,
            });
          } catch (e) {
            /* cancelado pelo usuário */
          }
        } else {
          try {
            await navigator.clipboard.writeText(location.href);
            shareBtn.innerHTML = `${iShare} Link copiado!`;
            setTimeout(
              () => (shareBtn.innerHTML = `${iShare} Compartilhar`),
              2000,
            );
          } catch (e) {
            console.error("Clipboard indisponível", e);
          }
        }
      });
    }

    // Barra de progresso: zera ao abrir novo artigo
    const bar = document.getElementById("readProgress");
    if (bar) bar.style.width = "0%";

    // ── Scroll inicial ────────────────────────────────────────────────────
    // Se vier de um deep link (?section=id) → scroll para a seção.
    // Caso contrário → topo da página + verifica progresso salvo.
    const sectionParam = new URLSearchParams(
      location.hash.split("?")[1] || "",
    ).get("section");
    if (sectionParam) {
      setTimeout(() => {
        const target = document.getElementById(sectionParam);
        if (target)
          target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } else {
      scrollTop();
      // Exibe banner de retomada se houver progresso salvo > 5%
      try {
        const savedPct = parseFloat(
          localStorage.getItem(`progress:${slug}`) || "0",
        );
        if (savedPct > 5)
          setTimeout(() => showResumeBanner(slug, savedPct), 400);
      } catch (e) {
        /* localStorage pode não estar disponível */
      }
    }
  }

  // ==========================================
  // ROTEAMENTO E EVENTOS GLOBAIS
  // ==========================================

  function router() {
    const h = location.hash.split("?")[0] || "#/";
    const parts = h.split("/");
    const route = parts[1] || "";
    const slug = parts[2];

    if (!route) return renderHome();
    if (route === "livros" && !slug)
      return renderList(BOOKS, {
        title: "Livros",
        subtitle: "Ideias densas sobre obras curtas ou clássicas.",
        routePrefix: "analise",
      });
    if (route === "audiovisual" && !slug)
      return renderList(AV, {
        title: "Audiovisual",
        subtitle: "Ver é pensar.",
        routePrefix: "audiovisual",
      });
    if (route === "jogos" && !slug)
      return renderList(GAMES, {
        title: "Jogos",
        subtitle: "Sentir é a primeira mecânica.",
        routePrefix: "jogo",
      });
    if (route === "personagens" && !slug)
      return renderList(CHARS, {
        title: "Personagens",
        subtitle: "Estudos de personalidade.",
        routePrefix: "personagem",
        notice: "ℹ️ Escritos com apoio de referências externas.",
      });

    if (route === "analise" && slug)
      return renderDetail(slug, BOOKS, "analises", "Livro");
    if (route === "audiovisual" && slug)
      return renderDetail(slug, AV, "audiovisual", "Audiovisual");
    if (route === "jogo" && slug)
      return renderDetail(slug, GAMES, "jogos", "Jogo");
    if (route === "personagem" && slug)
      return renderDetail(slug, CHARS, "personagens", "Personagem");

    renderHome();
  }

  function initReadProgress() {
    const bar = document.getElementById("readProgress");
    if (!bar) return;

    let lastSaveMs = 0; // throttle: salva no máximo a cada 800ms

    const onScroll = () => {
      const cont = document.querySelector(".article .content") || document.body;
      const top = Math.max(0, -cont.getBoundingClientRect().top);
      const total = Math.max(1, cont.scrollHeight - window.innerHeight);
      const pct = Math.min(100, (top / total) * 100);
      bar.style.width = pct + "%";

      // Persiste o progresso de leitura apenas em páginas de artigo
      const now = Date.now();
      if (
        document.querySelector(".article .content") &&
        now - lastSaveMs > 800
      ) {
        lastSaveMs = now;
        const hashParts = location.hash.split("?")[0].split("/");
        const currentSlug = hashParts.length >= 3 ? hashParts[2] : null;
        if (currentSlug) {
          try {
            if (pct >= 95) {
              // Leitura concluída: remove o progresso salvo
              localStorage.removeItem(`progress:${currentSlug}`);
            } else if (pct > 2) {
              localStorage.setItem(`progress:${currentSlug}`, pct.toFixed(1));
            }
          } catch (e) {
            /* quota excedida ou modo privado */
          }
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", () => {
      bar.style.width = "0%";
      setTimeout(onScroll, 50);
    });
    setTimeout(onScroll, 100);
  }

  // Atalho de teclado: "/" foca o campo de busca da página atual
  window.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      const box = document.querySelector('input[type="search"]');
      if (box) {
        box.focus();
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  async function start() {
    initTopButton();
    await loadData();
    window.addEventListener("hashchange", () => {
      router();
      updateNavActive();
    });
    router();
    updateNavActive();
    initReadProgress();
  }

  return { start };
})();

App.start();
