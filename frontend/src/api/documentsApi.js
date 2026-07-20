import axiosClient from './axiosClient';

export async function uploadApplicationDocument(applicationId, data) {
  const formData = new FormData();
  formData.append('document_type', data.document_type);
  formData.append('uploaded_by', data.uploaded_by);
  formData.append('actor_type', data.actor_type || 'applicant');
  if (data.notes) {
    formData.append('notes', data.notes);
  }
  formData.append('file', data.file);

  const response = await axiosClient.post(`/applications/${applicationId}/documents`, formData);
  return response.data;
}

export async function replaceApplicationDocument(applicationId, documentId, data) {
  const formData = new FormData();
  formData.append('document_type', data.document_type);
  formData.append('uploaded_by', data.uploaded_by);
  formData.append('actor_type', data.actor_type || 'applicant');
  if (data.notes) {
    formData.append('notes', data.notes);
  }
  formData.append('file', data.file);

  const response = await axiosClient.put(`/applications/${applicationId}/documents/${documentId}`, formData);
  return response.data;
}

export async function getApplicationDocuments(applicationId) {
  const response = await axiosClient.get(`/applications/${applicationId}/documents`);
  return response.data;
}

export async function deleteApplicationDocument(applicationId, documentId) {
  const response = await axiosClient.delete(`/applications/${applicationId}/documents/${documentId}`);
  return response.data;
}

export async function reviewApplicationDocument(applicationId, documentId, data) {
  const response = await axiosClient.patch(`/applications/${applicationId}/documents/${documentId}/review`, data);
  return response.data;
}
