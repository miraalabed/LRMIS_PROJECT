from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from app.schemas.survey_schema import (
    SurveyMilestoneUpdate, SurveyReportCreate,
    RegistrarReviewUpdate, MILESTONE_ORDER
)
from app.database import db
from app.services.audit_service import log_event
from app.services.assignment_service import auto_assign
from app.utils.security import require_back_office, require_registrar, require_staff, require_surveyor
from datetime import datetime, timezone

router = APIRouter(prefix="/applications", tags=["survey"])
tasks_router = APIRouter(prefix="/survey-tasks", tags=["survey"])


def resolve_staff_profile_id(current_user):
    staff_profile = db.staff_members.find_one(
        {
            "$or": [
                {"_id": current_user.get("user_id")},
                {"name": current_user.get("username")},
                {"staff_code": current_user.get("username")},
            ],
            "role": "surveyor",
        }
    )
    return staff_profile.get("_id") if staff_profile else current_user.get("user_id")


def ensure_survey_task_access(application_id: str, current_user):
    if current_user.get("role") in ("manager", "admin"):
        return
    if current_user.get("role") == "surveyor":
        staff_id = resolve_staff_profile_id(current_user)
        if db.survey_tasks.find_one({"application_id": application_id, "assigned_surveyor_id": staff_id}):
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Survey task access denied")


@tasks_router.get("/")
def list_survey_tasks(
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user=Depends(require_staff),
):
    query = {}
    effective_staff_id = staff_id

    if current_user.get("role") == "surveyor":
        effective_staff_id = resolve_staff_profile_id(current_user)

    if effective_staff_id:
        query["assigned_surveyor_id"] = effective_staff_id
    elif current_user.get("role") == "surveyor":
        return {"data": [], "total": 0, "page": page, "limit": limit}

    if status:
        query["status"] = status

    skip = (page - 1) * limit
    cursor = db.survey_tasks.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = []
    for task in cursor:
        application = db.land_applications.find_one({"_id": task.get("application_id")}) or {}
        surveyor = db.staff_members.find_one({"_id": task.get("assigned_surveyor_id")}) or {}
        items.append(
            {
                "id": task.get("_id"),
                **task,
                "application": {
                    "id": application.get("_id"),
                    "application_type": application.get("application_type"),
                    "status": application.get("status"),
                    "priority": application.get("metadata", {}).get("priority"),
                    "parcel_ref": application.get("parcel_ref", {}),
                },
                "surveyor": {
                    "id": surveyor.get("_id"),
                    "name": surveyor.get("name"),
                    "staff_code": surveyor.get("staff_code"),
                },
            }
        )

    total = db.survey_tasks.count_documents(query)
    return {"data": items, "total": total, "page": page, "limit": limit}


@router.post("/{application_id}/auto-assign-surveyor")
def assign_surveyor(application_id: str, current_user=Depends(require_back_office)):
    try:
        result = auto_assign(application_id)
        return {"message": "Surveyor assigned successfully", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.patch("/{application_id}/survey-milestone")
def add_survey_milestone(application_id: str, payload: SurveyMilestoneUpdate, current_user=Depends(require_surveyor)):
    ensure_survey_task_access(application_id, current_user)
    task = db.survey_tasks.find_one({"application_id": application_id})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")

    current_milestone = task.get("status", "assigned")
    new_milestone     = payload.milestone.value

    current_idx = MILESTONE_ORDER.index(current_milestone) if current_milestone in MILESTONE_ORDER else 0
    new_idx     = MILESTONE_ORDER.index(new_milestone)     if new_milestone     in MILESTONE_ORDER else -1

    if new_idx <= current_idx:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot go from '{current_milestone}' to '{new_milestone}'. Must follow order: {' -> '.join(MILESTONE_ORDER)}"
        )

    if new_idx > current_idx + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot skip milestones. Next allowed: '{MILESTONE_ORDER[current_idx + 1]}'"
        )

    now = datetime.now(timezone.utc)
    milestone_entry = {
        "type": new_milestone,
        "at":   now,
        "by":   payload.actor_id or "system",
        "meta": {"notes": payload.notes} if payload.notes else {}
    }

    db.survey_tasks.update_one(
        {"application_id": application_id},
        {
            "$set":  {"status": new_milestone, "updated_at": now},
            "$push": {"milestones": milestone_entry}
        }
    )

    if new_milestone == "report_uploaded":
        db.land_applications.update_one(
            {"_id": application_id},
            {"$set": {
                "status": "surveyed",
                "survey_report": True,
                "surveyed_at": now,
                "updated_at": now,
                "workflow.current_state": "surveyed",
                "workflow.allowed_next": ["legal_review"],
            }}
        )
        log_event("surveyed", application_id=application_id, details={"milestone": new_milestone})

    log_event("survey_milestone", application_id=application_id,
              user_id=payload.actor_id, details={"milestone": new_milestone})

    return {"message": f"Milestone updated to '{new_milestone}'", "task_status": new_milestone}



@router.post("/{application_id}/survey-report")
def upload_survey_report(application_id: str, payload: SurveyReportCreate, current_user=Depends(require_surveyor)):
    ensure_survey_task_access(application_id, current_user)
    app = db.land_applications.find_one({"_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = datetime.now(timezone.utc)
    report = {
        **payload.model_dump(),
        "application_id": application_id,
        "created_at": now,
    }
    db.survey_reports.insert_one(report)

    db.land_applications.update_one(
        {"_id": application_id},
        {"$set": {
            "survey_report": True,
            "status": "surveyed",
            "surveyed_at": now,
            "updated_at": now,
            "workflow.current_state": "surveyed",
            "workflow.allowed_next": ["legal_review"],
        }}
    )

    log_event("survey_report_uploaded", application_id=application_id,
              user_id=payload.surveyor_id, details={"ref": payload.report_ref})

    return {"message": "Survey report uploaded successfully"}


@router.get("/{application_id}/survey-report")
def get_survey_report(application_id: str, current_user=Depends(require_staff)):
    ensure_survey_task_access(application_id, current_user)
    report = db.survey_reports.find_one({"application_id": application_id}, sort=[("created_at", -1)])
    if not report:
        raise HTTPException(status_code=404, detail="Survey report not found")
    report_id = report.pop("_id", None)
    return {"id": str(report_id), **report}


@router.patch("/{application_id}/registrar-review")
def registrar_review(application_id: str, payload: RegistrarReviewUpdate, current_user=Depends(require_registrar)):
    app = db.land_applications.find_one({"_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in ("legal_review", "surveyed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot review at status '{app.get('status')}'. Must be in legal_review or surveyed."
        )

    now = datetime.now(timezone.utc)

    if payload.decision == "accepted":
        db.land_applications.update_one(
            {"_id": application_id},
            {"$set": {
                "status": "legal_review",
                "legal_review_completed": True,
                "legal_review_at": now,
                "updated_at": now,
                "workflow.current_state": "legal_review",
                "workflow.allowed_next": ["approved"],
                "registrar_review": {
                    "decision": "accepted",
                    "registrar_id": payload.registrar_id,
                    "notes": payload.notes,
                    "reviewed_at": now,
                }
            }}
        )
        message = "Legal review accepted. Application ready for approval."
    else:
        db.land_applications.update_one(
            {"_id": application_id},
            {"$set": {
                "status": "rejected",
                "legal_review_completed": False,
                "updated_at": now,
                "workflow.current_state": "rejected",
                "workflow.allowed_next": [],
                "registrar_review": {
                    "decision": "rejected",
                    "registrar_id": payload.registrar_id,
                    "notes": payload.notes,
                    "reviewed_at": now,
                }
            }}
        )
        message = "Application rejected by registrar."

    log_event("registrar_reviewed", application_id=application_id,
              user_id=payload.registrar_id,
              details={"decision": payload.decision, "notes": payload.notes})

    return {"message": message, "decision": payload.decision}
