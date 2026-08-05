"""
Constants for the auth module.

Mirrors the token-purpose strings already passed to
`app.modules.auth.service.decode_token()` / `create_token()`, and the
expiry values already computed inline in that module, so both places
can be pointed at the same source of truth.
"""

# ==========================================================
# Token Purposes
# ==========================================================
# Must match the `purpose` values encoded into the JWT payload in
# app.modules.auth.service.create_token()/decode_token().

TOKEN_PURPOSE_ACCESS = "access"
TOKEN_PURPOSE_REFRESH = "refresh"
TOKEN_PURPOSE_PASSWORD_RESET = "password_reset"
TOKEN_PURPOSE_EMAIL_VERIFICATION = "email_verification"

TOKEN_PURPOSES = (
    TOKEN_PURPOSE_ACCESS,
    TOKEN_PURPOSE_REFRESH,
    TOKEN_PURPOSE_PASSWORD_RESET,
    TOKEN_PURPOSE_EMAIL_VERIFICATION,
)


# ==========================================================
# Token Expiry (minutes)
# ==========================================================
# app.core.config.ACCESS_TOKEN_EXPIRE_MINUTES remains the single source
# of truth for the access token; these mirror the derived values already
# computed in app.modules.auth.service.

REFRESH_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_MINUTES = 30
VERIFY_TOKEN_EXPIRE_MINUTES = 60 * 24


# ==========================================================
# Login History
# ==========================================================

MAX_LOGIN_HISTORY_PER_USER = 50
