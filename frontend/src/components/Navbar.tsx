import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { clearSession, getStoredSessionUser } from '../utils/session';

export function Navbar() {
  const navigate = useNavigate();
  const user = getStoredSessionUser();
  const roleTitle = formatRole(user?.role ?? 'applicant');

  function handleSignOut() {
    clearSession();
    navigate('/');
  }

  return (
    <header className="app-navbar">
      <div>
        <p className="eyebrow">Land Registration Management Information System</p>
        <strong>{roleTitle} Portal</strong>
      </div>
      <div className="navbar-session">
        <span className="connection-dot" />
        <span>{user?.username ?? `${roleTitle} session`}</span>
        <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
      </div>
    </header>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
