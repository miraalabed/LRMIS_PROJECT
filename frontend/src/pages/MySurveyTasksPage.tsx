import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api/authApi';
import { listSurveyTasks } from '../api/surveyApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { getErrorMessage } from '../utils/errors';

type CurrentUser = {
  id?: string;
  username?: string;
  role?: string;
};

type SurveyTask = {
  id?: string;
  task_id?: string;
  application_id?: string;
  assigned_surveyor_id?: string;
  status?: string;
  created_at?: string;
  application?: {
    id?: string;
    application_type?: string;
    status?: string;
    priority?: string;
    parcel_ref?: {
      parcel_number?: string;
      zone_id?: string;
    };
  };
  surveyor?: {
    id?: string;
    name?: string;
    staff_code?: string;
  };
};

const taskStatuses = [
  '',
  'assigned',
  'visit_scheduled',
  'arrived_on_site',
  'survey_started',
  'survey_completed',
  'report_uploaded',
  'registrar_reviewed',
];

export function MySurveyTasksPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [tasks, setTasks] = useState<SurveyTask[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  async function loadTasks() {
    setIsLoading(true);
    setError('');
    try {
      const user = (await getCurrentUser()) as CurrentUser;
      setMe(user);

      const taskList = (await listSurveyTasks({
        limit: 100,
      })) as unknown as { data: SurveyTask[] };
      setTasks(taskList.data ?? []);
      setLastUpdated(new Date().toLocaleString());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => !statusFilter || task.status === statusFilter),
    [tasks, statusFilter],
  );

  const taskStats = useMemo(
    () => ({
      total: tasks.length,
      active: tasks.filter((task) => !['report_uploaded', 'registrar_reviewed'].includes(task.status ?? '')).length,
      completed: tasks.filter((task) => ['report_uploaded', 'registrar_reviewed'].includes(task.status ?? '')).length,
      scheduled: tasks.filter((task) => ['visit_scheduled', 'arrived_on_site', 'survey_started'].includes(task.status ?? '')).length,
    }),
    [tasks],
  );

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Field log</p>
            <h1 className="page-title">My survey tasks</h1>
            <p className="muted">
              Signed in as {me?.username ?? '...'} ({me?.role ?? 'surveyor'}). Review assigned survey work and open a task
              to log field progress, milestones, and reports.
            </p>
          </div>
          <div className="details-actions">
            <div className="session-panel">
              <strong>Survey feed</strong>
              <small>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for tasks'}</small>
            </div>
            <button type="button" className="button-link" onClick={loadTasks} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      {isLoading && <LoadingSpinner label="Loading survey tasks" />}

      {!isLoading && (
        <Card>
          <p className="eyebrow">Surveyor profile</p>
          <dl className="detail-grid">
            <div>
              <dt>Signed in as</dt>
              <dd>{me?.username ?? 'Surveyor account'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{formatLabel(me?.role ?? 'surveyor')}</dd>
            </div>
            <div>
              <dt>Resolved staff profile</dt>
              <dd>{firstSurveyorLabel(tasks) || 'No assigned task profile yet'}</dd>
            </div>
            <div>
              <dt>Active task load</dt>
              <dd>{taskStats.active} active / {taskStats.completed} completed</dd>
            </div>
          </dl>
        </Card>
      )}

      {!isLoading && (
        <section className="card-grid">
          <Metric label="Assigned tasks" value={taskStats.total} />
          <Metric label="Active tasks" value={taskStats.active} />
          <Metric label="In field progress" value={taskStats.scheduled} />
          <Metric label="Completed reports" value={taskStats.completed} />
        </section>
      )}

      {!isLoading && (
        <section className="staff-action-grid">
          <Link className="quick-action-card" to="/map">
            <strong>Open map</strong>
            <span>Check parcel geography and pending demand before field visits.</span>
          </Link>
          <Link className="quick-action-card" to="/staff-dashboard">
            <strong>Application queue</strong>
            <span>Review applications waiting for survey assignment or workflow movement.</span>
          </Link>
        </section>
      )}

      <Card>
        <div className="details-section-header">
          <div>
            <p className="eyebrow">Assigned work</p>
            <h2 style={{ margin: 0 }}>Survey task list</h2>
          </div>
          <label className="field application-picker">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {taskStatuses.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status ? formatLabel(status) : 'All tasks'}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!isLoading && visibleTasks.length === 0 && (
          <div className="empty-state">
            <h3>{tasks.length === 0 ? 'No survey tasks found' : 'No tasks match this filter'}</h3>
            <p>
              {tasks.length === 0
                ? 'Assigned survey tasks will appear here after staff auto-assigns a surveyor from the staff console.'
                : 'Try another milestone filter or clear the filter to return to the full task list.'}
            </p>
            <div className="scope-actions">
              {tasks.length > 0 && (
                <button type="button" className="button-link secondary-link" onClick={() => setStatusFilter('')}>
                  Clear filter
                </button>
              )}
              <Link className="button-link" to="/staff-dashboard">Open staff queue</Link>
            </div>
          </div>
        )}

        {!isLoading && visibleTasks.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 18 }}>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Application</th>
                  <th>Parcel</th>
                  <th>Priority</th>
                  <th>Milestone</th>
                  <th>Application status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id ?? task.task_id}>
                    <td>{task.task_id ?? task.id}</td>
                    <td>{formatLabel(task.application?.application_type)}</td>
                    <td>
                      {task.application?.parcel_ref?.parcel_number ?? 'Not provided'}
                      <br />
                      <small>{task.application?.parcel_ref?.zone_id ?? 'No zone'}</small>
                    </td>
                    <td>{task.application?.priority ?? 'normal'}</td>
                    <td><StatusBadge status={task.status ?? 'assigned'} /></td>
                    <td><StatusBadge status={task.application?.status ?? 'survey_required'} /></td>
                    <td>
                      <Button onClick={() => navigate(`/survey-tasks/${task.application_id}`)}>Open task</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div style={{ color: '#64748B', fontWeight: 800 }}>{label}</div>
      <div style={{ color: '#0F172A', fontSize: 30, fontWeight: 900, marginTop: 8 }}>{value}</div>
    </Card>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstSurveyorLabel(tasks: SurveyTask[]) {
  const surveyor = tasks.find((task) => task.surveyor?.name || task.surveyor?.staff_code)?.surveyor;
  if (!surveyor) return '';
  return [surveyor.name, surveyor.staff_code].filter(Boolean).join(' / ');
}
