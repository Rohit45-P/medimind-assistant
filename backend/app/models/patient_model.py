from pydantic import BaseModel
from typing import Optional, List

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "patient" # "patient" or "caregiver"

class UserLogin(BaseModel):
    email: str
    password: str

class EmergencyProfileUpdate(BaseModel):
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    diseases: Optional[str] = None
    emergency_contacts: Optional[str] = None

class HealthLogCreate(BaseModel):
    type: str # "symptom", "mood", "vitals"
    value: str
    notes: Optional[str] = None
