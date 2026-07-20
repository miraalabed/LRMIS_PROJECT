import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApplicantById } from '../api/applicantsApi';
import { createApplication } from '../api/applicationsApi';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormSection } from '../components/FormSection';
import { useToast } from '../components/ToastProvider';
import { theme } from '../theme';
import { formatValue, getErrorMessage } from '../utils/errors';
import { refreshSessionUser, type SessionUser } from '../utils/session';

const applicationTypes = ['first_registration', 'ownership_transfer', 'parcel_subdivision', 'parcel_merge', 'boundary_correction', 'certificate_request'];
const priorities = ['low', 'normal', 'high', 'urgent'];
const draftKey = 'lrmis_submit_application_draft';
const requiredDocumentsByType: Record<string, string[]> = {
  first_registration: ['identity_document', 'proof_of_ownership'],
  ownership_transfer: ['identity_document', 'proof_of_ownership', 'tax_clearance'],
  parcel_subdivision: ['identity_document', 'proof_of_ownership', 'survey_plan'],
  parcel_merge: ['identity_document', 'proof_of_ownership', 'survey_plan'],
  boundary_correction: ['identity_document', 'survey_plan'],
  certificate_request: ['identity_document'],
};

const initialForm = {
  application_type: 'first_registration',
  priority: 'normal',
  parcel_number: '',
  block_number: '',
  basin_number: '',
  parcel_zone_id: '',
  parcel_coordinates: '',
  description: '',
};

const steps = ['Applicant Info', 'Parcel Info', 'Review & Submit'];

type FormState = typeof initialForm;

export function SubmitApplicationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(() => loadDraft());
  const [step, setStep] = useState(0);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applicantProfile, setApplicantProfile] = useState<Record<string, unknown> | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ id: string; status: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = await refreshSessionUser();
        setUser(currentUser);
        if (currentUser.linked_applicant_id) {
          const profile = await getApplicantById(currentUser.linked_applicant_id);
          setApplicantProfile(profile);
        }
      } catch (profileError) {
        setError(getErrorMessage(profileError));
      } finally {
        setIsLoadingProfile(false);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
    setDraftSavedAt(new Date().toLocaleTimeString());
  }, [form]);

  const applicantId = user?.linked_applicant_id;
  const canSubmit = Boolean(applicantId && applicantProfile);
  const requiredDocuments = requiredDocumentsByType[form.application_type] ?? ['identity_document'];
  const coordinateParse = useMemo(() => parseCoordinateText(form.parcel_coordinates), [form.parcel_coordinates]);
  const parcelGeoJson = useMemo(() => buildPolygonGeoJson(coordinateParse.points), [coordinateParse.points]);

  const reviewRows = useMemo(
    () => [
      ['Applicant', formatValue(applicantProfile?.full_name)],
      ['Applicant type', formatValue(applicantProfile?.applicant_type)],
      ['Email', formatValue(applicantProfile?.email)],
      ['Phone', formatValue(applicantProfile?.phone)],
      ['Application type', formatLabel(form.application_type)],
      ['Priority', formatLabel(form.priority)],
      ['Parcel number', form.parcel_number.trim()],
      ['Block number', form.block_number.trim()],
      ['Basin number', form.basin_number.trim()],
      ['Zone ID', form.parcel_zone_id.trim()],
      ['Parcel geometry points', coordinateParse.points.length ? `${coordinateParse.points.length} boundary points` : 'Not provided'],
      ['Required documents', requiredDocuments.map(formatLabel).join(', ')],
      ['Description', form.description.trim()],
    ],
    [applicantProfile, coordinateParse.points.length, form, requiredDocuments],
  );

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setValidationErrors([]);
  }

  function validateStep(targetStep = step) {
    const errors: string[] = [];

    if (targetStep === 0) {
      if (!applicantId) {
        errors.push('Applicant profile is required before submitting an application.');
      }
      if (!applicantProfile) {
        errors.push('Applicant profile details could not be loaded.');
      }
    }

    if (targetStep === 1 || targetStep === 2) {
      if (!form.application_type) {
        errors.push('Application type is required.');
      }
      if (!form.priority) {
        errors.push('Priority is required.');
      }
      if (!form.parcel_number.trim()) {
        errors.push('Parcel number is required.');
      }
      if (form.parcel_number.trim().length < 2) {
        errors.push('Parcel number must be at least 2 characters.');
      }
      if (!form.parcel_zone_id.trim()) {
        errors.push('Zone ID is required.');
      }
      if (form.parcel_zone_id.trim().length < 2) {
        errors.push('Zone ID must be at least 2 characters.');
      }
      if (form.description.trim().length < 10) {
        errors.push('Description must be at least 10 characters.');
      }
      if (!form.parcel_coordinates.trim()) {
        errors.push('Parcel boundary coordinates are required.');
      }
      coordinateParse.errors.forEach((message) => errors.push(message));
      if (form.parcel_coordinates.trim() && coordinateParse.points.length < 3) {
        errors.push('Parcel boundary must include at least 3 coordinate points.');
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }

  function goNext() {
    if (validateStep(step)) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
      setError('');
    }
  }

  function goBack() {
    setValidationErrors([]);
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validateStep(2)) {
      showToast({ type: 'error', title: 'Review required fields', message: 'Fix the highlighted validation messages before submitting.' });
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(null);

    try {
      if (!applicantId) {
        throw new Error('Create your applicant profile before submitting an application.');
      }
      if (!parcelGeoJson) {
        throw new Error('Enter at least 3 valid parcel boundary coordinate points.');
      }

      const applicationPayload = {
        applicant_id: applicantId,
        application_type: form.application_type,
        parcel_geojson: parcelGeoJson,
        applicant_ref: {
          applicant_id: applicantId,
          full_name: applicantProfile?.full_name ?? null,
          applicant_type: applicantProfile?.applicant_type ?? null,
          email: applicantProfile?.email ?? null,
          phone: applicantProfile?.phone ?? null,
        },
        parcel_ref: {
          parcel_number: form.parcel_number.trim(),
          block_number: form.block_number.trim() || null,
          basin_number: form.basin_number.trim() || null,
          zone_id: form.parcel_zone_id.trim(),
        },
        required_documents: requiredDocuments,
        metadata: {
          priority: form.priority,
          description: form.description.trim(),
          submitted_from: 'applicant_frontend',
          geojson_source: 'applicant_coordinate_entry',
          coordinate_points: coordinateParse.points.length,
        },
      };

      const idempotencyKey = `lrmis-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
      const application = await createApplication(applicationPayload, idempotencyKey);
      const id = String(application.id);
      const status = String(application.status ?? 'submitted');
      localStorage.removeItem(draftKey);
      setSuccess({ id, status });
      showToast({ type: 'success', title: 'Application submitted', message: `Application ${id} is now ${status}.` });
      navigate(`/application-confirmation/${id}`, { state: { application } });
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setError(message);
      showToast({ type: 'error', title: 'Submission failed', message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearDraft() {
    setForm(initialForm);
    localStorage.removeItem(draftKey);
    setValidationErrors([]);
    setSuccess(null);
    setError('');
    setDraftSavedAt('');
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Applicant request</p>
            <h1 className="page-title">Submit new application</h1>
            <p className="muted">Complete each step, review the summary, then submit the application using your linked applicant profile.</p>
          </div>
          <div className="session-panel">
            <strong>Draft status</strong>
            <small>{draftSavedAt ? `Saved locally at ${draftSavedAt}` : 'No draft changes yet'}</small>
          </div>
        </div>
      </Card>

      <Card>
        {isLoadingProfile && <div className="muted">Checking applicant profile...</div>}

        {!isLoadingProfile && !applicantId && (
          <div className="profile-required">
            <h2>Applicant profile required</h2>
            <p>Create your applicant profile before submitting land applications. This prevents duplicate applicant records and keeps requests connected to your account.</p>
            <Button onClick={() => navigate('/applicant-profile')}>Create applicant profile</Button>
          </div>
        )}

        {applicantId && (
          <form onSubmit={handleSubmit} className="application-form">
            <StepIndicator currentStep={step} />

            {step === 0 && (
              <section className="profile-summary">
                <div>
                  <p className="eyebrow">Step 1</p>
                  <h2>{formatValue(applicantProfile?.full_name)}</h2>
                  <p>{formatValue(applicantProfile?.email)} | {formatValue(applicantProfile?.phone)}</p>
                  <p>Applicant ID: {applicantId}</p>
                </div>
                <Button variant="secondary" onClick={() => navigate('/applicant-profile')}>
                  Review profile
                </Button>
              </section>
            )}

          {step === 1 && (
            <>
              <FormSection title="Application Information">
                <Select label="Application type" name="application_type" value={form.application_type} options={applicationTypes} onChange={updateField} />
                <Select label="Priority" name="priority" value={form.priority} options={priorities} onChange={updateField} />
                <Input label="Parcel number" name="parcel_number" value={form.parcel_number} onChange={updateField} required />
                <Input label="Block number" name="block_number" value={form.block_number} onChange={updateField} />
                <Input label="Basin number" name="basin_number" value={form.basin_number} onChange={updateField} />
                <Input label="Zone ID" name="parcel_zone_id" value={form.parcel_zone_id} onChange={updateField} required />
                <label className="field full-span">
                  Description
                  <textarea name="description" value={form.description} onChange={updateField} rows={4} required />
                </label>
              </FormSection>

              <FormSection title="Parcel Location / GeoJSON">
                <label className="field full-span">
                  Parcel boundary coordinates
                  <textarea
                    name="parcel_coordinates"
                    value={form.parcel_coordinates}
                    onChange={updateField}
                    rows={7}
                    placeholder={'38.742, 9.024\n38.746, 9.024\n38.746, 9.028\n38.742, 9.028'}
                    required
                  />
                  <span className="muted">
                    Enter one longitude, latitude pair per line. The polygon closes automatically when submitted.
                  </span>
                </label>
                {coordinateParse.errors.length > 0 && (
                  <div className="validation-box full-span">
                    {coordinateParse.errors.map((message) => (
                      <div key={message}>{message}</div>
                    ))}
                  </div>
                )}
                <div className="geojson-preview full-span">
                  <pre>{parcelGeoJson ? JSON.stringify(parcelGeoJson, null, 2) : 'Enter at least 3 valid coordinate points to preview GeoJSON.'}</pre>
                </div>
              </FormSection>
            </>
          )}

          {step === 2 && (
            <section className="review-panel">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Review application summary</h2>
                <p className="muted">Confirm these details before submitting. After submission, upload the listed documents from the document page.</p>
              </div>
              <dl className="review-grid">
                {reviewRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || 'Not provided'}</dd>
                  </div>
                ))}
              </dl>
              <div className="geojson-preview">
                <pre>{parcelGeoJson ? JSON.stringify(parcelGeoJson, null, 2) : 'Parcel GeoJSON is not ready.'}</pre>
              </div>
            </section>
          )}

          {validationErrors.length > 0 && (
            <div className="validation-box">
              {validationErrors.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </div>
          )}
          <ErrorMessage message={error} />
          {success && <div style={{ color: theme.colors.success, fontWeight: 700 }}>Application {success.id} submitted with status {success.status}.</div>}

          <div className="form-actions">
            {step > 0 && <Button variant="secondary" onClick={goBack}>Back</Button>}
            <Button variant="secondary" onClick={clearDraft}>Clear draft</Button>
            {step < steps.length - 1 && <Button onClick={goNext}>Continue</Button>}
            {step === steps.length - 1 && (
              <Button type="submit" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? 'Submitting...' : 'Submit application'}
              </Button>
            )}
          </div>
          </form>
        )}
      </Card>
    </div>
  );
}

function loadDraft(): FormState {
  const raw = localStorage.getItem(draftKey);
  if (!raw) {
    return initialForm;
  }

  try {
    return { ...initialForm, ...JSON.parse(raw) };
  } catch {
    localStorage.removeItem(draftKey);
    return initialForm;
  }
}

type CoordinatePoint = [number, number];

function parseCoordinateText(value: string): { points: CoordinatePoint[]; errors: string[] } {
  const errors: string[] = [];
  const points: CoordinatePoint[] = [];
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const parts = line.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) {
      errors.push(`Line ${index + 1}: enter exactly two values: longitude, latitude.`);
      return;
    }

    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      errors.push(`Line ${index + 1}: coordinates must be numeric.`);
      return;
    }
    if (lng < -180 || lng > 180) {
      errors.push(`Line ${index + 1}: longitude must be between -180 and 180.`);
      return;
    }
    if (lat < -90 || lat > 90) {
      errors.push(`Line ${index + 1}: latitude must be between -90 and 90.`);
      return;
    }

    points.push([lng, lat]);
  });

  const uniquePoints = new Set(points.map(([lng, lat]) => `${lng},${lat}`));
  if (points.length >= 3 && uniquePoints.size < 3) {
    errors.push('Parcel boundary must include at least 3 unique coordinate points.');
  }

  return { points, errors };
}

function buildPolygonGeoJson(points: CoordinatePoint[]) {
  if (points.length < 3) {
    return null;
  }

  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="step-indicator">
      {steps.map((label, index) => (
        <div key={label} className={`step-pill ${index === currentStep ? 'step-pill-active' : ''} ${index < currentStep ? 'step-pill-done' : ''}`}>
          <span>{index + 1}</span>
          {label}
        </div>
      ))}
    </div>
  );
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

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
