"""
Constants for the ai.sprint_planning module.
"""

# ==========================================================
# Status
# ==========================================================
# `AISprintPlan.status` defaults to "Generated" (see model.py).

SPRINT_PLAN_STATUS_GENERATED = "Generated"
SPRINT_PLAN_STATUS_REVIEWED = "Reviewed"
SPRINT_PLAN_STATUS_APPROVED = "Approved"
SPRINT_PLAN_STATUS_REJECTED = "Rejected"

SPRINT_PLAN_STATUSES = (
    SPRINT_PLAN_STATUS_GENERATED,
    SPRINT_PLAN_STATUS_REVIEWED,
    SPRINT_PLAN_STATUS_APPROVED,
    SPRINT_PLAN_STATUS_REJECTED,
)

DEFAULT_SPRINT_PLAN_STATUS = SPRINT_PLAN_STATUS_GENERATED


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.ai.sprint_planning.model.AISprintPlan
# (sprint_duration_days > 0, confidence_score between 0 and 100).

MIN_SPRINT_DURATION_DAYS = 1
CONFIDENCE_SCORE_MIN = 0
CONFIDENCE_SCORE_MAX = 100
