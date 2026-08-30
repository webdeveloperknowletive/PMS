"""
Constants for the projects module.
"""

from app.shared.constants import STATUS_ACTIVE, STATUS_ARCHIVED

# ==========================================================
# Project Status
# ==========================================================
# `Project.status` defaults to "ACTIVE" (see model.py) and has no DB-level
# CHECK constraint, so this is the application-level source of truth.
# Enforced via ProjectBase's field_validator in schema.py.

PROJECT_STATUS_ACTIVE = STATUS_ACTIVE
PROJECT_STATUS_COMPLETED = "COMPLETED"
PROJECT_STATUS_ON_HOLD = "ON_HOLD"
PROJECT_STATUS_ARCHIVED = STATUS_ARCHIVED

PROJECT_STATUSES = (
    PROJECT_STATUS_ACTIVE,
    PROJECT_STATUS_COMPLETED,
    PROJECT_STATUS_ON_HOLD,
    PROJECT_STATUS_ARCHIVED,
)

DEFAULT_PROJECT_STATUS = PROJECT_STATUS_ACTIVE


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.projects.model.Project.project_name (String(200)).

PROJECT_NAME_MAX_LENGTH = 200
