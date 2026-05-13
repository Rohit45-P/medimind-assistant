from fastapi import APIRouter, Depends
from app.database import supabase
from app.dependencies import get_current_user

router = APIRouter()

@router.get("")
def get_health_logs(since: str = None, limit: int = 200, current_user=Depends(get_current_user)):
    query = supabase.table("health_logs").select("*").eq("user_id", current_user.id)
    if since:
        query = query.gte("created_at", since)
    res = query.order("created_at", desc=True).limit(limit).execute()
    return res.data
