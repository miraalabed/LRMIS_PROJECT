from datetime import datetime, timedelta, timezone

import pytest
import pymongo
from fastapi.testclient import TestClient

from app.database import db
from app.main import app
from app.routers.auth import pwd_context

client = TestClient(app)

PREFIX = "TEST-E2E-"


@pytest.fixture(autouse=True)
def cleanup_full_flow():
    try:
        db.client.admin.command("ping")
    except pymongo.errors.PyMongoError:
        pytest.skip("MongoDB is not available")

    cleanup()
    yield
    cleanup()


def cleanup():
    application_ids = [
        doc.get("_id")
        for doc in db.land_applications.find({"metadata.test_run": PREFIX}, {"_id": 1})
        if doc.get("_id")
    ]
    db.users.delete_many({"username": {"$regex": f"^{PREFIX}"}})
    db.api_tokens.delete_many({"user_id": {"$regex": f"^{PREFIX}"}})
    db.applicants.delete_many({"national_id": {"$regex": f"^{PREFIX}"}})
    db.parcels.delete_many({"_id": {"$regex": f"^{PREFIX}"}})
    if application_ids:
        db.application_documents.delete_many({"application_id": {"$in": application_ids}})
        db.survey_tasks.delete_many({"application_id": {"$in": application_ids}})
        db.survey_reports.delete_many({"application_id": {"$in": application_ids}})
        db.objections.delete_many({"application_id": {"$in": application_ids}})
        db.certificates.delete_many({"application_id": {"$in": application_ids}})
        db.performance_logs.delete_many({"application_id": {"$in": application_ids}})
    db.survey_tasks.delete_many({"assigned_surveyor_id": {"$regex": f"^{PREFIX}"}})
    db.survey_reports.delete_many({"report_ref": {"$regex": f"^{PREFIX}"}})
    db.land_applications.delete_many({"metadata.test_run": PREFIX})
    db.staff_members.delete_many({"_id": {"$regex": f"^{PREFIX}"}})


def seed_user(user_id: str, username: str, role: str, password: str = "pass123"):
    now = datetime.now(timezone.utc)
    db.users.insert_one(
        {
            "_id": user_id,
            "username": username,
            "password": pwd_context.hash(password),
            "role": role,
            "linked_applicant_id": None,
            "created_at": now,
        }
    )


def login(username: str, password: str = "pass123") -> str:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def transition(token: str, application_id: str, target: str):
    response = client.patch(
        f"/applications/{application_id}/transition",
        json={"target_status": target, "actor_type": "staff", "actor_id": f"{PREFIX}staff-user", "note": f"Move to {target}"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text


def seed_back_office_accounts():
    seed_user(f"{PREFIX}staff-user", f"{PREFIX}staff", "staff")
    seed_user(f"{PREFIX}surveyor-user", f"{PREFIX}SURV-01", "surveyor")
    seed_user(f"{PREFIX}registrar-user", f"{PREFIX}registrar", "registrar")

    db.staff_members.insert_one(
        {
            "_id": f"{PREFIX}surveyor-profile",
            "staff_code": f"{PREFIX}SURV-01",
            "name": "E2E Surveyor",
            "role": "surveyor",
            "department": "Survey",
            "skills": ["boundary_survey"],
            "coverage": {"zone_ids": [f"{PREFIX}ZONE"], "geo_fence": None},
            "schedule": {"timezone": "Asia/Jerusalem", "shifts": [], "on_call": False},
            "workload": {"active_tasks": 0, "max_tasks": 10},
            "contacts": {"phone": None, "email": "surveyor@example.com"},
            "active": True,
        }
    )


def seed_parcel():
    db.parcels.insert_one(
        {
            "_id": f"{PREFIX}parcel",
            "parcel_code": f"{PREFIX}PARCEL",
            "parcel_number": f"{PREFIX}PARCEL",
            "zone_id": f"{PREFIX}ZONE",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [38.742, 9.024],
                        [38.746, 9.024],
                        [38.746, 9.028],
                        [38.742, 9.028],
                        [38.742, 9.024],
                    ]
                ],
            },
            "created_at": datetime.now(timezone.utc),
        }
    )


def submit_application(applicant_token: str, applicant_id: str) -> str:
    response = client.post(
        "/applications/",
        json={
            "applicant_id": applicant_id,
            "application_type": "first_registration",
            "parcel_id": f"{PREFIX}parcel",
            "parcel_geojson": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [38.742, 9.024],
                        [38.746, 9.024],
                        [38.746, 9.028],
                        [38.742, 9.028],
                        [38.742, 9.024],
                    ]
                ],
            },
            "applicant_ref": {"applicant_id": applicant_id, "full_name": "E2E Applicant"},
            "parcel_ref": {
                "parcel_id": f"{PREFIX}parcel",
                "parcel_number": f"{PREFIX}PARCEL",
                "zone_id": f"{PREFIX}ZONE",
            },
            "required_documents": ["proof_of_ownership"],
            "metadata": {"priority": "normal", "description": "E2E integration application", "test_run": PREFIX},
        },
        headers=auth(applicant_token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_full_backend_frontend_integration_flow():
    seed_back_office_accounts()
    seed_parcel()

    register = client.post(
        "/auth/register",
        json={"username": f"{PREFIX}applicant", "password": "pass123", "role": "applicant"},
    )
    assert register.status_code == 201, register.text

    applicant_token = login(f"{PREFIX}applicant")
    staff_token = login(f"{PREFIX}staff")
    surveyor_token = login(f"{PREFIX}SURV-01")
    registrar_token = login(f"{PREFIX}registrar")

    applicant = client.post(
        "/applicants/",
        json={
            "full_name": "E2E Applicant",
            "email": "e2e@example.com",
            "phone": "+970599000000",
            "national_id": f"{PREFIX}NID",
            "address": {"city": "Ramallah", "zone_id": f"{PREFIX}ZONE"},
        },
        headers=auth(applicant_token),
    )
    assert applicant.status_code == 201, applicant.text
    applicant_id = applicant.json()["id"]

    application_id = submit_application(applicant_token, applicant_id)

    document = client.post(
        f"/applications/{application_id}/documents",
        data={"document_type": "proof_of_ownership", "uploaded_by": applicant_id, "actor_type": "applicant", "notes": "E2E document"},
        files={"file": ("ownership.txt", b"ownership evidence", "text/plain")},
        headers=auth(applicant_token),
    )
    assert document.status_code == 200, document.text
    document_id = document.json()["id"]

    comment = client.post(
        f"/applications/{application_id}/comments",
        json={"comment": "Applicant response for integration flow", "actor_type": "applicant", "actor_id": applicant_id, "visibility": "public"},
        headers=auth(applicant_token),
    )
    assert comment.status_code == 200, comment.text

    review_doc = client.patch(
        f"/applications/{application_id}/documents/{document_id}/review",
        json={"status": "verified", "reviewer_id": f"{PREFIX}staff-user", "remarks": "Verified in E2E flow"},
        headers=auth(staff_token),
    )
    assert review_doc.status_code == 200, review_doc.text

    transition(staff_token, application_id, "pre_checked")
    transition(staff_token, application_id, "survey_required")

    assignment = client.post(
        f"/applications/{application_id}/auto-assign-surveyor",
        headers=auth(staff_token),
    )
    assert assignment.status_code == 200, assignment.text
    assert assignment.json()["surveyor_id"] == f"{PREFIX}surveyor-profile"

    tasks = client.get("/survey-tasks/", headers=auth(surveyor_token))
    assert tasks.status_code == 200, tasks.text
    assert tasks.json()["total"] == 1

    for milestone in ["visit_scheduled", "arrived_on_site", "survey_started", "survey_completed"]:
        milestone_response = client.patch(
            f"/applications/{application_id}/survey-milestone",
            json={"milestone": milestone, "notes": f"E2E {milestone}", "actor_id": f"{PREFIX}surveyor-profile"},
            headers=auth(surveyor_token),
        )
        assert milestone_response.status_code == 200, milestone_response.text

    report = client.post(
        f"/applications/{application_id}/survey-report",
        json={
            "surveyor_id": f"{PREFIX}surveyor-profile",
            "observations": "Boundaries verified during integration test",
            "area_sqm": 850.5,
            "report_ref": f"{PREFIX}REPORT",
        },
        headers=auth(surveyor_token),
    )
    assert report.status_code == 200, report.text

    transition(staff_token, application_id, "legal_review")

    legal_review = client.patch(
        f"/applications/{application_id}/registrar-review",
        json={"registrar_id": f"{PREFIX}registrar-user", "decision": "accepted", "notes": "Accepted in E2E flow"},
        headers=auth(registrar_token),
    )
    assert legal_review.status_code == 200, legal_review.text

    transition(staff_token, application_id, "approved")

    certificate = client.post(
        f"/applications/{application_id}/certificate",
        json={"issued_by": f"{PREFIX}registrar-user"},
        headers=auth(registrar_token),
    )
    assert certificate.status_code == 200, certificate.text
    cert_id = certificate.json()["certificate_id"]
    assert certificate.json()["verification"]["digital_signature"]

    verify = client.get(f"/certificates/{cert_id}/verify")
    assert verify.status_code == 200, verify.text
    assert verify.json()["signature_valid"] is True

    objection_application_id = submit_application(applicant_token, applicant_id)
    objection = client.post(
        f"/applications/{objection_application_id}/objections",
        json={
            "reason": "Neighbor boundary conflict raised during E2E flow",
            "submitted_by": applicant_id,
            "actor_type": "applicant",
            "supporting_document_ids": [],
        },
        headers=auth(applicant_token),
    )
    assert objection.status_code == 200, objection.text

    objection_app = client.get(f"/applications/{objection_application_id}", headers=auth(applicant_token))
    assert objection_app.status_code == 200, objection_app.text
    assert objection_app.json()["status"] == "under_objection"
