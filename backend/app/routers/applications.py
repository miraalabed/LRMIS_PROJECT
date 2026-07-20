from fastapi import APIRouter, HTTPException, status, Header, UploadFile, File, Form, Depends
from typing import Optional, List
from app.schemas.application_schema import (
    ApplicationCreate,
    ApplicationOut,
    DocumentCreate,
    DocumentMeta,
    DocumentReviewRequest,
    CommentCreate,
    CommentOut,
    ObjectionCreate,
    ObjectionOut,
    CertificateIssueRequest,
    CertificateOut,
    TimelineResponse,
    TransitionRequest,
    HoldRequest,
    RejectRequest,
    ResumeRequest,
    StatusResponse,
    HoldResponse,
    RejectResponse,
    ResumeResponse,
)
from app.database import db
from app.services.audit_service import log_event
from app.services.workflow_service import initial_status, transition, resume
from app.services.certificate_service import issue_certificate
from app.utils.security import get_current_user, is_back_office, require_back_office, require_registrar
from bson import ObjectId
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/applications", tags=["applications"])


def resolve_staff_profile_id(current_user) -> Optional[str]:
    staff_profile = db.staff_members.find_one(
        {
            "$or": [
                {"_id": current_user.get("user_id")},
                {"name": current_user.get("username")},
                {"staff_code": current_user.get("username")},
            ]
        }
    )
    return staff_profile.get("_id") if staff_profile else current_user.get("user_id")


def get_application_for_user(application_id: str, current_user):
    app = db.land_applications.find_one({"_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if is_back_office(current_user):
        return app

    if current_user.get("role") == "applicant":
        if app.get("applicant_id") == current_user.get("linked_applicant_id"):
            return app
        raise HTTPException(status_code=403, detail="Applicants may only access their own applications")

    if current_user.get("role") == "surveyor":
        staff_id = resolve_staff_profile_id(current_user)
        assigned = db.survey_tasks.find_one({"application_id": application_id, "assigned_surveyor_id": staff_id})
        if assigned:
            return app
        raise HTTPException(status_code=403, detail="Surveyors may only access assigned applications")

    raise HTTPException(status_code=403, detail="Application access denied")


def ensure_application_document_access(application_id: str, current_user):
    app = get_application_for_user(application_id, current_user)
    return app


def ensure_applicant_actor_matches(current_user, actor_id: Optional[str], actor_type: Optional[str] = None):
    if current_user.get("role") != "applicant":
        return

    allowed_ids = {current_user.get("linked_applicant_id"), current_user.get("user_id")}
    if actor_type and actor_type != "applicant":
        raise HTTPException(status_code=403, detail="Applicants cannot act as another actor type")
    if actor_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Applicants cannot act on behalf of another applicant")


def save_upload_file(file: UploadFile):
    os.makedirs("uploads", exist_ok=True)
    stored_name = f"{str(ObjectId())}_{file.filename}"
    saved_path = os.path.join("uploads", stored_name)
    with open(saved_path, "wb") as buffer:
        buffer.write(file.file.read())
    return stored_name, saved_path


def remove_saved_file(path: Optional[str]):
    if path and os.path.exists(path):
        os.remove(path)


@router.post("/", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    idempotency_key: Optional[str] = Header(None),
    current_user=Depends(get_current_user),
):
    applicant_id = payload.applicant_id
    if current_user.get("role") == "applicant":
        linked_id = current_user.get("linked_applicant_id")
        if not linked_id:
            raise HTTPException(status_code=403, detail="Applicant account has no linked profile")
        if applicant_id and applicant_id != linked_id:
            raise HTTPException(status_code=403, detail="Applicants may only submit applications for their own profile")
        applicant_id = linked_id
    elif not is_back_office(current_user):
        raise HTTPException(status_code=403, detail="Only applicants and back-office users may create applications")

    applicant = db.applicants.find_one({"_id": applicant_id})
    if not applicant:
        raise HTTPException(status_code=400, detail="Applicant does not exist")

    if payload.parcel_id:
        parcel = db.parcels.find_one({"_id": payload.parcel_id})
        if not parcel:
            raise HTTPException(status_code=400, detail="Parcel does not exist")

    resolved_parcel_id = payload.parcel_id
    parcel_ref = dict(payload.parcel_ref) if payload.parcel_ref else {}

    if not resolved_parcel_id and (parcel_ref.get("parcel_number") or payload.parcel_geojson):
        # The applicant described a parcel (number/block/basin/zone and/or a drawn boundary)
        # but no existing parcel record was linked. Create one automatically so the
        # application has a real parcel_id, matching what the workflow rules expect
        # for the pre_checked transition.
        parcel_id = str(ObjectId())
        parcel_doc = {
            "_id": parcel_id,
            "parcel_number": parcel_ref.get("parcel_number") or "unspecified",
            "block_number": parcel_ref.get("block_number"),
            "basin_number": parcel_ref.get("basin_number"),
            "zone_id": parcel_ref.get("zone_id"),
            "parcel_code": parcel_ref.get("parcel_code") or f"AUTO-{parcel_id[:8]}",
            "current_owner_refs": [{"applicant_id": applicant_id, "share": "1/1"}],
            "geometry": payload.parcel_geojson,
            "registration_status": "pending_registration",
            "metadata": {"created_from": "application_intake"},
            "created_at": datetime.now(timezone.utc),
        }
        db.parcels.insert_one(parcel_doc)
        resolved_parcel_id = parcel_id
        parcel_ref.setdefault("parcel_id", parcel_id)

    if idempotency_key:
        existing = db.land_applications.find_one({"idempotency_key": idempotency_key})
        if existing:
            return {"id": existing.get("_id"), **existing}

    _id = str(ObjectId())
    doc = payload.model_dump()
    doc["applicant_id"] = applicant_id
    doc["parcel_id"] = resolved_parcel_id
    if parcel_ref:
        doc["parcel_ref"] = parcel_ref
    now = datetime.now(timezone.utc)
    doc.update(
        {
            "_id": _id,
            "application_id": _id,
            "status": initial_status(),
            "uploaded_documents": [],
            "created_at": now,
            "updated_at": now,
            "workflow": {
                "current_state": "submitted",
                "allowed_next": ["pre_checked"],
            },
        }
    )
    if idempotency_key:
        doc["idempotency_key"] = idempotency_key

    db.land_applications.insert_one(doc)
    log_event("application_submitted", application_id=_id, user_id=doc.get("applicant_id"))
    return {"id": _id, **doc}


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: str, current_user=Depends(get_current_user)):
    doc = get_application_for_user(application_id, current_user)
    return {"id": doc.get("_id"), **doc}


@router.get("/")
def list_applications(
    page: int = 1,
    limit: int = 10,
    status: Optional[str] = None,
    applicant_id: Optional[str] = None,
    application_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: Optional[str] = "asc",
    current_user=Depends(get_current_user),
):
    query = {}
    if current_user.get("role") == "applicant":
        linked_id = current_user.get("linked_applicant_id")
        if not linked_id:
            return {"data": [], "total": 0, "page": page, "limit": limit}
        if applicant_id and applicant_id != linked_id:
            raise HTTPException(status_code=403, detail="Applicants may only list their own applications")
        query["applicant_id"] = linked_id
    elif current_user.get("role") == "surveyor":
        staff_id = resolve_staff_profile_id(current_user)
        assigned_application_ids = [
            task.get("application_id")
            for task in db.survey_tasks.find({"assigned_surveyor_id": staff_id}, {"application_id": 1})
            if task.get("application_id")
        ]
        if not assigned_application_ids:
            return {"data": [], "total": 0, "page": page, "limit": limit}
        query["_id"] = {"$in": assigned_application_ids}
    elif applicant_id:
        query["applicant_id"] = applicant_id

    if status:
        query["status"] = status
    if application_type:
        query["application_type"] = application_type

    skip = (page - 1) * limit
    cursor = db.land_applications.find(query)
    if sort_by:
        direction = 1 if sort_dir == "asc" else -1
        cursor = cursor.sort([(sort_by, direction)])
    cursor = cursor.skip(skip).limit(limit)

    items = [{"id": d.get("_id"), **d} for d in cursor]
    total = db.land_applications.count_documents(query)
    return {"data": items, "total": total, "page": page, "limit": limit}


@router.patch("/{application_id}/transition", response_model=StatusResponse)
def application_transition(application_id: str, payload: TransitionRequest, current_user=Depends(require_back_office)):
    get_application_for_user(application_id, current_user)
    ok, reason = transition(
        application_id,
        payload.target_status,
        actor_type=payload.actor_type,
        actor_id=payload.actor_id,
        note=payload.note,
    )
    if not ok:
        if reason == "application_not_found":
            raise HTTPException(status_code=404, detail="Application not found")
        if reason in [
            "Application already in target status",
            "Rejected applications cannot transition",
            "On-hold applications cannot transition until resumed",
            "Certificate issuance is not allowed through transition endpoint",
            "Only certificate_issued applications can be closed",
            "Invalid workflow move from submitted to approved",
            "Invalid workflow move from submitted to survey_required",
            "Invalid workflow move from submitted to surveyed",
            "Invalid workflow move from submitted to legal_review",
            "Invalid workflow move from pre_checked to surveyed",
            "Invalid workflow move from pre_checked to legal_review",
            "Invalid workflow move from survey_required to legal_review",
            "Invalid workflow move from surveyed to approved",
            "Invalid workflow move from approved to closed",
        ]:
            raise HTTPException(status_code=409, detail=reason)
        raise HTTPException(status_code=400, detail=reason)

    return {"status": "ok", "to": payload.target_status}


@router.post("/{application_id}/hold", response_model=HoldResponse)
def hold_application(application_id: str, payload: HoldRequest, current_user=Depends(require_back_office)):
    app = get_application_for_user(application_id, current_user)

    now = datetime.now(timezone.utc)
    update = {
        "status": "on_hold",
        "previous_status": app.get("status"),
        "hold_reason": payload.reason,
        "actor_type": payload.actor_type,
        "actor_id": payload.actor_id,
        "updated_at": now,
        "workflow.current_state": "on_hold",
        "workflow.allowed_next": [],
    }
    db.land_applications.update_one({"_id": application_id}, {"$set": update})
    log_event(
        "application_on_hold",
        application_id=application_id,
        user_id=payload.actor_id,
        details={"reason": payload.reason, "actor_type": payload.actor_type},
    )
    return {"status": "ok", "hold_reason": payload.reason}


@router.post("/{application_id}/reject", response_model=RejectResponse)
def reject_application(application_id: str, payload: RejectRequest, current_user=Depends(require_back_office)):
    app = get_application_for_user(application_id, current_user)

    now = datetime.now(timezone.utc)
    update = {
        "status": "rejected",
        "rejection_reason": payload.reason,
        "actor_type": payload.actor_type,
        "actor_id": payload.actor_id,
        "updated_at": now,
        "workflow.current_state": "rejected",
        "workflow.allowed_next": [],
    }
    db.land_applications.update_one({"_id": application_id}, {"$set": update})
    log_event(
        "application_rejected",
        application_id=application_id,
        user_id=payload.actor_id,
        details={"reason": payload.reason, "actor_type": payload.actor_type},
    )
    return {"status": "ok", "rejection_reason": payload.reason}


@router.post("/{application_id}/resume", response_model=ResumeResponse)
def resume_application(application_id: str, payload: ResumeRequest, current_user=Depends(require_back_office)):
    get_application_for_user(application_id, current_user)
    ok, reason, restored_to = resume(
        application_id,
        actor_type=payload.actor_type,
        actor_id=payload.actor_id,
        note=payload.note,
    )
    if not ok:
        if reason == "application_not_found":
            raise HTTPException(status_code=404, detail="Application not found")
        raise HTTPException(status_code=400, detail=reason)
    return {"status": "ok", "restored_to": restored_to}


@router.post("/{application_id}/documents", response_model=DocumentMeta)
def add_application_document(
    application_id: str,
    payload: DocumentCreate = Depends(DocumentCreate.as_form),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    ensure_application_document_access(application_id, current_user)
    ensure_applicant_actor_matches(current_user, payload.uploaded_by, payload.actor_type)

    stored_name, saved_path = save_upload_file(file)

    now = datetime.now(timezone.utc)
    _id = str(ObjectId())
    doc = payload.model_dump()
    doc.update(
        {
            "_id": _id,
            "application_id": application_id,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "stored_name": stored_name,
            "saved_path": saved_path,
            "uploaded_at": now,
        }
    )
    db.application_documents.insert_one(doc)
    summary = {
        "id": _id,
        "document_type": payload.document_type,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "stored_name": stored_name,
        "uploaded_by": payload.uploaded_by,
        "actor_type": payload.actor_type,
        "notes": payload.notes,
        "status": "pending",
        "verified": False,
        "reviewer_id": None,
        "reviewed_at": None,
        "uploaded_at": now,
    }
    db.land_applications.update_one(
        {"_id": application_id},
        {"$push": {"uploaded_documents": summary}, "$set": {"updated_at": now}},
    )
    log_event(
        "document_uploaded",
        application_id=application_id,
        user_id=payload.uploaded_by,
        details={"document_id": _id, "document_type": payload.document_type},
    )
    return {"id": _id, **doc}


@router.patch("/{application_id}/documents/{document_id}/review", response_model=DocumentMeta)
def review_application_document(
    application_id: str,
    document_id: str,
    payload: DocumentReviewRequest,
    current_user=Depends(require_back_office),
):
    get_application_for_user(application_id, current_user)

    doc = db.application_documents.find_one({"_id": document_id, "application_id": application_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    now = datetime.now(timezone.utc)
    new_status = payload.status
    db.application_documents.update_one(
        {"_id": document_id},
        {
            "$set": {
                "status": new_status,
                "verified": new_status == "verified",
                "reviewer_id": payload.reviewer_id,
                "reviewed_at": now,
                "remarks": payload.remarks,
            }
        },
    )
    db.land_applications.update_one(
        {"_id": application_id, "uploaded_documents.id": document_id},
        {
            "$set": {
                "uploaded_documents.$.status": new_status,
                "uploaded_documents.$.verified": new_status == "verified",
                "uploaded_documents.$.reviewer_id": payload.reviewer_id,
                "uploaded_documents.$.reviewed_at": now,
            }
        },
    )
    log_event(
        "document_reviewed",
        application_id=application_id,
        user_id=payload.reviewer_id,
        details={"document_id": document_id, "status": new_status, "remarks": payload.remarks},
    )
    updated_doc = db.application_documents.find_one({"_id": document_id})
    return {
        "id": updated_doc.get("_id"),
        **updated_doc,
    }


@router.post("/{application_id}/comments", response_model=CommentOut)
def add_application_comment(application_id: str, payload: CommentCreate, current_user=Depends(get_current_user)):
    get_application_for_user(application_id, current_user)
    ensure_applicant_actor_matches(current_user, payload.actor_id, payload.actor_type)

    now = datetime.now(timezone.utc)
    comment_id = str(ObjectId())
    comment_doc = payload.model_dump()
    comment_doc.update({"id": comment_id, "created_at": now})
    db.land_applications.update_one(
        {"_id": application_id},
        {
            "$push": {"comments": comment_doc},
            "$set": {"updated_at": now},
        },
    )
    log_event(
        "comment_added",
        application_id=application_id,
        user_id=payload.actor_id,
        details={"comment_id": comment_id, "visibility": payload.visibility},
    )
    return comment_doc


@router.get("/{application_id}/documents", response_model=List[DocumentMeta])
def list_application_documents(application_id: str, current_user=Depends(get_current_user)):
    ensure_application_document_access(application_id, current_user)

    cursor = db.application_documents.find({"application_id": application_id})
    documents = [{"id": d.get("_id"), **d} for d in cursor]
    return documents


@router.put("/{application_id}/documents/{document_id}", response_model=DocumentMeta)
def replace_application_document(
    application_id: str,
    document_id: str,
    payload: DocumentCreate = Depends(DocumentCreate.as_form),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    ensure_application_document_access(application_id, current_user)
    ensure_applicant_actor_matches(current_user, payload.uploaded_by, payload.actor_type)

    existing = db.application_documents.find_one({"_id": document_id, "application_id": application_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    stored_name, saved_path = save_upload_file(file)
    remove_saved_file(existing.get("saved_path"))

    now = datetime.now(timezone.utc)
    update = payload.model_dump()
    update.update(
        {
            "original_filename": file.filename,
            "content_type": file.content_type,
            "stored_name": stored_name,
            "saved_path": saved_path,
            "uploaded_at": now,
            "status": "pending",
            "verified": False,
            "reviewer_id": None,
            "reviewed_at": None,
        }
    )

    db.application_documents.update_one({"_id": document_id}, {"$set": update})
    summary = {
        "id": document_id,
        "document_type": payload.document_type,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "stored_name": stored_name,
        "uploaded_by": payload.uploaded_by,
        "actor_type": payload.actor_type,
        "notes": payload.notes,
        "status": "pending",
        "verified": False,
        "reviewer_id": None,
        "reviewed_at": None,
        "uploaded_at": now,
    }
    db.land_applications.update_one(
        {"_id": application_id, "uploaded_documents.id": document_id},
        {"$set": {"uploaded_documents.$": summary, "updated_at": now}},
    )
    log_event(
        "document_replaced",
        application_id=application_id,
        user_id=payload.uploaded_by,
        details={"document_id": document_id, "document_type": payload.document_type},
    )
    updated = db.application_documents.find_one({"_id": document_id})
    return {"id": updated.get("_id"), **updated}


@router.delete("/{application_id}/documents/{document_id}")
def delete_application_document(
    application_id: str,
    document_id: str,
    current_user=Depends(get_current_user),
):
    ensure_application_document_access(application_id, current_user)

    existing = db.application_documents.find_one({"_id": document_id, "application_id": application_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    db.application_documents.delete_one({"_id": document_id})
    db.land_applications.update_one(
        {"_id": application_id},
        {
            "$pull": {"uploaded_documents": {"id": document_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    remove_saved_file(existing.get("saved_path"))
    log_event(
        "document_deleted",
        application_id=application_id,
        user_id=current_user.get("linked_applicant_id") or current_user.get("user_id"),
        details={"document_id": document_id},
    )
    return {"status": "deleted"}


@router.post("/{application_id}/objections", response_model=ObjectionOut)
def add_application_objection(application_id: str, payload: ObjectionCreate, current_user=Depends(get_current_user)):
    app = get_application_for_user(application_id, current_user)
    ensure_applicant_actor_matches(current_user, payload.submitted_by, payload.actor_type)

    now = datetime.now(timezone.utc)
    _id = str(ObjectId())
    doc = payload.model_dump()
    doc.update(
        {
            "_id": _id,
            "application_id": application_id,
            "created_at": now,
            "status": "pending",
        }
    )
    db.objections.insert_one(doc)

    objection_ids = app.get("objection_ids", [])
    objection_ids.append(_id)
    db.land_applications.update_one(
        {"_id": application_id},
        {
            "$set": {
                "status": "under_objection",
                "workflow.current_state": "under_objection",
                "workflow.allowed_next": [],
                "has_objection": True,
                "objection_ids": objection_ids,
                "updated_at": now,
            }
        },
    )
    log_event(
        "objection_submitted",
        application_id=application_id,
        user_id=payload.submitted_by,
        details={"objection_id": _id, "reason": payload.reason},
    )
    return {"id": _id, **doc}


@router.get("/{application_id}/objections", response_model=List[ObjectionOut])
def list_application_objections(application_id: str, current_user=Depends(get_current_user)):
    get_application_for_user(application_id, current_user)

    cursor = db.objections.find({"application_id": application_id})
    objections = [{"id": d.get("_id"), **d} for d in cursor]
    return objections


@router.get("/{application_id}/timeline", response_model=TimelineResponse)
def get_application_timeline(application_id: str, current_user=Depends(get_current_user)):
    get_application_for_user(application_id, current_user)

    events = list(db.performance_logs.find({"application_id": application_id}).sort("timestamp", 1))
    event_stream = [
        {
            "event_type": event.get("event_type"),
            "actor": event.get("user_id"),
            "timestamp": event.get("timestamp"),
            "metadata": event.get("details", {}),
        }
        for event in events
    ]
    return {"event_stream": event_stream}


@router.post("/{application_id}/certificate", response_model=CertificateOut)
def issue_application_certificate(application_id: str, payload: CertificateIssueRequest, current_user=Depends(require_registrar)):
    get_application_for_user(application_id, current_user)
    try:
        cert = issue_certificate(application_id, issued_by=payload.issued_by)
    except ValueError as exc:
        message = str(exc)
        if message == "application_not_found":
            raise HTTPException(status_code=404, detail="Application not found")
        if message == "application_not_approved":
            raise HTTPException(status_code=409, detail="Application must be approved before certificate issuance")
        if message == "certificate_already_issued":
            raise HTTPException(status_code=409, detail="Certificate already issued for this application")
        raise HTTPException(status_code=400, detail=message)
    return cert


@router.get("/{application_id}/certificates", response_model=List[CertificateOut])
def list_application_certificates(application_id: str, current_user=Depends(get_current_user)):
    get_application_for_user(application_id, current_user)

    cursor = db.certificates.find({"application_id": application_id})
    certificates = [{"certificate_id": d.get("certificate_id"), **d} for d in cursor]
    return certificates