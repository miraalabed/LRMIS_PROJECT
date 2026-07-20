from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from enum import Enum



class StaffRole(str, Enum):
    surveyor  = "surveyor"
    registrar = "registrar"
    manager   = "manager"
    admin     = "admin"


class SurveyMilestoneType(str, Enum):
    assigned          = "assigned"
    visit_scheduled   = "visit_scheduled"
    arrived_on_site   = "arrived_on_site"
    survey_started    = "survey_started"
    survey_completed  = "survey_completed"
    report_uploaded   = "report_uploaded"
    registrar_reviewed = "registrar_reviewed"



class Shift(BaseModel):
    day:   str   # "Mon", "Tue",
    start: str   # "08:00"
    end:   str   # "16:00"


class Schedule(BaseModel):
    timezone: str = "Asia/Jerusalem"
    shifts:   List[Shift] = []
    on_call:  bool = False


class Workload(BaseModel):
    active_tasks: int = 0
    max_tasks:    int = 10


class Coverage(BaseModel):
    zone_ids:  List[str] = []
    geo_fence: Optional[dict] = None   


class StaffContacts(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None



class StaffCreate(BaseModel):
    staff_code:  str         = Field(..., json_schema_extra={"example": "SURV-RM-04"})
    name:        str         = Field(..., json_schema_extra={"example": "Survey Team A"})
    role:        StaffRole
    department:  Optional[str] = None
    skills:      List[str]   = []
    coverage:    Coverage    = Coverage()
    schedule:    Schedule    = Schedule()
    workload:    Workload    = Workload()
    contacts:    StaffContacts = StaffContacts()
    active:      bool        = True


class StaffOut(BaseModel):
    id:         str
    staff_code: str
    name:       str
    role:       StaffRole
    department: Optional[str]
    skills:     List[str]
    coverage:   Coverage
    workload:   Workload
    contacts:   StaffContacts
    active:     bool

    model_config = ConfigDict(from_attributes=True)