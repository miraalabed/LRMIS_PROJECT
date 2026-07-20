import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApplications } from '../api/applicationsApi';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { theme } from '../theme';
import { getErrorMessage } from '../utils/errors';
import { getStoredSessionUser } from '../utils/session';

const statuses = ['', 'submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review', 'approved', 'missing_documents', 'under_objection', 'on_hold', 'rejected'];
const applicationTypes = ['', 'first_registration', 'ownership_transfer', 'parcel_subdivision', 'parcel_merge', 'boundary_correction', 'certificate_request'];

type ApplicationRow = {
  id: string;
  application_type?: string;
  status?: string;
  applicant_id?: string;
  parcel_ref?: { parcel_number?: string; zone_id?: string };
  created_at?: string;
};

export function StaffDashboardPage() {
  const navigate = useNavigate();
  const user = getStoredSessionUser();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadApplications(nextFilters = { status: statusFilter, application_type: typeFilter }) {
    setIsLoading(true);
    setError('');
    try {
      const response = await getApplications({
        limit: 100,
        sort_by: 'created_at',
        sort_dir: 'desc',
        ...(nextFilters.status ? { status: nextFilters.status } : {}),
        ...(nextFilters.application_type ? { application_type: nextFilters.application_type } : {}),
      });
      setApplications((response.data as ApplicationRow[]) ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, []);

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter((item) => ['submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review'].includes(item.status ?? '')).length,
    legalReview: applications.filter((item) => item.status === 'legal_review').length,
    objections: applications.filter((item) => item.status === 'under_objection').length,
    missingDocuments: applications.filter((item) => item.status === 'missing_documents').length,
  }), [applications]);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    loadApplications({ status: statusFilter, application_type: typeFilter });
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Staff console</p>
            <h1 className="page-title">Application management</h1>
            <p className="muted">Review submitted applications, inspect documents, manage workflow status, and issue certificates.</p>
          </div>
          <div className="session-panel">
            <strong>{formatLabel(user?.role ?? 'staff')} session</strong>
            <small>{user?.username ?? 'Back-office user'}</small>
            <button type="button" className="text-link" onClick={() => loadApplications()}>
              Refresh queue
            </button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      <section className="card-grid">
        <Metric label="Total queue" value={stats.total} />
        <Metric label="Pending" value={stats.pending} />
        <Metric label="Legal review" value={stats.legalReview} />
        <Metric label="Missing documents" value={stats.missingDocuments} />
        <Metric label="Under objection" value={stats.objections} />
      </section>

      <section className="card-grid analytics-metric-grid">
        <QuickAction title="Analytics" detail="Open operational KPIs and workload charts." onClick={() => navigate('/analytics')} />
        <QuickAction title="Map view" detail="Inspect parcel GeoJSON and pending heat points." onClick={() => navigate('/map')} />
        <QuickAction title="Legal review queue" detail="Filter applications waiting for registrar review." onClick={() => {
          setStatusFilter('legal_review');
          loadApplications({ status: 'legal_review', application_type: typeFilter });
        }} />
        <QuickAction title="Missing documents" detail="Find applications that need applicant uploads." onClick={() => {
          setStatusFilter('missing_documents');
          loadApplications({ status: 'missing_documents', application_type: typeFilter });
        }} />
      </section>

      <Card>
        <form onSubmit={handleFilter} className="staff-filter-bar">
          <label className="field">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statuses.map((status) => (
                <option key={status || 'all'} value={status}>{status ? formatLabel(status) : 'All statuses'}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {applicationTypes.map((type) => (
                <option key={type || 'all'} value={type}>{type ? formatLabel(type) : 'All types'}</option>
              ))}
            </select>
          </label>
          <button className="button-link" type="submit">Apply filters</button>
          <button className="text-link" type="button" onClick={() => {
            setStatusFilter('');
            setTypeFilter('');
            loadApplications({ status: '', application_type: '' });
          }}>
            Clear
          </button>
        </form>
      </Card>

      <Card>
        <div className="details-section-header">
          <div>
            <p className="eyebrow">Queue</p>
            <h2 style={{ margin: 0 }}>Applications</h2>
            <p className="muted">Metrics and table reflect the current filter set.</p>
          </div>
        </div>
        {isLoading && <LoadingSpinner label="Loading applications" />}
        {!isLoading && applications.length === 0 && (
          <div className="empty-state">
            <h3>No applications found</h3>
            <p>Try clearing filters, or wait for applicants to submit new registration requests.</p>
            <button type="button" className="button-link" onClick={() => {
              setStatusFilter('');
              setTypeFilter('');
              loadApplications({ status: '', application_type: '' });
            }}>
              Clear filters
            </button>
          </div>
        )}
        {!isLoading && applications.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: theme.spacing.md }}>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Parcel</th>
                  <th>Zone</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td><Link className="text-link" to={`/staff/applications/${application.id}`}>{application.id}</Link></td>
                    <td>{formatLabel(application.application_type)}</td>
                    <td><StatusBadge status={application.status ?? 'submitted'} /></td>
                    <td>{application.parcel_ref?.parcel_number ?? 'Not provided'}</td>
                    <td>{application.parcel_ref?.zone_id ?? 'Not provided'}</td>
                    <td>{application.created_at ? new Date(application.created_at).toLocaleDateString() : 'Not provided'}</td>
                    <td><button type="button" className="text-link" onClick={() => navigate(`/staff/applications/${application.id}`)}>Open</button></td>
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

function QuickAction({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" className="quick-action-card" onClick={onClick}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div style={{ color: theme.colors.mutedText, fontWeight: 800 }}>{label}</div>
      <div style={{ color: theme.colors.primary, fontSize: 30, fontWeight: 900, marginTop: 8 }}>{value}</div>
    </Card>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
