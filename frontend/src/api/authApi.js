import axiosClient from './axiosClient';

export async function registerUser(data) {
  const response = await axiosClient.post('/auth/register', data);
  return response.data;
}

export async function loginUser(data) {
  const response = await axiosClient.post('/auth/login', data);
  return response.data;
}

export async function getCurrentUser() {
  const response = await axiosClient.get('/auth/me');
  return response.data;
}
