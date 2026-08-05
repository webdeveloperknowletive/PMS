"""
Constants for the users module.
"""

# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.users.schema.UserCreate.password (min_length=8)
# and UserBase.name / UserBase.email (max_length).

PASSWORD_MIN_LENGTH = 8
NAME_MAX_LENGTH = 150
EMAIL_MAX_LENGTH = 255


# ==========================================================
# Defaults
# ==========================================================

DEFAULT_IS_ACTIVE = True
