import axiosClient from './axiosClient';

export async function listStaff(params = {}) {
  const response = await axiosClient.get('/staff/', { params });
  return response.data;
}

export async function getStaff(staffId) {
  const response = await axiosClient.get(`/staff/${staffId}`);
  return response.data;
}

export async function listSurveyTasks(params = {}) {
  const response = await axiosClient.get('/survey-tasks/', { params });
  return response.data;
}

export async function autoAssignSurveyor(applicationId) {
  const response = await axiosClient.post(`/applications/${applicationId}/auto-assign-surveyor`);
  return response.data;
}

export async function updateSurveyMilestone(applicationId, data) {
  const response = await axiosClient.patch(`/applications/${applicationId}/survey-milestone`, data);
  return response.data;
}

export async function uploadSurveyReport(applicationId, data) {
  const response = await axiosClient.post(`/applications/${applicationId}/survey-report`, data);
  return response.data;
}

export async function getSurveyReport(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}/survey-report`);
  return response.data;
}

export async function registrarReview(applicationId, data) {
  const response = await axiosClient.patch(`/applications/${applicationId}/registrar-review`, data);
  return response.data;
}
