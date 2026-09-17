/**
 * dashboard.js — Live Dashboard using /api/students/stats/
 * =========================================================
 *
 * Fetches summary statistics and recent student activity from the API.
 * Populates:
 *   - 6 stat cards: Total Students, Total Departments, Year 1–4 counts
 *   - Activity feed with most recently added students
 *   - Live clock in topbar
 */

document.addEventListener('DOMContentLoaded', () => {
  StudentAPI.checkAuthGuard();
  initSidebar();
  initAuthUI();
  renderCurrentTime();
  loadDashboardStats();
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
// Load live stats from API
// ---------------------------------------------------------------------------
async function loadDashboardStats() {
  // Show skeleton loading state on all stat values
  document.querySelectorAll('.stat-value[data-stat]').forEach(el => {
    el.innerHTML = '<div class="skeleton" style="width:60px;height:36px;border-radius:6px;display:inline-block"></div>';
  });

  try {
    // Fetch both stats and recent students in parallel
    const [statsRes, listRes] = await Promise.all([
      StudentAPI.getStats(),
      StudentAPI.getAll({ sort: 'created_at', order: 'desc' }),
    ]);

    const stats    = statsRes.data;
    const students = listRes.data || [];

    // Animate stat cards
    setStatCard('stat-total',   stats.total_students);
    setStatCard('stat-depts',   stats.total_departments);
    setStatCard('stat-year-1',  stats.by_year['1'] || 0);
    setStatCard('stat-year-2',  stats.by_year['2'] || 0);
    setStatCard('stat-year-3',  stats.by_year['3'] || 0);
    setStatCard('stat-year-4',  stats.by_year['4'] || 0);

    // API status indicator
    const apiEl = document.getElementById('stat-api-status');
    if (apiEl) {
      apiEl.textContent    = '● Online';
      apiEl.style.color    = 'var(--clr-success)';
    }

    // Render activity feed with last 5 students
    renderActivityFeed(students.slice(0, 5));

  } catch (err) {
    // API unreachable
    document.querySelectorAll('.stat-value[data-stat]').forEach(el => {
      el.textContent = '—';
      el.style.color = 'var(--clr-text-muted)';
    });

    const apiEl = document.getElementById('stat-api-status');
    if (apiEl) {
      apiEl.textContent = '● Offline';
      apiEl.style.color = 'var(--clr-danger)';
    }

    renderFallbackActivity();
    console.warn('[Dashboard] API unreachable:', err.message);
  }
}


// ---------------------------------------------------------------------------
// Animated stat counter
// ---------------------------------------------------------------------------
function setStatCard(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.removeAttribute('style');

  const duration = 900;
  const step = Math.max(1, Math.ceil(target / (duration / 16)));
  let current = 0;

  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 16);
}


// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------
function renderActivityFeed(students) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  if (!students.length) {
    feed.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon" style="background:var(--clr-accent-light);color:var(--clr-accent)">
          <span>📭</span>
        </div>
        <div class="activity-text">
          <p>No students yet. <a href="students.html" style="color:var(--clr-accent)">Add the first one →</a></p>
          <span class="text-muted">Now</span>
        </div>
      </div>`;
    return;
  }

  feed.innerHTML = students.map((s, i) => `
    <div class="activity-item animate-in" style="animation-delay:${0.05 * i}s">
      <div class="activity-icon"
           style="background:var(--clr-accent-light);color:var(--clr-accent);font-size:0.85rem;font-weight:700">
        ${avatarInitials(s.full_name)}
      </div>
      <div class="activity-text">
        <p><strong>${esc(s.full_name)}</strong> — ${esc(s.department)}, ${yearLabel(s.year)}</p>
        <span class="text-muted">ID: ${esc(s.student_id)} &nbsp;·&nbsp; ${timeAgo(s.created_at)}</span>
      </div>
    </div>
  `).join('');
}

function renderFallbackActivity() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  feed.innerHTML = `
    <div class="activity-item">
      <div class="activity-icon" style="background:var(--clr-danger-light);color:var(--clr-danger)">⚠️</div>
      <div class="activity-text">
        <p>Could not connect to the Django backend.</p>
        <span class="text-muted">Run: python manage.py runserver</span>
      </div>
    </div>`;
}


// ---------------------------------------------------------------------------
// Live clock
// ---------------------------------------------------------------------------
function renderCurrentTime() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  };
  update();
  setInterval(update, 60_000);
}


// ---------------------------------------------------------------------------
// Utilities (inline — api.js loaded before this file)
// ---------------------------------------------------------------------------
function esc(str) { return escapeHtml(str); }

function avatarInitials(name) {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
