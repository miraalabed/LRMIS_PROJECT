from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ApplicantType(str, Enum):
	citizen = "citizen"
	lawyer = "lawyer"
	company = "company"
	surveyor = "surveyor"
	authorized_representative = "authorized_representative"


class VerificationState(str, Enum):
	unverified = "unverified"
	verified = "verified"
	suspended = "suspended"


class ApplicationType(str, Enum):
	first_registration = "first_registration"
	ownership_transfer = "ownership_transfer"
	parcel_subdivision = "parcel_subdivision"
	parcel_merge = "parcel_merge"
	boundary_correction = "boundary_correction"
	certificate_request = "certificate_request"


class WorkflowStatus(str, Enum):
	submitted = "submitted"
	pre_checked = "pre_checked"
	survey_required = "survey_required"
	surveyed = "surveyed"
	legal_review = "legal_review"
	approved = "approved"
	certificate_issued = "certificate_issued"
	closed = "closed"
	rejected = "rejected"
	on_hold = "on_hold"
	missing_documents = "missing_documents"
	under_objection = "under_objection"


class CommentVisibility(str, Enum):
	public = "public"
	staff_only = "staff_only"


class Pagination(BaseModel):
	page: int = Field(1, ge=1)
	limit: int = Field(10, ge=1, le=100)


class ListResponse(BaseModel):
	data: list
	total: int
	page: int
	limit: int

