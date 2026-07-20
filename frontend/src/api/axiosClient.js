import axios from 'axios';
import { clearSession, expireSession, isStoredTokenExpired } from '../utils/session';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
});

axiosClient.interceptors.request.use((config) => {
  if (isStoredTokenExpired()) {
    expireSession();
    window.location.assign('/');
    return Promise.reject(new Error('Session expired'));
  }

  const token = localStorage.getItem('lrmis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : 'Your session expired. Please sign in again.';
      expireSession(message);
      if (window.location.pathname !== '/') {
        window.location.assign('/');
      } else {
        clearSession();
      }
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
