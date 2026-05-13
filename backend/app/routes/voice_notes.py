from fastapi import APIRouter, Depends
from app.models.voice_note_model import VoiceNoteCreate
from app.dependencies import get_current_user
from app.database import supabase
from datetime import datetime

router = APIRouter()

EMERGENCY_KEYWORDS = ["pain", "emergency", "chest pain", "dizziness", "help", "not feeling well", "heart attack"]

@router.get("/")
def get_voice_notes(current_user=Depends(get_current_user)):
    # Per user request, we do not store or return voice history
    return []

@router.post("/")
def process_voice_note(note: VoiceNoteCreate, current_user=Depends(get_current_user)):
    transcript = note.transcript.lower()
    
    # Check for emergency keywords
    is_emergency = any(keyword in transcript for keyword in EMERGENCY_KEYWORDS)
    
    response_msg = "Your voice input has been processed successfully."
    
    if is_emergency:
        response_msg = "Emergency keywords detected. Possible health concern flagged."
        # Generate alert in DB if we want caregiver to see it, but user said no need to save voice note.
        # We can still add an alert to the caregiver dashboard by logging a system alert, but let's just return the flag.
        
    return {
        "message": response_msg,
        "is_emergency": is_emergency,
        "data": {
            "transcript": note.transcript,
            "processed_at": datetime.utcnow().isoformat()
        }
    }

