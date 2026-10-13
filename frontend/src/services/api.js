const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('bookleaf_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('bookleaf_token', token);
  } else {
    localStorage.removeItem('bookleaf_token');
  }
}

export function getCurrentUser() {
  const user = localStorage.getItem('bookleaf_user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('bookleaf_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('bookleaf_user');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    // Session expired
    setAuthToken(null);
    setCurrentUser(null);
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!res.ok) {
    let errDetail = 'Request failed';
    try {
      const errData = await res.json();
      errDetail = errData.detail || errData.message || JSON.stringify(errData);
    } catch {
      errDetail = `${res.status} ${res.statusText}`;
    }
    throw new Error(errDetail);
  }

  return res.json();
}
