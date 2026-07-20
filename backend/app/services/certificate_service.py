from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
from app.database import db
from app.services.audit_service import log_event


SIGNATURE_ALGORITHM = "HMAC-SHA256"


def next_certificate_id():
	year = datetime.now(timezone.utc).year
	count = db.certificates.count_documents({"year": year}) + 1
	return f"CERT-{year}-{count:04d}", year


def can_issue_certificate(application: dict) -> bool:
	return application.get("status") == "approved"


def certificate_base_url() -> str:
	return os.getenv("CERTIFICATE_VERIFY_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def signing_secret() -> bytes:
	return os.getenv("CERTIFICATE_SIGNING_SECRET", "lrmis-local-certificate-secret").encode("utf-8")


def certificate_payload(cert_id: str, application_id: str, parcel_ref: dict = None, issued_at=None) -> dict:
	issued_value = issued_at.isoformat() if hasattr(issued_at, "isoformat") else str(issued_at or "")
	return {
		"certificate_id": cert_id,
		"application_id": application_id,
		"parcel_ref": parcel_ref or {},
		"issued_at": issued_value,
	}


def sign_payload(payload: dict) -> str:
	message = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
	return hmac.new(signing_secret(), message, hashlib.sha256).hexdigest()


def build_verification(cert_id: str, application_id: str, parcel_ref: dict = None, issued_at=None) -> dict:
	payload = certificate_payload(cert_id, application_id, parcel_ref, issued_at)
	signature = sign_payload(payload)
	verify_path = f"/certificates/{cert_id}/verify"
	verify_url = f"{certificate_base_url()}{verify_path}"
	qr_payload = f"{verify_url}?signature={signature}"
	return {
		"verification_url": verify_url,
		"qr_code_url": qr_payload,
		"signed_payload": payload,
		"digital_signature": signature,
		"signature_algorithm": SIGNATURE_ALGORITHM,
		"signed_at": datetime.now(timezone.utc),
	}


def verify_certificate_signature(certificate: dict) -> bool:
	verification = certificate.get("verification") or {}
	payload = verification.get("signed_payload") or certificate_payload(
		certificate.get("certificate_id"),
		certificate.get("application_id"),
		certificate.get("parcel_ref"),
		certificate.get("issued_at"),
	)
	expected = sign_payload(payload)
	return hmac.compare_digest(expected, verification.get("digital_signature") or "")


def issue_certificate(application_id: str, issued_by: str = None):
	app = db.land_applications.find_one({"_id": application_id})
	if not app:
		raise ValueError("application_not_found")
	if not can_issue_certificate(app):
		raise ValueError("application_not_approved")
	if app.get("certificate_id"):
		raise ValueError("certificate_already_issued")
	cert_id, year = next_certificate_id()
	cert = {
		"certificate_id": cert_id,
		"application_id": application_id,
		"parcel_id": app.get("parcel_id"),
		"parcel_ref": app.get("parcel_ref"),
		"certificate_type": "ownership_certificate",
		"issued_by": issued_by,
		"issued_at": datetime.now(timezone.utc),
		"year": year,
		"status": "certificate_issued",
		"issued_to": app.get("applicant_ref"),
		"metadata": app.get("metadata", {}),
	}
	cert["verification"] = build_verification(
		cert_id,
		application_id,
		cert.get("parcel_ref"),
		cert.get("issued_at"),
	)
	db.certificates.insert_one(cert)
	db.land_applications.update_one(
		{"_id": application_id},
		{
			"$set": {
				"status": "certificate_issued",
				"certificate_id": cert_id,
				"certificate_issued_at": cert["issued_at"],
				"updated_at": datetime.now(timezone.utc),
				"workflow.current_state": "certificate_issued",
				"workflow.allowed_next": ["closed"],
			},
		},
	)
	log_event("certificate_issued", application_id=application_id, user_id=issued_by, details={"certificate_id": cert_id})
	return cert

