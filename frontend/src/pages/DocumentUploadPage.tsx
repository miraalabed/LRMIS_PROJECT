import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApplications } from '../api/applicationsApi';
import { deleteApplicationDocument, getApplicationDocuments, replaceApplicationDocument, uploadApplicationDocument } from '../api/documentsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { formatValue, getErrorMessage } from '../utils/errors';
import { refreshSessionUser, type SessionUser } from '../utils/session';

const documentTypes = ['identity_document', 'proof_of_ownership', 'power_of_attorney', 'survey_plan', 'tax_clearance', 'other'];
const maxFileSizeBytes = 5 * 1024 * 1024;
const allowedFileTypes = ['application/pdf', 'image/jpeg', 'image/png'];
const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

type ApplicationOption = {
  id: string;
  application_type?: string;
  status?: string;
  parcel_ref?: { parcel_number?: string };
  required_documents?: string[];
};

type UploadedDocument = {
  id?: string;
  document_type?: string;
  original_filename?: string;
  content_type?: string;
  status?: string;
  verified?: boolean;
  uploaded_at?: string;
  notes?: string;
};

export function DocumentUploadPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState(searchParams.get('applicationId') ?? '');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replaceDocumentId, setReplaceDocumentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeDocumentAction, setActiveDocumentAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadApplications() {
      try {
        const currentUser = await refreshSessionUser();
        setUser(currentUser);
        const response = await getApplications({
          limit: 100,
          sort_by: 'created_at',
          sort_dir: 'desc',
          ...(currentUser.linked_applicant_id ? { applicant_id: currentUser.linked_applicant_id } : {}),
        });
        const items = (response.data as ApplicationOption[]) ?? [];
        setApplications(items);
        if (!selectedApplicationId && items[0]) {
          setSelectedApplicationId(items[0].id);
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    loadApplications();
  }, []);

  useEffect(() => {
    async function loadDocuments() {
      if (!selectedApplicationId) {
        setDocuments([]);
        return;
      }

      try {
        setError('');
        const nextDocuments = (await getApplicationDocuments(selectedApplicationId)) as UploadedDocument[];
        setDocuments(nextDocuments);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      }
    }

    loadDocuments();
  }, [selectedApplicationId]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedApplicationId),
    [applications, selectedApplicationId],
  );
  const uploadedTypes = useMemo(() => new Set(documents.map((document) => document.document_type)), [documents]);
  const missingRequiredDocuments = useMemo(
    () => (selectedApplication?.required_documents ?? []).filter((documentType) => !uploadedTypes.has(documentType)),
    [selectedApplication?.required_documents, uploadedTypes],
  );

  useEffect(() => {
    if (!replaceDocumentId && missingRequiredDocuments[0]) {
      setDocumentType(missingRequiredDocuments[0]);
    }
  }, [missingRequiredDocuments, replaceDocumentId]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSuccess('');
    setError('');

    if (nextFile) {
      const validationError = validateFile(nextFile);
      if (validationError) {
        setFile(null);
        event.target.value = '';
        setError(validationError);
        showToast({ type: 'error', title: 'File not allowed', message: validationError });
        return;
      }
    }

    setFile(nextFile);
    setSuccess('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedApplicationId) {
      setError('Choose an application before uploading a document.');
      showToast({ type: 'error', title: 'Choose an application', message: 'Documents must be attached to an application.' });
      return;
    }

    if (!file) {
      setError('Choose a file to upload.');
      showToast({ type: 'error', title: 'Choose a file', message: 'Select a PDF, JPG, or PNG before uploading.' });
      return;
    }

    const uploadedBy = user?.linked_applicant_id || user?.id;
    if (!uploadedBy) {
      setError('Your applicant session could not be verified. Sign in again.');
      showToast({ type: 'error', title: 'Session problem', message: 'Sign in again before uploading documents.' });
      return;
    }

    setIsUploading(true);
    try {
      const payload = {
        document_type: documentType,
        uploaded_by: uploadedBy,
        actor_type: 'applicant',
        notes,
        file,
      };
      const uploaded = replaceDocumentId
        ? await replaceApplicationDocument(selectedApplicationId, replaceDocumentId, payload)
        : await uploadApplicationDocument(selectedApplicationId, payload);
      const action = replaceDocumentId ? 'Replaced' : 'Uploaded';
      const filename = String(uploaded.original_filename ?? file.name);
      setSuccess(`${action} ${filename}.`);
      showToast({ type: 'success', title: `${action} document`, message: filename });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setReplaceDocumentId('');
      setNotes('');
      const updatedDocuments = await getApplicationDocuments(selectedApplicationId);
      setDocuments(updatedDocuments as UploadedDocument[]);
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      setError(message);
      showToast({ type: 'error', title: 'Upload failed', message });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(documentId?: string) {
    if (!documentId || !selectedApplicationId) {
      return;
    }

    const confirmed = window.confirm('Delete this uploaded document?');
    if (!confirmed) {
      return;
    }

    setActiveDocumentAction(documentId);
    setError('');
    setSuccess('');
    try {
      await deleteApplicationDocument(selectedApplicationId, documentId);
      setSuccess('Document deleted.');
      showToast({ type: 'success', title: 'Document deleted', message: 'The uploaded file was removed.' });
      setDocuments((await getApplicationDocuments(selectedApplicationId)) as UploadedDocument[]);
    } catch (deleteError) {
      const message = getErrorMessage(deleteError);
      setError(message);
      showToast({ type: 'error', title: 'Delete failed', message });
    } finally {
      setActiveDocumentAction('');
    }
  }

  function startReplace(document: UploadedDocument) {
    setReplaceDocumentId(document.id ?? '');
    setDocumentType(document.document_type ?? documentTypes[0]);
    setNotes(document.notes ?? '');
    setSuccess('');
    setError('');
  }

  function cancelReplacement() {
    setReplaceDocumentId('');
    setNotes('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <p className="eyebrow">Applicant documents</p>
        <h1 className="page-title">Upload documents</h1>
        <p className="muted">Choose one of your applications, select a document type, and upload the supporting file.</p>
      </Card>

      <Card>
        {isLoading && <LoadingSpinner label="Loading applications" />}
        <ErrorMessage message={error} />

        {!isLoading && applications.length === 0 && (
          <div className="empty-state">
            <h3>No applications available</h3>
            <p>Submit an application first. Document uploads are attached to an existing application record.</p>
            <Link to="/submit-application" className="button-link">Submit application</Link>
          </div>
        )}

        {!isLoading && applications.length > 0 && (
          <form onSubmit={handleSubmit} className="application-form">
            <section className="profile-summary">
              <div>
                <p className="eyebrow">Selected application</p>
                <h2>{formatLabel(selectedApplication?.application_type) ?? 'Application'}</h2>
                <p>{selectedApplicationId} | Parcel {formatValue(selectedApplication?.parcel_ref?.parcel_number)}</p>
              </div>
              <label className="field application-picker">
                Application
                <select value={selectedApplicationId} onChange={(event) => setSelectedApplicationId(event.target.value)}>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.id} - {application.application_type?.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <div className="form-grid">
              <label className="field">
                Document type
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                File
                <input ref={fileInputRef} type="file" accept={allowedExtensions.join(',')} onChange={handleFileChange} />
              </label>
              <label className="field full-span">
                Notes
                <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>

            <RequiredDocumentsPanel
              requiredDocuments={selectedApplication?.required_documents ?? []}
              uploadedTypes={uploadedTypes}
            />

            {success && (
              <div className="notice-box success-box">
                <strong>{success}</strong>
                <span>The document list below has been refreshed.</span>
              </div>
            )}
            <div className="upload-rules">
              <span>Allowed: PDF, JPG, PNG</span>
              <span>Maximum size: 5 MB</span>
              {file && <strong>Selected: {file.name} ({formatFileSize(file.size)})</strong>}
              {replaceDocumentId && <strong>Replacing document ID: {replaceDocumentId}</strong>}
            </div>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : replaceDocumentId ? 'Replace document' : 'Upload document'}
            </Button>
            {replaceDocumentId && (
              <button type="button" className="text-link" onClick={cancelReplacement}>
                Cancel replacement
              </button>
            )}
          </form>
        )}
      </Card>

      <Card>
        <p className="eyebrow">Uploaded files</p>
        <h2 style={{ marginTop: 0 }}>Document list</h2>
        {selectedApplicationId && (
          <div className="scope-actions" style={{ marginBottom: 16 }}>
            <Link to={`/applications/${selectedApplicationId}`} className="text-link">Open application details</Link>
            {missingRequiredDocuments.length > 0 && <span className="muted">{missingRequiredDocuments.length} required type(s) still missing.</span>}
          </div>
        )}
        {!selectedApplicationId && <p className="muted">Choose an application to see uploaded documents.</p>}
        {selectedApplicationId && documents.length === 0 && <p className="muted">No documents uploaded for this application yet.</p>}
        {documents.length > 0 && (
          <div className="document-list">
            {documents.map((document) => (
              <article key={document.id ?? document.original_filename} className="document-item">
                <div>
                  <strong>{document.document_type?.replace(/_/g, ' ') ?? 'Document'}</strong>
                  <span>{document.original_filename ?? 'Unnamed file'}</span>
                  <small>{document.content_type ?? 'Unknown type'} | {document.uploaded_at ? new Date(document.uploaded_at).toLocaleString() : 'Upload date unavailable'}</small>
                </div>
                <div className="document-actions">
                  <span className="document-status">{document.verified ? 'Verified' : document.status ?? 'pending'}</span>
                  <button type="button" className="text-link" onClick={() => startReplace(document)}>Replace</button>
                  <button type="button" className="text-link danger-link" disabled={activeDocumentAction === document.id} onClick={() => handleDeleteDocument(document.id)}>
                    {activeDocumentAction === document.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RequiredDocumentsPanel({
  requiredDocuments,
  uploadedTypes,
}: {
  requiredDocuments: string[];
  uploadedTypes: Set<string | undefined>;
}) {
  if (requiredDocuments.length === 0) {
    return (
      <div className="empty-inline">
        <strong>No required document list</strong>
        <span>Select the best matching document type for the file you are uploading.</span>
      </div>
    );
  }

  return (
    <section className="supporting-document-panel">
      <div>
        <p className="eyebrow">Required documents</p>
        <h2 className="compact-heading">Upload checklist</h2>
      </div>
      <div className="requirement-list">
        {requiredDocuments.map((documentType) => {
          const isUploaded = uploadedTypes.has(documentType);
          return (
            <div key={documentType} className="requirement-item">
              <span>{formatLabel(documentType)}</span>
              <StatusBadge status={isUploaded ? 'approved' : 'missing_documents'} label={isUploaded ? 'Uploaded' : 'Missing'} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function validateFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((extension) => lowerName.endsWith(extension));

  if (!allowedFileTypes.includes(file.type) && !hasAllowedExtension) {
    return 'Only PDF, JPG, and PNG files are allowed.';
  }

  if (file.size > maxFileSizeBytes) {
    return 'File must be 5 MB or smaller.';
  }

  return '';
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
