import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApplicationById, getApplications } from '../api/applicationsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../utils/errors';
import { getStoredSessionUser } from '../utils/session';

type Application = Record<string, unknown> & {
  id?: string;
  status?: string;
  application_type?: string;
  parcel_ref?: { parcel_number?: string; zone_id?: string };
  required_documents?: string[];
  uploaded_documents?: unknown[];
  workflow?: { current_state?: string; allowed_next?: string[] };
  created_at?: string;
  updated_at?: string;
};

export function TrackApplicationPage() {
  const { showToast } = useToast();
  const user = getStoredSessionUser();
  const [applicationId, setApplicationId] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRecentApplications() {
      try {
        const response = await getApplications({
          limit: 8,
          sort_by: 'created_at',
          sort_dir: 'desc',
          ...(user?.linked_applicant_id ? { applicant_id: user.linked_applicant_id } : {}),
        });
        setRecentApplications((response.data as Application[]) ?? []);
      } catch {
        setRecentApplications([]);
      } finally {
        setIsLoadingRecent(false);
      }
    }

    loadRecentApplications();
  }, [user?.linked_applicant_id]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmedId = applicationId.trim();
    if (trimmedId.length < 6) {
      const message = 'Enter a valid application ID.';
      setError(message);
      showToast({ type: 'error', title: 'Application ID needed', message });
      return;
    }

    setIsLoading(true);
    setError('');
    setApplication(null);

    try {
      const result = (await getApplicationById(trimmedId)) as Application;
      setApplication(result);
      showToast({ type: 'success', title: 'Application found', message: `Status: ${result.status ?? 'submitted'}.` });
    } catch (searchError) {
      const message = getErrorMessage(searchError);
      setError(message);
      showToast({ type: 'error', title: 'Search failed', message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <p className="eyebrow">Application tracker</p>
        <h1 className="page-title">Track application</h1>
        <p className="muted">Search by application ID, or choose one of your recent submitted applications below.</p>
        <form onSubmit={handleSearch} className="search-row">
          <label className="field" style={{ flex: 1 }}>
            Application ID
            <input value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="Paste application ID" required />
          </label>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </form>
        {isLoading && <LoadingSpinner label="Searching" />}
        <ErrorMessage message={error} />
      </Card>

      <Card>
        <div className="details-section-header">
          <div>
            <p className="eyebrow">Recent applications</p>
            <h2 style={{ margin: 0 }}>Choose from your applications</h2>
          </div>
        </div>
        {isLoadingRecent && <LoadingSpinner label="Loading recent applications" />}
        {!isLoadingRecent && recentApplications.length === 0 && (
          <div className="empty-state">
            <h3>No applications found</h3>
            <p>Submit an application first, then it will appear here for quick tracking.</p>
            <Link className="button-link" to="/submit-application">Submit application</Link>
          </div>
        )}
        {!isLoadingRecent && recentApplications.length > 0 && (
          <div className="document-list">
            {recentApplications.map((item) => (
              <article className="document-item" key={item.id}>
                <div>
                  <strong>{formatLabel(item.application_type)}</strong>
                  <span>{item.id}</span>
                  <small>Parcel {item.parcel_ref?.parcel_number ?? 'Not provided'} | {formatDate(item.created_at)}</small>
                </div>
                <div className="document-actions">
                  <StatusBadge status={item.status ?? 'submitted'} />
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setApplicationId(item.id ?? '');
                      setApplication(item);
                      setError('');
                    }}
                  >
                    Preview
                  </button>
                  <Link className="text-link" to={`/applications/${item.id}`}>Open</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {application && (
        <Card>
          <div className="details-section-header">
            <div>
              <p className="eyebrow">Search result</p>
              <h2 style={{ margin: 0 }}>{application.id}</h2>
            </div>
            <StatusBadge status={application.status ?? 'submitted'} />
          </div>
          <dl className="detail-grid">
            <Detail label="Application type" value={formatLabel(application.application_type)} />
            <Detail label="Status" value={<StatusBadge status={application.status ?? 'submitted'} />} />
            <Detail label="Parcel number" value={application.parcel_ref?.parcel_number ?? 'Not provided'} />
            <Detail label="Zone" value={application.parcel_ref?.zone_id ?? 'Not provided'} />
            <Detail label="Current workflow state" value={formatLabel(application.workflow?.current_state ?? application.status)} />
            <Detail label="Allowed next step" value={application.workflow?.allowed_next?.map(formatLabel).join(', ') || 'Waiting for staff action'} />
            <Detail label="Required documents" value={(application.required_documents ?? []).map(formatLabel).join(', ') || 'Not listed'} />
            <Detail label="Uploaded documents" value={`${application.uploaded_documents?.length ?? 0}`} />
            <Detail label="Submitted" value={formatDate(application.created_at)} />
            <Detail label="Updated" value={formatDate(application.updated_at)} />
          </dl>
          <div className="scope-actions">
            <Link to={`/applications/${application.id}`} className="button-link">Open full details</Link>
            <Link to={`/upload-documents?applicationId=${application.id}`} className="button-link secondary-link">Upload documents</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: unknown) {
  if (!value) return 'Not provided';
  return new Date(String(value)).toLocaleString();
}
