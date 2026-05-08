from fastapi import APIRouter, HTTPException, Depends
from app.models.medicine_model import MedicineCreate, MedicineUpdate, DoseLogCreate
from app.database import supabase
from app.dependencies import get_current_user

router = APIRouter()

@router.get("/")
def get_medicines(current_user=Depends(get_current_user)):
    res = supabase.table("medications").select("*").eq("user_id", current_user.id).execute()
    return res.data

@router.post("/")
def add_medicine(medicine: MedicineCreate, current_user=Depends(get_current_user)):
    data = {
        "user_id": current_user.id,
        "name": medicine.medicine_name,
        "dosage": medicine.dosage,
        "times": medicine.timing,
        "notes": medicine.notes,
        "active": True
    }
    res = supabase.table("medications").insert(data).execute()
    return {"message": "Medicine added successfully", "data": res.data}

@router.put("/{medicine_id}")
def update_medicine(medicine_id: str, medicine: MedicineUpdate, current_user=Depends(get_current_user)):
    data = {k: v for k, v in medicine.model_dump().items() if v is not None}
    if "medicine_name" in data:
        data["name"] = data.pop("medicine_name")
    if "timing" in data:
        data["times"] = data.pop("timing")
    res = supabase.table("medications").update(data).eq("id", medicine_id).eq("user_id", current_user.id).execute()
    return {"message": "Medicine updated successfully", "data": res.data}

@router.delete("/{medicine_id}")
def delete_medicine(medicine_id: str, current_user=Depends(get_current_user)):
    supabase.table("medications").delete().eq("id", medicine_id).eq("user_id", current_user.id).execute()
    return {"message": "Medicine deleted successfully"}

@router.get("/logs")
def get_logs(since: str = None, limit: int = 500, current_user=Depends(get_current_user)):
    query = supabase.table("medication_logs").select("*").eq("user_id", current_user.id)
    if since:
        query = query.gte("scheduled_date", since)
    res = query.limit(limit).execute()
    return res.data

@router.post("/log")
def log_dose(log: DoseLogCreate, current_user=Depends(get_current_user)):
    data = {
        "user_id": current_user.id,
        "medication_id": log.medication_id,
        "scheduled_time": log.scheduled_time,
        "scheduled_date": log.scheduled_date,
        "status": log.status
    }
    res = supabase.table("medication_logs").insert(data).execute()
    return {"message": f"Dose marked as {log.status}", "data": res.data}
