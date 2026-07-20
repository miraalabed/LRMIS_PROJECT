from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.staff_schema import StaffCreate, StaffOut
from app.database import db
from app.services.audit_service import log_event
from app.utils.security import require_back_office, require_management
from bson import ObjectId
from typing import Optional

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("/", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, current_user=Depends(require_management)):
    existing = db.staff_members.find_one({"staff_code": payload.staff_code})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"staff_code '{payload.staff_code}' already exists"
        )

    _id = str(ObjectId())
    doc = payload.model_dump()
    doc["_id"] = _id

    db.staff_members.insert_one(doc)
    log_event("staff_created", user_id=_id, details={"name": doc["name"], "role": doc["role"]})

    return {"id": _id, **doc}


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(staff_id: str, current_user=Depends(require_back_office)):
    doc = db.staff_members.find_one({"_id": staff_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return {"id": doc["_id"], **doc}


@router.get("/")
def list_staff(
    role: Optional[str] = None,
    zone: Optional[str] = None,
    active: Optional[bool] = None,
    page: int = 1,
    limit: int = 10,
    current_user=Depends(require_back_office),
):
    query = {}
    if role:
        query["role"] = role
    if zone:
        query["coverage.zone_ids"] = zone   
    if active is not None:
        query["active"] = active

    skip = (page - 1) * limit
    cursor = db.staff_members.find(query).skip(skip).limit(limit)

    items = []
    for d in cursor:
        items.append({"id": d["_id"], **d})

    total = db.staff_members.count_documents(query)
    return {"data": items, "total": total, "page": page, "limit": limit}
