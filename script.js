document.addEventListener("DOMContentLoaded", () => {
  // Ensure nav merch links have an inner label for layered jersey styling.
  document.querySelectorAll("a.nav-merch").forEach((link) => {
    if (link.querySelector(".nav-merch-label")) return;
    const labelText = (link.textContent || "Merch").trim() || "Merch";
    link.textContent = "";
    const label = document.createElement("span");
    label.className = "nav-merch-label";
    label.textContent = labelText;
    link.appendChild(label);
  });

  // ----- Shared player card source of truth -----
  // Source now lives in /players.json for easy non-code updates.

  function normalizeName(value) {
    return (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function deriveInitials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "N/A";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function isCaptainInContext(playerName, year) {
    const normalized = normalizeName(playerName);
    if (normalized !== normalizeName("Grant Miller")) return false;
    // Requested contexts: main roster page and 2025 history tab.
    if (year === "2025") return true;
    if (!year) return true;
    return false;
  }

  function buildPlayerMap(players) {
    const byName = new Map();
    players.forEach((player) => {
      byName.set(normalizeName(player.name), player);
      (player.aliases || []).forEach((alias) => {
        byName.set(normalizeName(alias), player);
      });
    });
    return byName;
  }

  function setCardAvatar(avatarEl, player, altName) {
    if (!avatarEl || !player) return;
    if (player.image) {
      avatarEl.classList.add("avatar-photo");
      avatarEl.innerHTML = `<img src="${player.image}" alt="${altName} headshot" loading="lazy">`;
      return;
    }
    avatarEl.classList.remove("avatar-photo");
    avatarEl.textContent = player.initials || deriveInitials(altName);
  }

  function syncSharedPlayerCards(playerByName) {
    if (!playerByName || playerByName.size === 0) return;

    // Roster cards (main roster style)
    const rosterCards = document.querySelectorAll(
      '.roster-panel[data-roster="first-team"] .roster-card:not(.coaching-card)'
    );
    rosterCards.forEach((card) => {
      const first = card.querySelector(".roster-first-name");
      const last = card.querySelector(".roster-last-name");
      if (!first || !last) return;
      const fullName = `${first.textContent?.trim() || ""} ${last.textContent?.trim() || ""}`.trim();
      const player = playerByName.get(normalizeName(fullName));
      if (!player) return;

      const canonicalParts = player.name.split(" ");
      first.textContent = canonicalParts[0] || player.name;
      const lastName = canonicalParts.slice(1).join(" ") || canonicalParts[0];
      const showCaptain = isCaptainInContext(player.name);
      last.innerHTML = `${lastName}${showCaptain ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : ''}`;

      setCardAvatar(card.querySelector(".history-avatar"), player, player.name);

      if (player.roster) {
        const numberEl = card.querySelector(".roster-number");
        const positionEl = card.querySelector(".roster-position");
        const appsEl = card.querySelector(".roster-appearances");
        if (numberEl) numberEl.textContent = player.roster.number || "#TBD";
        if (positionEl) positionEl.textContent = player.roster.position || "N/A";
        if (appsEl) appsEl.textContent = `${player.roster.appearances ?? 0} All-Time Apps.`;
      }
    });

    // History/records cards (sync name + avatar for the same player everywhere)
    const historyNameEls = document.querySelectorAll(".history-player .history-name");
    historyNameEls.forEach((nameEl) => {
      const nameText = nameEl.textContent?.trim() || "";
      const player = playerByName.get(normalizeName(nameText));
      if (!player) return;
      nameEl.textContent = player.name;
      const card = nameEl.closest(".history-player");
      const avatarEl = card?.querySelector(".history-avatar");
      setCardAvatar(avatarEl, player, player.name);
    });

    formatHistoryRosterCards(playerByName);
  }

  function formatHistoryRosterCards(playerByName) {
    const historyCards = document.querySelectorAll(
      '.history-panel[data-year="2025"] .history-roster .history-player:not(.coaching-card), .history-panel[data-year="2026"] .history-roster .history-player:not(.coaching-card)'
    );

    historyCards.forEach((card) => {
      const nameEl = card.querySelector(".history-name");
      const subtextEl = card.querySelector(".history-subtext");
      if (!nameEl || !subtextEl) return;

      const historyPanel = card.closest(".history-panel");
      const year = historyPanel?.getAttribute("data-year");
      const fullName = nameEl.textContent.trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length > 0) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || nameParts[0];
        const showCaptain = isCaptainInContext(fullName, year);
        nameEl.innerHTML = `<span class="history-first-name">${firstName}</span><span class="history-last-name">${lastName}${showCaptain ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : ''}</span>`;
      }

      const normalizedName = normalizeName(fullName);
      const mappedPlayer = playerByName?.get(normalizedName);
      const existingNumberPill = subtextEl.querySelector(".history-number-pill");
      const existingPositionPill = subtextEl.querySelector(".history-position-pill");
      const existingAppsPill = subtextEl.querySelector(".history-apps-pill");
      let numberPart = "#TBD";
      let positionPart = "N/A";
      let appsValue;
      if (year === "2026") {
        appsValue = 0;
      } else if (year === "2025") {
        appsValue = mappedPlayer?.seasons?.["2025"]?.appearances
          ?? mappedPlayer?.roster?.appearances
          ?? 0;
      } else {
        appsValue = mappedPlayer?.roster?.appearances ?? 0;
      }
      let appsPart = `${appsValue} Apps`;

      if (existingNumberPill && existingPositionPill) {
        numberPart = existingNumberPill.textContent.trim() || numberPart;
        positionPart = existingPositionPill.textContent.trim() || positionPart;
        if (existingAppsPill && year !== "2025" && year !== "2026") {
          appsPart = existingAppsPill.textContent.trim() || appsPart;
        }
      } else {
        const [numberPartRaw, positionPartRaw] = subtextEl.textContent.split("|");
        numberPart = (numberPartRaw || numberPart).trim();
        positionPart = (positionPartRaw || positionPart).trim();
      }

      subtextEl.innerHTML = `<span class="history-pill history-number-pill">${numberPart}</span><span class="history-pill history-position-pill">${positionPart}</span><span class="history-pill history-apps-pill">${appsPart}</span>`;
    });
  }

  function loadAndSyncSharedPlayerCards() {
    fetch("/players.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load players.json (${r.status})`);
        return r.json();
      })
      .then((players) => {
        if (!Array.isArray(players)) return;
        syncSharedPlayerCards(buildPlayerMap(players));
      })
      .catch((err) => {
        console.error("Error loading player card data:", err);
      });
  }

  loadAndSyncSharedPlayerCards();

  function formatBlogDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  // ----- Load blog data from blogs.json -----
  let blogPosts = [];

  fetch("/blogs.json")
    .then((r) => r.json())
    .then((data) => {
      blogPosts = data;

      // Initialize hero rotation if on the home page
      if (heroContent && heroTitle && heroSubtitle && heroButton) {
        updateHeroContent();
        setInterval(() => fadeOutAndUpdate(), 8000);
      }

      // Initialize blog list if on the news page
      if (blogList && searchInput && categoryFilter) {
        renderBlogs(blogPosts);
      }

      // Initialize related posts if on a blog post page
      if (relatedPostsGrid) {
        renderRelatedPosts(blogPosts);
      }

      // Initialize latest news on the homepage
      if (latestNewsGrid) {
        renderLatestNews(blogPosts);
      }
    })
    .catch((err) => console.error("Error loading blog data:", err));

  // ----- Hero rotation -----
  const heroContent = document.getElementById("hero-content");
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  const heroButton = document.getElementById("hero-button");
  let currentIndex = 0;

  function fadeOutAndUpdate() {
    if (!heroContent) return;
    heroContent.classList.add("fade-out");
    setTimeout(() => {
      updateHeroContent();
      heroContent.classList.remove("fade-out");
      heroContent.classList.add("fade-in");
      setTimeout(() => heroContent.classList.remove("fade-in"), 1000);
    }, 1000);
  }

  function updateHeroContent() {
    if (blogPosts.length === 0 || !heroTitle || !heroSubtitle || !heroButton)
      return;
    const post = blogPosts[currentIndex];
    heroTitle.textContent = post.title;
    heroSubtitle.textContent = post.excerpt;
    heroButton.href = post.link;
    currentIndex = (currentIndex + 1) % blogPosts.length;
  }

  // ----- Global ticker (all pages, synced position) -----
  const TICKER_DURATION_MS = 28000;
  const DEFAULT_TICKER_ITEMS = [
    "Firelands United launches women's first team for 2026 season",
    "Firelands United launches women's first team for 2026 season"
  ];

  let ticker = document.querySelector(".news-ticker");
  const navbar = document.querySelector(".navbar");

  if (!ticker && navbar) {
    ticker = document.createElement("section");
    ticker.className = "news-ticker";
    ticker.innerHTML = '<div class="news-ticker-track"></div>';
    navbar.insertAdjacentElement("afterend", ticker);
  }

  if (ticker) {
    const tickerTrack = ticker.querySelector(".news-ticker-track");
    if (tickerTrack) {
      const itemA = ticker.getAttribute("data-ticker-text");
      const itemB = ticker.getAttribute("data-ticker-text-2");
      const messages = [itemA, itemB].filter(Boolean);
      const activeMessages = messages.length > 0 ? messages : DEFAULT_TICKER_ITEMS;
      const baseItems = [];

      // Keep the ticker train long enough on every page (including pages with only one headline set).
      while (baseItems.length < 4) {
        const nextItem = activeMessages[baseItems.length % activeMessages.length];
        baseItems.push(nextItem);
      }

      tickerTrack.innerHTML = "";
      baseItems.forEach((msg, idx) => {
        const item = document.createElement("span");
        item.className = "news-ticker-item";
        if (idx > 0) item.setAttribute("aria-hidden", "true");
        item.textContent = msg;
        tickerTrack.appendChild(item);
      });

      const originals = Array.from(tickerTrack.querySelectorAll(".news-ticker-item"));
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        tickerTrack.appendChild(clone);
      });

      // Keep the ticker at a global position across page navigations.
      const offsetMs = Date.now() % TICKER_DURATION_MS;
      tickerTrack.style.animationDelay = `-${offsetMs}ms`;
    }
  }

  // ----- Hamburger menu -----
  const hamburger = document.getElementById("hamburger-menu");
  const navLinks = document.getElementById("nav-links");
  const navDropdowns = document.querySelectorAll(".nav-dropdown");
  const navDropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("show");
      hamburger.classList.toggle("active");
      if (!navLinks.classList.contains("show")) {
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
      }
      document.body.style.overflow = navLinks.classList.contains("show")
        ? "hidden"
        : "";
    });

    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
        document.body.style.overflow = "";
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
        document.body.style.overflow = "";
      }
    });
  }

  if (navDropdownToggles.length > 0) {
    navDropdownToggles.forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        if (window.innerWidth > 768) return;
        e.preventDefault();
        const parentDropdown = toggle.closest(".nav-dropdown");
        if (!parentDropdown) return;
        parentDropdown.classList.toggle("open");
      });
    });
  }

  // ----- Men's history year tabs -----
  const yearTabs = document.querySelectorAll(".year-tab");
  const yearPanels = document.querySelectorAll(".history-panel");

  if (yearTabs.length > 0 && yearPanels.length > 0) {
    yearTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetYear = tab.getAttribute("data-year");
        if (!targetYear) return;

        yearTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        yearPanels.forEach((panel) => {
          const isMatch = panel.getAttribute("data-year") === targetYear;
          panel.classList.toggle("active", isMatch);
        });
      });
    });
  }

  // ----- Roster page tabs -----
  const rosterTabs = document.querySelectorAll(".roster-tab");
  const rosterPanels = document.querySelectorAll(".roster-panel");

  if (rosterTabs.length > 0 && rosterPanels.length > 0) {
    rosterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetRoster = tab.getAttribute("data-roster");
        if (!targetRoster) return;

        rosterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        rosterPanels.forEach((panel) => {
          const isMatch = panel.getAttribute("data-roster") === targetRoster;
          panel.classList.toggle("active", isMatch);
        });
      });
    });
  }

  // ----- Blog list/search (news page) -----
  const blogList = document.getElementById("blog-list");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");

  function renderBlogs(items) {
    blogList.innerHTML = "";
    if (items.length === 0) {
      blogList.innerHTML = '<p class="no-results">No posts found.</p>';
      return;
    }
    items.forEach((blog) => {
      const card = document.createElement("a");
      card.classList.add("blog-card");
      card.href = blog.link;
      const imgSrc = blog.image || "/img/blogs/default.jpg";
      const category = blog.category || "Club News";
      const publishDate = formatBlogDate(blog.date);
      card.innerHTML = `
        <div class="blog-card-image">
          <img src="${imgSrc}" alt="${blog.title}">
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta">
            <span class="blog-card-category">${category}</span>
            <span class="blog-card-date">${publishDate}</span>
          </div>
          <h3 class="blog-card-title">${blog.title}</h3>
          <p class="blog-card-excerpt">${blog.excerpt}</p>
        </div>`;
      blogList.appendChild(card);
    });
  }

  function filterBlogs() {
    const searchText = searchInput.value.toLowerCase();
    const selected = categoryFilter.value;
    const filtered = blogPosts.filter((b) => {
      const matchesSearch = b.title.toLowerCase().includes(searchText);
      const matchesCat =
        selected === "all" || (b.category || "").toLowerCase() === selected;
      return matchesSearch && matchesCat;
    });
    renderBlogs(filtered);
  }

  if (searchInput && categoryFilter) {
    searchInput.addEventListener("input", filterBlogs);
    categoryFilter.addEventListener("change", filterBlogs);
  }

  // ----- Related posts (blog post pages) -----
  const relatedPostsGrid = document.getElementById("related-posts-grid");

  function renderRelatedPosts(allPosts) {
    if (!relatedPostsGrid || allPosts.length === 0) return;

    // Get the current page path
    const currentPath = window.location.pathname;

    // Filter out the current post and pick up to 3 others
    const otherPosts = allPosts.filter(
      (p) =>
        p.link !== currentPath &&
        p.link !== currentPath.replace(/\/$/, "") &&
        p.link + "/" !== currentPath
    );

    // Show up to 3 related posts (newest first, already sorted from blogs.json)
    const postsToShow = otherPosts.slice(0, 3);

    if (postsToShow.length === 0) {
      relatedPostsGrid.closest(".related-posts").style.display = "none";
      return;
    }

    relatedPostsGrid.innerHTML = "";
    postsToShow.forEach((post) => {
      const card = document.createElement("a");
      card.classList.add("related-card");
      card.href = post.link;
      const imgSrc = post.image || "/img/blogs/default.jpg";
      const category = post.category || "Club News";
      const publishDate = formatBlogDate(post.date);
      card.innerHTML = `
        <div class="related-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="related-card-body">
          <div class="related-card-meta">
            <span class="related-card-category">${category}</span>
            <span class="related-card-date">${publishDate}</span>
          </div>
          <h3 class="related-card-title">${post.title}</h3>
          <p class="related-card-excerpt">${post.excerpt}</p>
        </div>`;
      relatedPostsGrid.appendChild(card);
    });
  }

  // ----- Latest news (homepage) -----
  const latestNewsGrid = document.getElementById("latest-news-grid");
  const latestNewsScroll = latestNewsGrid
    ? latestNewsGrid.closest(".latest-news-scroll")
    : null;

  function renderLatestNews(allPosts) {
    if (!latestNewsGrid || allPosts.length === 0) return;

    // Show a wider set for horizontal scrolling on the homepage.
    const postsToShow = allPosts.slice(0, 12);

    latestNewsGrid.innerHTML = "";
    postsToShow.forEach((post) => {
      const card = document.createElement("a");
      card.classList.add("latest-news-card");
      card.href = post.link;
      const imgSrc = post.image || "/img/blogs/default.jpg";
      const category = post.category || "Club News";
      const publishDate = formatBlogDate(post.date);
      card.innerHTML = `
        <div class="latest-news-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="latest-news-card-body">
          <div class="latest-news-card-meta">
            <span class="latest-news-card-category">${category}</span>
            <span class="latest-news-card-date">${publishDate}</span>
          </div>
          <h3 class="latest-news-card-title">${post.title}</h3>
          <p class="latest-news-card-excerpt">${post.excerpt}</p>
        </div>`;
      latestNewsGrid.appendChild(card);
    });

    updateLatestNewsHint();
  }

  function updateLatestNewsHint() {
    if (!latestNewsGrid || !latestNewsScroll) return;

    const maxScrollLeft = latestNewsGrid.scrollWidth - latestNewsGrid.clientWidth;
    const noOverflow = maxScrollLeft <= 4;
    const atEnd = latestNewsGrid.scrollLeft >= maxScrollLeft - 4;

    latestNewsScroll.classList.toggle("no-overflow", noOverflow);
    latestNewsScroll.classList.toggle("at-end", atEnd);
  }

  if (latestNewsGrid && latestNewsScroll) {
    latestNewsGrid.addEventListener("scroll", updateLatestNewsHint, { passive: true });
    window.addEventListener("resize", updateLatestNewsHint);
  }

  // ----- Merch slider (homepage) -----
  const SHOPIFY_BASE_URL = 'https://firelandsunited.myshopify.com';
  const SHOPIFY_CDN = 'https://firelandsunited.myshopify.com/cdn/shop/files';

  const merchProducts = [
    {
      name: 'Firelands United Inaugural 2025 Home Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-home-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_165116.png?v=1769176652`
    },
    {
      name: 'Firelands United Inaugural 2025 Away Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-away-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_164816.png?v=1769176668`
    },
    {
      name: 'Firelands United 2025 Keeper Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-keeper-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_164603.png?v=1769176923`
    },
    {
      name: 'Firelands United Official Training Top',
      price: '$20.00',
      slug: 'firelands-united-official-training-top',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_155602.png?v=1769111034`
    },
    {
      name: '"Up the Lands" Sweatshirt',
      price: '$30.00',
      slug: 'up-the-lands-sweatshirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_154737.png?v=1769111153`
    },
    {
      name: '"Up the Lands" Zipper Hoodie',
      price: '$30.00',
      slug: 'up-the-lands-zipper-hoodie',
      image: `${SHOPIFY_CDN}/2_6a919dc5-f053-4d26-a9d0-4911b128c568.png?v=1769115505`
    },
    {
      name: 'Firelands United Badge Sweatshirt',
      price: '$30.00',
      slug: 'firelands-united-badge-sweatshirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_155044.png?v=1769111402`
    },
    {
      name: 'Firelands United Badge Orange & White Sweatshirt',
      price: '$30.00',
      slug: 'firelands-united-badge-orange-white-sweatshirt',
      image: `${SHOPIFY_CDN}/1_1fb98661-5832-438a-bdd6-20402c7faa7f.png?v=1769114427`
    },
    {
      name: 'Long Sleeve Firelands United Pullover',
      price: '$35.00',
      slug: 'long-sleeve-firelands-united-pullover',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152158.png?v=1769114809`
    },
    {
      name: '"Up the Lands" Crewneck - Blemished Collection',
      price: '$15.00',
      slug: 'up-the-lands-crewneck-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152415.png?v=1769115136`
    },
    {
      name: 'FUFC Hoodie - Blemished Collection',
      price: '$15.00',
      slug: 'fufc-hoodie-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152607.png?v=1769116449`
    },
    {
      name: 'Silky "Up the Lands" Hoodie - Blemished Collection',
      price: '$15.00',
      slug: 'silky-up-the-lands-hoodie-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152513.png?v=1769115886`
    },
    {
      name: 'Youth Firelands United T-Shirt',
      price: '$13.00',
      slug: 'youth-firelands-united-t-shirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_163016.png?v=1769177174`
    }
  ];

  const merchTrack = document.getElementById('merch-track');
  const merchDotsContainer = document.getElementById('merch-dots');
  const merchTrackWrapper = merchTrack
    ? merchTrack.closest('.merch-track-wrapper')
    : null;

  if (merchTrack && merchDotsContainer && merchTrackWrapper) {
    let merchIndex = 0;
    let cardsPerView = window.innerWidth <= 768 ? 1 : 3;
    const merchGap = 24;

    // Render product cards
    function renderMerchCards() {
      merchTrack.innerHTML = '';
      merchProducts.forEach((product) => {
        const card = document.createElement('a');
        card.classList.add('merch-card');
        card.href = `${SHOPIFY_BASE_URL}/products/${product.slug}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.innerHTML = `
          <div class="merch-card-image">
            <img src="${product.image}&width=600" alt="${product.name}">
          </div>
          <div class="merch-card-body">
            <div class="merch-card-name">${product.name}</div>
            <div class="merch-card-price">${product.price}</div>
          </div>`;
        merchTrack.appendChild(card);
      });
    }

    // Total number of slide positions (page-step)
    function getMaxIndex() {
      return Math.ceil(merchProducts.length / cardsPerView) - 1;
    }

    function setMerchCardWidths() {
      const wrapperWidth = merchTrackWrapper.clientWidth;
      const cardWidth =
        (wrapperWidth - merchGap * (cardsPerView - 1)) / cardsPerView;
      const cards = merchTrack.querySelectorAll('.merch-card');
      cards.forEach((card) => {
        card.style.flex = `0 0 ${cardWidth}px`;
      });
    }

    // Render dot indicators
    function renderMerchDots() {
      merchDotsContainer.innerHTML = '';
      const totalDots = getMaxIndex() + 1;
      for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('button');
        dot.classList.add('merch-dot');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        if (i === merchIndex) dot.classList.add('active');
        dot.addEventListener('click', () => {
          scrollMerchToIndex(i);
        });
        merchDotsContainer.appendChild(dot);
      }
    }

    // Update slider controls and dot state based on native scroll position
    function updateMerchSlider() {
      const maxIndex = getMaxIndex();
      merchIndex = Math.round(merchTrackWrapper.scrollLeft / merchTrackWrapper.clientWidth);
      merchIndex = Math.max(0, Math.min(merchIndex, maxIndex));

      // Update arrow states
      const leftArrow = document.querySelector('.merch-arrow-left');
      const rightArrow = document.querySelector('.merch-arrow-right');
      if (leftArrow) leftArrow.disabled = merchIndex === 0;
      if (rightArrow) rightArrow.disabled = merchIndex >= maxIndex;

      // Update dots
      const dots = merchDotsContainer.querySelectorAll('.merch-dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === merchIndex);
      });
    }

    function scrollMerchToIndex(index) {
      const clampedIndex = Math.max(0, Math.min(index, getMaxIndex()));
      merchTrackWrapper.scrollTo({
        left: clampedIndex * merchTrackWrapper.clientWidth,
        behavior: 'smooth'
      });
    }

    // Arrow event listeners
    const merchLeftArrow = document.querySelector('.merch-arrow-left');
    const merchRightArrow = document.querySelector('.merch-arrow-right');

    if (merchLeftArrow) {
      merchLeftArrow.addEventListener('click', () => {
        scrollMerchToIndex(merchIndex - 1);
      });
    }

    if (merchRightArrow) {
      merchRightArrow.addEventListener('click', () => {
        scrollMerchToIndex(merchIndex + 1);
      });
    }

    merchTrackWrapper.addEventListener('scroll', updateMerchSlider, { passive: true });

    // Handle window resize
    window.addEventListener('resize', () => {
      const newCardsPerView = window.innerWidth <= 768 ? 1 : 3;
      if (newCardsPerView !== cardsPerView) {
        cardsPerView = newCardsPerView;
      }
      setMerchCardWidths();
      renderMerchDots();
      scrollMerchToIndex(0);
      updateMerchSlider();
    });

    // Initialize
    renderMerchCards();
    setMerchCardWidths();
    renderMerchDots();
    updateMerchSlider();
  }

  // ----- Reusable Instagram feed renderer -----
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInstagramCards(container, posts, profile) {
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = '<p class="instagram-feed-empty">No recent posts yet.</p>';
      return;
    }

    const profileImage = profile?.profile_picture_url || "/img/firelands-badge.png";
    const username = profile?.username || "firelandsunited";

    container.innerHTML = posts.map((post) => {
      const imageUrl = post.image_url || "";
      const caption = escapeHtml(post.caption || "View this post on Instagram");
      const permalink = post.permalink || "https://www.instagram.com/firelandsunited/";
      const timestamp = post.timestamp
        ? new Date(post.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        : "";

      return `
        <a class="instagram-card" href="${permalink}" target="_blank" rel="noopener noreferrer">
          <div class="instagram-card-top">
            <span class="instagram-card-dot" aria-hidden="true"><img src="${profileImage}" alt="${username} profile photo" loading="lazy"></span>
            <span class="instagram-card-handle">${username}</span>
          </div>
          <div class="instagram-card-media">
            <img src="${imageUrl}" alt="${caption}" loading="lazy">
          </div>
          <div class="instagram-card-body">
            <div class="instagram-card-actions" aria-hidden="true">♡ ○ ⤴</div>
            <p class="instagram-card-caption">${caption}</p>
            <span class="instagram-card-date">${timestamp}</span>
          </div>
        </a>`;
    }).join("");
  }

  function initInstagramFeeds() {
    const feedContainers = document.querySelectorAll("[data-instagram-feed]");
    if (!feedContainers.length) return;

    feedContainers.forEach((container) => {
      const endpoint = container.getAttribute("data-instagram-feed-endpoint");
      const limit = Number(container.getAttribute("data-instagram-feed-limit") || 6);
      if (!endpoint) {
        container.innerHTML = '<p class="instagram-feed-empty">Instagram feed endpoint is not set.</p>';
        return;
      }

      container.innerHTML = '<p class="instagram-feed-loading">Loading recent posts...</p>';

      fetch(`${endpoint}?limit=${encodeURIComponent(limit)}`)
        .then((response) => {
          if (!response.ok) throw new Error("Instagram feed request failed");
          return response.json();
        })
        .then((data) => {
          renderInstagramCards(container, data.posts || [], data.profile || {});
        })
        .catch(() => {
          container.innerHTML = '<p class="instagram-feed-empty">Could not load Instagram posts right now.</p>';
        });
    });
  }

  initInstagramFeeds();

  // ----- Newsletter form (Google Sheets) -----
  const newsletterForm = document.getElementById("newsletter-form");
  var GOOGLE_SHEET_URL =
    "https://script.google.com/macros/s/AKfycbzXK4eHP3ZDeX8Kmakwx0wtuNwKpuSueW2wf8TmxSj3s4KlA0oiUfXjPzT99s7fvwQgjg/exec";

  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("newsletter-email");
      const email = emailInput.value;
      const submitBtn = newsletterForm.querySelector(".newsletter-btn");

      // Disable the button while submitting
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      // Send to Google Sheets
      fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email }),
      })
        .then(() => {
          // Show success message
          const container = newsletterForm.parentElement;
          newsletterForm.style.display = "none";

          // Remove the disclaimer text
          const disclaimer = container.querySelector(".newsletter-disclaimer");
          if (disclaimer) disclaimer.style.display = "none";

          // Insert success message
          const successMsg = document.createElement("p");
          successMsg.style.color = "#fff";
          successMsg.style.fontSize = "1.1rem";
          successMsg.style.fontWeight = "600";
          successMsg.style.marginTop = "10px";
          successMsg.textContent =
            "You\u2019re subscribed! Welcome to the club. \u26BD";
          container.appendChild(successMsg);
        })
        .catch(() => {
          // Show error message
          submitBtn.disabled = false;
          submitBtn.textContent = "Subscribe";
          const errorMsg = document.createElement("p");
          errorMsg.style.color = "#ff6b6b";
          errorMsg.style.fontSize = "0.9rem";
          errorMsg.style.marginTop = "10px";
          errorMsg.textContent =
            "Something went wrong. Please try again.";
          newsletterForm.parentElement.appendChild(errorMsg);
        });
    });
  }
});
