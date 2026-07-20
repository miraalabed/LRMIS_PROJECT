from datetime import datetime, timedelta, timezone

import pytest
import pymongo
from fastapi.testclient import TestClient

from app.database import db
from app.main import app
from app.services.certificate_service import issue_certificate
from app.services.workflow_service import transition

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_workflow_rules():
    try:
        db.client.admin.command("ping")
    except pymongo.errors.PyMongoError:
        pytest.skip("MongoDB is not available")

    db.land_applications.delete_many({"_id": {"$regex": "^TEST-WF-"}})
    db.survey_reports.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.objections.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.certificates.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.performance_logs.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.users.delete_many({"_id": {"$regex": "^TEST-WF-"}})
    db.api_tokens.delete_many({"user_id": {"$regex": "^TEST-WF-"}})
    yield
    db.land_applications.delete_many({"_id": {"$regex": "^TEST-WF-"}})
    db.survey_reports.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.objections.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.certificates.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.performance_logs.delete_many({"application_id": {"$regex": "^TEST-WF-"}})
    db.users.delete_many({"_id": {"$regex": "^TEST-WF-"}})
    db.api_tokens.delete_many({"user_id": {"$regex": "^TEST-WF-"}})


def make_application(application_id: str, status: str = "submitted", **extra):
    doc = {
        "_id": application_id,
        "application_id": application_id,
        "applicant_id": "TEST-APPLICANT",
        "application_type": "first_registration",
        "status": status,
        "parcel_id": "TEST-PARCEL",
        "parcel_geojson": {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        "required_documents": ["proof_of_ownership"],
        "uploaded_documents": [],
        "workflow": {"current_state": status, "allowed_next": []},
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    doc.update(extra)
    db.land_applications.insert_one(doc)
    return doc


def create_token(user_id: str, role: str = "registrar", linked_applicant_id: str | None = None) -> str:
    token = f"token-{user_id}"
    now = datetime.now(timezone.utc)
    db.users.insert_one(
        {
            "_id": user_id,
            "username": user_id,
            "password": "not-used",
            "role": role,
            "linked_applicant_id": linked_applicant_id,
            "created_at": now,
        }
    )
    db.api_tokens.insert_one(
        {
            "_id": f"{user_id}-token",
            "token": token,
            "user_id": user_id,
            "role": role,
            "linked_applicant_id": linked_applicant_id,
            "expires_at": now + timedelta(hours=1),
            "created_at": now,
        }
    )
    return token


def test_cannot_approve_before_legal_review():
    make_application("TEST-WF-APPROVE", status="submitted")

    ok, reason = transition("TEST-WF-APPROVE", "approved", actor_type="staff", actor_id="staff-test")

    assert ok is False
    assert "Invalid workflow move" in reason


def test_cannot_issue_certificate_before_approved():
    make_application("TEST-WF-CERT", status="legal_review")

    with pytest.raises(ValueError, match="application_not_approved"):
        issue_certificate("TEST-WF-CERT", issued_by="registrar-test")


def test_cannot_move_to_surveyed_without_survey_report():
    make_application("TEST-WF-SURVEYED", status="survey_required")

    ok, reason = transition("TEST-WF-SURVEYED", "surveyed", actor_type="surveyor", actor_id="survey-test")

    assert ok is False
    assert reason == "Survey report missing"


def test_objection_pushes_application_under_objection():
    make_application("TEST-WF-OBJECTION", status="legal_review")
    token = create_token("TEST-WF-APPLICANT-USER", role="applicant", linked_applicant_id="TEST-APPLICANT")

    response = client.post(
        "/applications/TEST-WF-OBJECTION/objections",
        json={
            "reason": "Boundary evidence conflicts with the submitted parcel record.",
            "submitted_by": "TEST-APPLICANT",
            "actor_type": "applicant",
            "supporting_document_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    updated = db.land_applications.find_one({"_id": "TEST-WF-OBJECTION"})
    assert updated["status"] == "under_objection"
    assert updated["workflow"]["current_state"] == "under_objection"
    assert updated["has_objection"] is True


def test_rejection_reason_is_required():
    make_application("TEST-WF-REJECT", status="legal_review")
    token = create_token("TEST-WF-REGISTRAR")

    response = client.post(
        "/applications/TEST-WF-REJECT/reject",
        json={"reason": "", "actor_type": "registrar", "actor_id": "registrar-test"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
