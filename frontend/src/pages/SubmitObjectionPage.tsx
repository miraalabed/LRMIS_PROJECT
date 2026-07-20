import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApplications } from '../api/applicationsApi';
import { getApplicationDocuments } from '../api/documentsApi';
import { getApplicationObjections, createApplicationObjection } from '../api/objectionsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../components/ToastProvider';
import { formatValue, getErrorMessage } from '../utils/errors';
import { refreshSessionUser, type SessionUser } from '../utils/session';

type ApplicationOption = {
  id: string;
  application_type?: string;
  status?: string;
  parcel_ref?: { parcel_number?: string };
};

type Objection = {
  id?: string;
  application_id?: string;
  reason?: string;
  submitted_by?: string;
  actor_type?: string;
  status?: string;
  created_at?: string;
  supporting_document_ids?: string[];
};

type UploadedDocument = {
  id?: string;
  document_type?: string;
  original_filename?: string;
  status?: string;
  verified?: boolean;
  uploaded_at?: string;
};

export function SubmitObjectionPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState(searchParams.get('applicationId') ?? '');
  const [reason, setReason] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
    async function loadSelectedApplicationData() {
      if (!selectedApplicationId) {
        setObjections([]);
        setUploadedDocuments([]);
        setSelectedDocumentIds([]);
        return;
      }

      try {
        setError('');
        setIsLoadingDocuments(true);
        setSelectedDocumentIds([]);
        const [nextObjections, nextDocuments] = await Promise.all([
          getApplicationObjections(selectedApplicationId),
          getApplicationDocuments(selectedApplicationId),
        ]);
        setObjections(nextObjections as Objection[]);
        setUploadedDocuments(nextDocuments as UploadedDocument[]);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    loadSelectedApplicationData();
  }, [selectedApplicationId]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedApplicationId),
    [applications, selectedApplicationId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setValidationErrors([]);

    const errors: string[] = [];
    if (!selectedApplicationId) {
      errors.push('Choose an application before submitting an objection.');
    }

    if (reason.trim().length < 20) {
      errors.push('Objection reason must be at least 20 characters.');
    }

    if (reason.trim().length > 1200) {
      errors.push('Objection reason must be 1200 characters or fewer.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      showToast({ type: 'error', title: 'Review objection', message: errors[0] });
      return;
    }

    const submittedBy = user?.linked_applicant_id || user?.id;
    if (!submittedBy) {
      setError('Your applicant session could not be verified. Sign in again.');
      showToast({ type: 'error', title: 'Session problem', message: 'Sign in again before submitting an objection.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const objection = await createApplicationObjection(selectedApplicationId, {
        reason: reason.trim(),
        submitted_by: submittedBy,
        actor_type: 'applicant',
        supporting_document_ids: selectedDocumentIds,
      });
      setSuccess(`Objection ${String(objection.id)} submitted.`);
      showToast({ type: 'success', title: 'Objection submitted', message: `Objection ${String(objection.id)} was recorded.` });
      setReason('');
      setSelectedDocumentIds([]);
      setObjections((await getApplicationObjections(selectedApplicationId)) as Objection[]);
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setError(message);
      showToast({ type: 'error', title: 'Objection failed', message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSupportingDocument(documentId: string) {
    setSelectedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((id) => id !== documentId)
        : [...currentIds, documentId],
    );
  }

  return (
    <div className="page-stack">
      <Card>
        <p className="eyebrow">Applicant objection</p>
        <h1 className="page-title">Submit objection</h1>
        <p className="muted">Choose an application and submit an objection reason under your applicant profile.</p>
      </Card>

      <Card>
        {isLoading && <LoadingSpinner label="Loading applications" />}
        <ErrorMessage message={error} />

        {!isLoading && applications.length === 0 && (
          <div className="empty-state">
            <h3>No applications available</h3>
            <p>Submit an application first. Objections are attached to an existing application record.</p>
          </div>
        )}

        {!isLoading && applications.length > 0 && (
          <form onSubmit={handleSubmit} className="application-form">
            <section className="profile-summary">
              <div>
                <p className="eyebrow">Selected application</p>
                <h2>{formatLabel(selectedApplication?.application_type)}</h2>
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

            <div className="submitted-by-panel">
              <div>
                <dt>Submitted by</dt>
                <dd>{user?.username ?? 'Applicant account'}</dd>
              </div>
              <div>
                <dt>Applicant reference</dt>
                <dd>{user?.linked_applicant_id ?? user?.id ?? 'Not available'}</dd>
              </div>
              <div>
                <dt>Actor type</dt>
                <dd>applicant</dd>
              </div>
            </div>

            <label className="field">
              Objection reason
              <textarea
                rows={6}
                value={reason}
                maxLength={1200}
                onChange={(event) => {
                  setReason(event.target.value);
                  setValidationErrors([]);
                  setSuccess('');
                }}
                placeholder="Explain the objection, what is disputed, and what evidence supports it."
                required
              />
              <small className="muted">{reason.trim().length}/1200 characters. Minimum 20.</small>
            </label>

            <section className="supporting-document-panel">
              <div className="details-section-header">
                <div>
                  <p className="eyebrow">Supporting documents</p>
                  <h2 className="compact-heading">Choose from uploaded files</h2>
                </div>
                {selectedApplicationId && (
                  <Link className="text-link" to={`/upload-documents?applicationId=${selectedApplicationId}`}>
                    Upload documents
                  </Link>
                )}
              </div>

              {isLoadingDocuments && <p className="muted">Loading uploaded documents...</p>}

              {!isLoadingDocuments && uploadedDocuments.length === 0 && (
                <div className="empty-inline">
                  <strong>No uploaded documents yet</strong>
                  <span>Upload files for this application, then return here to attach them to your objection.</span>
                  {selectedApplicationId && (
                    <Link className="text-link" to={`/upload-documents?applicationId=${selectedApplicationId}`}>
                      Upload supporting documents
                    </Link>
                  )}
                </div>
              )}

              {!isLoadingDocuments && uploadedDocuments.length > 0 && (
                <div className="supporting-document-list">
                  {uploadedDocuments.map((document) => {
                    const documentId = document.id ?? '';

                    return (
                      <label key={documentId || document.original_filename} className="supporting-document-option">
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(documentId)}
                          disabled={!documentId}
                          onChange={() => toggleSupportingDocument(documentId)}
                        />
                        <span>
                          <strong>{document.document_type?.replace(/_/g, ' ') ?? 'Document'}</strong>
                          <small>
                            {document.original_filename ?? documentId} | {document.verified ? 'Verified' : document.status ?? 'pending'} |{' '}
                            {document.uploaded_at ? new Date(document.uploaded_at).toLocaleString() : 'Upload date unavailable'}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {validationErrors.length > 0 && (
              <div className="validation-box">
                {validationErrors.map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </div>
            )}
            {success && (
              <div className="notice-box success-box">
                <strong>{success}</strong>
                <span>The application status will move to under objection.</span>
              </div>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit objection'}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <p className="eyebrow">Existing objections</p>
        <h2 style={{ marginTop: 0 }}>Objection list</h2>
        {!selectedApplicationId && <p className="muted">Choose an application to see objections.</p>}
        {selectedApplicationId && objections.length === 0 && <p className="muted">No objections submitted for this application yet.</p>}
        {objections.length > 0 && (
          <div className="document-list">
            {objections.map((objection) => (
              <article key={objection.id} className="document-item">
                <div>
                  <strong>{objection.id ?? 'Objection'}</strong>
                  <span>{objection.reason}</span>
                  <small>{objection.created_at ? new Date(objection.created_at).toLocaleString() : 'Submission date unavailable'}</small>
                  {objection.supporting_document_ids?.length ? (
                    <small>Supporting documents: {objection.supporting_document_ids.join(', ')}</small>
                  ) : (
                    <small>No supporting documents attached.</small>
                  )}
                </div>
                <span className="document-status">{objection.status ?? 'pending'}</span>
              </article>
            ))}
          </div>
        )}
      </Card>
      {selectedApplicationId && (
        <Card>
          <div className="scope-actions">
            <Link className="button-link" to={`/applications/${selectedApplicationId}`}>Open application details</Link>
            <Link className="button-link secondary-link" to={`/upload-documents?applicationId=${selectedApplicationId}`}>Upload documents</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Application';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
