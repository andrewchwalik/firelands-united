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
      blogList.innerHTML = "<p>No blogs found.</p>";
      return;
    }
    items.forEach((blog) => {
      const card = document.createElement("div");
      card.classList.add("blog-card");
      const imgSrc = blog.image || "/img/blogs/default.jpg";
      card.innerHTML = `
        <img src="${imgSrc}" alt="${blog.title}">
        <div class="blog-card-content">
          <h3>${blog.title}</h3>
          <p>${blog.excerpt}</p>
          <a href="${blog.link}">Read More</a>
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
});
