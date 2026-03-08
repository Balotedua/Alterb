const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  return res.json();
}

export const apiGet    = (path)         => request('GET',    path);
export const apiPost   = (path, body)   => request('POST',   path, body);
export const apiPut    = (path, body)   => request('PUT',    path, body);
export const apiDelete = (path)         => request('DELETE', path);
