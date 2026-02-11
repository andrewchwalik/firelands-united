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

  // ----- Hamburger menu -----
  const hamburger = document.getElementById("hamburger-menu");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("show");
      hamburger.classList.toggle("active");
      document.body.style.overflow = navLinks.classList.contains("show")
        ? "hidden"
        : "";
    });

    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        document.body.style.overflow = "";
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        document.body.style.overflow = "";
      }
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
      (p) => p.link !== currentPath && p.link !== currentPath.replace(/\/$/, "")
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

  // ----- Newsletter form -----
  const newsletterForm = document.getElementById("newsletter-form");

  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("newsletter-email");
      const email = emailInput.value;

      // Placeholder: replace with your newsletter service integration
      // For now, show a success message
      newsletterForm.innerHTML =
        '<p style="color: #fff; font-size: 1.1rem; font-weight: 600;">Thanks for subscribing! ⚽</p>';
    });
  }
});
