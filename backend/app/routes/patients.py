from fastapi import APIRouter, HTTPException, Depends
from app.models.patient_model import EmergencyProfileUpdate, HealthLogCreate
from app.database import supabase
from app.dependencies import get_current_user
from app.utils.qr_generator import generate_emergency_qr_base64
import os

router = APIRouter()

@router.get("/emergency-profile")
def get_emergency_profile(current_user=Depends(get_current_user)):
    res = supabase.table("profiles").select("*").eq("id", current_user.id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]

@router.put("/emergency-profile")
def update_emergency_profile(profile: EmergencyProfileUpdate, current_user=Depends(get_current_user)):
    data = {k: v for k, v in profile.model_dump().items() if v is not None}
    res = supabase.table("profiles").update(data).eq("id", current_user.id).execute()
    return {"message": "Emergency profile updated", "data": res.data}

@router.get("/generate-qr")
def get_emergency_qr(current_user=Depends(get_current_user)):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    qr_base64 = generate_emergency_qr_base64(current_user.id, frontend_url)
    return {"qr_code": qr_base64}

@router.post("/health-log")
def log_health_status(log: HealthLogCreate, current_user=Depends(get_current_user)):
    data = {
        "user_id": current_user.id,
        "type": log.type,
        "value": log.value,
        "notes": log.notes
    }
    res = supabase.table("health_logs").insert(data).execute()
    return {"message": "Health log saved", "data": res.data}
