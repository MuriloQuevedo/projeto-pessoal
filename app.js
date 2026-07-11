"use strict";

/* =========================================================================
   MURILO QUEVEDO — GABINETE DE ANÁLISES
   Roteador de hash + renderização das salas e peças do acervo.

   Contrato de dados preservado de propósito (para não exigir migração):
     data/analises.json      → { "analises": [...] }
     data/audiovisual.json   → { "audiovisual": [...] }
     data/jogos.json         → { "jogos": [...] }
     data/personagens.json   → { "personagens": [...] }
     cada item: { title, cover, author, date, tags[], slug }
     conteúdo:  {analises|audiovisual|jogos|personagens}/{slug}.html
   ========================================================================= */

const App = (function () {
  let BOOKS = [];
  let AV = [];
  let GAMES = [];
  let CHARS = [];
  let ALL_ITEMS = [];
  let activeTocCleanup = null;
  let quoteCleanup = null;
  let quoteTooltipEl = null;
  let gridFadeTimer = null;
  let internalNavCount = 0;

  const el = (sel) => document.querySelector(sel);
  const app = el("#app");

  // ==========================================
  // UTILITÁRIOS GERAIS
  // ==========================================

  function esc(str) {
    return String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

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

  function animatePageIn() {
    app.classList.remove("page-enter");
    void app.offsetHeight;
    app.classList.add("page-enter");
  }

  function clearResumeBanner() {
    document.querySelector(".resume-banner")?.remove();
  }

  function clearOverlays() {
    clearResumeBanner();
    document.querySelector(".lightbox-overlay")?.remove();
    if (quoteTooltipEl)
      quoteTooltipEl.classList.remove("quote-tooltip--visible");
    if (quoteCleanup) {
      quoteCleanup();
      quoteCleanup = null;
    }
  }

  function showResumeBanner(slug, savedPct) {
    clearResumeBanner();
    const banner = document.createElement("div");
    banner.className = "resume-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="resume-text">Você parou em ${Math.round(savedPct)}% desta peça</span>
      <button class="resume-btn" id="resumeBtn">Continuar lendo</button>
      <button class="resume-close" id="resumeClose" aria-label="Fechar aviso">✕</button>
    `;
    document.body.appendChild(banner);
    document.getElementById("resumeBtn").addEventListener("click", () => {
      const cont = document.getElementById("article-content");
      if (cont) {
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
    setTimeout(clearResumeBanner, 8000);
  }

  // ── Lightbox ────────────────────────────────────────────────────────────
  function openLightbox(src, alt) {
    document.querySelector(".lightbox-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", alt || "Imagem ampliada");
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="Fechar">&#x2715;</button>
      <img class="lightbox-img" src="${src}" alt="${esc(alt || "")}">
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => overlay.classList.add("lightbox-open")),
    );
    const close = () => {
      overlay.classList.remove("lightbox-open");
      setTimeout(() => overlay.remove(), 260);
      window.removeEventListener("keydown", onKey);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".lightbox-close").addEventListener("click", close);
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
  }

  function initLightbox(contentEl) {
    contentEl.querySelectorAll("img").forEach((img) => {
      img.classList.add("zoomable");
      img.addEventListener("click", () => openLightbox(img.src, img.alt));
    });
  }

  // ── Compartilhar trecho selecionado ────────────────────────────────────
  function initQuoteShare(item) {
    const content = el("#article-content");
    if (!content) return () => {};
    if (!quoteTooltipEl) {
      quoteTooltipEl = document.createElement("div");
      quoteTooltipEl.className = "quote-tooltip";
      document.body.appendChild(quoteTooltipEl);
    }
    const tooltip = quoteTooltipEl;
    const hide = () => tooltip.classList.remove("quote-tooltip--visible");

    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : "";
        if (
          text.length < 10 ||
          !sel ||
          sel.rangeCount === 0 ||
          !content.contains(sel.anchorNode)
        ) {
          hide();
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        tooltip.innerHTML = `<span class="qt-x">&#x1D54F;</span> Compartilhar trecho`;
        tooltip.onclick = () => {
          const q = text.length > 200 ? text.slice(0, 197) + "\u2026" : text;
          const body = `\u201c${q}\u201d \u2014 ${item.title}`;
          window.open(
            `https://x.com/intent/tweet?text=${encodeURIComponent(body)}&url=${encodeURIComponent(location.href)}`,
            "_blank",
            "noopener,noreferrer",
          );
          hide();
        };
        const ttW = 190;
        const left = Math.max(
          8,
          Math.min(
            rect.left + rect.width / 2 - ttW / 2,
            window.innerWidth - ttW - 8,
          ),
        );
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${window.scrollY + rect.top - 54}px`;
        tooltip.classList.add("quote-tooltip--visible");
      }, 20);
    };
    const handleMouseDown = (e) => {
      if (!tooltip.contains(e.target)) hide();
    };

    content.addEventListener("mouseup", handleMouseUp);
    content.addEventListener("touchend", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      content.removeEventListener("mouseup", handleMouseUp);
      content.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      hide();
    };
  }

  // ── Transição suave da grade ────────────────────────────────────────────
  function fadeReplaceGrid(gridEl, html) {
    if (gridFadeTimer) clearTimeout(gridFadeTimer);
    gridEl.style.transition = "opacity 0.12s ease";
    gridEl.style.opacity = "0";
    gridFadeTimer = setTimeout(() => {
      gridEl.innerHTML = html;
      requestAnimationFrame(() => {
        gridEl.style.opacity = "1";
      });
      gridFadeTimer = null;
    }, 130);
  }

  // ── Pequenos ajudantes de conteúdo ──────────────────────────────────────
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return h;
  }

  const PLATE_GRADIENTS = [
    "linear-gradient(160deg,#241f17,#14120e)",
    "linear-gradient(160deg,#2a2015,#14120e)",
    "linear-gradient(160deg,#1e2620,#14120e)",
    "linear-gradient(160deg,#241a1a,#14120e)",
    "linear-gradient(160deg,#1c2224,#14120e)",
  ];

  function plateContent(item) {
    const src = item.cover && item.cover.trim() ? item.cover.trim() : "";
    if (src) {
      return {
        bg: "",
        html: `<img src="${esc(src)}" alt="Capa de ${esc(item.title)}" loading="lazy" decoding="async">`,
      };
    }
    const idx = Math.abs(hashCode(item.title || "A")) % PLATE_GRADIENTS.length;
    const letter = ((item.title || "?").trim()[0] || "?").toUpperCase();
    return {
      bg: PLATE_GRADIENTS[idx],
      html: `<span class="specimen-fallback" aria-hidden="true">${esc(letter)}</span>`,
    };
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "short",
    });
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
    return (
      {
        analise: "Livro",
        audiovisual: "Audiovisual",
        jogo: "Jogo",
        personagem: "Personagem",
      }[prefix] || prefix
    );
  }

  function catColorVar(prefix) {
    return (
      {
        analise: "var(--cat-livros)",
        audiovisual: "var(--cat-av)",
        jogo: "var(--cat-jogos)",
        personagem: "var(--cat-personagens)",
      }[prefix] || "var(--brass)"
    );
  }

  function catalogCode(item, prefix) {
    const letters = {
      analise: "L",
      audiovisual: "A",
      jogo: "J",
      personagem: "P",
    };
    const year = item.date
      ? new Date(item.date + "T00:00:00").getFullYear()
      : "s/d";
    return `${letters[prefix] || "?"} · ${year}`;
  }

  function tagButtons(tags, prefix) {
    return (tags || [])
      .map(
        (t) =>
          `<button class="tag" type="button" data-tag="${esc(t)}" data-prefix="${esc(prefix)}">#${esc(t)}</button>`,
      )
      .join("");
  }

  // ==========================================
  // CABEÇALHO / RODAPÉ / NAVEGAÇÃO
  // ==========================================

  function initNavToggle() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("siteNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }),
    );
  }

  function updateNavActive() {
    const links = document.querySelectorAll(".nav a");
    if (location.pathname.endsWith("sobre.html")) {
      links.forEach((a) =>
        a.classList.toggle(
          "nav-active",
          (a.getAttribute("href") || "") === "sobre.html",
        ),
      );
      return;
    }
    const route = location.hash.split("?")[0].split("/")[1] || "";
    const map = {
      livros: "livros",
      analise: "livros",
      audiovisual: "audiovisual",
      jogos: "jogos",
      jogo: "jogos",
      personagens: "personagens",
      personagem: "personagens",
    };
    const active = map[route] || "";
    links.forEach((a) => {
      const navRoute =
        ((a.getAttribute("href") || "").split("#")[1] || "").split("/")[1] ||
        "";
      a.classList.toggle("nav-active", !!(navRoute && navRoute === active));
    });
  }

  function initYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  /** Pequeno detalhe escondido: o selo do rodapé revela uma nota do arquivista. */
  function initColophon() {
    const btn = document.getElementById("sealBtn");
    const box = document.getElementById("colophon");
    if (!btn || !box) return;
    const close = () => {
      box.hidden = true;
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      box.hidden = !box.hidden;
    });
    document.addEventListener("click", (e) => {
      if (!box.hidden && !box.contains(e.target) && e.target !== btn) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  /** Leve inclinação da porta ao passar o mouse — só com ponteiro fino e sem reduced-motion. */
  function initCabinetTilt() {
    const canHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!canHover || reduced) return;
    document.querySelectorAll(".cabinet-door").forEach((doorEl) => {
      doorEl.addEventListener("mousemove", (e) => {
        const r = doorEl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        doorEl.style.transform = `perspective(600px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg) translateY(-4px)`;
      });
      doorEl.addEventListener("mouseleave", () => {
        doorEl.style.transform = "";
      });
    });
  }

  // ==========================================
  // DADOS
  // ==========================================

  async function fetchJSON(path, key) {
    try {
      const r = await fetch(`${path}?ts=${Date.now()}`);
      if (!r.ok) throw new Error(path);
      return (await r.json())[key] || [];
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
    const tag = (arr, p) => arr.map((i) => ({ ...i, routePrefix: p }));
    ALL_ITEMS = [
      ...tag(BOOKS, "analise"),
      ...tag(AV, "audiovisual"),
      ...tag(GAMES, "jogo"),
      ...tag(CHARS, "personagem"),
    ];
  }

  // ==========================================
  // ESPÉCIME (cartão)
  // ==========================================

  function cardTemplate(item, overridePrefix, i = 0) {
    const prefix = overridePrefix || item.routePrefix;
    const plate = plateContent(item);
    const dateStr = item.date ? formatDate(item.date) : "";
    const meta = [item.author ? esc(item.author) : "", dateStr]
      .filter(Boolean)
      .join(" · ");
    return `
      <article class="specimen" style="--i:${i};--cat:${catColorVar(prefix)}">
        <a class="specimen-link" href="#/${prefix}/${encodeURIComponent(item.slug)}" aria-label="Abrir ${esc(item.title)}">
          <div class="specimen-plate"${plate.bg ? ` style="background:${plate.bg}"` : ""}>
            ${plate.html}
            <span class="specimen-badge">${getCategoryLabel(prefix)}</span>
          </div>
          <div class="specimen-body">
            <p class="specimen-catalog">${catalogCode(item, prefix)}</p>
            <h3 class="specimen-title">${esc(item.title)}</h3>
            ${meta ? `<p class="specimen-meta">${meta}</p>` : ""}
          </div>
        </a>
        ${(item.tags || []).length ? `<div class="specimen-tags">${tagButtons(item.tags, prefix)}</div>` : ""}
      </article>`;
  }

  // ==========================================
  // PÁGINAS
  // ==========================================

  function renderHome() {
    clearOverlays();
    document.title = "Murilo Quevedo — Gabinete de Análises";

    const cabinets = [
      {
        n: BOOKS.length,
        room: "Herbário",
        label: "Livros",
        route: "livros",
        idx: "I",
        cat: "var(--cat-livros)",
      },
      {
        n: AV.length,
        room: "Lanterna Mágica",
        label: "Audiovisual",
        route: "audiovisual",
        idx: "II",
        cat: "var(--cat-av)",
      },
      {
        n: GAMES.length,
        room: "Gabinete de Autômatos",
        label: "Jogos",
        route: "jogos",
        idx: "III",
        cat: "var(--cat-jogos)",
      },
      {
        n: CHARS.length,
        room: "Galeria de Retratos",
        label: "Personagens",
        route: "personagens",
        idx: "IV",
        cat: "var(--cat-personagens)",
      },
    ];
    const cabinetsHTML = cabinets
      .map(
        (c) => `
      <a class="cabinet-door" href="#/${c.route}" style="--cat:${c.cat}">
        <span class="cabinet-index">${c.idx}</span>
        <span class="cabinet-name">${c.room}</span>
        <span class="cabinet-desc">${c.label}</span>
        <span class="cabinet-count">${c.n} peça${c.n === 1 ? "" : "s"}</span>
      </a>`,
      )
      .join("");

    app.innerHTML = `
      <section class="atrium">
        <p class="kicker">Gabinete de Análises</p>
        <h1 class="atrium-title">Onde as obras continuam sendo lidas <em>depois de fechadas.</em></h1>
        <p class="atrium-lede">Ensaios sobre livros, cinema, jogos e os personagens que insistem em ficar. Assinados por Murilo Quevedo.</p>
      </section>
      <nav class="cabinets" aria-label="Coleções do acervo">${cabinetsHTML}</nav>
      <section class="ledger" aria-labelledby="ledgerLbl">
        <p class="section-label" id="ledgerLbl">Últimas peças catalogadas</p>
        <div class="toolbar">
          <div class="search-wrap">
            <input id="qGlobal" type="search" placeholder="Buscar em todo o acervo…" aria-label="Busca global">
            <kbd class="search-key-hint" aria-hidden="true">/</kbd>
          </div>
          <button id="btnGlobal" class="btn btn-primary" type="button">Buscar</button>
        </div>
        <section id="gridGlobal" class="grid" aria-live="polite"></section>
        <div id="vazioGlobal" class="empty hidden"></div>
      </section>
    `;
    animatePageIn();
    initCabinetTilt();

    const input = el("#qGlobal");
    const btn = el("#btnGlobal");
    const grid = el("#gridGlobal");
    const vazio = el("#vazioGlobal");
    const lbl = el("#ledgerLbl");
    const recents = sortItems(ALL_ITEMS, "new").slice(0, 8);
    grid.innerHTML = recents
      .map((item, i) => cardTemplate(item, null, i))
      .join("");

    function doGlobalSearch() {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        fadeReplaceGrid(
          grid,
          recents.map((item, i) => cardTemplate(item, null, i)).join(""),
        );
        vazio.classList.add("hidden");
        lbl.textContent = "Últimas peças catalogadas";
        return;
      }
      const filtered = ALL_ITEMS.filter((a) =>
        `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`
          .toLowerCase()
          .includes(q),
      );
      if (filtered.length > 0) {
        fadeReplaceGrid(
          grid,
          filtered.map((item, i) => cardTemplate(item, null, i)).join(""),
        );
        vazio.classList.add("hidden");
        lbl.textContent = `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`;
      } else {
        grid.innerHTML = "";
        vazio.innerHTML = `Nada catalogado para "<strong>${esc(q)}</strong>".`;
        vazio.classList.remove("hidden");
        lbl.textContent = "Sem resultados";
      }
    }

    let debounceTmr;
    input.addEventListener("input", () => {
      clearTimeout(debounceTmr);
      debounceTmr = setTimeout(doGlobalSearch, 300);
    });
    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") doGlobalSearch();
    });
    btn.addEventListener("click", doGlobalSearch);
    scrollTop();
  }

  function renderList(list, options) {
    clearOverlays();
    const { title, room, subtitle, routePrefix, notice } = options;
    document.title = `${title} — Murilo Quevedo`;
    const searchParam =
      new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";

    app.innerHTML = `
      <section class="sala-header">
        <p class="kicker">${title} <span class="count" id="item-count">· ${list.length} peça${list.length === 1 ? "" : "s"}</span></p>
        <h1 class="sala-title">${room}</h1>
        <p class="sala-lede">${subtitle}</p>
      </section>
      ${notice ? `<p class="curatorial-note"><span class="note-label">Nota curatorial</span>${notice}</p>` : ""}
      <div class="toolbar">
        <div class="search-wrap">
          <input id="q" type="search" placeholder="Buscar título, autor ou tag…" value="${esc(searchParam)}" aria-label="Buscar nesta sala">
          <kbd class="search-key-hint" aria-hidden="true">/</kbd>
        </div>
        <select id="sortOrder" aria-label="Ordenar">
          <option value="new" selected>Mais recentes</option>
          <option value="old">Mais antigas</option>
          <option value="az">A–Z</option>
          <option value="za">Z–A</option>
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
      let filtered = list.filter((a) =>
        `${a.title} ${a.author || ""} ${(a.tags || []).join(" ")}`
          .toLowerCase()
          .includes(q),
      );
      filtered = sortItems(filtered, method);
      countEl.textContent = q
        ? `· ${filtered.length} de ${list.length}`
        : `· ${list.length} peça${list.length === 1 ? "" : "s"}`;
      if (filtered.length > 0) {
        fadeReplaceGrid(
          grid,
          filtered
            .map((item, i) => cardTemplate(item, routePrefix, i))
            .join(""),
        );
        vazio.classList.add("hidden");
      } else {
        grid.innerHTML = "";
        const shuffled = [...list].sort(() => 0.5 - Math.random()).slice(0, 3);
        const suggHTML =
          shuffled.length > 0
            ? `<p style="margin-top:20px">Talvez você goste destas peças:</p><div class="grid grid--tight">${shuffled.map((it, i) => cardTemplate(it, routePrefix, i)).join("")}</div>`
            : "";
        vazio.innerHTML = `Nada catalogado para "<strong>${esc(q)}</strong>". ${suggHTML}`;
        vazio.classList.remove("hidden");
      }
      const base = location.hash.split("?")[0];
      const next = q ? `${base}?q=${encodeURIComponent(q)}` : base;
      if (location.hash !== next) history.replaceState(null, "", next);
    }

    input.addEventListener("input", applyFilter);
    sortSel.addEventListener("change", applyFilter);
    applyFilter();
    scrollTop();
  }

  async function renderDetail(
    slug,
    dataset,
    folder,
    pageTitlePrefix,
    routePrefix,
  ) {
    clearOverlays();
    if (activeTocCleanup) {
      activeTocCleanup();
      activeTocCleanup = null;
    }

    const item = (dataset || []).find((a) => a.slug === slug);
    if (!item) {
      app.innerHTML = `<div class="empty" style="margin-top:60px">Esta peça não está catalogada — ou foi removida do acervo.</div>`;
      animatePageIn();
      return;
    }
    document.title = `${item.title} — ${pageTitlePrefix} | Murilo Quevedo`;

    const res = await fetch(
      `${folder}/${encodeURIComponent(slug)}.html?ts=${Date.now()}`,
    );
    const html = res.ok
      ? await res.text()
      : "<p>Não foi possível carregar esta peça do acervo.</p>";

    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const readTime = Math.max(
      1,
      Math.ceil(
        (tmp.textContent || "").split(/\s+/).filter((w) => w).length / 200,
      ),
    );

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
        <h3>Peças relacionadas</h3>
        <div class="grid grid--tight">${relatedItems.map((it, i) => cardTemplate(it, it.routePrefix, i)).join("")}</div>
      </section>`
        : "";

    const iEdit = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
    const iCal = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const iClock = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iShare = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
    const iFocus = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const iLink = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const iCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

    const plateHTML = item.cover
      ? `<figure class="peca-plate"><img src="${esc(item.cover)}" alt="Peça em exposição: ${esc(item.title)}"></figure>`
      : "";

    app.innerHTML = `
      <article class="peca">
        <div class="peca-toolbar">
          <button class="btn-quiet" id="backBtn" type="button">← Voltar</button>
          <div class="peca-toolbar-actions">
            <button id="toggleReadingMode" class="btn-quiet" type="button">${iFocus} Modo Foco</button>
            <button id="shareBtn" class="btn-quiet" type="button">${iShare} Compartilhar</button>
          </div>
        </div>
        <header class="peca-header">
          <p class="catalog-plaque">${catalogCode(item, routePrefix)} · ${getCategoryLabel(routePrefix)}</p>
          <h1>${esc(item.title)}</h1>
          <div class="meta">
            ${item.author ? `<span class="meta-label">${iEdit} ${esc(item.author)}</span>` : ""}
            ${item.date ? `<span class="meta-label">${iCal} ${formatDate(item.date)}</span>` : ""}
            <span class="read-time">${iClock} ~${readTime} min de leitura</span>
          </div>
        </header>
        ${plateHTML}
        <div class="peca-layout">
          <div id="toc-container"></div>
          <section class="content" id="article-content"></section>
        </div>
        <footer class="peca-footer">
          <p class="tags-line">${tagButtons(item.tags, routePrefix)}</p>
        </footer>
        ${relatedHTML}
      </article>
    `;
    animatePageIn();

    const contentEl = el("#article-content");
    contentEl.innerHTML = html;

    initLightbox(contentEl);
    quoteCleanup = initQuoteShare(item);

    // Sumário
    const headings = contentEl.querySelectorAll("h2");
    if (headings.length > 0) {
      const tocList = Array.from(headings)
        .map((h, i) => {
          const id = h.id || `secao-${i}`;
          h.id = id;
          return `<li><a href="#" data-target="${id}" class="toc-link">${h.textContent}</a></li>`;
        })
        .join("");

      el("#toc-container").innerHTML = `
        <nav class="toc" aria-label="Índice desta peça">
          <strong>Neste ensaio</strong><ul>${tocList}</ul>
        </nav>`;

      const tocLinks = el("#toc-container").querySelectorAll(".toc-link");
      tocLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          document
            .getElementById(link.getAttribute("data-target"))
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      const headingArr = Array.from(headings);
      function updateActiveToc() {
        const sy = window.scrollY + 130;
        let activeId = null;
        for (const h of headingArr) {
          if (h.offsetTop <= sy) activeId = h.id;
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

      // Âncoras de seção
      headings.forEach((h) => {
        const a = document.createElement("a");
        a.className = "heading-anchor";
        a.href = "#";
        a.title = "Copiar link desta seção";
        a.setAttribute("aria-label", "Copiar link para esta seção");
        a.innerHTML = iLink;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const url = `${location.origin}${location.pathname}${location.hash.split("?")[0]}?section=${h.id}`;
          const ok = () => {
            a.innerHTML = iCheck;
            a.classList.add("copied");
            setTimeout(() => {
              a.innerHTML = iLink;
              a.classList.remove("copied");
            }, 1500);
          };
          if (navigator.clipboard?.writeText) {
            navigator.clipboard
              .writeText(url)
              .then(ok)
              .catch(() => prompt("Copie:", url));
          } else {
            const ta = Object.assign(document.createElement("textarea"), {
              value: url,
            });
            Object.assign(ta.style, { position: "fixed", opacity: "0" });
            document.body.appendChild(ta);
            ta.select();
            try {
              document.execCommand("copy");
              ok();
            } catch {
              prompt("Copie:", url);
            }
            ta.remove();
          }
        });
        h.appendChild(a);
      });
    }

    // Voltar (inteligente: só usa o histórico se a navegação começou aqui dentro)
    el("#backBtn")?.addEventListener("click", () => {
      if (internalNavCount > 0) history.back();
      else location.hash = "#/";
    });

    // Modo Foco
    const btnR = el("#toggleReadingMode");
    if (btnR) {
      btnR.addEventListener("click", () => {
        document.body.classList.toggle("reading-mode");
        btnR.innerHTML = document.body.classList.contains("reading-mode")
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
          } catch {}
        } else {
          try {
            await navigator.clipboard.writeText(location.href);
            shareBtn.innerHTML = `${iShare} Link copiado!`;
            setTimeout(() => {
              shareBtn.innerHTML = `${iShare} Compartilhar`;
            }, 2000);
          } catch (e) {
            console.error(e);
          }
        }
      });
    }

    const bar = document.getElementById("readProgress");
    if (bar) bar.style.width = "0%";

    const sectionParam = new URLSearchParams(
      location.hash.split("?")[1] || "",
    ).get("section");
    if (sectionParam) {
      setTimeout(
        () =>
          document
            .getElementById(sectionParam)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        150,
      );
    } else {
      scrollTop();
      try {
        const pct = parseFloat(localStorage.getItem(`progress:${slug}`) || "0");
        if (pct > 5) setTimeout(() => showResumeBanner(slug, pct), 400);
      } catch {}
    }
  }

  // ==========================================
  // ROTEADOR
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
        room: "Herbário",
        subtitle: "Onde ideias densas são prensadas e guardadas.",
        routePrefix: "analise",
      });
    if (route === "audiovisual" && !slug)
      return renderList(AV, {
        title: "Audiovisual",
        room: "Lanterna Mágica",
        subtitle: "Imagens que continuam se movendo depois da tela apagar.",
        routePrefix: "audiovisual",
      });
    if (route === "jogos" && !slug)
      return renderList(GAMES, {
        title: "Jogos",
        room: "Gabinete de Autômatos",
        subtitle: "Toda mecânica esconde uma intenção.",
        routePrefix: "jogo",
      });
    if (route === "personagens" && !slug)
      return renderList(CHARS, {
        title: "Personagens",
        room: "Galeria de Retratos",
        subtitle: "Retratos de quem nunca existiu — e ainda assim nos molda.",
        routePrefix: "personagem",
        notice:
          "Alguns retratos foram compostos com apoio de referências externas sobre as obras originais.",
      });
    if (route === "analise" && slug)
      return renderDetail(slug, BOOKS, "analises", "Livro", "analise");
    if (route === "audiovisual" && slug)
      return renderDetail(
        slug,
        AV,
        "audiovisual",
        "Audiovisual",
        "audiovisual",
      );
    if (route === "jogo" && slug)
      return renderDetail(slug, GAMES, "jogos", "Jogo", "jogo");
    if (route === "personagem" && slug)
      return renderDetail(
        slug,
        CHARS,
        "personagens",
        "Personagem",
        "personagem",
      );
    renderHome();
  }

  // ==========================================
  // LINHA DE BRASA (progresso de leitura)
  // ==========================================

  function initReadProgress() {
    const bar = document.getElementById("readProgress");
    if (!bar) return;
    let lastSaveMs = 0;
    const onScroll = () => {
      const cont = document.getElementById("article-content") || document.body;
      const top = Math.max(0, -cont.getBoundingClientRect().top);
      const total = Math.max(1, cont.scrollHeight - window.innerHeight);
      const pct = Math.min(100, (top / total) * 100);
      bar.style.width = pct + "%";
      const now = Date.now();
      if (
        document.getElementById("article-content") &&
        now - lastSaveMs > 800
      ) {
        lastSaveMs = now;
        const parts = location.hash.split("?")[0].split("/");
        const s = parts.length >= 3 ? parts[2] : null;
        if (s) {
          try {
            if (pct >= 95) localStorage.removeItem(`progress:${s}`);
            else if (pct > 2)
              localStorage.setItem(`progress:${s}`, pct.toFixed(1));
          } catch {}
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

  // Atalho "/" para focar a busca, em qualquer página
  window.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      const b = document.querySelector('input[type="search"]');
      if (b) {
        b.focus();
        b.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================

  async function start() {
    initTopButton();
    initNavToggle();
    initColophon();
    initYear();

    // Filtro por tag, delegado — funciona em qualquer cartão, em qualquer página
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest(".tag[data-tag]");
      if (t)
        location.hash = `#/${t.dataset.prefix}?q=${encodeURIComponent(t.dataset.tag)}`;
    });

    if (app) {
      // index.html: aplicativo completo, roteado por hash
      await loadData();
      window.addEventListener("hashchange", () => {
        internalNavCount++;
        router();
        updateNavActive();
      });
      router();
      updateNavActive();
    } else {
      // páginas estáticas (ex.: sobre.html) só recebem o cromo comum
      updateNavActive();
    }
    initReadProgress();
  }

  return { start };
})();

App.start();
