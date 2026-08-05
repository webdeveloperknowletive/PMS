"""
Constants for the ai.risk_prediction module.
"""

from app.shared.constants import (
    CONFIDENCE_SCORE_MAX as CONFIDENCE_SCORE_MAX,
    CONFIDENCE_SCORE_MIN as CONFIDENCE_SCORE_MIN,
    LEVEL_HIGH,
    LEVEL_LOW,
    LEVEL_MEDIUM,
    RISK_COMPLEXITY_LEVELS,
)

# ==========================================================
# Risk Level
# ==========================================================
# Matches `ck_ai_risk_predictions_risk_level`: Low | Medium | High.

RISK_LEVEL_LOW = LEVEL_LOW
RISK_LEVEL_MEDIUM = LEVEL_MEDIUM
RISK_LEVEL_HIGH = LEVEL_HIGH

RISK_LEVELS = RISK_COMPLEXITY_LEVELS


# ==========================================================
# Validation
# ==========================================================
# Matches `ck_ai_risk_predictions_probability_range` and
# `ck_ai_risk_predictions_confidence_range` (both 0-100).

PROBABILITY_MIN = 0
PROBABILITY_MAX = 100
