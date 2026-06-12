import axios from 'axios';

// Use relative path so Vite proxy (and any tunnel) handles routing correctly
const BASE_URL = '/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('sos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/');
    if (err.response?.status === 401 && !isLoginRequest) {
      // Clear storage immediately so any subsequent request doesn't retry
      // the stale token. Navigation is handled via SPA event in App.jsx —
      // no full page reload, React state and WebSocket are preserved.
      localStorage.removeItem('sos_token');
      localStorage.removeItem('sos_user');
      window.dispatchEvent(new CustomEvent('sos:session-expired'));
    }
    return Promise.reject(err);
  }
);

export default client;
