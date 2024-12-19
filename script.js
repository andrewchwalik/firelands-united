document.addEventListener("DOMContentLoaded", () => {
  const heroContent = document.getElementById("hero-content");
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  const heroButton = document.getElementById("hero-button");

  let blogPosts = [];
  let currentIndex = 0;

  // Fetch blog data from the blogs.json file
  fetch("blogs.json")
    .then(response => response.json())
    .then(data => {
      blogPosts = data;
      updateHeroContent(); // Display the first blog post
      setInterval(() => {
        fadeOutAndUpdate();
      }, 8000); // Change content every 5 seconds
    })
    .catch(error => {
      console.error("Error loading blog data:", error);
    });

  // Function to fade out, update content, and fade back in
  function fadeOutAndUpdate() {
    heroContent.classList.add("fade-out");

    setTimeout(() => {
      updateHeroContent();
      heroContent.classList.remove("fade-out");
      heroContent.classList.add("fade-in");

      // Remove fade-in class after animation completes
      setTimeout(() => heroContent.classList.remove("fade-in"), 1000);
    }, 1000); // Matches the fade-out duration
  }

  // Function to update the hero section content
  function updateHeroContent() {
    if (blogPosts.length === 0) return;

    const post = blogPosts[currentIndex];
    heroTitle.textContent = post.title;
    heroSubtitle.textContent = post.excerpt;
    heroButton.href = post.link;

    // Cycle to the next blog post
    currentIndex = (currentIndex + 1) % blogPosts.length;
  }
});

// Hamburger Menu Toggle
const hamburger = document.getElementById('hamburger-menu');
const navLinks = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('show');
});
