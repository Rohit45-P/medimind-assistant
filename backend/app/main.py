from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.routes import auth, medicines, patients, caregiver, analytics
from app.routes import health_logs, public, voice_notes

load_dotenv()

app = FastAPI(
    title="MediRecall Backend API",
    description="Backend API for Digital Memory Assistant for Patients",
    version="1.0.0"
)

origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(medicines.router, prefix="/api/medications", tags=["Medications"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(caregiver.router, prefix="/api/caregiver", tags=["Caregiver"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(health_logs.router, prefix="/api/health-logs", tags=["Health Logs"])
app.include_router(public.router, prefix="/api/public", tags=["Public"])
app.include_router(voice_notes.router, prefix="/api/voice-notes", tags=["Voice Notes"])

@app.get("/")
def read_root():
    return {"message": "Welcome to MediRecall API"}
