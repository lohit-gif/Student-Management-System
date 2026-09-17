/**
 * about.js — About Page Logic
 * ============================
 *
 * Handles all interactivity for the About page (about.html).
 *
 * Responsibilities:
 *   - Initialise the sidebar toggle
 *   - Animate the tech stack cards on scroll (IntersectionObserver)
 *   - Check backend health and display connection status
 */

document.addEventListener('DOMContentLoaded', () => {
  StudentAPI.checkAuthGuard();
  initSidebar();
  initAuthUI();
  initScrollAnimations();
  checkApiStatus();
});

function initAuthUI() {
  const user = StudentAPI.getAuthUser();
  const badge = document.getElementById('user-badge');
  const userNameEl = document.getElementById('user-name-text');
  const trigger = document.getElementById('user-profile-trigger');

  if (user) {
    const name = user.full_name || user.username || 'Admin';
    if (badge) badge.textContent = name[0].toUpperCase();
    if (userNameEl) userNameEl.textContent = name;
  }

  if (trigger) {
    trigger.addEventListener('click', () => {
      showProfileModal();
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      StudentAPI.logout();
    });
  }
}


// ---------------------------------------------------------------------------
// Scroll-triggered animations
// ---------------------------------------------------------------------------

/**
 * initScrollAnimations — uses IntersectionObserver to add .animate-in
 * to elements as they enter the viewport.
 */
function initScrollAnimations() {
  const targets = document.querySelectorAll('.tech-card, .feature-item, .api-route');

  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target); // Only animate once
        }
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach(el => {
    el.style.opacity = '0'; // Hide initially
    observer.observe(el);
  });
}


// ---------------------------------------------------------------------------
// API health check
// ---------------------------------------------------------------------------

/**
 * checkApiStatus — pings GET /api/students/ to verify the backend is reachable
 * and updates the #api-status indicator accordingly.
 */
async function checkApiStatus() {
  const statusDot  = document.getElementById('api-status-dot');
  const statusText = document.getElementById('api-status-text');

  if (!statusDot || !statusText) return;

  // Show "checking..." state
  statusDot.style.background  = 'var(--clr-warning)';
  statusDot.style.boxShadow   = '0 0 8px rgba(245,158,11,0.6)';
  statusText.textContent = 'Checking connection…';

  try {
    const response = await StudentAPI.getAll();

    // Backend responded — mark as connected
    statusDot.style.background = 'var(--clr-success)';
    statusDot.style.boxShadow  = '0 0 8px rgba(16,185,129,0.6)';
    statusText.textContent = 'Backend connected (Django running)';
    showToast('✓ Backend API is reachable!', 'success');

  } catch (error) {
    // Network error or backend not running
    statusDot.style.background = 'var(--clr-danger)';
    statusDot.style.boxShadow  = '0 0 8px rgba(239,68,68,0.6)';
    statusText.textContent = 'Backend offline — start Django server';
    console.warn('[checkApiStatus] Could not reach backend:', error.message);
  }
}
