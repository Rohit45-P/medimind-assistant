from fastapi import APIRouter, HTTPException
from app.models.patient_model import UserRegister, UserLogin
from app.database import supabase

router = APIRouter()

@router.post("/register")
def register_user(user: UserRegister):
    try:
        res = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {
                    "full_name": user.full_name,
                    "role": user.role
                }
            }
        })
        return {"message": "User registered successfully", "user": res.user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login_user(user: UserLogin):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        return {"message": "Login successful", "session": res.session}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/logout")
def logout_user(token: str):
    try:
        supabase.auth.sign_out(jwt=token)
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
