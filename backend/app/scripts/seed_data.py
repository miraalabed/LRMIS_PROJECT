from datetime import datetime, timezone
from passlib.context import CryptContext
from bson import ObjectId

from app.database import db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

DEMO_PASSWORD = "Demo1234"
NOW = datetime.now(timezone.utc)


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def upsert_user(username: str, role: str, linked_applicant_id: str | None = None) -> str:
    """Create the user if missing; return the user's _id either way."""
    existing = db.users.find_one({"username": username})
    if existing:
        print(f"  user '{username}' already exists, skipping")
        return existing["_id"]

    _id = str(ObjectId())
    db.users.insert_one(
        {
            "_id": _id,
            "username": username,
            "password": hash_password(DEMO_PASSWORD),
            "role": role,
            "linked_applicant_id": linked_applicant_id,
            "created_at": NOW,
        }
    )
    print(f"  created user '{username}' (role={role})")
    return _id


def upsert_applicant() -> str:
    existing = db.applicants.find_one({"identity.national_id": "400000000"})
    if existing:
        print("  applicant 'Nour Ahmad' already exists, skipping")
        return existing["_id"]

    _id = str(ObjectId())
    db.applicants.insert_one(
        {
            "_id": _id,
            "full_name": "Nour Ahmad",
            "email": "nour@example.com",
            "phone": "+970599000000",
            "applicant_type": "citizen",
            "national_id": "400000000",
            "address": {
                "city": "Ramallah",
                "neighborhood": "Al Tireh",
                "zone_id": "ZONE-RM-01",
            },
            "preferred_language": "en",
            "notification_preferences": {
                "on_status_change": True,
                "on_missing_documents": True,
                "on_certificate_ready": True,
            },
            "verification_state": "verified",
            "privacy_settings": {},
            "linked_applications": [],
            "identity": {"national_id": "400000000"},
            "created_at": NOW,
        }
    )
    print("  created applicant 'Nour Ahmad'")
    return _id


def upsert_staff(staff_code: str, name: str, role: str, zone_ids: list[str], skills: list[str]) -> str:
    existing = db.staff_members.find_one({"staff_code": staff_code})
    if existing:
        print(f"  staff '{name}' ({staff_code}) already exists, skipping")
        return existing["_id"]

    _id = str(ObjectId())
    db.staff_members.insert_one(
        {
            "_id": _id,
            "staff_code": staff_code,
            "name": name,
            "role": role,
            "department": "Cadastral Survey" if role == "surveyor" else "Land Registry Office",
            "skills": skills,
            "coverage": {"zone_ids": zone_ids},
            "schedule": {"timezone": "Asia/Jerusalem", "shifts": [], "on_call": False},
            "workload": {"active_tasks": 0, "max_tasks": 10},
            "contacts": {"phone": "+970599000001", "email": f"{staff_code.lower()}@example.com"},
            "active": True,
            "created_at": NOW,
        }
    )
    print(f"  created staff '{name}' ({staff_code}, role={role})")
    return _id


def upsert_parcel(parcel_code: str, applicant_id: str) -> str:
    existing = db.parcels.find_one({"parcel_code": parcel_code})
    if existing:
        print(f"  parcel '{parcel_code}' already exists, skipping")
        return existing["_id"]

    _id = str(ObjectId())
    db.parcels.insert_one(
        {
            "_id": _id,
            "parcel_code": parcel_code,
            "parcel_number": "145",
            "block_number": "12",
            "basin_number": "3",
            "zone_id": "ZONE-RM-01",
            "current_owner_refs": [{"applicant_id": applicant_id, "share": "1/1"}],
            "area_sqm": 850.5,
            "land_use": "residential",
            "registration_status": "registered",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [35.2001, 31.9021],
                    [35.2015, 31.9021],
                    [35.2015, 31.9030],
                    [35.2001, 31.9030],
                    [35.2001, 31.9021],
                ]],
            },
            "address_hint": "Ramallah - Al Tireh",
            "dispute_state": "none",
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    print(f"  created parcel '{parcel_code}'")
    return _id


def upsert_application(applicant_id: str, parcel_id: str, application_type: str, status: str) -> str:
    existing = db.land_applications.find_one(
        {"applicant_id": applicant_id, "application_type": application_type, "status": status}
    )
    if existing:
        print(f"  application ({application_type}, {status}) already exists, skipping")
        return existing["_id"]

    _id = str(ObjectId())
    db.land_applications.insert_one(
        {
            "_id": _id,
            "application_id": _id,
            "applicant_id": applicant_id,
            "application_type": application_type,
            "status": status,
            "parcel_id": parcel_id,
            "parcel_geojson": {
                "type": "Polygon",
                "coordinates": [[
                    [35.2001, 31.9021],
                    [35.2015, 31.9021],
                    [35.2015, 31.9030],
                    [35.2001, 31.9030],
                    [35.2001, 31.9021],
                ]],
            },
            "parcel_ref": {
                "parcel_id": parcel_id,
                "parcel_number": "145",
                "block_number": "12",
                "basin_number": "3",
                "zone_id": "ZONE-RM-01",
            },
            "required_documents": ["ownership_deed", "id_copy"],
            "uploaded_documents": [],
            "metadata": {"zone_id": "ZONE-RM-01"},
            "workflow": {"current_state": status, "allowed_next": []},
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    print(f"  created application ({application_type}, {status})")
    return _id


def run():
    print("Seeding LRMIS demo data...\n")

    print("Applicants:")
    applicant_id = upsert_applicant()

    print("\nUser accounts (password for all: Demo1234):")
    upsert_user("nour_applicant", "applicant", linked_applicant_id=applicant_id)
    upsert_user("sami_staff", "staff")
    upsert_user("ahmad_surveyor", "surveyor")
    upsert_user("sara_registrar", "registrar")
    upsert_user("admin_manager", "manager")

    print("\nStaff directory:")
    upsert_staff("SURV-RM-01", "ahmad_surveyor", "surveyor", ["ZONE-RM-01", "ZONE-RM-02"], ["boundary_survey", "gps_mapping"])
    upsert_staff("SURV-RM-02", "layla_surveyor", "surveyor", ["ZONE-RM-01"], ["parcel_subdivision"])
    upsert_staff("REG-RM-01", "sara_registrar", "registrar", ["ZONE-RM-01"], [])
    upsert_staff("STAFF-RM-01", "sami_staff", "staff", ["ZONE-RM-01"], [])

    print("\nParcels:")
    parcel_id = upsert_parcel("RM-Z01-B12-P145", applicant_id)

    print("\nSample applications:")
    upsert_application(applicant_id, parcel_id, "ownership_transfer", "submitted")
    upsert_application(applicant_id, parcel_id, "first_registration", "survey_required")

    print("\nDone. Sign in with any of the accounts above using password: Demo1234")


if __name__ == "__main__":
    run()