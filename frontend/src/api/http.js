const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  config: () => request('/config'),
  updateConfig: (body) => request('/config', { method: 'PUT', body: JSON.stringify(body) }),
  status: () => request('/bot/status'),
  start: (body) => request('/bot/start', { method: 'POST', body: JSON.stringify(body) }),
  stop: () => request('/bot/stop', { method: 'POST' }),
  restart: (body) => request('/bot/restart', { method: 'POST', body: JSON.stringify(body) }),
  send: (body) => request('/bot/send', { method: 'POST', body: JSON.stringify(body) }),
  mockInject: (body) => request('/bot/mock-inject', { method: 'POST', body: JSON.stringify(body) }),
  contacts: () => request('/contacts'),
  messages: (after = 0) => request(`/bot/messages?after=${after}`),
  chat: (text) => request('/chat', { method: 'POST', body: JSON.stringify({ text }) }),
};
