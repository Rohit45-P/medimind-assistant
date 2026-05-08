from fastapi import APIRouter, HTTPException
from app.models.patient_model import EmergencyProfileUpdate, HealthLogCreate
from app.database import supabase
from app.utils.qr_generator import generate_emergency_qr_base64
import os

router = APIRouter()

@router.get("/{user_id}/emergency-profile")
def get_emergency_profile(user_id: str):
    res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]

@router.put("/{user_id}/emergency-profile")
def update_emergency_profile(user_id: str, profile: EmergencyProfileUpdate):
    data = {k: v for k, v in profile.model_dump().items() if v is not None}
    res = supabase.table("profiles").update(data).eq("id", user_id).execute()
    return {"message": "Emergency profile updated", "data": res.data}

@router.get("/{user_id}/generate-qr")
def get_emergency_qr(user_id: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    qr_base64 = generate_emergency_qr_base64(user_id, frontend_url)
    return {"qr_code": qr_base64}

@router.post("/{user_id}/health-log")
def log_health_status(user_id: str, log: HealthLogCreate):
    data = {
        "user_id": user_id,
        "type": log.type,
        "value": log.value,
        "notes": log.notes
    }
    res = supabase.table("health_logs").insert(data).execute()
    return {"message": "Health log saved", "data": res.data}
