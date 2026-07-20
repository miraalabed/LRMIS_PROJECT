from app.database import db
from app.services.audit_service import log_event
from datetime import datetime, timezone


def find_best_surveyor(application: dict) -> dict | None:
    
    zone_id = None
    parcel_ref = application.get("parcel_ref", {})
    if parcel_ref:
        zone_id = parcel_ref.get("zone_id")

    app_type = application.get("application_type", "")

    query = {
        "role": "surveyor",
        "active": True,
        "workload.active_tasks": {"$lt": db.staff_members.find_one(
            {"role": "surveyor", "active": True},
            {"workload.max_tasks": 1}
        ).get("workload", {}).get("max_tasks", 10) if db.staff_members.find_one({"role": "surveyor", "active": True}) else 10}
    }

    if zone_id:
        query["coverage.zone_ids"] = zone_id

    candidates = list(
        db.staff_members.find(query).sort("workload.active_tasks", 1)
    )

    if not candidates and zone_id:
        query.pop("coverage.zone_ids", None)
        candidates = list(
            db.staff_members.find(query).sort("workload.active_tasks", 1)
        )

    if not candidates:
        return None

    skill_map = {
        "parcel_subdivision": "parcel_subdivision",
        "boundary_correction": "boundary_survey",
        "first_registration":  "boundary_survey",
        "ownership_transfer":  "boundary_survey",
    }
    preferred_skill = skill_map.get(app_type)

    if preferred_skill:
        skilled = [c for c in candidates if preferred_skill in c.get("skills", [])]
        if skilled:
            return skilled[0]

    return candidates[0]


def auto_assign(application_id: str) -> dict:
    app = db.land_applications.find_one({"_id": application_id})
    if not app:
        raise ValueError("application_not_found")

    if app.get("status") not in ("survey_required", "pre_checked"):
        raise ValueError(f"Cannot assign surveyor at status: {app.get('status')}")

    surveyor = find_best_surveyor(app)
    if not surveyor:
        raise ValueError("no_available_surveyor")

    surveyor_id = surveyor["_id"]
    now = datetime.now(timezone.utc)

    from bson import ObjectId
    task_id = str(ObjectId())
    count = db.survey_tasks.count_documents({}) + 1
    task_code = f"SURV-{now.year}-{count:04d}"

    task_doc = {
        "_id": task_id,
        "task_id": task_code,
        "application_id": application_id,
        "parcel_id": app.get("parcel_ref", {}).get("parcel_id"),
        "assigned_surveyor_id": surveyor_id,
        "status": "assigned",
        "milestones": [
            {
                "type": "assigned",
                "at": now,
                "by": "system",
                "meta": {"reason": "auto assignment — zone + workload match"}
            }
        ],
        "field_notes": [],
        "report_uploaded": False,
        "created_at": now,
    }
    db.survey_tasks.insert_one(task_doc)

    db.land_applications.update_one(
        {"_id": application_id},
        {"$set": {
            "status": "survey_required",
            "assignment.assigned_surveyor_id": surveyor_id,
            "assignment.task_id": task_id,
            "assignment.assigned_at": now,
        }}
    )

    db.staff_members.update_one(
        {"_id": surveyor_id},
        {"$inc": {"workload.active_tasks": 1}}
    )

    log_event(
        "survey_assigned",
        application_id=application_id,
        user_id=surveyor_id,
        details={"task_id": task_id, "surveyor_name": surveyor.get("name")}
    )

    return {
        "task_id": task_id,
        "task_code": task_code,
        "surveyor_id": surveyor_id,
        "surveyor_name": surveyor.get("name"),
    }