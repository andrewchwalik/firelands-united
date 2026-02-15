document.addEventListener("DOMContentLoaded", () => {
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

  // ----- Home ticker text sync -----
  const ticker = document.querySelector(".news-ticker");
  if (ticker) {
    const tickerText = ticker.getAttribute("data-ticker-text") || "";
    const tickerItems = ticker.querySelectorAll(".news-ticker-item");
    tickerItems.forEach((item) => {
      item.textContent = tickerText;
    });
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
      card.innerHTML = `
        <div class="blog-card-image">
          <img src="${imgSrc}" alt="${blog.title}">
        </div>
        <div class="blog-card-body">
          <span class="blog-card-category">${category}</span>
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
      card.innerHTML = `
        <div class="related-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="related-card-body">
          <span class="related-card-category">${category}</span>
          <h3 class="related-card-title">${post.title}</h3>
          <p class="related-card-excerpt">${post.excerpt}</p>
        </div>`;
      relatedPostsGrid.appendChild(card);
    });
  }

  // ----- Latest news (homepage) -----
  const latestNewsGrid = document.getElementById("latest-news-grid");

  function renderLatestNews(allPosts) {
    if (!latestNewsGrid || allPosts.length === 0) return;

    // Show up to 3 latest posts (already sorted newest first from blogs.json)
    const postsToShow = allPosts.slice(0, 3);

    latestNewsGrid.innerHTML = "";
    postsToShow.forEach((post) => {
      const card = document.createElement("a");
      card.classList.add("latest-news-card");
      card.href = post.link;
      const imgSrc = post.image || "/img/blogs/default.jpg";
      const category = post.category || "Club News";
      card.innerHTML = `
        <div class="latest-news-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="latest-news-card-body">
          <span class="latest-news-card-category">${category}</span>
          <h3 class="latest-news-card-title">${post.title}</h3>
          <p class="latest-news-card-excerpt">${post.excerpt}</p>
        </div>`;
      latestNewsGrid.appendChild(card);
    });
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

  if (merchTrack && merchDotsContainer) {
    let merchIndex = 0;
    let cardsPerView = window.innerWidth <= 768 ? 1 : 3;

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
          merchIndex = i;
          updateMerchSlider();
        });
        merchDotsContainer.appendChild(dot);
      }
    }

    // Update slider position and controls
    function updateMerchSlider() {
      merchIndex = Math.max(0, Math.min(merchIndex, getMaxIndex()));

      const gap = cardsPerView === 1 ? 0 : 30;
      const wrapperWidth = merchTrack.parentElement.offsetWidth;
      const cardWidth = (wrapperWidth - gap * (cardsPerView - 1)) / cardsPerView;

      // Calculate offset: jump by cardsPerView, but clamp so last page shows full cards
      const startCard = Math.min(merchIndex * cardsPerView, merchProducts.length - cardsPerView);
      const offset = startCard * (cardWidth + gap);
      merchTrack.style.transform = `translateX(-${offset}px)`;

      // Update arrow states
      const leftArrow = document.querySelector('.merch-arrow-left');
      const rightArrow = document.querySelector('.merch-arrow-right');
      if (leftArrow) leftArrow.disabled = merchIndex === 0;
      if (rightArrow) rightArrow.disabled = merchIndex >= getMaxIndex();

      // Update dots
      const dots = merchDotsContainer.querySelectorAll('.merch-dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === merchIndex);
      });
    }

    // Arrow event listeners
    const merchLeftArrow = document.querySelector('.merch-arrow-left');
    const merchRightArrow = document.querySelector('.merch-arrow-right');

    if (merchLeftArrow) {
      merchLeftArrow.addEventListener('click', () => {
        if (merchIndex > 0) {
          merchIndex--;
          updateMerchSlider();
        }
      });
    }

    if (merchRightArrow) {
      merchRightArrow.addEventListener('click', () => {
        if (merchIndex < getMaxIndex()) {
          merchIndex++;
          updateMerchSlider();
        }
      });
    }

    // Touch/swipe support for mobile
    let merchTouchStartX = 0;
    let merchTouchEndX = 0;

    merchTrack.addEventListener('touchstart', (e) => {
      merchTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    merchTrack.addEventListener('touchend', (e) => {
      merchTouchEndX = e.changedTouches[0].screenX;
      const diff = merchTouchStartX - merchTouchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && merchIndex < getMaxIndex()) {
          merchIndex++;
          updateMerchSlider();
        }
        if (diff < 0 && merchIndex > 0) {
          merchIndex--;
          updateMerchSlider();
        }
      }
    }, { passive: true });

    // Handle window resize
    window.addEventListener('resize', () => {
      const newCardsPerView = window.innerWidth <= 768 ? 1 : 3;
      if (newCardsPerView !== cardsPerView) {
        cardsPerView = newCardsPerView;
        merchIndex = 0;
        renderMerchDots();
        updateMerchSlider();
      } else {
        updateMerchSlider();
      }
    });

    // Initialize
    renderMerchCards();
    renderMerchDots();
    updateMerchSlider();
  }

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
