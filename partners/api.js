/**
 * Moonshot Partner API Client
 * Shared helper for all partner portal pages — handles auth, tenant header, error handling.
 */

const API_BASE = 'https://api.moonshotclinic.com';
const TENANT_SLUG = 'moonshot';
const TOKEN_KEY = 'ms_partner_token';

// --- Auth helpers ---

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

// --- API fetch wrapper ---

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'X-Tenant-Slug': TENANT_SLUG,
    ...(options.headers || {}),
  };

  // Only set Content-Type for requests with a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 — redirect to login
  if (res.status === 401 && !options.skipAuthRedirect) {
    clearToken();
    window.location.href = '/partners/login.html';
    throw new Error('Session expired');
  }

  return res;
}

// Convenience methods
async function apiGet(path, options) {
  return apiFetch(path, { method: 'GET', ...options });
}

async function apiPost(path, body, options) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
}

// --- Exports (global namespace for vanilla JS pages) ---

const PartnerAPI = {
  API_BASE,
  TENANT_SLUG,
  getToken,
  setToken,
  clearToken,
  isLoggedIn,
  apiFetch,
  apiGet,
  apiPost,
};
