import json
import os
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import anthropic
from database import supabase
from auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class Message(BaseModel):
    role: str    # "user" or "assistant"
    content: str


class ChatBody(BaseModel):
    messages: List[Message]


def _build_system_prompt(user_id: str) -> str:
    lines = [
        "You are a knowledgeable, friendly personal fitness AI advisor inside the Kinetic workout app.",
        "Give concise, practical advice. Use bullet points for lists. Be encouraging.",
        "",
    ]

    # Profile context
    profile = (
        supabase.table("profiles")
        .select("full_name, age, weight_kg, height_cm, goal, units")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    p = profile.data or {}
    if p:
        lines.append("## User Profile")
        if p.get("full_name"):   lines.append(f"- Name: {p['full_name']}")
        if p.get("age"):         lines.append(f"- Age: {p['age']}")
        if p.get("weight_kg"):   lines.append(f"- Weight: {p['weight_kg']} kg")
        if p.get("height_cm"):   lines.append(f"- Height: {p['height_cm']} cm")
        if p.get("goal"):        lines.append(f"- Primary goal: {p['goal']}")
        lines.append("")

    # Workout plans context
    plans = (
        supabase.table("workout_plans")
        .select("name, goal, plan_sessions(day_of_week, exercises(name, difficulty, equipment, muscle_groups(name)))")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    if plans.data:
        lines.append("## Current Workout Plans")
        for plan in plans.data:
            plan_label = plan["name"]
            if plan.get("goal"):
                plan_label += f" (goal: {plan['goal']})"
            lines.append(f"\n**{plan_label}**")
            sessions = plan.get("plan_sessions") or []
            by_day: dict = {}
            for s in sessions:
                day = s.get("day_of_week", "?")
                ex = s.get("exercises") or {}
                mg = (ex.get("muscle_groups") or {}).get("name", "")
                entry = f"{ex.get('name', 'Unknown')} ({mg}, {ex.get('difficulty', '')}, {ex.get('equipment', '')})"
                by_day.setdefault(day, []).append(entry)
            for day, exs in by_day.items():
                lines.append(f"  {day}: " + ", ".join(exs))
        lines.append("")

    lines.append("Answer questions about training, recovery, nutrition timing, form tips, and program adjustments based on this context.")
    return "\n".join(lines)


@router.post("/chat")
def chat(body: ChatBody, user=Depends(get_current_user)):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI advisor not configured")

    client = anthropic.Anthropic(api_key=api_key)
    system = _build_system_prompt(user["id"])
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    def generate():
        try:
            with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=1024,
                system=system,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
