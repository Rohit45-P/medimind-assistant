from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.database import supabase
from app.dependencies import get_current_user
from app.services.reminder_service import check_adherence

router = APIRouter()

class LinkPatientRequest(BaseModel):
    patient_email: str

@router.get("/patients")
def get_patients(current_user=Depends(get_current_user)):
    """Return all linked patients with their meds, logs, and health data."""
    links_res = supabase.table("caregiver_links").select("patient_id").eq("caregiver_id", current_user.id).execute()
    ids = [l["patient_id"] for l in (links_res.data or [])]
    if not ids:
        return []

    profs_res = supabase.table("profiles").select("id, full_name").in_("id", ids).execute()
    meds_res = supabase.table("medications").select("*").in_("user_id", ids).execute()
    logs_res = supabase.table("medication_logs").select("*").in_("user_id", ids).execute()
    health_res = supabase.table("health_logs").select("*").in_("user_id", ids).execute()

    result = []
    for prof in (profs_res.data or []):
        pid = prof["id"]
        result.append({
            "id": pid,
            "full_name": prof.get("full_name", "Patient"),
            "meds": [m for m in (meds_res.data or []) if m["user_id"] == pid],
            "logs": [l for l in (logs_res.data or []) if l["user_id"] == pid],
            "health": [h for h in (health_res.data or []) if h["user_id"] == pid],
        })
    return result

@router.post("/link")
def link_patient(req: LinkPatientRequest, current_user=Depends(get_current_user)):
    try:
        pid_res = supabase.rpc("find_user_id_by_email", {"_email": req.patient_email.strip().lower()}).execute()
        pid = pid_res.data
        if not pid:
            raise HTTPException(status_code=404, detail="No patient found with that email")
        if pid == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot link your own account")
        link_res = supabase.table("caregiver_links").insert({"caregiver_id": current_user.id, "patient_id": pid}).execute()
        return {"message": "Patient linked successfully", "data": link_res.data}
    except HTTPException:
        raise
    except Exception as e:
        if "23505" in str(e):
            raise HTTPException(status_code=409, detail="Already linked")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/unlink/{patient_id}")
def unlink_patient(patient_id: str, current_user=Depends(get_current_user)):
    supabase.table("caregiver_links").delete().eq("caregiver_id", current_user.id).eq("patient_id", patient_id).execute()
    return {"message": "Patient unlinked"}

@router.get("/patient-status/{patient_id}")
def get_patient_status(patient_id: str, current_user=Depends(get_current_user)):
    adherence_data = check_adherence(patient_id)
    recent_logs = supabase.table("medication_logs").select("*").eq("user_id", patient_id).order("created_at", desc=True).limit(5).execute()
    return {
        "adherence": adherence_data,
        "recent_activity": recent_logs.data,
        "needs_attention": len(adherence_data["alerts"]) > 0
    }

@router.get("/emergency-alerts")
def get_emergency_alerts(current_user=Depends(get_current_user)):
    """Return all active (unresolved) emergency alerts for patients linked to this caregiver."""
    # Get linked patient IDs
    links_res = supabase.table("caregiver_links").select("patient_id").eq("caregiver_id", current_user.id).execute()
    ids = [l["patient_id"] for l in (links_res.data or [])]
    if not ids:
        return []

    # Get unresolved alerts for those patients
    alerts_res = supabase.table("emergency_alerts") \
        .select("*") \
        .in_("patient_id", ids) \
        .eq("resolved", False) \
        .order("created_at", desc=True) \
        .execute()
    alerts = alerts_res.data or []

    # Enrich with patient names from profiles
    if alerts:
        alert_patient_ids = list({a["patient_id"] for a in alerts})
        profs_res = supabase.table("profiles").select("id, full_name").in_("id", alert_patient_ids).execute()
        name_map = {p["id"]: p["full_name"] for p in (profs_res.data or [])}
        for a in alerts:
            a["patient_name"] = name_map.get(a["patient_id"], "Unknown Patient")

    return alerts


@router.patch("/emergency-alerts/{alert_id}/resolve")
def resolve_emergency_alert(alert_id: str, current_user=Depends(get_current_user)):
    """Caregiver marks an emergency alert as resolved."""
    from datetime import datetime, timezone
    # Verify the alert belongs to a linked patient
    links_res = supabase.table("caregiver_links").select("patient_id").eq("caregiver_id", current_user.id).execute()
    ids = [l["patient_id"] for l in (links_res.data or [])]

    alert_res = supabase.table("emergency_alerts").select("patient_id").eq("id", alert_id).execute()
    if not alert_res.data or alert_res.data[0]["patient_id"] not in ids:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to resolve this alert")

    supabase.table("emergency_alerts").update({
        "resolved": True,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", alert_id).execute()
    return {"message": "Alert resolved"}
