import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import { getApplicationCertificates } from '../api/applicationsApi';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { formatValue, getErrorMessage } from '../utils/errors';

type Certificate = Record<string, unknown> & {
  certificate_id?: string;
  application_id?: string;
  certificate_type?: string;
  status?: string;
  issued_at?: string;
  issued_by?: string;
  year?: number;
  parcel_ref?: Record<string, unknown>;
  issued_to?: Record<string, unknown>;
  verification?: {
    qr_code_url?: string;
    verification_url?: string;
    digital_signature?: string;
    signature_algorithm?: string;
    signed_payload?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
};

export function CertificateViewPage() {
  const { applicationId = '' } = useParams();
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCertificates() {
      try {
        setCertificates((await getApplicationCertificates(applicationId)) as Certificate[]);
      } catch (loadError) {
        const message = getErrorMessage(loadError);
        setError(message);
        showToast({ type: 'error', title: 'Could not load certificates', message });
      } finally {
        setIsLoading(false);
      }
    }

    loadCertificates();
  }, [applicationId, showToast]);

  return (
    <div className="page-stack">
      <Card>
        <Link to={`/applications/${applicationId}`} className="text-link">Back to application details</Link>
        <p className="eyebrow">Official certificate</p>
        <h1 className="page-title">Certificate view</h1>
        <p className="muted">Review issued certificate metadata, verification URL, digital signature, and related application references.</p>
        {isLoading && <LoadingSpinner label="Loading certificates" />}
        <ErrorMessage message={error} />
      </Card>

      {!isLoading && certificates.length === 0 && (
        <Card>
          <div className="empty-state">
            <h3>No certificate issued yet</h3>
            <p>A registrar can issue a certificate after the application reaches approved status.</p>
            <Link to={`/applications/${applicationId}`} className="button-link">Back to application</Link>
          </div>
        </Card>
      )}

      {certificates.map((certificate) => (
        <Card key={certificate.certificate_id}>
          <section className="certificate-paper">
            <div className="certificate-paper-header">
              <div>
                <p className="eyebrow">Land Registration Certificate</p>
                <h2>{certificate.certificate_id}</h2>
                <p>{formatLabel(certificate.certificate_type ?? 'ownership_certificate')}</p>
              </div>
              <StatusBadge status={certificate.status ?? 'certificate_issued'} />
            </div>

            <div className="certificate-seal-row">
              <div className="certificate-seal">LR</div>
              <div>
                <strong>Official registry record</strong>
                <span>Issued {formatDate(certificate.issued_at)} for application {certificate.application_id ?? applicationId}</span>
              </div>
            </div>
          </section>

          <section className="details-two-column" style={{ marginTop: 24 }}>
            <Summary title="Issue details" items={{
              'Application ID': certificate.application_id,
              Year: certificate.year,
              'Issued at': formatDate(certificate.issued_at),
              'Issued by': certificate.issued_by,
              Status: certificate.status,
            }} />
            <VerificationCard certificate={certificate} />
          </section>

          <section className="details-two-column" style={{ marginTop: 24 }}>
            <Summary title="Issued to" items={certificate.issued_to ?? {}} />
            <Summary title="Parcel reference" items={certificate.parcel_ref ?? {}} />
          </section>

          <Summary title="Certificate metadata" items={certificate.metadata ?? {}} />

          <div className="scope-actions" style={{ marginTop: 24 }}>
            <Link to={`/applications/${applicationId}`} className="button-link">Back to application</Link>
            <button type="button" className="button-link secondary-link" onClick={() => window.print()}>Print / export</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function VerificationCard({ certificate }: { certificate: Certificate }) {
  const verifyUrl = certificate.verification?.verification_url ?? certificate.verification?.qr_code_url ?? `/certificates/${certificate.certificate_id}/verify`;
  const qrPayload = certificate.verification?.qr_code_url ?? verifyUrl;
  const signature = certificate.verification?.digital_signature ?? 'Not provided';
  const algorithm = certificate.verification?.signature_algorithm ?? 'Not provided';

  return (
    <div className="certificate-summary">
      <h3 className="compact-heading">Verification</h3>
      <div className="certificate-verification">
        <VerificationMatrix payload={qrPayload} />
        <dl className="detail-grid">
          <div>
            <dt>QR verify URL</dt>
            <dd>{verifyUrl}</dd>
          </div>
          <div>
            <dt>Signature algorithm</dt>
            <dd>{algorithm}</dd>
          </div>
          <div>
            <dt>Digital signature</dt>
            <dd>{shortenSignature(signature)}</dd>
          </div>
        </dl>
      </div>
      <div className="scope-actions" style={{ marginTop: 16 }}>
        <a className="button-link secondary-link" href={verifyUrl} target="_blank" rel="noreferrer">Open verification</a>
      </div>
    </div>
  );
}

function VerificationMatrix({ payload }: { payload: string }) {
  return (
    <div className="qr-stub" aria-label="Certificate verification QR code">
      <QRCodeSVG value={payload} size={96} level="M" includeMargin />
    </div>
  );
}

function Summary({ title, items }: { title: string; items: Record<string, unknown> }) {
  const entries = Object.entries(items);

  return (
    <div className="certificate-summary">
      <h3 className="compact-heading">{title}</h3>
      {entries.length === 0 ? (
        <p className="muted">Not available.</p>
      ) : (
        <dl className="detail-grid">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{renderValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function renderValue(value: unknown) {
  if (!value) {
    return 'Not provided';
  }

  if (typeof value === 'object') {
    return <pre>{formatValue(value)}</pre>;
  }

  return String(value);
}

function formatLabel(value: unknown) {
  if (!value) {
    return 'Not provided';
  }
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) {
    return 'Not provided';
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString();
}

function shortenSignature(value: string) {
  if (!value || value === 'Not provided') {
    return 'Not provided';
  }
  return value.length > 28 ? `${value.slice(0, 18)}...${value.slice(-10)}` : value;
}
