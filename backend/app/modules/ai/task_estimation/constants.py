"""
Constants for the ai.task_estimation module.
"""

from app.shared.constants import LEVEL_HIGH, LEVEL_LOW, LEVEL_MEDIUM, RISK_COMPLEXITY_LEVELS

# ==========================================================
# Complexity
# ==========================================================
# Matches `ck_ai_task_estimations_complexity`: Low | Medium | High.

COMPLEXITY_LOW = LEVEL_LOW
COMPLEXITY_MEDIUM = LEVEL_MEDIUM
COMPLEXITY_HIGH = LEVEL_HIGH

COMPLEXITY_LEVELS = RISK_COMPLEXITY_LEVELS


# ==========================================================
# Validation
# ==========================================================
# Matches the ai_task_estimations CHECK constraints (hours/cost/story
# points non-negative, confidence 0-100).

ESTIMATED_HOURS_MIN = 0
ESTIMATED_COST_MIN = 0
STORY_POINTS_MIN = 0
CONFIDENCE_SCORE_MIN = 0
CONFIDENCE_SCORE_MAX = 100
