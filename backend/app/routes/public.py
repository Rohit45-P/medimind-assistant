from fastapi import APIRouter, HTTPException
from app.database import supabase

router = APIRouter()

@router.get("/emergency/{user_id}")
def get_public_emergency_profile(user_id: str):
    """Public endpoint — no auth required. Used by QR code scan."""
    prof_res = supabase.table("profiles").select(
        "id, full_name, blood_group, allergies, emergency_contacts, diseases"
    ).eq("id", user_id).execute()

    if not prof_res.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    meds_res = supabase.table("medications").select("id, name, dosage").eq("user_id", user_id).eq("active", True).execute()

    return {
        "profile": prof_res.data[0],
        "medications": meds_res.data or []
    }
