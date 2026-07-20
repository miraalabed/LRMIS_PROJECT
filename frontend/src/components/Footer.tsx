import { getStoredSessionUser } from '../utils/session';

export function Footer() {
  const user = getStoredSessionUser();
  const role = user?.role ? formatRole(user.role) : 'Applicant';

  return (
    <footer className="app-footer">
      <span>LRMIS {role} Portal</span>
      <span>Connected to local backend service</span>
    </footer>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
