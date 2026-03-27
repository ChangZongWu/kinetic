from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth import get_current_user

router = APIRouter(prefix="/plans", tags=["plans"])


# ── Models ────────────────────────────────────────────────────────────────────

VALID_GOALS = {"strength", "hypertrophy", "endurance", "fat_loss"}

class CreatePlanBody(BaseModel):
    name: str
    goal: Optional[str] = None  # must be one of VALID_GOALS or None

VALID_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}

class AddSessionBody(BaseModel):
    exercise_id: str
    day_of_week: str          # "Mon" … "Sun"
    is_rest_day: bool = False

class UpdateSessionBody(BaseModel):
    day_of_week: Optional[str] = None
    is_rest_day: Optional[bool] = None


# ── Plan endpoints ─────────────────────────────────────────────────────────────

@router.get("")
def list_plans(user=Depends(get_current_user)):
    result = (
        supabase.table("workout_plans")
        .select("*, plan_sessions(*, exercises(name, difficulty, equipment, sets_suggestion, reps_suggestion, muscle_groups(name)))")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("")
def create_plan(body: CreatePlanBody, user=Depends(get_current_user)):
    goal = body.goal if body.goal in VALID_GOALS else None
    result = (
        supabase.table("workout_plans")
        .insert({"user_id": user["id"], "name": body.name, "goal": goal})
        .execute()
    )
    return result.data[0] if result.data else {}


@router.get("/{plan_id}")
def get_plan(plan_id: str, user=Depends(get_current_user)):
    result = (
        supabase.table("workout_plans")
        .select("*, plan_sessions(*, exercises(*, muscle_groups(name)))")
        .eq("id", plan_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result.data


@router.delete("/{plan_id}")
def delete_plan(plan_id: str, user=Depends(get_current_user)):
    result = (
        supabase.table("workout_plans")
        .delete()
        .eq("id", plan_id)
        .eq("user_id", user["id"])
        .execute()
    )
    return {"deleted": len(result.data) > 0}


# ── Session (exercise assignment) endpoints ────────────────────────────────────

@router.post("/{plan_id}/sessions")
def add_session(plan_id: str, body: AddSessionBody, user=Depends(get_current_user)):
    # Verify ownership
    plan = supabase.table("workout_plans").select("id").eq("id", plan_id).eq("user_id", user["id"]).single().execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    result = (
        supabase.table("plan_sessions")
        .insert({
            "plan_id": plan_id,
            "exercise_id": body.exercise_id,
            "day_of_week": body.day_of_week,
            "is_rest_day": body.is_rest_day,
        })
        .execute()
    )
    return result.data[0]


@router.patch("/{plan_id}/sessions/{session_id}")
def update_session(plan_id: str, session_id: str, body: UpdateSessionBody, user=Depends(get_current_user)):
    plan = supabase.table("workout_plans").select("id").eq("id", plan_id).eq("user_id", user["id"]).single().execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = supabase.table("plan_sessions").update(updates).eq("id", session_id).eq("plan_id", plan_id).execute()
    return result.data[0] if result.data else {}


@router.delete("/{plan_id}/sessions/{session_id}")
def delete_session(plan_id: str, session_id: str, user=Depends(get_current_user)):
    plan = supabase.table("workout_plans").select("id").eq("id", plan_id).eq("user_id", user["id"]).single().execute()
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    result = supabase.table("plan_sessions").delete().eq("id", session_id).eq("plan_id", plan_id).execute()
    return {"deleted": len(result.data) > 0}
