from pydantic import BaseModel
from typing import Optional

class VoiceNoteCreate(BaseModel):
    transcript: str

class VoiceNoteResponse(BaseModel):
    id: str
    user_id: str
    transcript: str
    is_emergency: bool
    created_at: str
