from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.router import api_router
from app.lifespan import lifespan
from app.core.logger import logger

from app.core.exceptions import register_exception_handlers

from app.core.config import (
    APP_NAME,
    APP_VERSION,
    APP_DESCRIPTION,
    API_V1_PREFIX,
)

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)


@app.middleware("http")
async def log_user_changes(request: Request, call_next):
    """Write authenticated create/update/delete requests to application.log."""
    response = await call_next(request)
    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and request.url.path.startswith(f"{API_V1_PREFIX}/")
        and not request.url.path.startswith(f"{API_V1_PREFIX}/auth/")
    ):
        actor = getattr(request.state, "audit_actor", None)
        if actor:
            roles = ", ".join(getattr(request.state, "audit_roles", [])) or "User"
            logger.info(
                "AUDIT status=%s action=%s path=%s actor=%r roles=(%s)",
                response.status_code,
                request.method,
                request.url.path,
                actor,
                roles,
            )
    return response

register_exception_handlers(app)

# ==========================================================
# CORS Middleware
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Change in Production
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
