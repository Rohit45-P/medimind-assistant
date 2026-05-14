from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.database import supabase
from app.dependencies import get_current_user

router = APIRouter()


class EmergencyAlertRequest(BaseModel):
    message: Optional[str] = "Patient needs help!"


@router.post("/alert")
def send_emergency_alert(req: EmergencyAlertRequest, current_user=Depends(get_current_user)):
    """Patient triggers an emergency alert — stored in DB, visible on caregiver dashboard."""
    try:
        res = supabase.table("emergency_alerts").insert({
            "patient_id": current_user.id,
            "message": req.message or "Patient needs help!",
            "resolved": False,
        }).execute()
        return {"message": "Emergency alert sent", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/mine")
def get_my_alerts(current_user=Depends(get_current_user)):
    """Patient can view their own recent alerts."""
    try:
        res = supabase.table("emergency_alerts") \
            .select("*") \
            .eq("patient_id", current_user.id) \
            .order("created_at", desc=True) \
            .limit(20) \
            .execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
