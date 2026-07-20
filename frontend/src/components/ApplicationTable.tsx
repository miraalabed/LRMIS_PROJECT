import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';

type ApplicationRow = {
  id: string;
  application_type?: string;
  status?: string;
  parcel_ref?: { parcel_number?: string };
  created_at?: string;
};

export function ApplicationTable({ applications }: { applications: ApplicationRow[] }) {
  if (!applications.length) {
    return <p className="muted">No applications found.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="staff-table">
        <thead>
          <tr>
            {['Application ID', 'Type', 'Status', 'Parcel', 'Submitted'].map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td>
                <Link to={`/applications/${application.id}`} className="text-link">
                  {application.id}
                </Link>
              </td>
              <td>{formatLabel(application.application_type)}</td>
              <td>
                <StatusBadge status={application.status ?? 'submitted'} />
              </td>
              <td>{application.parcel_ref?.parcel_number ?? 'Not provided'}</td>
              <td>
                {application.created_at ? new Date(application.created_at).toLocaleDateString() : 'Not provided'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
