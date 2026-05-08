from pydantic import BaseModel
from typing import List, Optional

class MedicineCreate(BaseModel):
    medicine_name: str
    dosage: str
    timing: List[str]
    notes: Optional[str] = None

class MedicineUpdate(BaseModel):
    medicine_name: Optional[str] = None
    dosage: Optional[str] = None
    timing: Optional[List[str]] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class MedicineResponse(BaseModel):
    id: str
    user_id: str
    medicine_name: str
    dosage: str
    timing: List[str]
    notes: Optional[str] = None
    active: bool
    created_at: str

class DoseLogCreate(BaseModel):
    medication_id: str
    scheduled_time: str
    scheduled_date: str
    status: str # "taken" or "missed"
