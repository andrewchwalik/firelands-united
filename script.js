document.addEventListener("DOMContentLoaded", () => {
  // Hero Section for Blog Rotation
  const heroContent = document.getElementById("hero-content");
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  const heroButton = document.getElementById("hero-button");

  let blogPosts = [];
  let currentIndex = 0;

  fetch("../blogs.json")
    .then(response => response.json())
    .then(data => {
      blogPosts = data;
      updateHeroContent();
      setInterval(() => fadeOutAndUpdate(), 8000);
    })
    .catch(error => console.error("Error loading blog data:", error));

  function fadeOutAndUpdate() {
    heroContent.classList.add("fade-out");
    setTimeout(() => {
      updateHeroContent();
      heroContent.classList.remove("fade-out");
      heroContent.classList.add("fade-in");
      setTimeout(() => heroContent.classList.remove("fade-in"), 1000);
    }, 1000);
  }

  function updateHeroContent() {
    if (blogPosts.length === 0) return;
    const post = blogPosts[currentIndex];
    heroTitle.textContent = post.title;
    heroSubtitle.textContent = post.excerpt;
    heroButton.href = post.link;
    currentIndex = (currentIndex + 1) % blogPosts.length;
  }

  // Blog Section with Search and Filter Functionality
  const blogList = document.getElementById("blog-list");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");

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

  function renderBlogs(filteredBlogs) {
    blogList.innerHTML = "";

    if (filteredBlogs.length === 0) {
      blogList.innerHTML = `<p>No blogs found.</p>`;
      return;
    }

    filteredBlogs.forEach((blog) => {
      const blogCard = document.createElement("div");
      blogCard.classList.add("blog-card");

      blogCard.innerHTML = `
        <img src="${blog.image}" alt="${blog.title}">
        <div class="blog-card-content">
          <h3>${blog.title}</h3>
          <p>${blog.excerpt}</p>
          <a href="${blog.link}">Read More</a>
        </div>
      `;

      blogList.appendChild(blogCard);
    });
  }

  function filterBlogs() {
    const searchText = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    const filteredBlogs = blogs.filter((blog) => {
      const matchesSearch = blog.title.toLowerCase().includes(searchText);
      const matchesCategory =
        selectedCategory === "all" || blog.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    renderBlogs(filteredBlogs);
  }

  searchInput.addEventListener("input", filterBlogs);
  categoryFilter.addEventListener("change", filterBlogs);

  renderBlogs(blogs); // Initial render

  // Hamburger Menu Toggle
  const hamburger = document.getElementById("hamburger-menu");
  const navLinks = document.getElementById("nav-links");

  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("show");
  });

  // COUNTDOWN TIMER FOR NEXT GAME
  const gameDate = new Date("May 24, 2025 11:00:00").getTime(); // Fix: Use correct string format

  function updateCountdown() {
    const now = new Date().getTime();
    const timeLeft = gameDate - now;

    if (timeLeft <= 0) {
      // If the countdown reaches zero, show "Game Day!"
      document.querySelector(".match-timer").innerHTML = "<span>Game Day!</span>";
      return;
    }

    // Time calculations
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Ensure HTML elements exist before updating them
    if (document.querySelector(".match-timer .days")) {
      document.querySelector(".match-timer .days").textContent = days.toString().padStart(2, "0");
      document.querySelector(".match-timer .hours").textContent = hours.toString().padStart(2, "0");
      document.querySelector(".match-timer .minutes").textContent = minutes.toString().padStart(2, "0");
      document.querySelector(".match-timer .seconds").textContent = seconds.toString().padStart(2, "0");
    }
  }

  // Run countdown every second
  setInterval(updateCountdown, 1000);
  updateCountdown(); // Run immediately on page load
});
