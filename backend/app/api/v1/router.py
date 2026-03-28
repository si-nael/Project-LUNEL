from fastapi import APIRouter

from app.api.v1 import auth, users, groups, schedules, projects, ratings, visibility_policies

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(ratings.router, tags=["ratings"])
api_router.include_router(
    visibility_policies.router,
    prefix="/visibility-policies",
    tags=["visibility-policies"],
)
