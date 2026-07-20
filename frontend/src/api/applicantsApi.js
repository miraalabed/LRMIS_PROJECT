import axiosClient from './axiosClient';

export async function createApplicant(data) {
  const response = await axiosClient.post('/applicants/', data);
  return response.data;
}

export async function updateApplicant(applicantId, data) {
  const response = await axiosClient.patch(`/applicants/${applicantId}`, data);
  return response.data;
}

export async function getApplicantById(applicantId) {
  const response = await axiosClient.get(`/applicants/${applicantId}`);
  return response.data;
}

export async function getApplicantApplications(applicantId) {
  const response = await axiosClient.get(`/applicants/${applicantId}/applications`);
  return response.data;
}
