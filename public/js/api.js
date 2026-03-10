const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getProfiles: () => request('/cv/profiles'),
  createProfile: (data) => request('/cv/profiles', { method: 'POST', body: data }),
  updateProfile: (id, data) => request(`/cv/profiles/${id}`, { method: 'PUT', body: data }),
  deleteProfile: (id) => request(`/cv/profiles/${id}`, { method: 'DELETE' }),

  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/upload/photo`, { method: 'POST', body: form, credentials: 'include' })
      .then(r => r.json());
  },
  uploadCV: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/upload/cv-file`, { method: 'POST', body: form, credentials: 'include' })
      .then(r => r.json());
  },

  parseCV: (filePath) => request('/ai/parse-cv', { method: 'POST', body: { filePath } }),
  analyze: (data) => request('/ai/analyze', { method: 'POST', body: data }),
  generate: (data) => request('/ai/generate', { method: 'POST', body: data }),
  atsScore: (data) => request('/ai/ats-score', { method: 'POST', body: data }),
  optimize: (data) => request('/ai/optimize', { method: 'POST', body: data }),

  getGenerated: () => request('/cv/generated'),
  saveGenerated: (data) => request('/cv/generated', { method: 'POST', body: data }),
};
