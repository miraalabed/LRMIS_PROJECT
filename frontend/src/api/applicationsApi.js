import axiosClient from './axiosClient';

export async function createApplication(data, idempotencyKey) {
  const response = await axiosClient.post('/applications/', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

export async function getApplications(params) {
  const response = await axiosClient.get('/applications/', { params });
  return response.data;
}

export async function getApplicationById(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}`);
  return response.data;
}

export async function addApplicationComment(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/comments`, data);
  return response.data;
}

export async function getApplicationTimeline(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}/timeline`);
  return response.data;
}

export async function getApplicationCertificates(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}/certificates`);
  return response.data;
}

export async function transitionApplication(applicationId, data) {
  const response = await axiosClient.patch(`/applications/${applicationId}/transition`, data);
  return response.data;
}

export async function holdApplication(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/hold`, data);
  return response.data;
}

export async function rejectApplication(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/reject`, data);
  return response.data;
}

export async function resumeApplication(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/resume`, data);
  return response.data;
}

export async function issueApplicationCertificate(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/certificate`, data);
  return response.data;
}
