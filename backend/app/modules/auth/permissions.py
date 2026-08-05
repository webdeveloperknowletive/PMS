"""
Permissions for the auth module.

Registration, login, token refresh and the password-reset flow are all
deliberately public (an unauthenticated caller must be able to reach
them). Only the endpoints that act on an already-established session
(logout, "who am I", changing your own password) require an
authenticated user, which `app.core.dependencies.get_current_user`
already provides. There is no role gating in this module: role checks
start downstream, once a user actually has a session.
"""

from app.core.dependencies import get_current_active_user, get_current_user

# ==========================================================
# Public Endpoints
# ==========================================================
# No authentication required. Listed here (rather than only implied by
# omission in the router) so it is explicit which auth endpoints are
# intentionally open.

PUBLIC_AUTH_ENDPOINTS = (
    "register",
    "login",
    "refresh_token",
    "forgot_password",
    "reset_password",
    "verify_email",
)


# ==========================================================
# Authenticated-Session Dependency
# ==========================================================
# Re-exported under a module-local name so auth's router can express
# "must already be logged in" without reaching into app.core directly.

require_authenticated_session = get_current_user
require_active_session = get_current_active_user
