from datetime import datetime
from fastapi import Form
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from .common_schema import ApplicationType, WorkflowStatus, CommentVisibility


class ApplicationCreate(BaseModel):
    applicant_id: str = Field(...)
    application_type: ApplicationType
    parcel_id: Optional[str] = None
    parcel_geojson: Optional[dict] = None
    applicant_ref: Optional[dict] = None
    parcel_ref: Optional[dict] = None
    required_documents: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ApplicationOut(BaseModel):
    id: str
    applicant_id: str
    application_type: ApplicationType
    status: WorkflowStatus
    parcel_id: Optional[str]
    parcel_geojson: Optional[dict]
    applicant_ref: Optional[dict] = None
    parcel_ref: Optional[dict] = None
    required_documents: List[str] = Field(default_factory=list)
    uploaded_documents: List[dict] = Field(default_factory=list)
    workflow: Optional[dict] = None
    comments: Optional[List[dict]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    metadata: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentMeta(BaseModel):
    id: str
    application_id: str
    document_type: str
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    stored_name: Optional[str] = None
    saved_path: Optional[str] = None
    uploaded_by: str
    actor_type: str
    notes: Optional[str] = None
    status: str = "pending"
    verified: bool = False
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    uploaded_at: Optional[datetime] = None


class DocumentCreate(BaseModel):
    document_type: str = Field(...)
    uploaded_by: str = Field(...)
    actor_type: str = Field(default="applicant")
    notes: Optional[str] = None

    @classmethod
    def as_form(
        cls,
        document_type: str = Form(...),
        uploaded_by: str = Form(...),
        actor_type: str = Form("applicant"),
        notes: Optional[str] = Form(None),
    ):
        return cls(
            document_type=document_type,
            uploaded_by=uploaded_by,
            actor_type=actor_type,
            notes=notes,
        )


class DocumentReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(verified|rejected)$")
    reviewer_id: str = Field(...)
    remarks: Optional[str] = None


class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1)
    actor_type: str = Field(...)
    actor_id: str = Field(...)
    visibility: CommentVisibility = Field(...)


class CommentOut(BaseModel):
    id: str
    comment: str
    actor_type: str
    actor_id: str
    visibility: CommentVisibility
    created_at: Optional[datetime] = None


class ObjectionCreate(BaseModel):
    reason: str = Field(..., min_length=1)
    submitted_by: str = Field(...)
    actor_type: str = Field(...)
    supporting_document_ids: List[str] = Field(default_factory=list)


class ObjectionOut(BaseModel):
    id: str
    application_id: str
    reason: str
    submitted_by: str
    actor_type: str
    supporting_document_ids: List[str] = Field(default_factory=list)
    status: str
    created_at: Optional[datetime] = None


class TimelineEvent(BaseModel):
    event_type: str
    actor: Optional[str] = None
    timestamp: datetime
    metadata: dict = Field(default_factory=dict)


class TimelineResponse(BaseModel):
    event_stream: List[TimelineEvent]


class CertificateIssueRequest(BaseModel):
    issued_by: str = Field(...)


class CertificateOut(BaseModel):
    certificate_id: str
    application_id: str
    parcel_id: Optional[str] = None
    parcel_ref: Optional[dict] = None
    certificate_type: Optional[str] = None
    status: str
    year: Optional[int] = None
    issued_to: Optional[dict] = None
    issued_at: Optional[datetime] = None
    issued_by: Optional[str] = None
    verification: Optional[dict] = None
    metadata: Optional[dict] = None


class TransitionRequest(BaseModel):
    target_status: WorkflowStatus = Field(...)
    actor_type: str = Field(...)
    actor_id: str = Field(...)
    note: Optional[str] = None


class HoldRequest(BaseModel):
    reason: str = Field(..., min_length=1)
    actor_type: str = Field(...)
    actor_id: str = Field(...)


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=1)
    actor_type: str = Field(...)
    actor_id: str = Field(...)


class ResumeRequest(BaseModel):
    actor_type: str = Field(...)
    actor_id: str = Field(...)
    note: Optional[str] = None


class StatusResponse(BaseModel):
    status: str
    to: Optional[str] = None


class HoldResponse(BaseModel):
    status: str
    hold_reason: str


class RejectResponse(BaseModel):
    status: str
    rejection_reason: str


class ResumeResponse(BaseModel):
    status: str
    restored_to: str

