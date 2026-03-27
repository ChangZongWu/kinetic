from fastapi import APIRouter, HTTPException
from database import supabase

router = APIRouter()

@router.get("/muscles")
def get_muscles():
    result = supabase.table("muscle_groups").select("*").execute()
    return result.data

@router.get("/muscles/{muscle_id}")
def get_muscle(muscle_id: str):
    result = supabase.table("muscle_groups").select("*").eq("id", muscle_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Muscle group not found")
    return result.data