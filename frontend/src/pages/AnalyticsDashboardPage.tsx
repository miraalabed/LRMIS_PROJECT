import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getApplicationsByStatus,
  getApplicationsByZone,
  getKpis,
  getProcessingTime,
  getRegistrarAnalytics,
  getSurveyorAnalytics,
} from '../api/analyticsApi';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { getErrorMessage } from '../utils/errors';

type MetricMap = Record<string, unknown>;
type CountRow = Record<string, unknown>;

type StaffRow = {
  name?: string;
  staff_code?: string;
  active_tasks?: number;
  completed_tasks?: number;
  reviewed_count?: number;
  accepted_count?: number;
  rejected_count?: number;
};

const metricCards = [
  ['total_applications', 'Total applications'],
  ['pending_applications', 'Pending'],
  ['approved_applications', 'Approved'],
  ['rejected_applications', 'Rejected'],
  ['applications_under_objection', 'Under objection'],
  ['certificate_issued', 'Certificates issued'],
  ['average_processing_days', 'Avg. processing days'],
] as const;

const actionCards = [
  {
    title: 'Review application queue',
    description: 'Open staff management to inspect pending, rejected, approved, and objection cases.',
    to: '/staff-dashboard',
  },
  {
    title: 'Open parcel map',
    description: 'View parcel geometry, zone distribution, and pending application heat points.',
    to: '/map',
  },
];

export function AnalyticsDashboardPage() {
  const [kpis, setKpis] = useState<MetricMap>({});
  const [statusRows, setStatusRows] = useState<CountRow[]>([]);
  const [zoneRows, setZoneRows] = useState<CountRow[]>([]);
  const [processingRows, setProcessingRows] = useState<CountRow[]>([]);
  const [surveyorRows, setSurveyorRows] = useState<StaffRow[]>([]);
  const [registrarRows, setRegistrarRows] = useState<StaffRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  async function loadAnalytics() {
    setIsLoading(true);
    setError('');
    try {
      const [nextKpis, byStatus, byZone, processing, surveyors, registrars] = await Promise.all([
        getKpis(),
        getApplicationsByStatus(),
        getApplicationsByZone(),
        getProcessingTime(),
        getSurveyorAnalytics(),
        getRegistrarAnalytics(),
      ]);
      setKpis(nextKpis ?? {});
      setStatusRows(byStatus ?? []);
      setZoneRows(byZone ?? []);
      setProcessingRows(processing ?? []);
      setSurveyorRows((surveyors as StaffRow[]) ?? []);
      setRegistrarRows((registrars as StaffRow[]) ?? []);
      setLastUpdated(new Date().toLocaleString());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const statusTotal = useMemo(() => totalCount(statusRows), [statusRows]);
  const zoneTotal = useMemo(() => totalCount(zoneRows), [zoneRows]);
  const hasAnalyticsData = useMemo(() => {
    return (
      asNumber(kpis.total_applications) > 0 ||
      statusRows.length > 0 ||
      zoneRows.length > 0 ||
      processingRows.length > 0 ||
      surveyorRows.length > 0 ||
      registrarRows.length > 0
    );
  }, [kpis, processingRows.length, registrarRows.length, statusRows.length, surveyorRows.length, zoneRows.length]);

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Analytics</p>
            <h1 className="page-title">Operations dashboard</h1>
            <p className="muted">Track application volume, workflow pressure, zone demand, and staff workload from live MongoDB data.</p>
          </div>
          <div className="details-actions">
            <div className="session-panel">
              <strong>Live analytics</strong>
              <small>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for first refresh'}</small>
            </div>
            <button type="button" className="button-link" onClick={loadAnalytics} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      {isLoading && <LoadingSpinner label="Loading analytics" />}

      {!isLoading && (
        <>
          {!hasAnalyticsData && (
            <Card>
              <div className="empty-state">
                <h3>No analytics data yet</h3>
                <p>Analytics will fill automatically after applications, workflow actions, survey tasks, registrar reviews, or certificates are stored in MongoDB.</p>
                <Link className="button-link" to="/staff-dashboard">Open application queue</Link>
              </div>
            </Card>
          )}

          <section className="card-grid analytics-metric-grid">
            {metricCards.map(([key, label]) => (
              <MetricCard key={key} label={label} value={formatMetric(kpis[key])} />
            ))}
          </section>

          <section className="staff-action-grid">
            {actionCards.map((action) => (
              <Link className="quick-action-card" key={action.to} to={action.to}>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </Link>
            ))}
          </section>

          <section className="details-two-column">
            <Card>
              <SectionHeader eyebrow="Workflow" title="Applications by status" />
              {statusRows.length === 0 ? (
                <EmptyBlock message="No status data has been recorded yet." />
              ) : (
                <BarList rows={statusRows} labelKey="status" total={statusTotal} />
              )}
            </Card>

            <Card>
              <SectionHeader eyebrow="Geography" title="Applications by zone" />
              {zoneRows.length === 0 ? (
                <EmptyBlock message="No zone data is available yet." />
              ) : (
                <BarList rows={zoneRows} labelKey="zone_id" total={zoneTotal} />
              )}
            </Card>
          </section>

          <Card>
            <SectionHeader eyebrow="Performance" title="Processing time by application type" />
            <ResponsiveTable
              emptyMessage="No completed processing-time records yet."
              headers={['Application type', 'Average days', 'Count']}
              rows={processingRows.map((row) => [
                formatLabel(row.application_type),
                formatMetric(row.avg_days),
                formatMetric(row.count),
              ])}
            />
          </Card>

          <section className="details-two-column">
            <Card>
              <SectionHeader eyebrow="Field work" title="Surveyor workload" />
              <ResponsiveTable
                emptyMessage="No surveyor workload has been assigned yet."
                headers={['Surveyor', 'Active', 'Completed']}
                rows={surveyorRows.map((row) => [
                  row.name || row.staff_code || 'Unassigned',
                  formatMetric(row.active_tasks),
                  formatMetric(row.completed_tasks),
                ])}
              />
            </Card>

            <Card>
              <SectionHeader eyebrow="Legal review" title="Registrar workload" />
              <ResponsiveTable
                emptyMessage="No registrar review activity yet."
                headers={['Registrar', 'Reviewed', 'Accepted', 'Rejected']}
                rows={registrarRows.map((row) => [
                  row.name || row.staff_code || 'Unassigned',
                  formatMetric(row.reviewed_count),
                  formatMetric(row.accepted_count),
                  formatMetric(row.rejected_count),
                ])}
              />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="analytics-metric">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Card>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="details-section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>
    </div>
  );
}

function BarList({ rows, labelKey, total }: { rows: CountRow[]; labelKey: string; total: number }) {
  return (
    <div className="analytics-bar-list">
      {rows.map((row, index) => {
        const count = asNumber(row.count);
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const label = formatLabel(row[labelKey] ?? row._id ?? 'Unassigned');
        return (
          <div className="analytics-bar-row" key={`${label}-${index}`}>
            <div className="analytics-bar-label">
              {labelKey === 'status' ? <StatusBadge status={String(row[labelKey] ?? row._id ?? 'submitted')} /> : <strong>{label}</strong>}
              <span>{count} ({percent}%)</span>
            </div>
            <div className="analytics-bar-track" aria-hidden="true">
              <span className="analytics-bar-fill" style={{ width: `${Math.max(percent, count > 0 ? 6 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResponsiveTable({ headers, rows, emptyMessage }: { headers: string[]; rows: string[][]; emptyMessage: string }) {
  if (rows.length === 0) return <EmptyBlock message={emptyMessage} />;

  return (
    <div className="analytics-table-wrap">
      <table className="staff-table analytics-table">
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return <p className="empty-inline"><span>{message}</span></p>;
}

function totalCount(rows: CountRow[]) {
  return rows.reduce((sum, row) => sum + asNumber(row.count), 0);
}

function asNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMetric(value: unknown) {
  if (value === undefined || value === null || value === '') return '0';
  const numberValue = Number(value);
  if (Number.isFinite(numberValue)) {
    return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
  }
  return String(value);
}

function formatLabel(value?: unknown) {
  if (!value) return 'Unassigned';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
