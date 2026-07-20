from fastapi import APIRouter, HTTPException

from app.database import db
from app.services.certificate_service import verify_certificate_signature

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.get("/{certificate_id}/verify")
def verify_certificate(certificate_id: str):
    certificate = db.certificates.find_one({"certificate_id": certificate_id})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    is_valid = verify_certificate_signature(certificate)
    return {
        "certificate_id": certificate.get("certificate_id"),
        "application_id": certificate.get("application_id"),
        "status": certificate.get("status"),
        "issued_at": certificate.get("issued_at"),
        "issued_by": certificate.get("issued_by"),
        "signature_valid": is_valid,
        "signature_algorithm": (certificate.get("verification") or {}).get("signature_algorithm"),
        "verification_url": (certificate.get("verification") or {}).get("verification_url"),
    }
