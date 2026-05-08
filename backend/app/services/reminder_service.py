from app.database import supabase
from datetime import datetime, timedelta

def check_adherence(user_id: str):
    """
    Check if a patient has missed multiple doses recently.
    """
    seven_days_ago = (datetime.now() - timedelta(days=7)).date().isoformat()
    
    response = supabase.table("medication_logs").select("*").eq("user_id", user_id).gte("scheduled_date", seven_days_ago).execute()
    logs = response.data
    
    missed_count = sum(1 for log in logs if log['status'] == 'missed')
    taken_count = sum(1 for log in logs if log['status'] == 'taken')
    total = missed_count + taken_count
    
    adherence_percentage = (taken_count / total * 100) if total > 0 else 100
    
    alerts = []
    if missed_count > 3:
        alerts.append("High Risk: You missed medicine more than 3 times this week.")
    
    if adherence_percentage < 50 and total > 0:
        alerts.append("Warning: Your adherence is below 50%. Please stick to your schedule.")
        
    return {
        "missed_count": missed_count,
        "taken_count": taken_count,
        "adherence_percentage": round(adherence_percentage, 2),
        "alerts": alerts
    }
