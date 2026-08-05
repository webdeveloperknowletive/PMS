"""
Constants for the kanban module.
"""

# ==========================================================
# Default Board Layout
# ==========================================================
# Used by service.py when auto-provisioning a board's starting columns
# for a new project (project_id + position must stay unique, per
# `uq_kanban_columns_project_position`).

DEFAULT_COLUMN_NAMES = (
    "To Do",
    "In Progress",
    "In Review",
    "Done",
)

DEFAULT_COLUMN_COLORS = {
    "To Do": "#94A3B8",
    "In Progress": "#3B82F6",
    "In Review": "#F59E0B",
    "Done": "#22C55E",
}


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.kanban.model.KanbanColumn.column_name (String(100)).

COLUMN_NAME_MAX_LENGTH = 100
COLUMN_COLOR_MAX_LENGTH = 20
FIRST_COLUMN_POSITION = 0
