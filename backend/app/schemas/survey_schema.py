from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from app.schemas.staff_schema import SurveyMilestoneType


MILESTONE_ORDER = [
    "assigned",
    "visit_scheduled",
    "arrived_on_site",
    "survey_started",
    "survey_completed",
    "report_uploaded",
    "registrar_reviewed",
]

class SurveyMilestoneUpdate(BaseModel):
    milestone:  SurveyMilestoneType
    notes:      Optional[str] = None
    actor_id:   Optional[str] = None   



class SurveyReportCreate(BaseModel):
    surveyor_id:    str
    observations:   str   = Field(..., json_schema_extra={"example": "الحدود واضحة، لا يوجد تعارض"})
    area_sqm:       Optional[float] = None
    coordinates:    Optional[dict]  = None  
    field_notes:    Optional[str]   = None
    report_ref:     Optional[str]   = None   



class RegistrarDecision(str, Enum):
    accepted = "accepted"
    rejected = "rejected"

class RegistrarReviewUpdate(BaseModel):
    registrar_id:  str
    decision:      RegistrarDecision
    notes:         Optional[str] = None  