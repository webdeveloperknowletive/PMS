"""
Top-level API router.

Aggregates every module's own `router` (each already carries its own
`prefix` and `tags`, see e.g. app.modules.projects.router) into a single
`api_router`. `app.main` mounts this once, under `API_V1_PREFIX`:

    from app.router import api_router
    app.include_router(api_router, prefix=API_V1_PREFIX)

Add a new module here by importing its `router` and calling
`api_router.include_router(...)` — nothing else needs to change in
`app.main`.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.roles.router import router as roles_router
from app.modules.projects.router import router as projects_router
from app.modules.teams.router import router as teams_router
from app.modules.tasks.router import router as tasks_router
from app.modules.workflow.router import router as workflow_router
from app.modules.kanban.router import router as kanban_router
from app.modules.gantt.router import router as gantt_router
from app.modules.milestones.router import router as milestones_router
from app.modules.calendar.router import router as calendar_router
from app.modules.documentation.router import router as documentation_router
from app.modules.notifications.router import router as notifications_router
from app.modules.reports.router import router as reports_router
from app.modules.ai.sprint_planning.router import router as ai_sprint_planning_router
from app.modules.ai.risk_prediction.router import router as ai_risk_prediction_router
from app.modules.ai.doc_generator.router import router as ai_doc_generator_router
from app.modules.ai.task_estimation.router import router as ai_task_estimation_router
from app.modules.ai.meeting_summary.router import router as ai_meeting_summary_router

api_router = APIRouter()

# ==========================================================
# Core Modules
# ==========================================================

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(roles_router)

# ==========================================================
# Project Management Modules
# ==========================================================

api_router.include_router(projects_router)
api_router.include_router(teams_router)
api_router.include_router(tasks_router)
api_router.include_router(workflow_router)

# ==========================================================
# Planning & Tracking Modules
# ==========================================================

api_router.include_router(kanban_router)
api_router.include_router(gantt_router)
api_router.include_router(milestones_router)
api_router.include_router(calendar_router)

# ==========================================================
# Collaboration Modules
# ==========================================================

api_router.include_router(documentation_router)
api_router.include_router(notifications_router)
api_router.include_router(reports_router)

# ==========================================================
# AI Modules
# ==========================================================

api_router.include_router(ai_sprint_planning_router)
api_router.include_router(ai_risk_prediction_router)
api_router.include_router(ai_doc_generator_router)
api_router.include_router(ai_task_estimation_router)
api_router.include_router(ai_meeting_summary_router)
