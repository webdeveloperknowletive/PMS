from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.router import api_router
from app.lifespan import lifespan
from backend.core.logger import logger

from core.config import (
    APP_NAME,
    APP_VERSION,
    APP_DESCRIPTION,
)

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)

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

app.include_router(api_router)

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