from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.database import supabase
from app.dependencies import get_current_user

router = APIRouter()


class EmergencyAlertRequest(BaseModel):
    message: Optional[str] = "Patient needs help!"


class AutoSOSRequest(BaseModel):
    """Payload sent by Smart Auto SOS when vitals cross emergency thresholds."""
    pulse: Optional[float] = None
    temperature: Optional[float] = None
    motion: Optional[str] = None
    trigger_reasons: Optional[List[str]] = []


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


@router.post("/auto-alert")
def send_auto_sos_alert(req: AutoSOSRequest, current_user=Depends(get_current_user)):
    """
    Smart Auto SOS — called automatically when simulated vitals cross emergency thresholds.
    Stores a rich alert message with vitals data so caregivers see exactly why it fired.
    """
    try:
        # Build a human-readable message from the vitals
        parts = ["🤖 AUTO-DETECTED EMERGENCY (Smart SOS)"]
        if req.trigger_reasons:
            parts.append("Triggers: " + " | ".join(req.trigger_reasons))
        vitals_parts = []
        if req.pulse is not None:
            vitals_parts.append(f"Pulse: {req.pulse} BPM")
        if req.temperature is not None:
            vitals_parts.append(f"Temp: {req.temperature}°F")
        if req.motion:
            vitals_parts.append(f"Motion: {req.motion}")
        if vitals_parts:
            parts.append("Vitals → " + " | ".join(vitals_parts))

        message = " · ".join(parts)

        res = supabase.table("emergency_alerts").insert({
            "patient_id": current_user.id,
            "message": message,
            "resolved": False,
        }).execute()
        return {"message": "Auto SOS alert sent to caregiver", "data": res.data}
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
