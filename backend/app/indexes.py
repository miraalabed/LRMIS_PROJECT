from pymongo import ASCENDING, GEOSPHERE

from app.database import db


def ensure_indexes():
    db.users.create_index([("username", ASCENDING)], unique=True)
    db.api_tokens.create_index([("token", ASCENDING)], unique=True)
    db.api_tokens.create_index([("expires_at", ASCENDING)])

    db.applicants.create_index(
        [("identity.national_id", ASCENDING)],
        unique=True,
        sparse=True,
    )
    db.applicants.create_index(
        [("national_id", ASCENDING)],
        unique=True,
        sparse=True,
    )
    db.applicants.create_index([("email", ASCENDING)])

    db.land_applications.create_index(
        [("application_id", ASCENDING)],
        unique=True,
        sparse=True,
    )
    db.land_applications.create_index([("idempotency_key", ASCENDING)], sparse=True)
    db.land_applications.create_index([("applicant_id", ASCENDING)])
    db.land_applications.create_index([("status", ASCENDING)])
    db.land_applications.create_index([("application_type", ASCENDING)])
    db.land_applications.create_index([("parcel_geojson", GEOSPHERE)], sparse=True)

    db.staff_members.create_index([("staff_code", ASCENDING)], unique=True)
    db.staff_members.create_index([("role", ASCENDING)])
    db.staff_members.create_index([("coverage.zone_ids", ASCENDING)])

    db.parcels.create_index([("parcel_code", ASCENDING)], unique=True, sparse=True)
    db.parcels.create_index([("geometry", GEOSPHERE)], sparse=True)

    db.application_documents.create_index([("application_id", ASCENDING)])
    db.objections.create_index([("application_id", ASCENDING)])
    db.certificates.create_index([("certificate_id", ASCENDING)], unique=True)
    db.survey_tasks.create_index([("application_id", ASCENDING)])
    db.survey_tasks.create_index([("assigned_surveyor_id", ASCENDING)])
    db.survey_reports.create_index([("application_id", ASCENDING)])


ensure_indexes()
