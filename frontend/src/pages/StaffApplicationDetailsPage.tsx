import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getApplicationById,
  getApplicationCertificates,
  getApplicationTimeline,
  holdApplication,
  issueApplicationCertificate,
  rejectApplication,
  resumeApplication,
  transitionApplication,
} from '../api/applicationsApi';
import { getApplicationDocuments, reviewApplicationDocument } from '../api/documentsApi';
import { autoAssignSurveyor, registrarReview } from '../api/surveyApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { theme } from '../theme';
import { formatValue, getErrorMessage } from '../utils/errors';
import { getStoredSessionUser } from '../utils/session';

const workflowTargets = ['pre_checked', 'survey_required', 'surveyed', 'legal_review', 'approved', 'closed', 'missing_documents'];
const registrarRoles = ['registrar', 'manager', 'admin'];

type Application = Record<string, unknown> & {
  id?: string;
  status?: string;
  application_type?: string;
  applicant_id?: string;
  applicant_ref?: Record<string, unknown>;
  parcel_ref?: Record<string, unknown>;
  workflow?: { allowed_next?: string[] };
  required_documents?: string[];
  uploaded_documents?: Record<string, unknown>[];
};

type Document = Record<string, unknown> & {
  id?: string;
  document_type?: string;
  original_filename?: string;
  status?: string;
  verified?: boolean;
  uploaded_at?: string;
};

type TimelineEvent = {
  event_type?: string;
  actor?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export function StaffApplicationDetailsPage() {
  const { applicationId = '' } = useParams();
  const { showToast } = useToast();
  const user = getStoredSessionUser();
  const actorId = user?.id ?? user?.username ?? 'staff';
  const canRegistrarReview = registrarRoles.includes(user?.role ?? '');
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [certificates, setCertificates] = useState<Record<string, unknown>[]>([]);
  const [targetStatus, setTargetStatus] = useState('pre_checked');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});
  const [registrarNotes, setRegistrarNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');

  async function loadAll({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }
    setError('');
    try {
      const [nextApplication, nextDocuments, nextTimeline, nextCertificates] = await Promise.all([
        getApplicationById(applicationId),
        getApplicationDocuments(applicationId),
        getApplicationTimeline(applicationId),
        getApplicationCertificates(applicationId),
      ]);
      setApplication(nextApplication as Application);
      setDocuments(nextDocuments as Document[]);
      setTimeline(((nextTimeline as { event_stream?: TimelineEvent[] }).event_stream ?? []) as TimelineEvent[]);
      setCertificates(nextCertificates);
      const allowedNext = ((nextApplication as Application).workflow?.allowed_next ?? [])[0];
      setTargetStatus(allowedNext ?? String((nextApplication as Application).status ?? 'submitted'));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [applicationId]);

  const allowedTargets = useMemo(() => {
    const allowedNext = application?.workflow?.allowed_next ?? [];
    return allowedNext.length > 0 ? allowedNext : workflowTargets.filter((target) => target === application?.status);
  }, [application?.workflow?.allowed_next]);

  const documentStats = useMemo(() => {
    const required = application?.required_documents ?? [];
    const uploadedTypes = new Set(documents.map((document) => document.document_type));
    return {
      required: required.length,
      uploaded: documents.length,
      verified: documents.filter((document) => document.verified || document.status === 'verified').length,
      missing: required.filter((documentType) => !uploadedTypes.has(documentType)).length,
    };
  }, [application?.required_documents, documents]);

  const canIssueCertificate = canRegistrarReview && application?.status === 'approved';
  const canRunRegistrarReview = canRegistrarReview && ['legal_review', 'surveyed'].includes(application?.status ?? '');

  async function runAction(actionName: string, action: () => Promise<unknown>, successTitle: string) {
    setActiveAction(actionName);
    setError('');
    try {
      await action();
      showToast({ type: 'success', title: successTitle });
      await loadAll();
    } catch (actionError) {
      const message = getErrorMessage(actionError);
      setError(message);
      showToast({ type: 'error', title: `${successTitle} failed`, message });
    } finally {
      setActiveAction('');
    }
  }

  function handleTransition(event: FormEvent) {
    event.preventDefault();
    runAction(
      'transition',
      () => transitionApplication(applicationId, { target_status: targetStatus, actor_type: user?.role ?? 'staff', actor_id: actorId, note: note || undefined }),
      `Moved to ${formatLabel(targetStatus)}`,
    );
  }

  return (
    <div className="page-stack">
      <Card>
        <Link to="/staff-dashboard" className="text-link">Back to staff dashboard</Link>
          <div className="details-header">
          <div>
            <p className="eyebrow">Staff application review</p>
            <h1 className="page-title">{applicationId}</h1>
            <p className="muted">{formatLabel(application?.application_type)} | Applicant {application?.applicant_id ?? 'Not provided'}</p>
          </div>
          <div className="details-actions">
            {application?.status && <StatusBadge status={application.status} />}
            <Button variant="secondary" onClick={() => loadAll({ silent: true })}>Refresh</Button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      {isLoading && <LoadingSpinner label="Loading application" />}

      {!isLoading && application && (
        <>
          <section className="details-two-column">
            <SummaryCard title="Applicant reference" items={application.applicant_ref ?? {}} />
            <SummaryCard title="Parcel reference" items={application.parcel_ref ?? {}} />
          </section>

          <Card>
            <p className="eyebrow">Workflow control</p>
            <h2 style={{ marginTop: 0 }}>Change status</h2>
            <form onSubmit={handleTransition} className="staff-action-grid">
              <label className="field">
                Target status
                <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
                  {allowedTargets.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
              <label className="field">
                Note
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional internal note" />
              </label>
              <Button type="submit" disabled={activeAction === 'transition' || allowedTargets.length === 0 || targetStatus === application.status}>
                {activeAction === 'transition' ? 'Updating...' : 'Update status'}
              </Button>
            </form>
            {application.workflow?.allowed_next?.length === 0 && (
              <p className="muted">No workflow transition is currently available for this status.</p>
            )}
          </Card>

          <section className="details-two-column">
            <Card>
              <p className="eyebrow">Administrative decision</p>
              <h2 style={{ marginTop: 0 }}>Hold / reject / resume</h2>
              <div className="application-form">
                <label className="field">
                  Reason
                  <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for hold or rejection" />
                </label>
                <div className="form-actions">
                  <Button variant="secondary" disabled={!reason || activeAction === 'hold'} onClick={() => runAction('hold', () => holdApplication(applicationId, { reason, actor_type: user?.role ?? 'staff', actor_id: actorId }), 'Application placed on hold')}>Hold</Button>
                  <Button variant="error" disabled={!reason || activeAction === 'reject'} onClick={() => runAction('reject', () => rejectApplication(applicationId, { reason, actor_type: user?.role ?? 'staff', actor_id: actorId }), 'Application rejected')}>Reject</Button>
                  <Button variant="accent" disabled={activeAction === 'resume'} onClick={() => runAction('resume', () => resumeApplication(applicationId, { actor_type: user?.role ?? 'staff', actor_id: actorId, note: reason || undefined }), 'Application resumed')}>Resume</Button>
                </div>
              </div>
            </Card>

            <Card>
              <p className="eyebrow">Survey and registrar</p>
              <h2 style={{ marginTop: 0 }}>Assignment and review</h2>
              <div className="application-form">
                <Button disabled={activeAction === 'assign'} onClick={() => runAction('assign', () => autoAssignSurveyor(applicationId), 'Surveyor assigned')}>Auto-assign surveyor</Button>
                <label className="field">
                  Registrar notes
                  <textarea rows={3} value={registrarNotes} onChange={(event) => setRegistrarNotes(event.target.value)} />
                </label>
                <div className="form-actions">
                  <Button variant="success" disabled={!canRunRegistrarReview || activeAction === 'registrar-accept'} onClick={() => runAction('registrar-accept', () => registrarReview(applicationId, { decision: 'accepted', registrar_id: actorId, notes: registrarNotes }), 'Registrar review accepted')}>Accept legal review</Button>
                  <Button variant="error" disabled={!canRunRegistrarReview || activeAction === 'registrar-reject'} onClick={() => runAction('registrar-reject', () => registrarReview(applicationId, { decision: 'rejected', registrar_id: actorId, notes: registrarNotes }), 'Registrar review rejected')}>Reject in review</Button>
                </div>
                {!canRegistrarReview && <p className="muted">Registrar review actions require registrar, manager, or admin access.</p>}
                {canRegistrarReview && !canRunRegistrarReview && <p className="muted">Registrar review is available only at surveyed or legal review status.</p>}
              </div>
            </Card>
          </section>

          <Card>
            <div className="details-section-header">
              <div>
                <p className="eyebrow">Documents</p>
                <h2 style={{ margin: 0 }}>Review uploaded documents</h2>
                <p className="muted">
                  {documentStats.uploaded} uploaded, {documentStats.verified} verified, {documentStats.missing} required type(s) missing.
                </p>
              </div>
            </div>
            {application.required_documents?.length ? (
              <div className="requirement-list" style={{ marginTop: theme.spacing.md }}>
                {application.required_documents.map((documentType) => {
                  const isUploaded = documents.some((document) => document.document_type === documentType);
                  return (
                    <div key={documentType} className="requirement-item">
                      <span>{formatLabel(documentType)}</span>
                      <StatusBadge status={isUploaded ? 'approved' : 'missing_documents'} label={isUploaded ? 'Uploaded' : 'Missing'} />
                    </div>
                  );
                })}
              </div>
            ) : null}
            {documents.length === 0 && <p className="muted">No uploaded documents yet.</p>}
            {documents.length > 0 && (
              <div className="document-list" style={{ marginTop: theme.spacing.md }}>
                {documents.map((document) => (
                  <article key={document.id} className="document-item">
                    <div>
                      <strong>{formatLabel(document.document_type)}</strong>
                      <span>{document.original_filename ?? 'Unnamed file'}</span>
                      <small>{document.uploaded_at ? new Date(document.uploaded_at).toLocaleString() : 'Upload date unavailable'}</small>
                    </div>
                    <div className="document-actions">
                      <span className="document-status">{document.verified ? 'verified' : document.status ?? 'pending'}</span>
                      <input
                        value={reviewRemarks[document.id ?? ''] ?? ''}
                        onChange={(event) => setReviewRemarks((current) => ({ ...current, [document.id ?? '']: event.target.value }))}
                        placeholder="Review remarks"
                        style={{ minWidth: 180 }}
                      />
                      <button type="button" className="text-link" onClick={() => runAction(`verify-${document.id}`, () => reviewApplicationDocument(applicationId, document.id ?? '', { status: 'verified', reviewer_id: actorId, remarks: reviewRemarks[document.id ?? ''] || undefined }), 'Document verified')}>Verify</button>
                      <button type="button" className="text-link danger-link" onClick={() => runAction(`reject-doc-${document.id}`, () => reviewApplicationDocument(applicationId, document.id ?? '', { status: 'rejected', reviewer_id: actorId, remarks: reviewRemarks[document.id ?? ''] || undefined }), 'Document rejected')}>Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <section className="details-two-column">
            <Card>
              <p className="eyebrow">Certificate</p>
              <h2 style={{ marginTop: 0 }}>Issue certificate</h2>
              <p className="muted">Certificate issuance is allowed only when the application is approved.</p>
              <Button variant="success" disabled={!canIssueCertificate || activeAction === 'certificate'} onClick={() => runAction('certificate', () => issueApplicationCertificate(applicationId, { issued_by: actorId }), 'Certificate issued')}>Issue certificate</Button>
              {!canRegistrarReview && <p className="muted">Certificate issuance requires registrar, manager, or admin access.</p>}
              {canRegistrarReview && application.status !== 'approved' && <p className="muted">Move the application to approved before issuing a certificate.</p>}
              {certificates.length > 0 && (
                <div className="document-list" style={{ marginTop: theme.spacing.md }}>
                  {certificates.map((certificate) => (
                    <article key={String(certificate.certificate_id)} className="document-item">
                      <div>
                        <strong>{String(certificate.certificate_id)}</strong>
                        <span>{String(certificate.status ?? 'certificate_issued')}</span>
                      </div>
                      <Link className="text-link" to={`/applications/${applicationId}/certificates`}>View</Link>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <p className="eyebrow">Timeline</p>
              <h2 style={{ marginTop: 0 }}>Audit trail</h2>
              {timeline.length === 0 && <p className="muted">No events yet.</p>}
              <div className="timeline-list">
                {timeline.map((event, index) => (
                  <article key={`${event.event_type}-${index}`} className="timeline-item">
                    <span />
                    <div>
                      <strong>{formatLabel(event.event_type)}</strong>
                      <small>{event.timestamp ? new Date(event.timestamp).toLocaleString() : 'No timestamp'} | {event.actor ?? 'system'}</small>
                      {event.metadata && Object.keys(event.metadata).length > 0 && <pre>{formatValue(event.metadata)}</pre>}
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, items }: { title: string; items: Record<string, unknown> }) {
  const entries = Object.entries(items);
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {entries.length === 0 ? <p className="muted">Not available.</p> : (
        <dl className="detail-grid">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{typeof value === 'object' ? <pre>{formatValue(value)}</pre> : String(value ?? 'Not provided')}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
