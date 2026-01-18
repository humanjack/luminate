from fastapi import APIRouter
from app.api.v1 import projects, llm, settings, init

router = APIRouter()

router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(llm.router, prefix="/llm", tags=["llm"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(init.router, tags=["init"])
