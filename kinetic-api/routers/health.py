from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": "Kinetic Workout API",
        "version": "1.0.0"
    }