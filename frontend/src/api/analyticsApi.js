import axiosClient from './axiosClient';

export async function getKpis() {
  const response = await axiosClient.get('/analytics/kpis');
  return response.data;
}

export async function getApplicationsByStatus() {
  const response = await axiosClient.get('/analytics/applications-by-status');
  return response.data;
}

export async function getApplicationsByZone() {
  const response = await axiosClient.get('/analytics/applications-by-zone');
  return response.data;
}

export async function getProcessingTime() {
  const response = await axiosClient.get('/analytics/processing-time');
  return response.data;
}

export async function getSurveyorAnalytics() {
  const response = await axiosClient.get('/analytics/surveyors');
  return response.data;
}

export async function getRegistrarAnalytics() {
  const response = await axiosClient.get('/analytics/registrars');
  return response.data;
}

export async function getParcelsGeoFeed(params = {}) {
  const response = await axiosClient.get('/analytics/geofeeds/parcels', { params });
  return response.data;
}

export async function getPendingHeatmap() {
  const response = await axiosClient.get('/analytics/geofeeds/pending-heatmap');
  return response.data;
}
