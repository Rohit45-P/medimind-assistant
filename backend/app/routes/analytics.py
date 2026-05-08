from fastapi import APIRouter
from app.services.analysis_service import get_analytics_for_user, generate_doctor_summary

router = APIRouter()

@router.get("/{user_id}/chart-data")
def get_chart_data(user_id: str):
    chart_data = get_analytics_for_user(user_id)
    return chart_data

@router.get("/{user_id}/doctor-summary")
def get_doctor_summary(user_id: str):
    summary = generate_doctor_summary(user_id)
    return summary
