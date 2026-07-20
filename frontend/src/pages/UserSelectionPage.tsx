import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../api/authApi';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../utils/errors';
import { clearSession, consumeSessionMessage, getRoleHomePath, getStoredToken, refreshSessionUser, storeSessionToken } from '../utils/session';

const roles = [
  {
    name: 'applicant',
    title: 'Applicant',
    heading: 'Applicant Service Portal',
    copy: 'Start a registration request, follow its status, and keep parcel details organized in one applicant workspace.',
    detail: 'Submit and track land registration requests.',
    canRegister: true,
  },
  {
    name: 'staff',
    title: 'Staff',
    heading: 'Staff Intake Workspace',
    copy: 'Prepare applications for review, check applicant records, and organize incoming registration requests.',
    detail: 'Intake and pre-check workspace.',
    canRegister: false,
  },
  {
    name: 'surveyor',
    title: 'Surveyor',
    heading: 'Survey Assignment Desk',
    copy: 'Review assigned parcels, coordinate field work, and prepare survey outputs for the registration process.',
    detail: 'Survey assignments and field updates.',
    canRegister: false,
  },
  {
    name: 'registrar',
    title: 'Registrar',
    heading: 'Registrar Review Queue',
    copy: 'Review legal status, evaluate completed applications, and prepare decisions for land registration cases.',
    detail: 'Legal review and approval queue.',
    canRegister: false,
  },
  {
    name: 'manager',
    title: 'Manager',
    heading: 'Management Overview',
    copy: 'Monitor service performance, application queues, and operational workload across the registry office.',
    detail: 'Operational oversight and reports.',
    canRegister: false,
  },
];

export function UserSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState(roles[0]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(() => consumeSessionMessage() ?? '');

  useEffect(() => {
    async function redirectSignedInUser() {
      if (!getStoredToken()) {
        return;
      }

      try {
        const user = await refreshSessionUser();
        const fallback = getRoleHomePath(user);
        const requestedPath = (location.state as { from?: string } | null)?.from;
        navigate(requestedPath || fallback, { replace: true });
      } catch {
        clearSession();
        setError((current) => current || 'Your session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      }
    }

    redirectSignedInUser();
  }, [location.state, navigate]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    await loginApplicant();
  }

  async function loginApplicant() {
    setIsLoggingIn(true);
    setError('');

    try {
      const response = await loginUser({ username, password });
      storeSessionToken(String(response.token), response.expires_at ? String(response.expires_at) : undefined);
      const user = await refreshSessionUser();
      showToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${user.username}.` });
      navigate(getRoleHomePath(user));
    } catch (loginError) {
      const message = getErrorMessage(loginError);
      setError(message);
      showToast({ type: 'error', title: 'Sign in failed', message });
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleCreateAccount() {
    if (!selectedRole.canRegister) {
      const message = 'Only applicant accounts can be created from this public page. Staff accounts must be created by an administrator.';
      setError(message);
      showToast({ type: 'error', title: 'Registration unavailable', message });
      return;
    }

    setIsRegistering(true);
    setError('');

    try {
      await registerUser({
        username,
        password,
        role: selectedRole.name,
      });
      showToast({ type: 'success', title: 'Account created', message: 'Signing you in now.' });
      await loginApplicant();
    } catch (registerError) {
      const message = getErrorMessage(registerError);
      setError(message);
      showToast({ type: 'error', title: 'Account creation failed', message });
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <header className="auth-header">
          <div>
            <span className="brand-mark">LR</span>
            <span className="brand-text">LRMIS</span>
          </div>
          <span className="auth-status">{selectedRole.title} portal preview</span>
        </header>

        <main className="auth-panel">
          <section className="auth-hero">
            <p className="eyebrow">Land Registration Management Information System</p>
            <h1 className="auth-title">{selectedRole.heading}</h1>
            <p className="auth-copy">{selectedRole.copy}</p>

            <div className="auth-metrics">
              <div>
                <strong>6</strong>
                <span>Request types</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>Status access</span>
              </div>
              <div>
                <strong>1</strong>
                <span>Applicant queue</span>
              </div>
            </div>

            <div className="role-list">
              {roles.map((role) => {
                const isSelected = role.name === selectedRole.name;

                return (
                  <button
                    key={role.name}
                    type="button"
                    className={`role-card ${isSelected ? 'role-card-active' : ''}`}
                    onClick={() => {
                      setSelectedRole(role);
                      setError('');
                    }}
                  >
                    <span>{role.title}</span>
                    <small>{role.detail}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="login-panel">
            <div>
              <p className="eyebrow">Secure access</p>
              <h2>{selectedRole.title} login</h2>
              <p className="muted">
                {selectedRole.name === 'applicant'
                  ? 'Use an applicant account to submit a new application through the backend.'
                  : `Use an existing ${selectedRole.title.toLowerCase()} account to open the ${selectedRole.title.toLowerCase()} workspace.`}
              </p>
            </div>

            {selectedRole.name !== 'applicant' && (
              <div className="notice-box">
                Public registration is only for applicants. Ask an administrator to create or link {selectedRole.title.toLowerCase()} credentials.
              </div>
            )}

            <form onSubmit={handleLogin} className="stack">
              <label className="field">
              Username
                <input value={username} onChange={(event) => setUsername(event.target.value)} required />
              </label>
              <label className="field">
              Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <ErrorMessage message={error} />
              <Button type="submit" disabled={isLoggingIn || isRegistering} style={{ width: '100%', minHeight: 48 }}>
                {isLoggingIn ? 'Signing in...' : 'Sign in'}
              </Button>
              <div className="login-actions">
                <button type="button" className="text-link centered-link" onClick={handleCreateAccount} disabled={isRegistering || !username || !password}>
                  {isRegistering
                    ? 'Creating account...'
                    : selectedRole.name === 'applicant'
                      ? 'Create account and set up profile'
                      : `${selectedRole.title} accounts are admin-created`}
                </button>
              </div>
            </form>
          </aside>
        </main>
      </div>
    </div>
  );
}
