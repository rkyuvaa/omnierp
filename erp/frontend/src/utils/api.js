import axios from 'axios';

// Dynamically use the current host so the app works regardless of server IP
const BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000/api`;

const api = axios.create({ baseURL: BASE_URL });

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
  return Promise.reject(err);
});

export default api;
export { BASE_URL };
