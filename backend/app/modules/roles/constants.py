"""
Constants for the roles module.

These names and descriptions are used only when the database is first
initialized, to provide familiar starting roles. Authorization uses the
permission grants stored for each role, and admins can create other roles.
"""

ROLE_NAME_ADMIN = "Admin"
ROLE_NAME_PROJECT_MANAGER = "Project Manager"
ROLE_NAME_TEAM_LEAD = "Team Lead"
ROLE_NAME_DEVELOPER = "Developer"
ROLE_NAME_TESTER = "Tester"
ROLE_NAME_VIEWER = "Viewer"

DEFAULT_ROLE_NAMES = (
    ROLE_NAME_ADMIN,
    ROLE_NAME_PROJECT_MANAGER,
    ROLE_NAME_TEAM_LEAD,
    ROLE_NAME_DEVELOPER,
    ROLE_NAME_TESTER,
    ROLE_NAME_VIEWER,
)

DEFAULT_ROLE_DESCRIPTIONS = {
    ROLE_NAME_ADMIN: "Full access to every module and administrative action.",
    ROLE_NAME_PROJECT_MANAGER: "Manages projects, teams, workflows, and reporting.",
    ROLE_NAME_TEAM_LEAD: "Leads a team and its day-to-day workflow.",
    ROLE_NAME_DEVELOPER: "Builds and updates assigned tasks.",
    ROLE_NAME_TESTER: "Verifies and reports on task quality.",
    ROLE_NAME_VIEWER: "Read-only access to project data.",
}
