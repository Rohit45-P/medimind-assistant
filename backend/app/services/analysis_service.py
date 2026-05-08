from app.database import supabase
from datetime import datetime, timedelta

def get_analytics_for_user(user_id: str):
    """
    Generates health analytics data formatted for Chart.js
    """
    days = []
    for i in range(6, -1, -1):
        d = (datetime.now() - timedelta(days=i)).date().isoformat()
        days.append(d)
        
    logs_res = supabase.table("medication_logs").select("*").eq("user_id", user_id).in_("scheduled_date", days).execute()
    logs = logs_res.data
    
    taken_data = []
    missed_data = []
    
    for day in days:
        taken = sum(1 for l in logs if l['scheduled_date'] == day and l['status'] == 'taken')
        missed = sum(1 for l in logs if l['scheduled_date'] == day and l['status'] == 'missed')
        taken_data.append(taken)
        missed_data.append(missed)
        
    chart_data = {
        "labels": [d[5:] for d in days], # MM-DD
        "datasets": [
            {
                "label": "Taken",
                "data": taken_data,
                "backgroundColor": "hsl(174 62% 42%)"
            },
            {
                "label": "Missed",
                "data": missed_data,
                "backgroundColor": "hsl(0 78% 60%)"
            }
        ]
    }
    
    return chart_data

def generate_doctor_summary(user_id: str):
    """
    Generate a summary of the patient's data for the doctor.
    """
    meds_res = supabase.table("medications").select("*").eq("user_id", user_id).execute()
    symptoms_res = supabase.table("health_logs").select("*").eq("user_id", user_id).eq("type", "symptom").order("created_at", desc=True).limit(10).execute()
    
    adherence = 100 # Default
    try:
        from app.services.reminder_service import check_adherence
        adherence_data = check_adherence(user_id)
        adherence = adherence_data["adherence_percentage"]
        alerts = adherence_data["alerts"]
    except Exception:
        alerts = []
        
    symptoms_list = [s['value'] for s in symptoms_res.data]
    
    # Simple pattern detection
    from collections import Counter
    symptom_counts = Counter(symptoms_list)
    repeated_symptoms = [sym for sym, count in symptom_counts.items() if count >= 3]
    
    if repeated_symptoms:
        alerts.append(f"Suggestion: Patient frequently reported {', '.join(repeated_symptoms)}. Consider consultation.")
        
    return {
        "active_medicines": len(meds_res.data),
        "medicines_list": [{"name": m['name'], "dosage": m.get('dosage')} for m in meds_res.data],
        "recent_symptoms": symptoms_list,
        "adherence_score": adherence,
        "insights_and_alerts": alerts
    }
