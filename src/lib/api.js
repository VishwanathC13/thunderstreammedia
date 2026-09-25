const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  try {
    return localStorage.getItem('ah_token');
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const apiGet = (path, opts) => request(path, { ...opts, method: 'GET' });
export const apiPost = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
export const apiPatch = (path, body, opts) => request(path, { ...opts, method: 'PATCH', body });
export const apiDelete = (path, opts) => request(path, { ...opts, method: 'DELETE' });

// The backend returns relative /media/* paths; the frontend and backend
// run on different origins in dev (5173 vs 4000), so those need the API
// base URL prefixed before they're usable as an <img>/<video> src.
export const mediaUrl = (path) => (path ? `${BASE_URL}${path}` : null);

export { BASE_URL };
