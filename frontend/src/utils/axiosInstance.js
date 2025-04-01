import axios from 'axios';

const TIMEOUT_DURATION = 15000; // 15 seconds
const MAX_RETRIES = 2;

const axiosInstance = axios.create({
 // baseURL: 'https://eventcirclebackend.vercel.app/api/',
  // baseURL: 'http://localhost:4000/api/',
  baseURL: import.meta.env.VITE_REACT_APP_BACKEND_BASEURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: TIMEOUT_DURATION,
});

// Retry logic
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.code === 'ECONNABORTED' && !originalRequest._retry) {
      originalRequest._retry = (originalRequest._retry || 0) + 1;
      
      if (originalRequest._retry <= MAX_RETRIES) {
        return axiosInstance(originalRequest);
      }
    }
    
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Add device info to help with debugging
    config.headers['X-Device-Type'] = 'mobile';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
