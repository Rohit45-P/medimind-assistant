from fastapi import APIRouter, HTTPException
from app.database import supabase
from app.services.reminder_service import check_adherence

router = APIRouter()

@router.post("/link")
def link_caregiver(caregiver_id: str, patient_id: str):
    # Depending on DB schema, this might be a separate table or profile array
    # Assume a caregivers_patients table exists
    data = {
        "caregiver_id": caregiver_id,
        "patient_id": patient_id
    }
    try:
        res = supabase.table("caregiver_patients").insert(data).execute()
        return {"message": "Linked successfully", "data": res.data}
    except Exception as e:
        # Fallback if table doesn't exist
        return {"error": str(e), "message": "Make sure 'caregiver_patients' table exists in Supabase."}

@router.get("/patient-status/{patient_id}")
def get_patient_status(patient_id: str):
    """
    Caregiver fetches patient status to see if they are doing well.
    """
    adherence_data = check_adherence(patient_id)
    
    # Check recent logs
    recent_logs = supabase.table("medication_logs").select("*").eq("user_id", patient_id).order("created_at", desc=True).limit(5).execute()
    
    return {
        "adherence": adherence_data,
        "recent_activity": recent_logs.data,
        "needs_attention": len(adherence_data["alerts"]) > 0
    }
