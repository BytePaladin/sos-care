const API_BASE = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('sos_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  login: async (phone, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('sos_token', data.token);
    }
    return data;
  },

  register: async (name, phone, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('sos_token', data.token);
    }
    return data;
  },

  updateTelegram: async (telegramOptIn, telegramChatId) => {
    const res = await fetch(`${API_BASE}/auth/telegram`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ telegramOptIn, telegramChatId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update Telegram settings');
    }
    return await res.json();
  },

  getStaffMembers: async () => {
    const res = await fetch(`${API_BASE}/auth/staff`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  // Triage
  getPatients: async () => {
    const res = await fetch(`${API_BASE}/triage/patients`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch patients');
    }
    return await res.json();
  },

  updatePatientStatus: async (id, reviewStatus, reviewComment, forwardedTo) => {
    const res = await fetch(`${API_BASE}/triage/patients/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ reviewStatus, reviewComment, forwardedTo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update patient status');
    }
    return await res.json();
  },

  addPatientNote: async (id, text) => {
    const res = await fetch(`${API_BASE}/triage/patients/${id}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to add note');
    }
    return await res.json();
  },

  // Chats
  createChatSession: async () => {
    const res = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to create chat session');
    return await res.json();
  },

  sendChatMessage: async (sessionId, text) => {
    const res = await fetch(`${API_BASE}/chats/${sessionId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return await res.json();
  },

  // Admin Portal
  adminLogin: async (phone, password) => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Admin authentication failed');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('sos_token', data.token);
    }
    return data;
  },

  createStaff: async (name, phone, password, staffRole) => {
    const res = await fetch(`${API_BASE}/admin/staff`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, phone, password, staffRole }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create staff account');
    }
    return await res.json();
  },

  getAllUsers: async () => {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch users');
    }
    return await res.json();
  },

  deleteUserAccount: async (id) => {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete account');
    }
    return await res.json();
  },

  getHospitalAnalytics: async () => {
    const res = await fetch(`${API_BASE}/admin/analytics`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch hospital analytics');
    }
    return await res.json();
  },

  getStaffAnalytics: async () => {
    const res = await fetch(`${API_BASE}/admin/staff-analytics`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch staff analytics');
    }
    return await res.json();
  },

  getStaffActions: async () => {
    const res = await fetch(`${API_BASE}/admin/staff-actions`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch staff actions audit log');
    }
    return await res.json();
  },
};
