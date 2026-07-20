import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getApplicationById } from '../api/applicationsApi';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { getErrorMessage } from '../utils/errors';

type Application = {
  id?: string;
  status?: string;
  created_at?: string;
  application_type?: string;
  parcel_ref?: { parcel_number?: string };
  required_documents?: string[];
};

export function ApplicationConfirmationPage() {
  const { applicationId = '' } = useParams();
  const location = useLocation();
  const [application, setApplication] = useState<Application | null>((location.state as { application?: Application } | null)?.application ?? null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(!application);

  useEffect(() => {
    if (application || !applicationId) {
      return;
    }

    async function loadApplication() {
      try {
        setApplication((await getApplicationById(applicationId)) as Application);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    loadApplication();
  }, [application, applicationId]);

  return (
    <div className="page-stack">
      <Card>
        <p className="eyebrow">Submission complete</p>
        <h1 className="page-title">Application confirmation</h1>
        <p className="muted">Your request was saved in MongoDB and is ready for staff pre-check.</p>
        {isLoading && <LoadingSpinner label="Loading confirmation" />}
        <ErrorMessage message={error} />
      </Card>

      {application && (
        <>
          <Card>
            <div className="details-header">
              <div>
                <p className="eyebrow">Reference</p>
                <h2 style={{ marginTop: 0 }}>{application.id ?? applicationId}</h2>
                <p className="muted">Keep this ID for tracking, document upload, and future communication.</p>
              </div>
              <StatusBadge status={application.status ?? 'submitted'} />
            </div>
            <dl className="detail-grid">
              <Detail label="Submitted date" value={formatDate(application.created_at)} />
              <Detail label="Application type" value={formatLabel(application.application_type)} />
              <Detail label="Parcel number" value={application.parcel_ref?.parcel_number ?? 'Not provided'} />
              <Detail label="Next expected step" value="Pre-check by land registration staff" />
            </dl>
          </Card>

          <section className="details-two-column">
            <Card>
              <p className="eyebrow">Next step</p>
              <h2 style={{ marginTop: 0 }}>Upload required documents</h2>
              {application.required_documents?.length ? (
                <div className="requirement-list">
                  {application.required_documents.map((documentType) => (
                    <div className="requirement-item" key={documentType}>
                      <span>{formatLabel(documentType)}</span>
                      <StatusBadge status="missing_documents" label="Needed" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No required documents were listed for this request.</p>
              )}
              <Link to={`/upload-documents?applicationId=${application.id ?? applicationId}`} className="button-link confirmation-action">
                Upload documents
              </Link>
            </Card>

            <Card>
              <p className="eyebrow">Actions</p>
              <h2 style={{ marginTop: 0 }}>Continue workflow</h2>
              <div className="scope-actions">
                <Link to={`/applications/${application.id ?? applicationId}`} className="button-link">View details</Link>
                <Link to="/track-application" className="button-link secondary-link">Track application</Link>
                <Link to="/applicant-dashboard" className="button-link secondary-link">Dashboard</Link>
              </div>
            </Card>
          </section>
        </>
      )}

      {!isLoading && !application && !error && (
        <Card>
          <div className="empty-state">
            <h3>Confirmation not available</h3>
            <p>The application may still have been submitted. Use Track Application with the ID from the previous screen if you saved it.</p>
            <Link to="/track-application" className="button-link">Track application</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
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
