import axios from 'axios';

// Detect if we are on local development (Vite), production web, or mobile app
const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '5173';
const isMobileApp = window.location.hostname === 'localhost' && !window.location.port || window.location.protocol.startsWith('capacitor');

const BASE_URL = isLocal 
  ? 'http://localhost:8000/api' 
  : isMobileApp 
    ? 'https://kimerp.ddns.net/api'
    : `${window.location.protocol}//${window.location.hostname}${window.location.port && window.location.port !== '80' && window.location.port !== '443' ? ':' + window.location.port : ''}/api`;

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  console.error('API Error:', err.message, err.response?.status, err.response?.data);
  return Promise.reject(err);
});

export default api;
export { BASE_URL };
