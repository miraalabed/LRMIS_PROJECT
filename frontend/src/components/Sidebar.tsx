import { NavLink } from 'react-router-dom';

const applicantNavItems = [
  { label: 'Dashboard', href: '/applicant-dashboard' },
  { label: 'Applicant Profile', href: '/applicant-profile' },
  { label: 'Submit Application', href: '/submit-application' },
  { label: 'Track Application', href: '/track-application' },
  { label: 'Upload Documents', href: '/upload-documents' },
  { label: 'Submit Objection', href: '/submit-objection' },
];

const staffNavItems = [
  { label: 'Application Queue', href: '/staff-dashboard' },
  { label: 'Analytics Dashboard', href: '/analytics' },
  { label: 'Map View', href: '/map' },
];

const surveyorNavItems = [
  { label: 'My Survey Tasks', href: '/my-survey-tasks' },
];

export function Sidebar({ variant = 'applicant' }: { variant?: 'applicant' | 'staff' | 'surveyor' }) {
  const navItems = variant === 'staff' ? staffNavItems : variant === 'surveyor' ? surveyorNavItems : applicantNavItems;
  const label = variant === 'staff' ? 'Staff workspace' : variant === 'surveyor' ? 'Survey workspace' : 'Applicant workspace';
  const note = variant === 'staff'
    ? 'Review applications, update workflow, and issue certificates.'
    : variant === 'surveyor'
      ? 'Open assigned survey tasks and record field progress.'
      : 'Use Track Application to look up any submitted request.';

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">LR</span>
        <div>
          <strong>LRMIS</strong>
          <small>{label}</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-note">
        <strong>Need help?</strong>
        <span>{note}</span>
      </div>
    </aside>
  );
}
