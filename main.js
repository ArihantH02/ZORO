// Import styles
// CSS handled via HTML link
import { initAurora } from './anoai.js';
import { initHeroShader } from './heroShader.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Aurora Animation globally - Disabled for static background
  // initAurora();
  
  // Initialize Shader Background for Hero
  initHeroShader();

  // Sticky Navbar Logic
  const navbar = document.getElementById('navbar');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Button Interactions
  const registerBtn = document.getElementById('registerBtn');
  const loginBtn = document.getElementById('loginBtn');
  const profileBtn = document.getElementById('profileBtn');

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      window.location.href = '/register.html';
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = '/login.html';
    });
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      // Direct user to login from homepage profile click
      window.location.href = '/login.html';
    });
  }

  // --- Premium Scroll Animation Observer ---
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const scrollObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Optional: Stop observing once animated if you only want it to happen once
        // observer.unobserve(entry.target); 
      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll('.scroll-reveal, .scale-reveal, .fade-in-left, .fade-in-right');
  animatedElements.forEach(el => scrollObserver.observe(el));
});
