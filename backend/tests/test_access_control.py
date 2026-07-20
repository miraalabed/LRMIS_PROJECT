from datetime import datetime, timedelta, timezone

import pytest
import pymongo
from fastapi.testclient import TestClient

from app.database import db
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_access_control():
    try:
        db.client.admin.command("ping")
    except pymongo.errors.PyMongoError:
        pytest.skip("MongoDB is not available")

    cleanup()
    yield
    cleanup()


def cleanup():
    db.users.delete_many({"_id": {"$regex": "^TEST-ACL-"}})
    db.api_tokens.delete_many({"user_id": {"$regex": "^TEST-ACL-"}})
    db.applicants.delete_many({"_id": {"$regex": "^TEST-ACL-"}})
    db.land_applications.delete_many({"_id": {"$regex": "^TEST-ACL-"}})
    db.performance_logs.delete_many({"application_id": {"$regex": "^TEST-ACL-"}})


def create_token(user_id: str, role: str, linked_applicant_id: str | None = None) -> str:
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


def create_application(application_id: str, applicant_id: str):
    now = datetime.now(timezone.utc)
    db.land_applications.insert_one(
        {
            "_id": application_id,
            "application_id": application_id,
            "applicant_id": applicant_id,
            "application_type": "first_registration",
            "status": "submitted",
            "parcel_id": None,
            "parcel_geojson": None,
            "required_documents": [],
            "uploaded_documents": [],
            "workflow": {"current_state": "submitted", "allowed_next": ["pre_checked"]},
            "created_at": now,
            "updated_at": now,
        }
    )


def test_public_registration_cannot_create_staff_roles():
    response = client.post(
        "/auth/register",
        json={"username": "TEST-ACL-admin", "password": "pass123", "role": "admin"},
    )

    assert response.status_code == 403


def test_application_details_require_token():
    create_application("TEST-ACL-APP", "TEST-ACL-APPLICANT")

    response = client.get("/applications/TEST-ACL-APP")

    assert response.status_code == 401


def test_applicant_cannot_read_another_applicants_application():
    token = create_token("TEST-ACL-USER-1", "applicant", linked_applicant_id="TEST-ACL-APPLICANT-1")
    create_application("TEST-ACL-APP-2", "TEST-ACL-APPLICANT-2")

    response = client.get(
        "/applications/TEST-ACL-APP-2",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_objection_submission_requires_application_access():
    create_application("TEST-ACL-OBJ", "TEST-ACL-APPLICANT")

    response = client.post(
        "/applications/TEST-ACL-OBJ/objections",
        json={
            "reason": "Boundary conflict",
            "submitted_by": "TEST-ACL-APPLICANT",
            "actor_type": "applicant",
            "supporting_document_ids": [],
        },
    )

    assert response.status_code == 401


def test_analytics_and_geofeeds_require_back_office_token():
    applicant_token = create_token("TEST-ACL-USER-2", "applicant", linked_applicant_id="TEST-ACL-APPLICANT")

    no_token_response = client.get("/analytics/kpis")
    applicant_response = client.get(
        "/analytics/geofeeds/parcels",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )

    assert no_token_response.status_code == 401
    assert applicant_response.status_code == 403
