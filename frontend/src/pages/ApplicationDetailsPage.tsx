import { FormEvent, isValidElement, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addApplicationComment, getApplicationById, getApplicationCertificates, getApplicationTimeline } from '../api/applicationsApi';
import { getApplicationObjections } from '../api/objectionsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { DetailsSkeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { theme } from '../theme';
import { formatValue, getErrorMessage } from '../utils/errors';
import { getStoredSessionUser } from '../utils/session';

const workflowStages = ['submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review', 'approved', 'certificate_issued', 'closed'];

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

type Application = Record<string, unknown> & {
  id?: string;
  status?: string;
  application_type?: string;
  applicant_id?: string;
  parcel_id?: string | null;
  applicant_ref?: Record<string, unknown>;
  parcel_ref?: Record<string, unknown>;
  workflow?: { current_state?: string; allowed_next?: string[] };
  required_documents?: string[];
  uploaded_documents?: UploadedDocument[];
  comments?: ApplicationComment[];
  created_at?: string;
  updated_at?: string;
};

type ApplicationComment = {
  id?: string;
  comment?: string;
  actor_type?: string;
  actor_id?: string;
  visibility?: string;
  created_at?: string;
};

type TimelineEvent = {
  event_type?: string;
  actor?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

type Certificate = {
  certificate_id?: string;
  status?: string;
  issued_at?: string;
  issued_by?: string;
  certificate_type?: string;
};

type Objection = {
  id?: string;
  reason?: string;
  submitted_by?: string;
  actor_type?: string;
  supporting_document_ids?: string[];
  status?: string;
  created_at?: string;
};

export function ApplicationDetailsPage() {
  const { applicationId = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = getStoredSessionUser();
  const [application, setApplication] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [comment, setComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadApplication({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }
    setError('');

    try {
      const [nextApplication, nextTimeline, nextCertificates, nextObjections] = await Promise.all([
        getApplicationById(applicationId),
        getApplicationTimeline(applicationId),
        getApplicationCertificates(applicationId),
        getApplicationObjections(applicationId),
      ]);
      setApplication(nextApplication as Application);
      setTimeline(((nextTimeline as { event_stream?: TimelineEvent[] }).event_stream ?? []) as TimelineEvent[]);
      setCertificates(nextCertificates as Certificate[]);
      setObjections(nextObjections as Objection[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  const currentStageIndex = useMemo(() => {
    if (!application?.status) {
      return -1;
    }
    return workflowStages.indexOf(application.status);
  }, [application?.status]);

  async function handleCommentSubmit(event: FormEvent) {
    event.preventDefault();

    if (comment.trim().length < 2) {
      showToast({ type: 'error', title: 'Comment is too short', message: 'Add a short response before submitting.' });
      return;
    }

    setIsCommenting(true);
    try {
      const created = await addApplicationComment(applicationId, {
        comment: comment.trim(),
        actor_type: user?.role ?? 'applicant',
        actor_id: user?.linked_applicant_id ?? user?.id ?? 'applicant',
        visibility: 'public',
      });
      setApplication((current) => current ? { ...current, comments: [...(current.comments ?? []), created as ApplicationComment] } : current);
      setComment('');
      showToast({ type: 'success', title: 'Response added', message: 'Your comment was attached to this application.' });
    } catch (commentError) {
      const message = getErrorMessage(commentError);
      setError(message);
      showToast({ type: 'error', title: 'Could not add response', message });
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <Link to="/applicant-dashboard" className="text-link">Back to dashboard</Link>
        <div className="details-header">
          <div>
            <p className="eyebrow">Application details</p>
            <h1 className="page-title">{applicationId}</h1>
            {application && (
              <p className="muted">
                {formatLabel(application.application_type)} | Submitted {formatDate(application.created_at)}
              </p>
            )}
          </div>
          <div className="details-actions">
            {application?.status && <StatusBadge status={application.status} />}
            <Button variant="secondary" onClick={() => loadApplication({ silent: true })}>Refresh</Button>
            <Button onClick={() => navigate(`/upload-documents?applicationId=${applicationId}`)}>Upload documents</Button>
            <Button variant="secondary" onClick={() => navigate(`/submit-objection?applicationId=${applicationId}`)}>Submit objection</Button>
            <Button variant="accent" onClick={() => navigate(`/applications/${applicationId}/certificates`)}>View certificates</Button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      {isLoading && <DetailsSkeleton />}

      {!isLoading && application && (
        <>
          <Card>
            <p className="eyebrow">Progress</p>
            <h2 style={{ marginTop: 0 }}>Status tracker</h2>
            <div className="workflow-strip">
              {workflowStages.map((stage, index) => {
                const isDone = currentStageIndex >= index;
                const isCurrent = application.status === stage;
                return (
                  <div key={stage} className={`workflow-step ${isDone ? 'workflow-step-done' : ''} ${isCurrent ? 'workflow-step-current' : ''}`}>
                    <span />
                    <small>{formatLabel(stage)}</small>
                  </div>
                );
              })}
            </div>
          </Card>

          <section className="details-two-column">
            <SummaryCard
              title="Basic information"
              items={{
                'Application ID': application.id,
                Type: formatLabel(application.application_type),
                Status: application.status ? <StatusBadge status={application.status} /> : 'Not provided',
                'Applicant ID': application.applicant_id,
                'Parcel ID': application.parcel_id,
              }}
            />
            <SummaryCard
              title="Workflow"
              items={{
                'Current state': formatLabel(application.workflow?.current_state ?? application.status),
                'Allowed next': application.workflow?.allowed_next?.map(formatLabel).join(', ') || 'Not available',
              }}
            />
          </section>

          <section className="details-two-column">
            <SummaryCard title="Applicant reference" items={application.applicant_ref ?? {}} />
            <SummaryCard title="Parcel reference" items={application.parcel_ref ?? {}} />
          </section>

          <DocumentsSection
            requiredDocuments={application.required_documents ?? []}
            uploadedDocuments={application.uploaded_documents ?? []}
            applicationId={applicationId}
          />

          <section className="details-two-column">
            <TimelineSection events={timeline} />
            <CertificatesSummary certificates={certificates} applicationId={applicationId} />
          </section>

          <CommentsSection
            comments={application.comments ?? []}
            comment={comment}
            isCommenting={isCommenting}
            onCommentChange={setComment}
            onSubmit={handleCommentSubmit}
          />

          <section className="details-two-column">
            <ObjectionsSection objections={objections} applicationId={applicationId} />
            <SummaryCard
              title="Timestamps"
              items={{
                Created: formatDate(application.created_at),
                Updated: formatDate(application.updated_at),
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}

function DocumentsSection({
  requiredDocuments,
  uploadedDocuments,
  applicationId,
}: {
  requiredDocuments: string[];
  uploadedDocuments: UploadedDocument[];
  applicationId: string;
}) {
  const uploadedTypes = new Set(uploadedDocuments.map((document) => document.document_type));
  const missingDocuments = requiredDocuments.filter((documentType) => !uploadedTypes.has(documentType));

  return (
    <Card>
      <div className="details-section-header">
        <div>
          <p className="eyebrow">Documents</p>
          <h2 style={{ margin: 0 }}>Required and uploaded documents</h2>
          <p className="muted">
            {requiredDocuments.length === 0
              ? 'No document requirements were listed.'
              : missingDocuments.length === 0
                ? 'All required document types have an uploaded file.'
                : `${missingDocuments.length} required document type${missingDocuments.length === 1 ? '' : 's'} still missing.`}
          </p>
        </div>
        <Link className="button-link" to={`/upload-documents?applicationId=${applicationId}`}>Manage documents</Link>
      </div>

      <div className="details-two-column" style={{ marginTop: theme.spacing.lg }}>
        <div>
          <h3 className="compact-heading">Required documents</h3>
          {requiredDocuments.length === 0 ? (
            <p className="muted">No required documents listed.</p>
          ) : (
            <div className="requirement-list">
              {requiredDocuments.map((documentType) => (
                <div key={documentType} className="requirement-item">
                  <span>{formatLabel(documentType)}</span>
                  <StatusBadge status={uploadedTypes.has(documentType) ? 'approved' : 'missing_documents'} label={uploadedTypes.has(documentType) ? 'Uploaded' : 'Missing'} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="compact-heading">Uploaded documents</h3>
          {uploadedDocuments.length === 0 ? (
            <p className="muted">No documents uploaded yet.</p>
          ) : (
            <div className="document-list">
              {uploadedDocuments.map((document) => (
                <article key={document.id ?? document.original_filename} className="document-item">
                  <div>
                    <strong>{formatLabel(document.document_type)}</strong>
                    <span>{document.original_filename ?? 'Unnamed file'}</span>
                    <small>{document.content_type ?? 'Unknown type'} | {formatDate(document.uploaded_at)}</small>
                  </div>
                  <span className="document-status">{document.verified ? 'Verified' : document.status ?? 'pending'}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ObjectionsSection({ objections, applicationId }: { objections: Objection[]; applicationId: string }) {
  return (
    <Card>
      <p className="eyebrow">Objections</p>
      <h2 style={{ marginTop: 0 }}>Objection records</h2>
      {objections.length === 0 ? (
        <>
          <p className="muted">No objections have been submitted for this application.</p>
          <Link className="button-link" to={`/submit-objection?applicationId=${applicationId}`}>Submit objection</Link>
        </>
      ) : (
        <div className="document-list">
          {objections.map((objection) => (
            <article key={objection.id ?? objection.created_at} className="document-item">
              <div>
                <strong>{objection.id ?? 'Objection'}</strong>
                <span>{objection.reason ?? 'No reason provided'}</span>
                <small>
                  {formatDate(objection.created_at)} | Submitted by {objection.submitted_by ?? 'applicant'}
                </small>
                {objection.supporting_document_ids?.length ? (
                  <small>Supporting documents: {objection.supporting_document_ids.join(', ')}</small>
                ) : null}
              </div>
              <span className="document-status">{objection.status ?? 'pending'}</span>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function TimelineSection({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <p className="eyebrow">Audit trail</p>
      <h2 style={{ marginTop: 0 }}>Timeline and performance logs</h2>
      {events.length === 0 ? (
        <p className="muted">No timeline events recorded yet.</p>
      ) : (
        <div className="timeline-list">
          {events.map((event, index) => (
            <article key={`${event.event_type}-${event.timestamp}-${index}`} className="timeline-item">
              <span />
              <div>
                <strong>{formatLabel(event.event_type)}</strong>
                <small>{formatDate(event.timestamp)} | Actor: {event.actor ?? 'system'}</small>
                {event.metadata && Object.keys(event.metadata).length > 0 && <pre>{formatValue(event.metadata)}</pre>}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function CertificatesSummary({ certificates, applicationId }: { certificates: Certificate[]; applicationId: string }) {
  return (
    <Card>
      <p className="eyebrow">Certificates</p>
      <h2 style={{ marginTop: 0 }}>Certificate status</h2>
      {certificates.length === 0 ? (
        <p className="muted">No certificate has been issued for this application yet.</p>
      ) : (
        <div className="document-list">
          {certificates.map((certificate) => (
            <article key={certificate.certificate_id} className="document-item">
              <div>
                <strong>{certificate.certificate_id}</strong>
                <span>{formatLabel(certificate.certificate_type ?? 'ownership_certificate')}</span>
                <small>Issued {formatDate(certificate.issued_at)} by {certificate.issued_by ?? 'registry office'}</small>
              </div>
              <span className="document-status">{certificate.status ?? 'issued'}</span>
            </article>
          ))}
        </div>
      )}
      <Link className="button-link" to={`/applications/${applicationId}/certificates`} style={{ marginTop: theme.spacing.md }}>
        Open certificate view
      </Link>
    </Card>
  );
}

function CommentsSection({
  comments,
  comment,
  isCommenting,
  onCommentChange,
  onSubmit,
}: {
  comments: ApplicationComment[];
  comment: string;
  isCommenting: boolean;
  onCommentChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Card>
      <div className="details-section-header">
        <div>
          <p className="eyebrow">Applicant responses</p>
          <h2 style={{ margin: 0 }}>Comments and responses</h2>
        </div>
      </div>

      <form onSubmit={onSubmit} className="comment-form">
        <label className="field">
          Add response
          <textarea rows={4} value={comment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Write a comment or response for this application" />
        </label>
        <Button type="submit" disabled={isCommenting}>
          {isCommenting ? 'Adding response...' : 'Add response'}
        </Button>
      </form>

      {comments.length === 0 ? (
        <p className="muted">No comments or applicant responses yet.</p>
      ) : (
        <div className="comment-list">
          {comments.map((item) => (
            <article key={item.id ?? item.created_at} className="comment-item">
              <div>
                <strong>{formatLabel(item.actor_type)} response</strong>
                <small>{formatDate(item.created_at)} | {item.visibility ?? 'public'}</small>
              </div>
              <p>{item.comment}</p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function SummaryCard({ title, items }: { title: string; items: Record<string, unknown> }) {
  const entries = Object.entries(items);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {entries.length === 0 ? (
        <p className="muted">Not available.</p>
      ) : (
        <dl className="detail-grid">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{renderValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

function renderValue(value: unknown) {
  if (!value) {
    return 'Not provided';
  }

  if (isValidElement(value)) {
    return value;
  }

  if (typeof value === 'object') {
    return <pre>{formatValue(value)}</pre>;
  }

  return String(value);
}

function formatLabel(value: unknown) {
  if (!value) {
    return 'Not provided';
  }
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) {
    return 'Not provided';
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString();
}
