/**
 * students.js — Students Page — Full CRUD + Search, Filter & Sort
 * ================================================================
 *
 * State machine:
 *   searchQuery       : Free-text search string
 *   activeYearFilter  : '' | '1' | '2' | '3' | '4'
 *   activeDeptFilter  : '' | '<department name>'
 *   sortField         : 'student_id' | 'full_name' | 'department' | 'year'
 *   sortOrder         : 'asc' | 'desc'
 *   editingStudentId  : null (add mode) | <pk> (edit mode)
 *
 * All state changes call loadStudents() which re-fetches from the API.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let searchQuery      = '';
let activeYearFilter = '';
let activeDeptFilter = '';
let sortField        = 'student_id';
let sortOrder        = 'asc';
let editingStudentId = null;
let searchDebounce   = null;

// Master set of all departments seen — retains choices even when filtering
const allDepartmentsSet = new Set();

// Cache of all students — used to build department dropdown without extra API call
let cachedStudents   = [];


// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  StudentAPI.checkAuthGuard();
  initSidebar();
  initAuthUI();
  initSearch();
  initYearFilters();
  initSortHeaders();
  initAddButton();
  initModalClose();
  initClearFilters();
  loadStudents();
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
// Data loading & table rendering
// ---------------------------------------------------------------------------
async function loadStudents() {
  showTableLoading();
  try {
    const response = await StudentAPI.getAll({
      search:     searchQuery,
      year:       activeYearFilter,
      department: activeDeptFilter,
      sort:       sortField,
      order:      sortOrder,
    });
    cachedStudents = response.data || [];
    renderTable(cachedStudents);
    rebuildDeptDropdown(cachedStudents);
    updateActiveFiltersBar();
  } catch (err) {
    showTableError(err.message);
  }
}

function renderTable(students) {
  const tbody = document.getElementById('student-table-body');
  updateRecordCount(students.length);

  if (!students.length) {
    const hasFilters = searchQuery || activeYearFilter || activeDeptFilter;
    tbody.innerHTML = `
      <tr><td colspan="7" style="padding:0;border:none">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952
                4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15
                19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375
                6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25
                2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h3>${hasFilters ? 'No students match your filters' : 'No students yet'}</h3>
          <p>${hasFilters
            ? 'Try clearing the search or filters below.'
            : 'Click <strong>Add Student</strong> to add the first record.'
          }</p>
          ${hasFilters ? '<button class="btn btn-ghost btn-sm" onclick="clearAllFilters()">Clear Filters</button>' : ''}
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = students.map((s, i) => `
    <tr class="animate-in" style="animation-delay:${Math.min(i * 0.03, 0.3)}s" data-id="${s.id}">
      <td><span class="td-id">${esc(s.student_id)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="student-avatar" aria-hidden="true">${avatarInitials(s.full_name)}</div>
          <span class="td-name">${esc(s.full_name)}</span>
        </div>
      </td>
      <td>${esc(s.department)}</td>
      <td><span class="${yearBadgeClass(s.year)}">${yearLabel(s.year)}</span></td>
      <td><a href="mailto:${esc(s.email)}" class="email-link">${esc(s.email)}</a></td>
      <td class="col-phone">${esc(s.phone_number)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm btn-icon"
                  onclick="openEditModal(${s.id})"
                  title="Edit student" aria-label="Edit ${esc(s.full_name)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5
                4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button class="btn btn-danger btn-sm btn-icon"
                  onclick="confirmDelete(${s.id})"
                  title="Delete student" aria-label="Delete ${esc(s.full_name)}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
                1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25
                2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0
                00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0
                013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0
                00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0
                00-7.5 0" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showTableLoading() {
  const tbody = document.getElementById('student-table-body');
  tbody.innerHTML = Array.from({ length: 5 }, () => `
    <tr>${Array.from({ length: 7 }, () =>
      `<td><div class="skeleton" style="height:18px;border-radius:6px"></div></td>`
    ).join('')}</tr>
  `).join('');
}

function showTableError(message) {
  const tbody = document.getElementById('student-table-body');
  tbody.innerHTML = `
    <tr><td colspan="7" style="text-align:center;padding:48px 24px;color:var(--clr-danger)">
      <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
      <strong>Could not load students</strong>
      <p style="margin-top:6px;font-size:0.8rem;color:var(--clr-text-muted)">${esc(message)}</p>
    </td></tr>`;
}


// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
function initSearch() {
  const input = document.getElementById('student-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value.trim();
      loadStudents();
    }, 300);
  });
}


// ---------------------------------------------------------------------------
// Year filter chips
// ---------------------------------------------------------------------------
function initYearFilters() {
  document.querySelectorAll('.filter-chip[data-year]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-year]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeYearFilter = chip.dataset.year || '';
      loadStudents();
    });
  });
}


// ---------------------------------------------------------------------------
// Department filter dropdown (built dynamically from cached data)
// ---------------------------------------------------------------------------
function rebuildDeptDropdown(students) {
  const select = document.getElementById('dept-filter');
  if (!select) return;

  students.forEach(s => {
    if (s.department && s.department.trim()) {
      allDepartmentsSet.add(s.department.trim());
    }
  });

  const departments = [...allDepartmentsSet].sort();
  const current = activeDeptFilter;

  select.innerHTML = `<option value="">All Departments</option>` +
    departments.map(d =>
      `<option value="${esc(d)}" ${d === current ? 'selected' : ''}>${esc(d)}</option>`
    ).join('');
}

// Called when the user changes the department dropdown
function onDeptFilterChange(value) {
  activeDeptFilter = value;
  loadStudents();
}


// ---------------------------------------------------------------------------
// Sorting — clickable column headers
// ---------------------------------------------------------------------------
function initSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortOrder = 'asc';
      }
      updateSortIndicators();
      loadStudents();
    });
  });
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const field = th.dataset.sort;
    const indicator = th.querySelector('.sort-indicator');
    if (!indicator) return;

    if (field === sortField) {
      indicator.textContent = sortOrder === 'asc' ? ' ▲' : ' ▼';
      indicator.style.color = 'var(--clr-accent)';
      th.style.color        = 'var(--clr-accent)';
    } else {
      indicator.textContent = ' ⇅';
      indicator.style.color = 'var(--clr-text-muted)';
      th.style.color        = '';
    }
  });
}


// ---------------------------------------------------------------------------
// Active filters bar & Clear Filters
// ---------------------------------------------------------------------------
function initClearFilters() {
  document.getElementById('clear-filters-btn')?.addEventListener('click', clearAllFilters);
}

function clearAllFilters() {
  searchQuery      = '';
  activeYearFilter = '';
  activeDeptFilter = '';
  sortField        = 'student_id';
  sortOrder        = 'asc';

  // Reset UI controls
  const searchInput = document.getElementById('student-search');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.filter-chip[data-year]').forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chip[data-year=""]')?.classList.add('active');

  const deptSelect = document.getElementById('dept-filter');
  if (deptSelect) deptSelect.value = '';

  updateSortIndicators();
  updateActiveFiltersBar();
  loadStudents();
}

function updateActiveFiltersBar() {
  const bar = document.getElementById('active-filters-bar');
  if (!bar) return;

  const tags = [];
  if (searchQuery)      tags.push(`Search: "${esc(searchQuery)}"`);
  if (activeYearFilter) tags.push(`Year: ${yearLabel(parseInt(activeYearFilter))}`);
  if (activeDeptFilter) tags.push(`Dept: ${esc(activeDeptFilter)}`);

  const hasFilters = tags.length > 0;
  bar.style.display = hasFilters ? 'flex' : 'none';

  const tagsEl = document.getElementById('active-filter-tags');
  if (tagsEl) {
    tagsEl.innerHTML = tags.map(t =>
      `<span class="active-filter-tag">${t}</span>`
    ).join('');
  }
}


// ---------------------------------------------------------------------------
// Add Student Modal
// ---------------------------------------------------------------------------
function initAddButton() {
  document.getElementById('add-student-btn')?.addEventListener('click', openAddModal);
}

function openAddModal() {
  editingStudentId = null;
  document.getElementById('modal-title').textContent = 'Add New Student';
  document.getElementById('modal-submit-label').textContent = 'Add Student';
  document.getElementById('student-form').reset();
  clearFormErrors();
  document.getElementById('field-student-id').removeAttribute('readonly');
  openModal();
}

async function openEditModal(id) {
  editingStudentId = id;
  document.getElementById('modal-title').textContent = 'Edit Student';
  document.getElementById('modal-submit-label').textContent = 'Update Student';
  clearFormErrors();

  try {
    const response = await StudentAPI.getById(id);
    const s = response.data;

    document.getElementById('field-student-id').value  = s.student_id;
    document.getElementById('field-full-name').value   = s.full_name;
    document.getElementById('field-department').value  = s.department;
    document.getElementById('field-year').value        = s.year;
    document.getElementById('field-email').value       = s.email;
    document.getElementById('field-phone').value       = s.phone_number;
    document.getElementById('field-address').value     = s.address;

    // Lock student_id during edit to prevent accidental changes
    document.getElementById('field-student-id').setAttribute('readonly', true);
    openModal();
  } catch (err) {
    showToast(`Could not load student: ${err.message}`, 'error');
  }
}

function openModal() {
  const modal = document.getElementById('student-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('field-student-id').focus(), 100);
}

function closeModal() {
  const modal = document.getElementById('student-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  editingStudentId = null;
}

function initModalClose() {
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('student-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('student-modal')) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.getElementById('student-form')?.addEventListener('submit', handleFormSubmit);
}


// ---------------------------------------------------------------------------
// Form submission (Create / Update)
// ---------------------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const payload = collectFormData();
  const clientErrors = validateClientSide(payload);
  if (Object.keys(clientErrors).length) {
    displayFormErrors(clientErrors);
    return;
  }

  const submitBtn = document.getElementById('form-submit-btn');
  setSubmitLoading(submitBtn, true);

  try {
    if (editingStudentId) {
      await StudentAPI.update(editingStudentId, payload);
      showToast(`✓ "${payload.full_name}" updated successfully`, 'success');
    } else {
      await StudentAPI.create(payload);
      showToast(`✓ "${payload.full_name}" added successfully`, 'success');
    }
    closeModal();
    await loadStudents();
  } catch (err) {
    const serverErrors = err.data?.data?.errors;
    if (serverErrors) {
      displayFormErrors(serverErrors);
    } else {
      showToast(err.message || 'An error occurred. Please try again.', 'error');
    }
  } finally {
    setSubmitLoading(submitBtn, false);
  }
}

function collectFormData() {
  return {
    student_id:   document.getElementById('field-student-id').value.trim(),
    full_name:    document.getElementById('field-full-name').value.trim(),
    department:   document.getElementById('field-department').value.trim(),
    year:         parseInt(document.getElementById('field-year').value, 10),
    email:        document.getElementById('field-email').value.trim(),
    phone_number: document.getElementById('field-phone').value.trim(),
    address:      document.getElementById('field-address').value.trim(),
  };
}


// ---------------------------------------------------------------------------
// Client-side validation
// ---------------------------------------------------------------------------
function validateClientSide(data) {
  const errors = {};

  if (!data.student_id)                errors.student_id   = ['Student ID is required.'];
  else if (data.student_id.length > 20) errors.student_id  = ['Student ID must be 20 characters or fewer.'];

  if (!data.full_name)                 errors.full_name    = ['Full name is required.'];
  else if (data.full_name.length < 2)  errors.full_name    = ['Full name must be at least 2 characters.'];

  if (!data.department)                errors.department   = ['Department is required.'];

  if (!data.year || ![1,2,3,4].includes(data.year)) errors.year = ['Please select a valid year (1–4).'];

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email)                     errors.email        = ['Email is required.'];
  else if (!emailRe.test(data.email))  errors.email        = ['Enter a valid email address.'];

  const digits = data.phone_number.replace(/^\+/, '');
  if (!data.phone_number)              errors.phone_number = ['Phone number is required.'];
  else if (!/^\+?\d+$/.test(data.phone_number)) errors.phone_number = ['Digits only (+ prefix allowed).'];
  else if (digits.length < 7 || digits.length > 15) errors.phone_number = ['Phone must be 7–15 digits.'];

  if (!data.address)                   errors.address      = ['Address is required.'];

  return errors;
}


// ---------------------------------------------------------------------------
// Form error display
// ---------------------------------------------------------------------------
const ERROR_IDS = {
  student_id: 'err-student-id', full_name: 'err-full-name',
  department: 'err-department', year: 'err-year', email: 'err-email',
  phone_number: 'err-phone',    address: 'err-address',
};

function clearFormErrors() {
  Object.values(ERROR_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
}

function displayFormErrors(errors) {
  let firstField = null;
  Object.entries(errors).forEach(([field, messages]) => {
    const spanId = ERROR_IDS[field];
    if (spanId) {
      const span = document.getElementById(spanId);
      if (span) span.textContent = Array.isArray(messages) ? messages[0] : messages;
    }
    const inputId = field === 'phone_number' ? 'field-phone' : `field-${field.replace(/_/g, '-')}`;
    const input = document.getElementById(inputId);
    if (input) {
      input.classList.add('field-error');
      if (!firstField) firstField = input;
    }
  });
  if (firstField) firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setSubmitLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const label = document.getElementById('modal-submit-label');
  if (label) label.textContent = isLoading ? 'Saving…' : (editingStudentId ? 'Update Student' : 'Add Student');
}


// ---------------------------------------------------------------------------
// Delete with custom confirmation dialog
// ---------------------------------------------------------------------------
async function confirmDelete(id) {
  const student = cachedStudents.find(s => s.id === id);
  const name = student ? student.full_name : 'this student';
  const confirmed = await showConfirmDialog(
    'Delete Student',
    `Are you sure you want to delete <strong>${esc(name)}</strong>?<br>This action cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await StudentAPI.delete(id);
    showToast(`✓ "${name}" deleted successfully`, 'success');
    await loadStudents();
  } catch (err) {
    showToast(`Failed to delete: ${err.message}`, 'error');
  }
}


// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function updateRecordCount(count) {
  const el = document.getElementById('record-count');
  if (el) el.textContent = count;
}

function esc(str) {
  return escapeHtml(str); // uses global from api.js
}

function avatarInitials(name) {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
