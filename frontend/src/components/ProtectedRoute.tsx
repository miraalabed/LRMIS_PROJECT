import { Navigate, useLocation } from 'react-router-dom';
import { expireSession, getRoleHomePath, getStoredSessionUser, getStoredToken, isStoredTokenExpired } from '../utils/session';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const location = useLocation();
  const token = getStoredToken();
  const user = getStoredSessionUser();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (isStoredTokenExpired()) {
    expireSession();
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !user?.role) {
    expireSession('Your session could not be verified. Please sign in again.');
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && user?.role && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user)} replace />;
  }

  return <>{children}</>;
}
