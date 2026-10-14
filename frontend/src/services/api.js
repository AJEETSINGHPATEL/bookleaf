export const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

// In-flight GET requests cache to deduplicate simultaneous duplicate requests
const inFlightRequests = new Map();

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = isGet ? endpoint : null;

  // If an identical GET request is already active in flight, return the shared pending Promise
  if (isGet && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
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
          try {
            const text = await res.text();
            errDetail = text ? text.slice(0, 150) : `Error (${res.status}): Server returned invalid response.`;
          } catch {
            errDetail = `Error (${res.status}): Server returned invalid response.`;
          }
        }
        throw new Error(errDetail);
      }

      return await res.json();
    } finally {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
}
