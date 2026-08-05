"""
Constants for the tasks module.
"""

# ==========================================================
# Task Status
# ==========================================================
# `Task.status` defaults to "TODO" (see model.py).

TASK_STATUS_TODO = "TODO"
TASK_STATUS_IN_PROGRESS = "IN_PROGRESS"
TASK_STATUS_IN_REVIEW = "IN_REVIEW"
TASK_STATUS_DONE = "DONE"
TASK_STATUS_BLOCKED = "BLOCKED"
TASK_STATUS_CANCELLED = "CANCELLED"

TASK_STATUSES = (
    TASK_STATUS_TODO,
    TASK_STATUS_IN_PROGRESS,
    TASK_STATUS_IN_REVIEW,
    TASK_STATUS_DONE,
    TASK_STATUS_BLOCKED,
    TASK_STATUS_CANCELLED,
)

DEFAULT_TASK_STATUS = TASK_STATUS_TODO


# ==========================================================
# Task Priority
# ==========================================================
# `Task.priority` defaults to "MEDIUM" (see model.py).

TASK_PRIORITY_LOW = "LOW"
TASK_PRIORITY_MEDIUM = "MEDIUM"
TASK_PRIORITY_HIGH = "HIGH"
TASK_PRIORITY_URGENT = "URGENT"

TASK_PRIORITIES = (
    TASK_PRIORITY_LOW,
    TASK_PRIORITY_MEDIUM,
    TASK_PRIORITY_HIGH,
    TASK_PRIORITY_URGENT,
)

DEFAULT_TASK_PRIORITY = TASK_PRIORITY_MEDIUM


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.tasks.model.Task.task_name (String(255)).

TASK_NAME_MAX_LENGTH = 255
