from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from .common_schema import ApplicationType


class ParcelLocation(BaseModel):
    type: str = Field(..., json_schema_extra={"example": "Polygon"})
    coordinates: list


class ParcelCreate(BaseModel):
    parcel_number: str = Field(...)
    block_number: Optional[str] = None
    basin_number: Optional[str] = None
    zone_id: Optional[str] = None
    parcel_code: Optional[str] = None
    current_owner_refs: List[dict] = Field(default_factory=list)
    area_sqm: Optional[float] = None
    land_use: Optional[str] = None
    registration_status: Optional[str] = None
    geometry: Optional[dict] = None
    address_hint: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class ParcelOut(ParcelCreate):
    id: str

    model_config = ConfigDict(from_attributes=True)
