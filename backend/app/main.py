from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Import routes
from app.routes import auth, medicines, patients, caregiver, analytics

load_dotenv()

app = FastAPI(
    title="MediRecall Backend API",
    description="Backend API for Digital Memory Assistant for Patients",
    version="1.0.0"
)

# Setup CORS
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:8080",  # Adding Vite's default dev server port if different
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(medicines.router, prefix="/api/medicines", tags=["Medicines"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(caregiver.router, prefix="/api/caregiver", tags=["Caregiver"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

@app.get("/")
def read_root():
    return {"message": "Welcome to MediRecall API"}
