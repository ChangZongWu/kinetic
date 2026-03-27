from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import supabase
from auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


class LogSetBody(BaseModel):
    exercise_id: str
    set_number: int
    reps: Optional[int] = None
    weight_kg: Optional[float] = None


class CreateLogBody(BaseModel):
    plan_id: Optional[str] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    sets: List[LogSetBody] = []


@router.get("")
def list_logs(user=Depends(get_current_user)):
    result = (
        supabase.table("workout_logs")
        .select("*, workout_plans(name), log_sets(*, exercises(name, muscle_groups(name)))")
        .eq("user_id", user["id"])
        .order("logged_at", desc=True)
        .limit(30)
        .execute()
    )
    return result.data


@router.post("")
def create_log(body: CreateLogBody, user=Depends(get_current_user)):
    log_result = (
        supabase.table("workout_logs")
        .insert({
            "user_id": user["id"],
            "plan_id": body.plan_id or None,
            "duration_minutes": body.duration_minutes,
            "notes": body.notes,
        })
        .execute()
    )
    if not log_result.data:
        raise HTTPException(status_code=500, detail="Failed to create log")

    log_id = log_result.data[0]["id"]

    if body.sets:
        sets_data = [
            {
                "log_id": log_id,
                "exercise_id": s.exercise_id,
                "set_number": s.set_number,
                "reps": s.reps,
                "weight_kg": s.weight_kg,
            }
            for s in body.sets
        ]
        supabase.table("log_sets").insert(sets_data).execute()

    full = (
        supabase.table("workout_logs")
        .select("*, workout_plans(name), log_sets(*, exercises(name, muscle_groups(name)))")
        .eq("id", log_id)
        .single()
        .execute()
    )
    return full.data


@router.delete("/{log_id}")
def delete_log(log_id: str, user=Depends(get_current_user)):
    log = (
        supabase.table("workout_logs")
        .select("id")
        .eq("id", log_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    if not log.data:
        raise HTTPException(status_code=404, detail="Log not found")
    supabase.table("workout_logs").delete().eq("id", log_id).execute()
    return {"deleted": True}
