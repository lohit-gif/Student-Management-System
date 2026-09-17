/**
 * api.js — Centralised API Communication Layer
 * =============================================
 *
 * Provides:
 *   - apiFetch()          : Core fetch wrapper with JSON headers & error handling
 *   - StudentAPI.*        : Full CRUD + stats helpers for /api/students/
 *   - showToast()         : Non-blocking notification UI
 *   - showConfirmDialog() : Custom styled confirmation modal
 *   - initSidebar()       : Mobile sidebar toggle
 *   - Utility fns         : formatDate, yearLabel, yearBadgeClass, escapeHtml
 *
 * Base URL:  http://127.0.0.1:8000/api
 */

// ---------------------------------------------------------------------------
// Configuration & Auth Token Storage
// ---------------------------------------------------------------------------
const API_BASE_URL = 'http://127.0.0.1:8000/api';

const ENDPOINTS = {
  register:      '/auth/register/',
  login:         '/auth/login/',
  logout:        '/auth/logout/',
  me:            '/auth/me/',
  profile:       '/auth/profile/',
  students:      '/students/',
  stats:         '/students/stats/',
  studentDetail: (id) => `/students/${id}/`,
};

function getAuthToken() {
  return localStorage.getItem('sms_auth_token') || '';
}

function setAuthToken(token, user) {
  if (token) localStorage.setItem('sms_auth_token', token);
  if (user)  localStorage.setItem('sms_user', JSON.stringify(user));
}

function clearAuthToken() {
  localStorage.removeItem('sms_auth_token');
  localStorage.removeItem('sms_user');
}


// ---------------------------------------------------------------------------
// Custom Error class
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name       = 'ApiError';
    this.statusCode = statusCode;
    this.data       = data;
  }
}


// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    let data = null;
    const ct = response.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      if (response.status === 401 &&
          !window.location.pathname.endsWith('login.html') &&
          !window.location.pathname.endsWith('signup.html')) {
        clearAuthToken();
        window.location.href = 'login.html';
        return;
      }
      const message = data?.message || data?.detail || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Cannot reach the server. Make sure the Django backend is running on port 8000.',
      0, null
    );
  }
}


// ---------------------------------------------------------------------------
// Student & Auth API helpers
// ---------------------------------------------------------------------------
const StudentAPI = {

  /** Register new user account */
  register: async (userData) => {
    return apiFetch(ENDPOINTS.register, {
      method: 'POST',
      body: userData,
    });
  },

  /** Authenticate administrator / user */
  login: async (usernameOrEmail, password) => {
    const res = await apiFetch(ENDPOINTS.login, {
      method: 'POST',
      body: { username: usernameOrEmail, password },
    });
    if (res?.data?.token) {
      setAuthToken(res.data.token, res.data.user);
    }
    return res;
  },

  /** Fetch user profile */
  getProfile: async () => {
    return apiFetch(ENDPOINTS.profile, { method: 'GET' });
  },

  /** Logout user */
  logout: async () => {
    try {
      await apiFetch(ENDPOINTS.logout, { method: 'POST' });
    } catch (_) {
      // Ignore API errors during logout
    } finally {
      clearAuthToken();
      window.location.href = 'login.html';
    }
  },

  /** Check if authenticated */
  isAuthenticated: () => {
    return Boolean(getAuthToken());
  },

  /** Get authenticated user info */
  getAuthUser: () => {
    try {
      return JSON.parse(localStorage.getItem('sms_user') || 'null');
    } catch (_) {
      return null;
    }
  },

  /** Check auth guard on protected pages */
  checkAuthGuard: () => {
    if (!StudentAPI.isAuthenticated() &&
        !window.location.pathname.endsWith('login.html') &&
        !window.location.pathname.endsWith('signup.html')) {
      window.location.href = 'login.html';
    }
  },

  /** Fetch all students with optional search, filter, and sort. */
  getAll: async ({ search = '', year = '', department = '', sort = 'student_id', order = 'asc' } = {}) => {
    const qs = new URLSearchParams();
    if (search)     qs.set('search', search);
    if (year)       qs.set('year', year);
    if (department) qs.set('department', department);
    if (sort)       qs.set('sort', sort);
    if (order)      qs.set('order', order);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch(`${ENDPOINTS.students}${query}`, { method: 'GET' });
  },

  /** Fetch dashboard summary statistics. */
  getStats: async () => {
    return apiFetch(ENDPOINTS.stats, { method: 'GET' });
  },

  /** Fetch a single student by primary key. */
  getById: async (id) => {
    return apiFetch(ENDPOINTS.studentDetail(id), { method: 'GET' });
  },

  /** Create a new student. */
  create: async (studentData) => {
    return apiFetch(ENDPOINTS.students, { method: 'POST', body: studentData });
  },

  /** Full update (PUT). */
  update: async (id, studentData) => {
    return apiFetch(ENDPOINTS.studentDetail(id), { method: 'PUT', body: studentData });
  },

  /** Partial update (PATCH). */
  partialUpdate: async (id, studentData) => {
    return apiFetch(ENDPOINTS.studentDetail(id), { method: 'PATCH', body: studentData });
  },

  /** Delete a student. */
  delete: async (id) => {
    return apiFetch(ENDPOINTS.studentDetail(id), { method: 'DELETE' });
  },
};


// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position:      'fixed',
      top:           '24px',
      right:         '24px',
      zIndex:        '9999',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  const palette = {
    success: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: '✓' },
    error:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: '✕' },
    warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', icon: '⚠' },
    info:    { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', icon: 'ℹ' },
  };

  const c = palette[type] || palette.info;
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg};border:1px solid ${c.border};backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);padding:12px 18px;border-radius:10px;
    color:${c.text};font-family:'Inter',sans-serif;font-size:13.5px;font-weight:600;
    display:flex;align-items:center;gap:10px;min-width:240px;max-width:420px;
    box-shadow:0 6px 20px rgba(0,0,0,0.08);animation:fadeInUp 0.25s ease;
    pointer-events:all;cursor:default;
  `;
  toast.innerHTML = `<span style="font-size:15px;flex-shrink:0">${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease,transform 0.3s ease';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(12px)';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}


// ---------------------------------------------------------------------------
// Custom Confirm Dialog (replaces window.confirm)
// ---------------------------------------------------------------------------
/**
 * showConfirmDialog — shows a styled confirmation modal.
 * @param {string} title   - Dialog title
 * @param {string} message - Dialog body message
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
 */
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    // Remove any existing dialog
    document.getElementById('confirm-dialog-backdrop')?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'confirm-dialog-backdrop';
    backdrop.style.cssText = `
      position:fixed;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(4px);
      z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;
      animation:fadeInUp 0.2s ease;
    `;

    backdrop.innerHTML = `
      <div style="
        background:#ffffff;border:1px solid #e2e8f0;
        border-radius:16px;padding:32px;max-width:400px;width:100%;
        box-shadow:0 20px 40px rgba(0,0,0,0.12);text-align:center;
      ">
        <div style="
          width:56px;height:56px;border-radius:50%;background:rgba(239,68,68,0.1);
          display:flex;align-items:center;justify-content:center;margin:0 auto 20px;
          font-size:1.5rem;
        ">🗑️</div>
        <h3 style="font-family:'Inter',sans-serif;font-size:1.1rem;font-weight:700;
          color:#0f172a;margin-bottom:10px;">${title}</h3>
        <p style="font-family:'Inter',sans-serif;font-size:0.875rem;color:#475569;
          margin-bottom:28px;line-height:1.6;">${message}</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="confirm-cancel" style="
            font-family:'Inter',sans-serif;padding:10px 24px;border-radius:8px;
            border:1px solid #cbd5e1;background:#ffffff;
            color:#475569;font-size:0.875rem;font-weight:600;cursor:pointer;
            transition:all 0.15s ease;
          ">Cancel</button>
          <button id="confirm-ok" style="
            font-family:'Inter',sans-serif;padding:10px 24px;border-radius:8px;
            border:none;background:linear-gradient(135deg,#ef4444,#dc2626);
            color:#fff;font-size:0.875rem;font-weight:600;cursor:pointer;
            box-shadow:0 4px 14px rgba(239,68,68,0.35);transition:all 0.15s ease;
          ">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cleanup = (result) => {
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity 0.2s ease';
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };

    backdrop.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', handler); }
    });
  });
}


// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function yearLabel(year) {
  return { 1: 'First Year', 2: 'Second Year', 3: 'Third Year', 4: 'Fourth Year' }[year] || `Year ${year}`;
}

function yearBadgeClass(year) {
  return `badge badge-year-${year}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}


// ---------------------------------------------------------------------------
// Mobile sidebar toggle
// ---------------------------------------------------------------------------
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !toggle || !overlay) return;

  toggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    toggle.setAttribute('aria-expanded', 'false');
  });
}


// ---------------------------------------------------------------------------
// User Profile Modal
// ---------------------------------------------------------------------------
async function showProfileModal() {
  document.getElementById('profile-modal-backdrop')?.remove();

  let user = StudentAPI.getAuthUser() || {};
  try {
    const res = await StudentAPI.getProfile();
    if (res?.data) user = res.data;
  } catch (_) {
    // Fallback to cached user
  }

  const name = user.full_name || user.username || 'Administrator';
  const initial = (name && name.trim()) ? name.trim()[0].toUpperCase() : 'A';

  const backdrop = document.createElement('div');
  backdrop.id = 'profile-modal-backdrop';
  backdrop.style.cssText = `
    position:fixed;inset:0;background:rgba(15,23,42,0.4);backdrop-filter:blur(6px);
    z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeInUp 0.2s ease;
  `;

  backdrop.innerHTML = `
    <div style="
      background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;
      padding:32px;max-width:440px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.35);
      position:relative;overflow:hidden;
    ">
      <button id="profile-close" style="
        position:absolute;top:16px;right:16px;background:none;border:none;
        font-size:1.2rem;color:#64748b;cursor:pointer;padding:4px;
      ">✕</button>

      <div style="text-align:center;margin-bottom:24px;">
        <div style="
          width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:#ffffff;font-size:1.8rem;font-weight:700;display:flex;align-items:center;
          justify-content:center;margin:0 auto 12px;box-shadow:0 8px 20px rgba(37,99,235,0.35);
        ">${initial}</div>
        <h3 style="font-family:'Inter',sans-serif;font-size:1.3rem;font-weight:800;color:#0f172a;margin:0 0 4px;">${escapeHtml(name)}</h3>
        <span style="font-size:0.8rem;background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:9999px;font-weight:600;">Administrator Account</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;font-size:0.875rem;color:#334155;">
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
          <strong style="color:#64748b;">Username:</strong>
          <span style="font-weight:600;color:#0f172a;">@${escapeHtml(user.username || 'admin')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
          <strong style="color:#64748b;">Email Address:</strong>
          <span style="font-weight:600;color:#0f172a;">${escapeHtml(user.email || 'admin@example.com')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <strong style="color:#64748b;">System Role:</strong>
          <span style="font-weight:600;color:#0f172a;">System Administrator</span>
        </div>
      </div>

      <div style="margin-top:24px;display:flex;gap:12px;justify-content:flex-end;">
        <button id="profile-close-btn" style="
          font-family:'Inter',sans-serif;padding:10px 20px;border-radius:8px;
          border:1px solid #cbd5e1;background:#ffffff;color:#475569;
          font-size:0.875rem;font-weight:600;cursor:pointer;
        ">Close</button>
        <button id="profile-logout-btn" style="
          font-family:'Inter',sans-serif;padding:10px 20px;border-radius:8px;
          border:none;background:#ef4444;color:#ffffff;
          font-size:0.875rem;font-weight:600;cursor:pointer;
          box-shadow:0 4px 12px rgba(239,68,68,0.3);
        ">Logout</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#profile-close').addEventListener('click', close);
  backdrop.querySelector('#profile-close-btn').addEventListener('click', close);
  backdrop.querySelector('#profile-logout-btn').addEventListener('click', () => {
    close();
    StudentAPI.logout();
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
}
