"""
Constants for the teams module.
"""

from app.shared.constants import STATUS_ACTIVE, STATUS_ARCHIVED, STATUS_INACTIVE

# ==========================================================
# Team Status
# ==========================================================
# `Team.status` defaults to "ACTIVE" (see model.py).

TEAM_STATUS_ACTIVE = STATUS_ACTIVE
TEAM_STATUS_INACTIVE = STATUS_INACTIVE
TEAM_STATUS_ARCHIVED = STATUS_ARCHIVED

TEAM_STATUSES = (
    TEAM_STATUS_ACTIVE,
    TEAM_STATUS_INACTIVE,
    TEAM_STATUS_ARCHIVED,
)

DEFAULT_TEAM_STATUS = TEAM_STATUS_ACTIVE


# ==========================================================
# Team Sizing
# ==========================================================
# Matches app.modules.teams.model.Team.max_members (default=10) and its
# `ck_teams_max_members_positive` CHECK constraint.

DEFAULT_MAX_MEMBERS = 10
MIN_MAX_MEMBERS = 1


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.teams.model.Team.team_name (String(150)).

TEAM_NAME_MAX_LENGTH = 150
RESPONSIBILITY_MAX_LENGTH = 100
