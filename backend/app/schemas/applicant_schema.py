from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
from .common_schema import ApplicantType, VerificationState


class ApplicantCreate(BaseModel):
	name: str = Field(...)
	email: Optional[EmailStr] = None
	phone: Optional[str] = None
	applicant_type: ApplicantType = ApplicantType.citizen
	verified: VerificationState = VerificationState.unverified


class ApplicantOut(BaseModel):
    id: str
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    applicant_type: ApplicantType
    verified: VerificationState

    model_config = ConfigDict(from_attributes=True)

