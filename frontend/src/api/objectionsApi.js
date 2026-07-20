import axiosClient from './axiosClient';

export async function createApplicationObjection(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/objections`, data);
  return response.data;
}

export async function getApplicationObjections(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}/objections`);
  return response.data;
}
