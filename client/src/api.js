const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  getMe: () => request('/auth/me'),
  guestLogin: () => request('/auth/guest', { method: 'POST', body: {} }),
  logout: () => request('/auth/logout', { method: 'POST', body: {} }),

  getProfiles: () => request('/cv/profiles'),
  createProfile: (data) => request('/cv/profiles', { method: 'POST', body: data }),
  updateProfile: (id, data) => request(`/cv/profiles/${id}`, { method: 'PUT', body: data }),
  deleteProfile: (id) => request(`/cv/profiles/${id}`, { method: 'DELETE' }),

  uploadPhoto: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/upload/photo`, { method: 'POST', body: form, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
  uploadCV: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/upload/cv-file`, { method: 'POST', body: form, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  parseCV: (filePath) => request('/ai/parse-cv', { method: 'POST', body: { filePath } }),
  analyze: (data) => request('/ai/analyze', { method: 'POST', body: data }),
  fitScore: (data) => request('/ai/fit-score', { method: 'POST', body: data }),
  extractKeywords: (data) => request('/ai/extract-keywords', { method: 'POST', body: data }),
  generate: (data) => request('/ai/generate', { method: 'POST', body: data }),
  scrapeAndGenerate: (data) => request('/ai/scrape-and-generate', { method: 'POST', body: data }),
  atsScore: (data) => request('/ai/ats-score', { method: 'POST', body: data }),
  optimize: (data) => request('/ai/optimize', { method: 'POST', body: data }),
  coverLetter: (data) => request('/ai/cover-letter', { method: 'POST', body: data }),

  exportPDF: async (html, filename, cvId) => {
    const res = await fetch(`${BASE}/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ html, filename, cvId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'PDF export failed');
    }
    return res.blob();
  },

  downloadCachedPDF: async (cvId) => {
    const res = await fetch(`${BASE}/cv/generated/${cvId}/pdf`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.blob();
  },

  getGenerated: () => request('/cv/generated'),
  saveGenerated: (data) => request('/cv/generated', { method: 'POST', body: data }),
  updateGenerated: (id, data) => request(`/cv/generated/${id}`, { method: 'PUT', body: data }),

  updateMe: (data) => request('/auth/me', { method: 'PUT', body: data }),
  exportMyData: () => request('/auth/me/export'),
  deleteMe: () => request('/auth/me', { method: 'DELETE' }),

  // Invite system
  claimInvite: (code) => request('/auth/claim-invite', { method: 'POST', body: { code } }),
  getInviteStats: () => request('/auth/invite-stats'),
  joinWaitlist: (email) => request('/auth/waitlist', { method: 'POST', body: { email } }),

  // Legacy referral (no-op)
  claimReferral: () => Promise.resolve({}),
  getReferralStats: () => Promise.resolve({ code: null, referrals: 0, creditsEarned: 0, maxReferrals: 0 }),

  // Notifications
  getNotifications: () => request('/notifications'),
  getNotificationCount: () => request('/notifications/count'),
  markNotificationsRead: (body) => request('/notifications/read', { method: 'POST', body }),

  getPricing: () => request('/payments/pricing'),
  getBalance: () => request('/payments/balance'),
  createCheckout: (tier) => request('/payments/create-checkout', { method: 'POST', body: { tier } }),

  // Admin
  adminOverview: () => request('/admin/stats/overview'),
  adminTimeseries: (params) => request(`/admin/stats/timeseries?${new URLSearchParams(params)}`),
  adminCohort: () => request('/admin/stats/cohort'),
  adminOpenRouter: () => request('/admin/stats/openrouter'),
  adminUsers: (params) => request(`/admin/users?${new URLSearchParams(params)}`),
  adminUserDetail: (id) => request(`/admin/users/${id}`),
  adminUpdateCredits: (id, data) => request(`/admin/users/${id}/credits`, { method: 'PUT', body: data }),
  adminAudit: (params) => request(`/admin/audit?${new URLSearchParams(params)}`),
  adminErrors: (params) => request(`/admin/errors?${new URLSearchParams(params)}`),
  adminWaitlist: (params) => request(`/admin/waitlist?${new URLSearchParams(params)}`),
  adminInviteWaitlist: (id) => request(`/admin/waitlist/${id}/invite`, { method: 'POST', body: {} }),
  adminActivateWaitlist: (id) => request(`/admin/waitlist/${id}/activate`, { method: 'POST', body: {} }),
  adminInviteStats: () => request('/admin/stats/invites'),
  adminActivateUser: (id) => request(`/admin/users/${id}/activate`, { method: 'PUT', body: {} }),
  adminGenerateInvite: () => request('/admin/invite-generate', { method: 'POST', body: {} }),

  // Feedback
  submitFeedback: (data) => request('/feedback', { method: 'POST', body: data }),
  myFeedback: () => request('/feedback/mine'),
  adminFeedback: (params) => request(`/feedback/admin?${new URLSearchParams(params)}`),
  adminRewardFeedback: (id, data) => request(`/feedback/admin/${id}/reward`, { method: 'POST', body: data }),
  adminReviewFeedback: (id, data) => request(`/feedback/admin/${id}/review`, { method: 'POST', body: data }),
};
