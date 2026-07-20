import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApplicationById } from '../api/applicationsApi';
import { getCurrentUser } from '../api/authApi';
import {
  autoAssignSurveyor,
  getSurveyReport,
  updateSurveyMilestone,
  uploadSurveyReport,
} from '../api/surveyApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { theme } from '../theme';
import { getErrorMessage } from '../utils/errors';

const MILESTONES = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'visit_scheduled', label: 'Visit scheduled' },
  { value: 'arrived_on_site', label: 'Arrived on site' },
  { value: 'survey_started', label: 'Survey started' },
  { value: 'survey_completed', label: 'Survey completed' },
  { value: 'report_uploaded', label: 'Report uploaded' },
  { value: 'registrar_reviewed', label: 'Registrar reviewed' },
] as const;

type Application = Record<string, unknown> & {
  id?: string;
  status?: string;
  application_type?: string;
  parcel_ref?: Record<string, unknown>;
  applicant_ref?: Record<string, unknown>;
  priority?: string;
  created_at?: string;
};

type SurveyReport = Record<string, unknown> & {
  id?: string;
  surveyor_id?: string;
  observations?: string;
  area_sqm?: number;
  coordinates?: Record<string, unknown>;
  field_notes?: string;
  report_ref?: string;
  created_at?: string;
};

export function SurveyTaskDetailsPage() {
  const { applicationId = '' } = useParams();
  const { showToast } = useToast();
  const [application, setApplication] = useState<Application | null>(null);
  const [surveyReport, setSurveyReport] = useState<SurveyReport | null>(null);
  const [surveyorId, setSurveyorId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadTask({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');
    try {
      const reportRequest = getSurveyReport(applicationId).catch((reportError) => {
        const status = (reportError as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          return null;
        }
        throw reportError;
      });
      const [app, user, report] = await Promise.all([
        getApplicationById(applicationId),
        getCurrentUser(),
        reportRequest,
      ]);
      setApplication(app as Application);
      setSurveyReport(report as SurveyReport | null);
      setSurveyorId((user as { id?: string }).id ?? '');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [applicationId]);

  async function refreshApplication() {
    try {
      const reportRequest = getSurveyReport(applicationId).catch((reportError) => {
        const status = (reportError as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          return null;
        }
        throw reportError;
      });
      const [app, report] = await Promise.all([
        getApplicationById(applicationId),
        reportRequest,
      ]);
      setApplication(app as Application);
      setSurveyReport(report as SurveyReport | null);
    } catch {
      // keep existing view if refresh fails; the action's own toast already reported the result
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <Link to="/my-survey-tasks" className="text-link">
          Back to my survey tasks
        </Link>
        <div className="details-header">
          <div>
            <p className="eyebrow">Survey task</p>
            <h1 className="page-title">{applicationId}</h1>
            {application?.application_type && (
              <p className="muted">{formatLabel(application.application_type)}</p>
            )}
          </div>
          <div className="details-actions">
            {application?.status && <StatusBadge status={application.status} />}
            <button type="button" className="button-link" onClick={() => loadTask({ silent: true })} disabled={isRefreshing || isLoading}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      {isLoading && <LoadingSpinner label="Loading application" />}

      {!isLoading && application && (
        <>
          <Card>
            <p className="eyebrow">Task context</p>
            <dl className="detail-grid">
              <Detail label="Application type" value={formatLabel(application.application_type)} />
              <Detail label="Priority" value={formatLabel(application.priority ?? 'normal')} />
              <Detail label="Current status" value={<StatusBadge status={application.status ?? 'survey_required'} />} />
              <Detail label="Parcel number" value={displayValue(application.parcel_ref?.parcel_number)} />
              <Detail label="Zone" value={displayValue(application.parcel_ref?.zone_id)} />
              <Detail label="Applicant" value={displayValue(application.applicant_ref?.name ?? application.applicant_ref?.applicant_id)} />
            </dl>
          </Card>
          <AssignmentSection applicationId={applicationId} onChanged={refreshApplication} />
          <MilestoneSection
            applicationId={applicationId}
            surveyorId={surveyorId}
            onChanged={refreshApplication}
            showToast={showToast}
          />
          <ReportSection
            applicationId={applicationId}
            surveyorId={surveyorId}
            surveyReport={surveyReport}
            onChanged={refreshApplication}
            showToast={showToast}
          />
        </>
      )}
    </div>
  );
}

function AssignmentSection({
  applicationId,
  onChanged,
}: {
  applicationId: string;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [isAssigning, setIsAssigning] = useState(false);
  const [result, setResult] = useState('');

  async function handleAssign() {
    setIsAssigning(true);
    try {
      const res = (await autoAssignSurveyor(applicationId)) as {
        message: string;
        surveyor_name: string;
        task_code: string;
      };
      setResult(`${res.message} - ${res.surveyor_name} (${res.task_code})`);
      showToast({ type: 'success', title: 'Surveyor assigned', message: res.surveyor_name });
      onChanged();
    } catch (assignError) {
      const message = getErrorMessage(assignError);
      showToast({ type: 'error', title: 'Could not assign surveyor', message });
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <Card>
      <p className="eyebrow">Assignment</p>
      <h2 style={{ marginTop: 0 }}>Auto-assign a surveyor</h2>
      <p className="muted">
        Picks a surveyor by zone match, availability, and current workload.
      </p>
      <Button onClick={handleAssign} disabled={isAssigning}>
        {isAssigning ? 'Assigning...' : 'Auto-assign surveyor'}
      </Button>
      {result && <p className="muted" style={{ marginTop: theme.spacing.sm }}>{result}</p>}
    </Card>
  );
}

function MilestoneSection({
  applicationId,
  surveyorId,
  onChanged,
  showToast,
}: {
  applicationId: string;
  surveyorId: string;
  onChanged: () => void;
  showToast: ReturnType<typeof useToast>['showToast'];
}) {
  const [milestone, setMilestone] = useState<string>(MILESTONES[1].value);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!surveyorId) {
      showToast({ type: 'error', title: 'Surveyor profile missing', message: 'Sign in with a surveyor account before updating milestones.' });
      return;
    }
    if (['arrived_on_site', 'survey_started', 'survey_completed'].includes(milestone) && notes.trim().length < 5) {
      showToast({ type: 'error', title: 'Add field notes', message: 'Field milestones need a short note for the audit history.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = (await updateSurveyMilestone(applicationId, {
        milestone,
        notes: notes.trim() || undefined,
        actor_id: surveyorId || undefined,
      })) as { message: string };
      showToast({ type: 'success', title: 'Milestone updated', message: res.message });
      setNotes('');
      onChanged();
    } catch (updateError) {
      const message = getErrorMessage(updateError);
      showToast({ type: 'error', title: 'Could not update milestone', message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <p className="eyebrow">Field progress</p>
      <h2 style={{ marginTop: 0 }}>Update milestone</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing.md, maxWidth: 480 }}>
        <label className="field">
          Milestone
          <select value={milestone} onChange={(event) => setMilestone(event.target.value)}>
            {MILESTONES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Field notes (optional)
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What happened at this step"
          />
          <span className="muted">{notes.trim().length} characters</span>
        </label>
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update milestone'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReportSection({
  applicationId,
  surveyorId,
  surveyReport,
  onChanged,
  showToast,
}: {
  applicationId: string;
  surveyorId: string;
  surveyReport: SurveyReport | null;
  onChanged: () => void;
  showToast: ReturnType<typeof useToast>['showToast'];
}) {
  const [observations, setObservations] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [fieldNotes, setFieldNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!surveyorId) {
      showToast({ type: 'error', title: 'Surveyor profile missing', message: 'Sign in with a surveyor account before submitting a report.' });
      return;
    }
    if (observations.trim().length < 3) {
      showToast({ type: 'error', title: 'Add field observations', message: 'Describe what was found during the survey.' });
      return;
    }
    const areaValue = areaSqm ? Number(areaSqm) : undefined;
    if (areaSqm && (!Number.isFinite(areaValue) || Number(areaValue) <= 0)) {
      showToast({ type: 'error', title: 'Check parcel area', message: 'Area must be a positive number when provided.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = (await uploadSurveyReport(applicationId, {
        surveyor_id: surveyorId,
        observations: observations.trim(),
        area_sqm: areaValue,
        field_notes: fieldNotes.trim() || undefined,
      })) as { message: string };
      showToast({ type: 'success', title: 'Report submitted', message: res.message });
      setObservations('');
      setAreaSqm('');
      setFieldNotes('');
      onChanged();
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      showToast({ type: 'error', title: 'Could not upload report', message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <p className="eyebrow">Final step</p>
      <h2 style={{ marginTop: 0 }}>Upload survey report</h2>
      <p className="muted">
        Submitting a report moves the application to <strong>surveyed</strong> automatically.
      </p>
      {surveyReport ? (
        <div className="notice-box success-box" style={{ marginBottom: theme.spacing.md }}>
          <strong>Saved survey report</strong>
          <dl className="detail-grid" style={{ marginTop: theme.spacing.sm }}>
            <Detail label="Surveyor" value={displayValue(surveyReport.surveyor_id)} />
            <Detail label="Report reference" value={displayValue(surveyReport.report_ref)} />
            <Detail label="Area" value={surveyReport.area_sqm ? `${surveyReport.area_sqm} sqm` : 'Not provided'} />
            <Detail label="Submitted" value={formatDate(surveyReport.created_at)} />
            <Detail label="Observations" value={displayValue(surveyReport.observations)} />
            <Detail label="Field notes" value={displayValue(surveyReport.field_notes)} />
          </dl>
          {surveyReport.coordinates && (
            <div className="geojson-preview" style={{ marginTop: theme.spacing.sm }}>
              <pre>{JSON.stringify(surveyReport.coordinates, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : (
        <p className="muted">No survey report has been submitted yet.</p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: theme.spacing.md, maxWidth: 480 }}>
        <label className="field">
          Field observations
          <textarea
            rows={4}
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            placeholder="Boundaries clear, no conflict with neighboring parcels"
          />
          <span className="muted">{observations.trim().length} characters</span>
        </label>
        <label className="field">
          Area (sqm), optional
          <input
            value={areaSqm}
            onChange={(event) => setAreaSqm(event.target.value)}
            placeholder="850.5"
          />
        </label>
        <label className="field">
          Field notes, optional
          <textarea
            rows={2}
            value={fieldNotes}
            onChange={(event) => setFieldNotes(event.target.value)}
          />
        </label>
        <div>
          <Button variant="success" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit report'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function formatLabel(value: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  );
}

function displayValue(value: unknown) {
  return value === undefined || value === null || value === '' ? 'Not provided' : String(value);
}

function formatDate(value: unknown) {
  if (!value) {
    return 'Not provided';
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
