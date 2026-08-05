"""
Constants for the workflow module.
"""

from app.shared.constants import STATUS_ACTIVE, STATUS_ARCHIVED, STATUS_INACTIVE

# ==========================================================
# Workflow Status
# ==========================================================
# `Workflow.status` defaults to "ACTIVE" (see model.py).

WORKFLOW_STATUS_ACTIVE = STATUS_ACTIVE
WORKFLOW_STATUS_INACTIVE = STATUS_INACTIVE
WORKFLOW_STATUS_ARCHIVED = STATUS_ARCHIVED

WORKFLOW_STATUSES = (
    WORKFLOW_STATUS_ACTIVE,
    WORKFLOW_STATUS_INACTIVE,
    WORKFLOW_STATUS_ARCHIVED,
)

DEFAULT_WORKFLOW_STATUS = WORKFLOW_STATUS_ACTIVE


# ==========================================================
# Workflow Type
# ==========================================================
# `Workflow.workflow_type` defaults to "Task Workflow" (see model.py).

WORKFLOW_TYPE_TASK = "Task Workflow"
WORKFLOW_TYPE_APPROVAL = "Approval Workflow"
WORKFLOW_TYPE_REVIEW = "Review Workflow"

WORKFLOW_TYPES = (
    WORKFLOW_TYPE_TASK,
    WORKFLOW_TYPE_APPROVAL,
    WORKFLOW_TYPE_REVIEW,
)

DEFAULT_WORKFLOW_TYPE = WORKFLOW_TYPE_TASK


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.workflow.model.Workflow.workflow_name (String(100)).

WORKFLOW_NAME_MAX_LENGTH = 100
WORKFLOW_TYPE_MAX_LENGTH = 50
