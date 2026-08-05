"""
Constants for the gantt module.
"""

from decimal import Decimal

# ==========================================================
# Progress
# ==========================================================
# Matches app.modules.gantt.model.GanttTask.progress (Numeric(5, 2),
# default=0) and the schema's `Field(0, ge=0, le=100)` bound.

DEFAULT_PROGRESS = Decimal("0")
PROGRESS_MIN = Decimal("0")
PROGRESS_MAX = Decimal("100")
PROGRESS_COMPLETE = Decimal("100")
