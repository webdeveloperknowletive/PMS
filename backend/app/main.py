from uuid import UUID

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.router import api_router
from app.lifespan import lifespan
from app.core.logger import logger
from db.session import SessionLocal
from app.modules.audit.model import AuditEvent

from app.core.exceptions import register_exception_handlers

from app.core.config import (
    APP_NAME,
    APP_VERSION,
    APP_DESCRIPTION,
    API_V1_PREFIX,
    APP_ENV,
    ALLOW_ORIGINS,
    WORKSPACE_ORIGIN_REGEX,
)

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=()")
    if APP_ENV == "production" and request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.middleware("http")
async def log_user_changes(request: Request, call_next):
    """Log authenticated API writes to the application log and workspace audit table."""
    response_status = 500
    try:
        response = await call_next(request)
        response_status = response.status_code
        return response
    finally:
        is_task_reminder_poll = request.url.path.endswith("/tasks/deadline-reminders/check")
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith(f"{API_V1_PREFIX}/") and not request.url.path.startswith(f"{API_V1_PREFIX}/auth/") and not is_task_reminder_poll:
            actor = getattr(request.state, "audit_actor", None)
            organization_id = getattr(request.state, "audit_organization_id", None)
            actor_id = getattr(request.state, "audit_actor_id", None)
            if actor and organization_id and actor_id:
                roles = ", ".join(getattr(request.state, "audit_roles", [])) or "User"
                logger.info(
                    "AUDIT status=%s action=%s path=%s organization_id=%s actor=%r roles=(%s)",
                    response_status,
                    request.method,
                    request.url.path,
                    organization_id,
                    actor,
                    roles,
                )
                try:
                    with SessionLocal() as audit_db:
                        audit_db.add(AuditEvent(
                            organization_id=UUID(organization_id),
                            actor_id=UUID(actor_id),
                            actor_name=actor,
                            actor_roles=roles[:500],
                            method=request.method,
                            path=request.url.path[:500],
                            status_code=response_status,
                        ))
                        audit_db.commit()
                except Exception:
                    logger.exception("Could not persist workspace audit event for %s %s", request.method, request.url.path)

register_exception_handlers(app)

# ==========================================================
# CORS Middleware
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_origin_regex=WORKSPACE_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# Register API Routes
# ==========================================================
print(f"API_V1_PREFIX = '{API_V1_PREFIX}'")

app.include_router(api_router, prefix=API_V1_PREFIX)

# ==========================================================
# Root Endpoint
# ==========================================================

@app.get(
    "/",
    tags=["Root"],
    summary="Welcome API",
)
async def root():
    logger.info("Root API called.")

    return {
        "success": True,
        "application": APP_NAME,
        "version": APP_VERSION,
        "message": f"Welcome to {APP_NAME}",
        "docs": "/docs",
        "redoc": "/redoc",
    }


# ==========================================================
# Health Check
# ==========================================================

@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
)
async def health_check():
    return {
        "success": True,
        "status": "Healthy",
    }
