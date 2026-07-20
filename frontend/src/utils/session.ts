import { getCurrentUser } from '../api/authApi';

export type SessionUser = {
  id?: string;
  username?: string;
  role?: string;
  linked_applicant_id?: string | null;
};

export function getRoleHomePath(user: SessionUser | null) {
  if (!user || user.role === 'applicant') {
    return user?.linked_applicant_id ? '/applicant-dashboard' : '/applicant-profile';
  }

  if (user.role === 'surveyor') {
    return '/my-survey-tasks';
  }

  if (['staff', 'registrar', 'manager', 'admin'].includes(user.role ?? '')) {
    return '/staff-dashboard';
  }

  return `/role-unavailable/${user.role}`;
}

export function getStoredToken() {
  return localStorage.getItem('lrmis_token');
}

export function storeSessionToken(token: string, expiresAt?: string) {
  localStorage.setItem('lrmis_token', token);
  if (expiresAt) {
    localStorage.setItem('lrmis_token_expires_at', expiresAt);
  }
}

export function getStoredTokenExpiry() {
  return localStorage.getItem('lrmis_token_expires_at');
}

export function isStoredTokenExpired() {
  const expiresAt = getStoredTokenExpiry();
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= Date.now();
}

export async function refreshSessionUser() {
  const user = (await getCurrentUser()) as SessionUser;
  localStorage.setItem('lrmis_user', JSON.stringify(user));
  return user;
}

export function getStoredSessionUser(): SessionUser | null {
  const raw = localStorage.getItem('lrmis_user');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    localStorage.removeItem('lrmis_user');
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('lrmis_token');
  localStorage.removeItem('lrmis_token_expires_at');
  localStorage.removeItem('lrmis_user');
}

export function expireSession(reason = 'Your session expired. Please sign in again.') {
  clearSession();
  sessionStorage.setItem('lrmis_session_message', reason);
}

export function consumeSessionMessage() {
  const message = sessionStorage.getItem('lrmis_session_message');
  if (message) {
    sessionStorage.removeItem('lrmis_session_message');
  }
  return message;
}
