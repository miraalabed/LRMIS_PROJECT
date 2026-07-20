from datetime import datetime, timezone
from app.database import db
from app.utils.geojson import is_valid_geojson
from app.services.audit_service import log_event
from .certificate_service import can_issue_certificate


VALID_WORKFLOW = [
	"submitted",
	"pre_checked",
	"survey_required",
	"surveyed",
	"legal_review",
	"approved",
	"certificate_issued",
	"closed",
]

ALTERNATIVE_STATUSES = [
	"rejected",
	"on_hold",
	"missing_documents",
	"under_objection",
]


def initial_status():
	return "submitted"


def _allowed_next(current: str):
	if current not in VALID_WORKFLOW:
		return []
	index = VALID_WORKFLOW.index(current)
	if index < len(VALID_WORKFLOW) - 1:
		return [VALID_WORKFLOW[index + 1]]
	return []


def can_transition(application: dict, target: str) -> (bool, str):
	current = application.get("status")
	if current == target:
		return False, "Application already in target status"
	if current is None:
		return False, "Invalid current status"
	if current == "rejected":
		return False, "Rejected applications cannot transition"
	if current == "on_hold":
		return False, "On-hold applications cannot transition until resumed"
	if target == "certificate_issued":
		return False, "Certificate issuance is not allowed through transition endpoint"
	if target == "closed" and current != "certificate_issued":
		return False, "Only certificate_issued applications can be closed"
	if target not in VALID_WORKFLOW + ALTERNATIVE_STATUSES:
		return False, "Invalid target status"
	if target in ALTERNATIVE_STATUSES:
		return True, "ok"
	allowed = _allowed_next(current)
	if target not in allowed:
		return False, f"Invalid workflow move from {current} to {target}"
	if target == "pre_checked":
		if not application.get("applicant_id") or not application.get("parcel_id"):
			return False, "Applicant or parcel information incomplete"
	if target == "survey_required":
		if not is_valid_geojson(application.get("parcel_geojson")):
			return False, "Parcel location not valid GeoJSON"
	if target == "surveyed":
		if not application.get("survey_report") and not db.survey_reports.find_one({"application_id": application.get("_id")}):
			return False, "Survey report missing"
	if target == "legal_review":
		uploaded_documents = application.get("uploaded_documents") or []
		required_documents = application.get("required_documents") or []
		verified_types = {
			document.get("document_type")
			for document in uploaded_documents
			if document.get("verified") or document.get("status") == "verified"
		}
		if required_documents:
			missing_documents = [document_type for document_type in required_documents if document_type not in verified_types]
			if missing_documents:
				return False, f"Required documents not verified: {', '.join(missing_documents)}"
		else:
			ownership_types = {"ownership_deed", "proof_of_ownership", "sale_contract", "title_deed"}
			if not verified_types.intersection(ownership_types):
				return False, "Verified ownership document missing"
	if target == "approved":
		if not application.get("legal_review_completed") and not application.get("registrar_review"):
			return False, "Legal review not completed"
	return True, "ok"


def transition(application_id: str, target: str, actor_type: str = None, actor_id: str = None, note: str = None):
	app = db.land_applications.find_one({"_id": application_id})
	if not app:
		return False, "application_not_found"
	ok, reason = can_transition(app, target)
	if not ok:
		return False, reason
	now = datetime.now(timezone.utc)
	update = {"status": target, "updated_at": now}
	if target == "pre_checked":
		update["pre_checked_at"] = now
	elif target == "survey_required":
		update["survey_required_at"] = now
	elif target == "surveyed":
		update["surveyed_at"] = now
	elif target == "legal_review":
		update["legal_review_at"] = now
	elif target == "approved":
		update["approved_at"] = now
	elif target == "closed":
		update["closed_at"] = now
	if note:
		update["note"] = note
	if actor_type:
		update["actor_type"] = actor_type
	if actor_id:
		update["actor_id"] = actor_id
	workflow_updates = {}
	if app.get("workflow"):
		workflow_updates["workflow.current_state"] = target
		workflow_updates["workflow.allowed_next"] = _allowed_next(target)
	if workflow_updates:
		update.update(workflow_updates)
	db.land_applications.update_one({"_id": application_id}, {"$set": update})
	log_event("transition_changed", application_id=application_id, user_id=actor_id, details={"from": app.get("status"), "to": target, "actor_type": actor_type, "actor_id": actor_id, "note": note})
	return True, "ok"


def resume(application_id: str, actor_type: str = None, actor_id: str = None, note: str = None):
    app = db.land_applications.find_one({"_id": application_id})
    if not app:
        return False, "application_not_found", None
    if app.get("status") != "on_hold":
        return False, "Only on_hold applications can be resumed", None
    previous_status = app.get("previous_status")
    if not previous_status:
        return False, "Cannot resume application without a prior status", None

    now = datetime.now(timezone.utc)
    update = {
        "status": previous_status,
        "updated_at": now,
        "workflow.current_state": previous_status,
        "workflow.allowed_next": _allowed_next(previous_status),
        "previous_status": None,
    }
    if note:
        update["note"] = note
    if actor_type:
        update["actor_type"] = actor_type
    if actor_id:
        update["actor_id"] = actor_id

    db.land_applications.update_one({"_id": application_id}, {"$set": update})
    log_event(
        "application_resumed",
        application_id=application_id,
        user_id=actor_id,
        details={"restored_to": previous_status, "actor_type": actor_type, "actor_id": actor_id, "note": note},
    )
    return True, "ok", previous_status
