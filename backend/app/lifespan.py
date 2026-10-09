"""
==========================================================
                APPLICATION LIFESPAN
==========================================================

Startup/shutdown hook for the FastAPI app, wired in via:

    from app.lifespan import lifespan
    app = FastAPI(..., lifespan=lifespan)

Startup:
    - Logs that the app is starting.
    - Verifies the database is reachable, so the app fails fast at
      boot instead of serving requests against a dead database.

Shutdown:
    - Disposes the SQLAlchemy engine's connection pool.
    - Logs that the app has stopped.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.core.database import engine
from app.core.logger import logger
from app.core.config import APP_NAME
from app.modules.roles.bootstrap import initialize_role_permissions
from app.modules.documentation.bootstrap import ensure_document_resource_schema
from app.modules.notifications.bootstrap import ensure_notification_settings
from app.modules.users.bootstrap import ensure_user_profile_schema
from app.modules.chat.bootstrap import ensure_chat_schema

# ==========================================================
# Lifespan Context Manager
# ==========================================================


@asynccontextmanager
async def lifespan(app: FastAPI):

    # ---------------------------------------------------------------
    # Startup
    # ---------------------------------------------------------------

    logger.info(f"Starting {APP_NAME} ...")

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        initialize_role_permissions()
        ensure_document_resource_schema()
        ensure_notification_settings()
        ensure_user_profile_schema()
        ensure_chat_schema()

        logger.info("Database connection established.")

    except Exception as exc:
        logger.error(f"Database connection failed: {exc}")
        raise

    yield

    # ---------------------------------------------------------------
    # Shutdown
    # ---------------------------------------------------------------

    logger.info(f"Shutting down {APP_NAME} ...")

    engine.dispose()

    logger.info("Database connections closed.")
