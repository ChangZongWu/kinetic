from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth import get_current_user

router = APIRouter()

class CreateExerciseBody(BaseModel):
    name: str
    muscle_group_id: str
    description: Optional[str] = ""
    difficulty: str = "beginner"
    equipment: str = "bodyweight"
    sets_suggestion: Optional[int] = 3
    reps_suggestion: Optional[str] = "10"
    rpe_suggestion: Optional[float] = 7.0

@router.get("/exercises")
def get_exercises(muscle_id: str = None, difficulty: str = None, equipment: str = None, q: str = None):
    query = supabase.table("exercises").select("*, muscle_groups(name, body_region)")
    if muscle_id:
        ids = [i.strip() for i in muscle_id.split(",") if i.strip()]
        if len(ids) == 1:
            query = query.eq("muscle_group_id", ids[0])
        elif len(ids) > 1:
            query = query.in_("muscle_group_id", ids)
    if difficulty:
        query = query.eq("difficulty", difficulty)
    if equipment:
        query = query.eq("equipment", equipment)
    if q:
        query = query.ilike("name", f"%{q}%")
    result = query.execute()
    return result.data

@router.post("/exercises")
def create_exercise(body: CreateExerciseBody, user=Depends(get_current_user)):
    if body.difficulty not in ("beginner", "intermediate", "advanced"):
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    result = supabase.table("exercises").insert({
        "name": body.name,
        "muscle_group_id": body.muscle_group_id,
        "description": body.description,
        "difficulty": body.difficulty,
        "equipment": body.equipment,
        "sets_suggestion": body.sets_suggestion,
        "reps_suggestion": body.reps_suggestion,
        "rpe_suggestion": body.rpe_suggestion,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create exercise")
    created = result.data[0]
    # Fetch with muscle_groups join to match list format
    full = supabase.table("exercises").select("*, muscle_groups(name, body_region)").eq("id", created["id"]).single().execute()
    return full.data

@router.get("/exercises/{exercise_id}")
def get_exercise(exercise_id: str):
    result = supabase.table("exercises").select("*, muscle_groups(name, body_region)").eq("id", exercise_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return result.data