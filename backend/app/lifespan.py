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
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI
from sqlalchemy import text

from app.core.database import engine
from app.core.logger import logger
from app.core.config import APP_NAME
from app.modules.roles.bootstrap import initialize_role_permissions
from app.modules.organizations.bootstrap import get_default_organization_id
from db.session import SessionLocal
from app.modules.users.model import User

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

        # No customer workspace is valid immediately after a platform reset;
        # migrations are already checked separately by deployment tooling.
        get_default_organization_id()
        initialize_role_permissions()

        logger.info("Database connection established.")

    except Exception as exc:
        logger.error(f"Database connection failed: {exc}")
        raise

    reminder_task = asyncio.create_task(_run_task_deadline_reminders(), name="task-deadline-reminders")
    try:
        yield
    finally:
        reminder_task.cancel()
        try:
            await reminder_task
        except asyncio.CancelledError:
            pass

    # ---------------------------------------------------------------
    # Shutdown
    # ---------------------------------------------------------------

    logger.info(f"Shutting down {APP_NAME} ...")

    engine.dispose()

    logger.info("Database connections closed.")


async def _run_task_deadline_reminders() -> None:
    """Run reminder checks even while workspace users have their browsers closed.

    The delivery table's unique key makes multiple API worker processes safe:
    only the worker that reserves a reminder sends it.
    """
    while True:
        await asyncio.sleep(60)
        await asyncio.to_thread(_run_task_deadline_reminder_cycle)


def _run_task_deadline_reminder_cycle() -> None:
    local_date = datetime.now(timezone.utc).date()
    try:
        with SessionLocal() as db:
            users = db.query(User).filter(User.is_active.is_(True)).all()
            for user in users:
                try:
                    db.info["organization_id"] = user.organization_id
                    from app.modules.tasks.service import deliver_task_deadline_reminders
                    deliver_task_deadline_reminders(db, user, local_date)
                except Exception:
                    db.rollback()
                    logger.exception("Scheduled task deadline reminder failed for user %s", user.user_id)
    except Exception:
        logger.exception("Could not run the scheduled task deadline reminder check")
