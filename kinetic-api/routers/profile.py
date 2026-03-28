from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


class UpdateProfileBody(BaseModel):
    full_name: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    age: Optional[int] = None
    goal: Optional[str] = None
    units: Optional[str] = None
    fitness_level: Optional[str] = None
    default_rest_timer: Optional[int] = None


@router.get("")
def get_profile(user=Depends(get_current_user)):
    result = supabase.table("profiles").select("*").eq("id", user["id"]).maybe_single().execute()
    return result.data or {}


@router.patch("")
def update_profile(body: UpdateProfileBody, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = (
        supabase.table("profiles")
        .upsert({"id": user["id"], **updates})
        .execute()
    )
    return result.data[0] if result.data else {}
