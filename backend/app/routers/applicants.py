from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.applicant_profile_schema import ApplicantCreate, ApplicantOut, ApplicantUpdate
from app.database import db
from app.services.audit_service import log_event
from app.utils.security import get_current_user, is_back_office, require_applicant
from bson import ObjectId

router = APIRouter(prefix="/applicants", tags=["applicants"])


@router.post("/", response_model=ApplicantOut, status_code=status.HTTP_201_CREATED)
def create_applicant(payload: ApplicantCreate, current_user=Depends(require_applicant)):
    if current_user.get("role") == "applicant" and current_user.get("linked_applicant_id"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Applicant profile already exists for this account")

    _id = str(ObjectId())
    doc = payload.model_dump()
    doc.update({"_id": _id})
    db.applicants.insert_one(doc)

    if current_user.get("role") == "applicant":
        db.users.update_one(
            {"_id": current_user.get("user_id")},
            {"$set": {"linked_applicant_id": _id}},
        )
        db.api_tokens.update_many(
            {"user_id": current_user.get("user_id")},
            {"$set": {"linked_applicant_id": _id}},
        )

    log_event("applicant_created", user_id=_id, details={"full_name": doc.get("full_name"), "national_id": doc.get("national_id")})
    return {"id": _id, **doc}


@router.get("/{applicant_id}", response_model=ApplicantOut)
def get_applicant(applicant_id: str, current_user=Depends(get_current_user)):
    if not is_back_office(current_user) and current_user.get("linked_applicant_id") != applicant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Applicants may only view their own profile")

    doc = db.applicants.find_one({"_id": applicant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return {"id": doc.get("_id"), **doc}


@router.patch("/{applicant_id}", response_model=ApplicantOut)
def update_applicant(applicant_id: str, payload: ApplicantUpdate, current_user=Depends(get_current_user)):
    if not is_back_office(current_user) and current_user.get("linked_applicant_id") != applicant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Applicants may only update their own profile")

    existing = db.applicants.find_one({"_id": applicant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Applicant not found")

    update_doc = payload.model_dump(exclude_unset=True)
    if not update_doc:
        return {"id": existing.get("_id"), **existing}

    db.applicants.update_one({"_id": applicant_id}, {"$set": update_doc})
    updated = db.applicants.find_one({"_id": applicant_id})
    log_event("applicant_updated", user_id=applicant_id, details={"full_name": updated.get("full_name"), "national_id": updated.get("national_id")})
    return {"id": updated.get("_id"), **updated}


@router.get("/{applicant_id}/applications")
def get_applicant_applications(applicant_id: str, page: int = 1, limit: int = 10, current_user=Depends(get_current_user)):
    if not is_back_office(current_user) and current_user.get("linked_applicant_id") != applicant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Applicants may only view their own applications")

    skip = (page - 1) * limit
    cursor = db.land_applications.find({"applicant_id": applicant_id}).skip(skip).limit(limit)
    items = []
    for d in cursor:
        d_id = d.get("_id")
        items.append({"id": d_id, **d})
    total = db.land_applications.count_documents({"applicant_id": applicant_id})
    return {"data": items, "total": total, "page": page, "limit": limit}

