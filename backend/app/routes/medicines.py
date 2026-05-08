from fastapi import APIRouter, HTTPException, Depends
from app.models.medicine_model import MedicineCreate, MedicineUpdate, DoseLogCreate
from app.database import supabase

router = APIRouter()

@router.get("/")
def get_medicines(user_id: str):
    res = supabase.table("medications").select("*").eq("user_id", user_id).execute()
    return res.data

@router.post("/")
def add_medicine(user_id: str, medicine: MedicineCreate):
    data = {
        "user_id": user_id,
        "name": medicine.medicine_name,
        "dosage": medicine.dosage,
        "times": medicine.timing,
        "notes": medicine.notes,
        "active": True
    }
    res = supabase.table("medications").insert(data).execute()
    return {"message": "Medicine added successfully", "data": res.data}

@router.put("/{medicine_id}")
def update_medicine(medicine_id: str, medicine: MedicineUpdate):
    data = {k: v for k, v in medicine.model_dump().items() if v is not None}
    
    # Map back model keys to DB keys if needed
    if "medicine_name" in data:
        data["name"] = data.pop("medicine_name")
    if "timing" in data:
        data["times"] = data.pop("timing")
        
    res = supabase.table("medications").update(data).eq("id", medicine_id).execute()
    return {"message": "Medicine updated successfully", "data": res.data}

@router.delete("/{medicine_id}")
def delete_medicine(medicine_id: str):
    res = supabase.table("medications").delete().eq("id", medicine_id).execute()
    return {"message": "Medicine deleted successfully"}

@router.post("/log")
def log_dose(user_id: str, log: DoseLogCreate):
    data = {
        "user_id": user_id,
        "medication_id": log.medication_id,
        "scheduled_time": log.scheduled_time,
        "scheduled_date": log.scheduled_date,
        "status": log.status
    }
    res = supabase.table("medication_logs").insert(data).execute()
    return {"message": f"Dose marked as {log.status}", "data": res.data}
