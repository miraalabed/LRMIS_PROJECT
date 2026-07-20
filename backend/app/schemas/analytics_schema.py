from pydantic import BaseModel
from typing import Optional, List


class KPIResponse(BaseModel):
    total_applications:        int
    pending_applications:      int
    approved_applications:     int
    rejected_applications:     int
    applications_under_objection: int
    certificate_issued:        int
    average_processing_days:   Optional[float] = None


class StatusCount(BaseModel):
    status: str
    count:  int


class ZoneCount(BaseModel):
    zone_id: str
    count:   int


class ProcessingTimeEntry(BaseModel):
    application_type: str
    avg_days: Optional[float]
    count: int


class SurveyorStat(BaseModel):
    surveyor_id:   str
    name:          str
    active_tasks:  int
    completed_tasks: int
    avg_completion_days: Optional[float] = None


class RegistrarStat(BaseModel):
    registrar_id:   str
    name:           str
    reviewed_count: int
    accepted_count: int
    rejected_count: int