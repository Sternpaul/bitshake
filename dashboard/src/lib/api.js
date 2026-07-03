const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Make an authenticated API request.
 * @param {string} endpoint - API endpoint (e.g., '/api/readings/live')
 * @param {object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Token expired — redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bitshake_user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  // Handle CSV responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return response.blob();
  }

  return response.json();
}

/**
 * Login and store JWT token.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object>}
 */
export async function login(username, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Login failed');
  }

  const data = await response.json();
  localStorage.setItem('bitshake_user', JSON.stringify(data.user));
  return data;
}

/**
 * Logout — clear stored credentials.
 */
export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.error('Logout failed:', err);
  }
  localStorage.removeItem('bitshake_user');
  window.location.href = '/login';
}

/**
 * Check if user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('bitshake_user');
}

/**
 * Get stored user info.
 * @returns {object|null}
 */
export function getUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('bitshake_user');
  return user ? JSON.parse(user) : null;
}

// ── Convenience API Methods ─────────────────────────────────

export const api = {
  // Readings
  getLive: () => apiRequest('/api/readings/live'),
  getRecent: (minutes = 30) => apiRequest(`/api/readings/recent?minutes=${minutes}`),
  getHistory: (range = '24h') => apiRequest(`/api/readings/history?range=${range}`),
  getDaily: (date) => apiRequest(`/api/readings/daily?date=${date}`),

  // Stats
  getOverview: () => apiRequest('/api/stats/overview'),
  getHourlyProfile: (days = 30) => apiRequest(`/api/stats/hourly-profile?days=${days}`),
  getComparison: (range = '7d') => apiRequest(`/api/stats/compare?range=${range}`),

  // Settings
  getSettings: () => apiRequest('/api/settings'),
  updateSettings: (settings) => apiRequest('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // Auth
  changePassword: (currentPassword, newPassword) => apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }),
  verifyToken: () => apiRequest('/api/auth/verify'),

  // Export
  exportCSV: async (from, to) => {
    const blob = await apiRequest(`/api/readings/export?from=${from}&to=${to}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitshake_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Health
  getHealth: () => apiRequest('/api/health'),
};
