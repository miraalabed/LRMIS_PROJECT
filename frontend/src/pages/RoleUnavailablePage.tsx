import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../utils/errors';
import { clearSession, getRoleHomePath, refreshSessionUser, type SessionUser } from '../utils/session';

const roleCopy: Record<string, { title: string; summary: string; actions: string[] }> = {
  staff: {
    title: 'Staff Intake Workspace',
    summary: 'Staff users can manage application intake, inspect details, and move workflow steps from the staff workspace.',
    actions: ['Application queue', 'Application review', 'Document review', 'Workflow updates'],
  },
  surveyor: {
    title: 'Survey Assignment Desk',
    summary: 'Surveyors can open assigned task lists, update field progress, and submit survey reports.',
    actions: ['Survey task list', 'Field progress', 'Milestone updates', 'Survey report submission'],
  },
  registrar: {
    title: 'Registrar Review Queue',
    summary: 'Registrars use the staff workspace for legal review, approval decisions, and certificate issuance.',
    actions: ['Legal review queue', 'Approval decisions', 'Certificate issuance', 'Objection review handoff'],
  },
  manager: {
    title: 'Management Overview',
    summary: 'Managers can use the staff workspace, analytics dashboard, and map view for operational oversight.',
    actions: ['Operational dashboard', 'Workload reports', 'Application aging metrics', 'Staff activity overview'],
  },
};

export function RoleUnavailablePage() {
  const { role = 'staff' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const details = roleCopy[role] ?? roleCopy.staff;
  const homePath = getRoleHomePath(user ?? { role });

  useEffect(() => {
    async function loadSession() {
      try {
        const currentUser = await refreshSessionUser();
        setUser(currentUser);

        if (currentUser.role === 'applicant') {
          navigate(getRoleHomePath(currentUser), { replace: true });
        }
      } catch (sessionError) {
        const message = getErrorMessage(sessionError);
        setError(message);
        showToast({ type: 'error', title: 'Session check failed', message });
      }
    }

    loadSession();
  }, [navigate, showToast]);

  function handleSignOut() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="page-stack">
      <Card>
        <p className="eyebrow">Workspace routing</p>
        <h1 className="page-title">{details.title}</h1>
        <p className="muted">{details.summary}</p>
        <ErrorMessage message={error} />
      </Card>

      <section className="details-two-column">
        <Card>
          <p className="eyebrow">Authenticated session</p>
          <dl className="detail-grid">
            <div>
              <dt>Username</dt>
              <dd>{user?.username ?? 'Checking session...'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role ?? role}</dd>
            </div>
            <div>
              <dt>Backend status</dt>
              <dd>Connected</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <p className="eyebrow">Available actions</p>
          <div className="scope-list">
            {details.actions.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="scope-actions">
          <Button onClick={() => navigate(homePath)}>Open my workspace</Button>
          {(user?.role === 'staff' || user?.role === 'registrar' || user?.role === 'manager') && (
            <>
              <Button variant="secondary" onClick={() => navigate('/analytics')}>Open analytics</Button>
              <Button variant="secondary" onClick={() => navigate('/map')}>Open map</Button>
            </>
          )}
          <Button variant="secondary" onClick={() => navigate('/')}>Back to role selection</Button>
          <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}
