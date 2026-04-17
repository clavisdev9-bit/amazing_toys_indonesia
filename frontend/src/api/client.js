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
      localStorage.removeItem('sos_token');
      localStorage.removeItem('sos_user');
      window.location.href = '/masuk';
    }
    return Promise.reject(err);
  }
);

export default client;
