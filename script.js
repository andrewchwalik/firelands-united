document.addEventListener("DOMContentLoaded", () => {
  // ----- Hero rotation -----
  const heroContent  = document.getElementById("hero-content");
  const heroTitle    = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  const heroButton   = document.getElementById("hero-button");

  let blogPosts = [];
  let currentIndex = 0;

  fetch("../blogs.json")
    .then(r => r.json())
    .then(data => {
      blogPosts = data;
      if (heroContent && heroTitle && heroSubtitle && heroButton) {
        updateHeroContent();
        setInterval(() => fadeOutAndUpdate(), 8000);
      }
    })
    .catch(err => console.error("Error loading blog data:", err));

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
    if (blogPosts.length === 0 || !heroTitle || !heroSubtitle || !heroButton) return;
    const post = blogPosts[currentIndex];
    heroTitle.textContent = post.title;
    heroSubtitle.textContent = post.excerpt;
    heroButton.href = post.link;
    currentIndex = (currentIndex + 1) % blogPosts.length;
  }

  // ----- Hamburger menu (always attach) -----
  const hamburger = document.getElementById("hamburger-menu");
  const navLinks  = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("show");
      hamburger.classList.toggle("active");
      document.body.style.overflow = navLinks.classList.contains("show") ? "hidden" : "";
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

  // ----- Blog list/search (only if present) -----
  const blogList       = document.getElementById("blog-list");
  const searchInput    = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");

  if (blogList && searchInput && categoryFilter) {
    const blogs = [
      {
        title: "Firelands United to Join NOSL Northwest",
        excerpt: "We're excited to be joining the Northern Ohio Soccer League Northwest to help grow the beautiful game in Northern Ohio!",
        image: "/img/blogs/firelands-united-to-join-nosl-northwest.jpg",
        link: "/blogs/firelands-united-to-join-nosl-northwest/",
        category: "club news",
      },
      {
        title: "Join Firelands United for Our Summer Season",
        excerpt: "Think you have what it takes to play minor league soccer? Submit your information to join the coolest soccer team in Northern Ohio.",
        image: "/img/blogs/join-firelands-united-for-our-summer-season.jpg",
        link: "/blogs/join-firelands-united-for-our-summer-season",
        category: "club news",
      },
    ];

    function renderBlogs(items) {
      blogList.innerHTML = "";
      if (items.length === 0) {
        blogList.innerHTML = `<p>No blogs found.</p>`;
        return;
      }
      items.forEach((blog) => {
        const card = document.createElement("div");
        card.classList.add("blog-card");
        card.innerHTML = `
          <img src="${blog.image}" alt="${blog.title}">
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
      const selected   = categoryFilter.value;
      const filtered = blogs.filter((b) => {
        const matchesSearch = b.title.toLowerCase().includes(searchText);
        const matchesCat    = selected === "all" || b.category === selected;
        return matchesSearch && matchesCat;
      });
      renderBlogs(filtered);
    }

    searchInput.addEventListener("input", filterBlogs);
    categoryFilter.addEventListener("change", filterBlogs);
    renderBlogs(blogs);
  }
});
