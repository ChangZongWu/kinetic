from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth import get_current_user

router = APIRouter(prefix="/plans", tags=["session_sets"])


class SetBody(BaseModel):
    set_number: int
    reps: Optional[int] = None
    weight_kg: Optional[float] = None


class UpdateSetBody(BaseModel):
    reps: Optional[int] = None
    weight_kg: Optional[float] = None


def _verify_plan_ownership(plan_id: str, user_id: str):
    plan = (
        supabase.table("workout_plans")
        .select("id")
        .eq("id", plan_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not plan.data:
        raise HTTPException(status_code=404, detail="Plan not found")


@router.get("/{plan_id}/sessions/{session_id}/sets")
def list_sets(plan_id: str, session_id: str, user=Depends(get_current_user)):
    _verify_plan_ownership(plan_id, user["id"])
    result = (
        supabase.table("session_sets")
        .select("*")
        .eq("session_id", session_id)
        .order("set_number")
        .execute()
    )
    return result.data


@router.post("/{plan_id}/sessions/{session_id}/sets")
def add_set(plan_id: str, session_id: str, body: SetBody, user=Depends(get_current_user)):
    _verify_plan_ownership(plan_id, user["id"])
    result = (
        supabase.table("session_sets")
        .insert({
            "session_id": session_id,
            "set_number": body.set_number,
            "reps": body.reps,
            "weight_kg": body.weight_kg,
        })
        .execute()
    )
    return result.data[0]


@router.patch("/{plan_id}/sessions/{session_id}/sets/{set_id}")
def update_set(plan_id: str, session_id: str, set_id: str, body: UpdateSetBody, user=Depends(get_current_user)):
    _verify_plan_ownership(plan_id, user["id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = (
        supabase.table("session_sets")
        .update(updates)
        .eq("id", set_id)
        .eq("session_id", session_id)
        .execute()
    )
    return result.data[0] if result.data else {}


@router.delete("/{plan_id}/sessions/{session_id}/sets/{set_id}")
def delete_set(plan_id: str, session_id: str, set_id: str, user=Depends(get_current_user)):
    _verify_plan_ownership(plan_id, user["id"])
    result = (
        supabase.table("session_sets")
        .delete()
        .eq("id", set_id)
        .eq("session_id", session_id)
        .execute()
    )
    return {"deleted": len(result.data) > 0}
