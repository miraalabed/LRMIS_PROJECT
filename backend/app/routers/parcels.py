from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from app.schemas.parcel_schema import ParcelCreate, ParcelOut
from app.database import db
from app.utils.security import get_current_user, require_back_office
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/parcels", tags=["parcels"])


@router.post("/", response_model=ParcelOut, status_code=status.HTTP_201_CREATED)
def create_parcel(payload: ParcelCreate, current_user=Depends(require_back_office)):
    _id = str(ObjectId())
    now = datetime.now(timezone.utc)
    doc = payload.model_dump()
    doc.update({"_id": _id, "created_at": now, "updated_at": now})
    db.parcels.insert_one(doc)
    return {"id": _id, **doc}


@router.get("/{parcel_id}", response_model=ParcelOut)
def get_parcel(parcel_id: str, current_user=Depends(get_current_user)):
    doc = db.parcels.find_one({"_id": parcel_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return {"id": doc.get("_id"), **doc}


@router.get("/")
def list_parcels(
    page: int = 1,
    limit: int = 10,
    zone_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    query = {}
    if zone_id:
        query["zone_id"] = zone_id
    if status:
        query["registration_status"] = status
    skip = (page - 1) * limit
    cursor = db.parcels.find(query).skip(skip).limit(limit)
    items = [{"id": d.get("_id"), **d} for d in cursor]
    total = db.parcels.count_documents(query)
    return {"data": items, "total": total, "page": page, "limit": limit}


@router.patch("/{parcel_id}", response_model=ParcelOut)
def update_parcel(parcel_id: str, payload: ParcelCreate, current_user=Depends(require_back_office)):
    doc = payload.model_dump(exclude_none=True)
    doc["updated_at"] = datetime.now(timezone.utc)
    result = db.parcels.update_one({"_id": parcel_id}, {"$set": doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Parcel not found")
    updated = db.parcels.find_one({"_id": parcel_id})
    return {"id": updated.get("_id"), **updated}


@router.delete("/{parcel_id}")
def delete_parcel(parcel_id: str, current_user=Depends(require_back_office)):
    result = db.parcels.delete_one({"_id": parcel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return {"status": "deleted"}
