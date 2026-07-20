from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from .common_schema import ApplicantType, VerificationState


class NotificationPreferences(BaseModel):
    on_status_change: bool = True
    on_missing_documents: bool = True
    on_certificate_ready: bool = True


class Address(BaseModel):
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    zone_id: Optional[str] = None
    street: Optional[str] = None
    address_line: Optional[str] = None


class ApplicantCreate(BaseModel):
    full_name: str = Field(...)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    applicant_type: ApplicantType = ApplicantType.citizen
    national_id: str = Field(...)
    address: Address = Address()
    preferred_language: Optional[str] = "en"
    notification_preferences: NotificationPreferences = NotificationPreferences()
    verification_state: VerificationState = VerificationState.unverified
    privacy_settings: Optional[dict] = Field(default_factory=dict)
    linked_applications: List[str] = Field(default_factory=list)


class ApplicantUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    applicant_type: Optional[ApplicantType] = None
    national_id: Optional[str] = None
    address: Optional[Address] = None
    preferred_language: Optional[str] = None
    notification_preferences: Optional[NotificationPreferences] = None
    privacy_settings: Optional[dict] = None


class ApplicantOut(ApplicantCreate):
    id: str

    model_config = ConfigDict(from_attributes=True)
