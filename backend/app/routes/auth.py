from fastapi import APIRouter, HTTPException, Depends
from app.models.patient_model import UserRegister, UserLogin
from app.database import supabase, supabase_anon
from app.dependencies import get_current_user

router = APIRouter()

@router.post("/register")
def register_user(user: UserRegister):
    try:
        res = supabase_anon.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {"data": {"full_name": user.full_name, "role": user.role}}
        })
        return {"message": "User registered successfully", "user": res.user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login_user(user: UserLogin):
    try:
        res = supabase_anon.auth.sign_in_with_password({"email": user.email, "password": user.password})
        return {"message": "Login successful", "session": res.session}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    """Return the current user's profile from the profiles table."""
    try:
        res = supabase.table("profiles").select("*").eq("id", current_user.id).maybe_single().execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
