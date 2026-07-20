import os
import pytest
import pymongo
from fastapi.testclient import TestClient

from app.main import app
from app.database import db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def cleanup():
    try:
        db.client.admin.command("ping")
    except pymongo.errors.PyMongoError:
        pytest.skip("MongoDB is not available")

    db.users.delete_many({"username": {"$in": ["testuser", "staffuser"]}})
    db.applicants.delete_many({"national_id": "TEST-NID"})
    db.parcels.delete_many({"parcel_number": "TEST-PARCEL"})
    db.land_applications.delete_many({"application_type": "first_registration"})
    db.api_tokens.delete_many({})
    yield
    db.users.delete_many({"username": {"$in": ["testuser", "staffuser"]}})
    db.applicants.delete_many({"national_id": "TEST-NID"})
    db.parcels.delete_many({"parcel_number": "TEST-PARCEL"})
    db.land_applications.delete_many({"application_type": "first_registration"})
    db.api_tokens.delete_many({})


def test_applicant_registration_and_application_creation():
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "password": "pass123", "role": "applicant"},
    )
    assert response.status_code == 201
    token_resp = client.post(
        "/auth/login",
        json={"username": "testuser", "password": "pass123"},
    )
    assert token_resp.status_code == 200
    token = token_resp.json()["token"]

    applicant = client.post(
        "/applicants/",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "+1234567890",
            "national_id": "TEST-NID",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert applicant.status_code == 201
    applicant_id = applicant.json()["id"]

    app_create = client.post(
        "/applications/",
        json={
            "applicant_id": applicant_id,
            "application_type": "first_registration",
            "parcel_id": None,
            "parcel_geojson": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert app_create.status_code == 201
    assert app_create.json()["applicant_id"] == applicant_id
