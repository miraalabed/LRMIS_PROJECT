import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApplications } from '../api/applicationsApi';
import { ApplicationTable } from '../components/ApplicationTable';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { InfoCard } from '../components/InfoCard';
import { DashboardSkeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { theme } from '../theme';
import { getErrorMessage } from '../utils/errors';
import { getStoredSessionUser, refreshSessionUser, type SessionUser } from '../utils/session';

type Application = {
  id: string;
  status?: string;
  application_type?: string;
  parcel_ref?: { parcel_number?: string };
  created_at?: string;
  updated_at?: string;
};

const workflowStages = ['submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review', 'approved', 'certificate_issued'];

export function ApplicantDashboard() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [user, setUser] = useState<SessionUser | null>(() => getStoredSessionUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadDashboard({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');
    try {
      const currentUser = await refreshSessionUser();
      setUser(currentUser);
      const params = {
        limit: 100,
        sort_by: 'created_at',
        sort_dir: 'desc',
        ...(currentUser.linked_applicant_id ? { applicant_id: currentUser.linked_applicant_id } : {}),
      };
      const response = await getApplications(params);
      setApplications((response.data as Application[]) ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const pendingStatuses = ['submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review', 'on_hold', 'missing_documents'];
    return {
      total: applications.length,
      pending: applications.filter((application) => pendingStatuses.includes(application.status ?? '')).length,
      approved: applications.filter((application) => ['approved', 'certificate_issued', 'closed'].includes(application.status ?? '')).length,
      underObjection: applications.filter((application) => application.status === 'under_objection').length,
      needsDocuments: applications.filter((application) => ['missing_documents', 'on_hold'].includes(application.status ?? '')).length,
    };
  }, [applications]);

  const hasApplicantProfile = Boolean(user?.linked_applicant_id);
  const hasApplications = applications.length > 0;
  const latestApplication = applications[0];
  const currentStageIndex = latestApplication?.status ? workflowStages.indexOf(latestApplication.status) : -1;

  return (
    <div className="page-stack">
      <Card>
        <div className="dashboard-hero">
          <div>
            <p className="eyebrow">Applicant portal</p>
            <h1 className="page-title">Welcome to LRMIS</h1>
            <p className="muted">
              {hasApplicantProfile
                ? 'Submit land registration applications, track status, and review application details from one clean workspace.'
                : 'Your account is signed in, but it needs an applicant profile before applications can be submitted.'}
            </p>
          </div>
          <div className="session-panel">
            <span className="connection-dot" />
            <strong>Backend connected</strong>
            <small>{user?.username ?? 'Signed in applicant'}</small>
            <small>{hasApplicantProfile ? `Applicant ID ${user?.linked_applicant_id}` : 'Profile not linked'}</small>
            <button type="button" className="text-link" onClick={() => loadDashboard({ silent: true })} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh dashboard'}
            </button>
          </div>
        </div>
        {!hasApplicantProfile && (
          <div className="notice-box" style={{ marginTop: theme.spacing.md }}>
            Create your applicant profile once. After that, new applications will use the linked profile automatically.
          </div>
        )}
      </Card>

      <section className="card-grid">
        <InfoCard
          title={hasApplicantProfile ? 'Submit New Application' : 'Set Up Applicant Profile'}
          detail={hasApplicantProfile ? 'Open a land application using your linked applicant profile.' : 'Required before submitting land applications.'}
          onClick={() => navigate(hasApplicantProfile ? '/submit-application' : '/applicant-profile')}
        />
        <InfoCard
          title="Track Application"
          detail={hasApplications ? 'Search by application ID or open one from the recent list.' : 'Submit an application first, then tracking will show its status.'}
          onClick={() => navigate('/track-application')}
          disabled={!hasApplications}
        />
        <InfoCard
          title="Upload Documents"
          detail={hasApplications ? 'Attach supporting files to an existing application.' : 'Available after your first application is submitted.'}
          onClick={() => navigate('/upload-documents')}
          disabled={!hasApplications}
        />
        <InfoCard
          title="Submit Objection"
          detail={hasApplications ? 'Submit an objection for one of your existing applications.' : 'Available after your first application is submitted.'}
          onClick={() => navigate('/submit-objection')}
          disabled={!hasApplications}
        />
      </section>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="card-grid">
            <InfoCard title="Total applications" value={stats.total} />
            <InfoCard title="Pending applications" value={stats.pending} />
            <InfoCard title="Approved applications" value={stats.approved} />
            <InfoCard title="Under objection" value={stats.underObjection} />
            <InfoCard title="Need attention" value={stats.needsDocuments} />
          </section>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p className="eyebrow">Status timeline</p>
                <h2 style={{ margin: 0 }}>Most recent application</h2>
              </div>
              {latestApplication ? (
                <ButtonLink onClick={() => navigate(`/applications/${latestApplication.id}`)} label="Open latest" />
              ) : (
                <ButtonLink onClick={() => navigate(hasApplicantProfile ? '/submit-application' : '/applicant-profile')} label={hasApplicantProfile ? 'Submit application' : 'Set up profile'} />
              )}
            </div>
            <ErrorMessage message={error} />
            {!error && latestApplication && (
              <div className="timeline-card">
                <div className="timeline-heading">
                  <div>
                    <strong>{formatLabel(latestApplication.application_type)}</strong>
                    <span>{latestApplication.id}</span>
                  </div>
                  <StatusBadge status={latestApplication.status ?? 'submitted'} />
                </div>
                <div className="workflow-strip">
                  {workflowStages.map((stage, index) => {
                    const isDone = currentStageIndex >= index;
                    const isCurrent = latestApplication.status === stage;
                    return (
                      <div key={stage} className={`workflow-step ${isDone ? 'workflow-step-done' : ''} ${isCurrent ? 'workflow-step-current' : ''}`}>
                        <span />
                        <small>{formatLabel(stage)}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!error && !latestApplication && (
              <div className="empty-state">
                <h3>No active timeline yet</h3>
                <p>Your latest application workflow will appear here after you submit a request.</p>
              </div>
            )}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p className="eyebrow">Application history</p>
                <h2 style={{ margin: 0 }}>Recent applications</h2>
              </div>
              {hasApplicantProfile && <ButtonLink onClick={() => navigate('/submit-application')} label="New application" />}
            </div>
            <ErrorMessage message={error} />
            {!error && applications.length === 0 && (
              <div className="empty-state">
                <h3>No applications yet</h3>
                <p>Your submitted land registration requests will appear here with their status, parcel reference, and submitted date.</p>
                <Button onClick={() => navigate(hasApplicantProfile ? '/submit-application' : '/applicant-profile')}>
                  {hasApplicantProfile ? 'Submit first application' : 'Set up applicant profile'}
                </Button>
              </div>
            )}
            {!error && applications.length > 0 && <ApplicationTable applications={applications.slice(0, 8)} />}
          </Card>
        </>
      )}
    </div>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ButtonLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="link-button">
      {label}
    </button>
  );
}
