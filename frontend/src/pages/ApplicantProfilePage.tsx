import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApplicant, getApplicantById, updateApplicant } from '../api/applicantsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormSection } from '../components/FormSection';
import { useToast } from '../components/ToastProvider';
import { theme } from '../theme';
import { getErrorMessage } from '../utils/errors';
import { refreshSessionUser, type SessionUser } from '../utils/session';

const applicantTypes = ['citizen', 'lawyer', 'company', 'surveyor', 'authorized_representative'];
const preferredLanguages = ['en', 'ar'];

const initialProfile = {
  full_name: '',
  applicant_type: 'citizen',
  national_id: '',
  registration_number: '',
  email: '',
  phone: '',
  city: '',
  neighborhood: '',
  zone_id: '',
  preferred_language: 'en',
  notify_status: true,
  notify_documents: true,
  notify_certificate: true,
};

export function ApplicantProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(initialProfile);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isEditing = Boolean(user?.linked_applicant_id);
  const isCompany = profile.applicant_type === 'company';

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = await refreshSessionUser();
        setUser(currentUser);
        if (currentUser.linked_applicant_id) {
          const existingProfile = await getApplicantById(currentUser.linked_applicant_id);
          setProfile(profileFromResponse(existingProfile));
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    const checked = 'checked' in event.target ? event.target.checked : false;
    setProfile((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setSuccess('');
    setValidationErrors([]);
  }

  function validateProfile() {
    const errors: string[] = [];
    const hasIdentity = profile.national_id.trim() || profile.registration_number.trim();

    if (profile.full_name.trim().length < 3) {
      errors.push(isCompany ? 'Company name must be at least 3 characters.' : 'Full name must be at least 3 characters.');
    }
    if (!hasIdentity) {
      errors.push(isCompany ? 'Registration number is required for company applicants.' : 'National ID is required.');
    }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors.push('Email address is not valid.');
    }
    if (profile.phone && profile.phone.replace(/[^\d+]/g, '').length < 7) {
      errors.push('Phone number looks too short.');
    }
    if (!profile.preferred_language.trim()) {
      errors.push('Preferred language is required.');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validateProfile()) {
      showToast({ type: 'error', title: 'Review profile fields', message: 'Fix the validation messages before saving.' });
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        full_name: profile.full_name.trim(),
        email: profile.email || null,
        phone: profile.phone || null,
        applicant_type: profile.applicant_type,
        national_id: profile.national_id.trim() || profile.registration_number.trim(),
        address: {
          city: profile.city.trim() || null,
          neighborhood: profile.neighborhood.trim() || null,
          zone_id: profile.zone_id.trim() || null,
        },
        preferred_language: profile.preferred_language,
        notification_preferences: {
          on_status_change: profile.notify_status,
          on_missing_documents: profile.notify_documents,
          on_certificate_ready: profile.notify_certificate,
        },
        privacy_settings: {
          registration_number: profile.registration_number.trim() || null,
        },
      };

      if (user?.linked_applicant_id) {
        await updateApplicant(user.linked_applicant_id, payload);
        setSuccess('Applicant profile updated.');
        showToast({ type: 'success', title: 'Profile updated', message: 'Your applicant details were saved.' });
      } else {
        await createApplicant(payload);
        const updatedUser = await refreshSessionUser();
        setUser(updatedUser);
        setSuccess('Applicant profile created.');
        showToast({ type: 'success', title: 'Profile created', message: 'You can now submit land applications.' });
      }
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      showToast({ type: 'error', title: 'Could not save profile', message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Applicant profile</p>
            <h1 className="page-title">{isEditing ? 'Edit applicant profile' : 'Set up your applicant profile'}</h1>
            <p className="muted">
              {isEditing
                ? 'Keep your applicant identity, contact details, and notification preferences current.'
                : 'Create this profile once. Applications will use this linked applicant record instead of asking you to recreate it every time.'}
            </p>
          </div>
          {user?.linked_applicant_id && (
            <div className="session-panel">
              <strong>Linked applicant</strong>
              <small>{user.linked_applicant_id}</small>
            </div>
          )}
        </div>
      </Card>

      <Card>
        {isLoading && <p className="muted">Loading applicant profile...</p>}

        {!isLoading && <form onSubmit={handleSubmit} className="application-form">
          <FormSection title="Identity and contact">
            <Input label={isCompany ? 'Company name' : 'Full name'} name="full_name" value={profile.full_name} onChange={updateField} required />
            <Select label="Applicant type" name="applicant_type" value={profile.applicant_type} options={applicantTypes} onChange={updateField} />
            <Input label="National ID" name="national_id" value={profile.national_id} onChange={updateField} required={!isCompany && !profile.registration_number} />
            <Input label="Registration number" name="registration_number" value={profile.registration_number} onChange={updateField} required={isCompany && !profile.national_id} />
            <Input label="Email" name="email" value={profile.email} type="email" onChange={updateField} />
            <Input label="Phone" name="phone" value={profile.phone} onChange={updateField} />
          </FormSection>

          <FormSection title="Address and preferences">
            <Input label="City" name="city" value={profile.city} onChange={updateField} />
            <Input label="Neighborhood" name="neighborhood" value={profile.neighborhood} onChange={updateField} />
            <Input label="Zone ID" name="zone_id" value={profile.zone_id} onChange={updateField} />
            <Select label="Preferred language" name="preferred_language" value={profile.preferred_language} options={preferredLanguages} onChange={updateField} />
            <Checkbox label="Notify status changes" name="notify_status" checked={profile.notify_status} onChange={updateField} />
            <Checkbox label="Notify missing documents" name="notify_documents" checked={profile.notify_documents} onChange={updateField} />
            <Checkbox label="Notify certificate ready" name="notify_certificate" checked={profile.notify_certificate} onChange={updateField} />
          </FormSection>

          {validationErrors.length > 0 && (
            <div className="validation-box">
              {validationErrors.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </div>
          )}
          <ErrorMessage message={error} />
          {success && (
            <div className="notice-box success-box">
              <strong>{success}</strong>
              <span>{isEditing ? 'Your saved profile will be used on future applications.' : 'You can now continue to the application form.'}</span>
            </div>
          )}
          <div className="form-actions">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving profile...' : isEditing ? 'Update profile' : 'Save profile'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/applicant-dashboard')}>
              Back to dashboard
            </Button>
            {user?.linked_applicant_id && (
              <Button variant="accent" onClick={() => navigate('/submit-application')}>
                Submit application
              </Button>
            )}
          </div>
        </form>}
      </Card>
    </div>
  );
}

function profileFromResponse(data: Record<string, unknown>) {
  const address = (data.address ?? {}) as Record<string, unknown>;
  const preferences = (data.notification_preferences ?? {}) as Record<string, unknown>;
  const privacy = (data.privacy_settings ?? {}) as Record<string, unknown>;

  return {
    full_name: String(data.full_name ?? ''),
    applicant_type: String(data.applicant_type ?? 'citizen'),
    national_id: String(data.national_id ?? ''),
    registration_number: String(privacy.registration_number ?? ''),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    city: String(address.city ?? ''),
    neighborhood: String(address.neighborhood ?? ''),
    zone_id: String(address.zone_id ?? ''),
    preferred_language: String(data.preferred_language ?? 'en'),
    notify_status: Boolean(preferences.on_status_change ?? true),
    notify_documents: Boolean(preferences.on_missing_documents ?? true),
    notify_certificate: Boolean(preferences.on_certificate_ready ?? true),
  };
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="field">
      {label}
      <select {...props}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}
