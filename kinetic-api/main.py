from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import health, muscles, exercises, plans, profile, session_sets, ai, logs

app = FastAPI(title="Kinetic Workout API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(muscles.router)
app.include_router(exercises.router)
app.include_router(plans.router)
app.include_router(profile.router)
app.include_router(session_sets.router)
app.include_router(ai.router)
app.include_router(logs.router)
