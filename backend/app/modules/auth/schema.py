from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ==========================================================
# Refresh Token
# ==========================================================

class RefreshTokenBase(BaseModel):
    user_id: UUID
    token: str
    expires_at: datetime
    is_revoked: bool = False


class RefreshTokenCreate(RefreshTokenBase):
    pass


class RefreshTokenUpdate(BaseModel):
    is_revoked: bool | None = None


class RefreshTokenRead(RefreshTokenBase):
    refresh_token_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Password Reset Token
# ==========================================================

class PasswordResetTokenBase(BaseModel):
    user_id: UUID
    token: str
    expires_at: datetime
    is_used: bool = False


class PasswordResetTokenCreate(PasswordResetTokenBase):
    pass


class PasswordResetTokenUpdate(BaseModel):
    is_used: bool | None = None


class PasswordResetTokenRead(PasswordResetTokenBase):
    password_reset_token_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Email Verification Token
# ==========================================================

class EmailVerificationTokenBase(BaseModel):
    user_id: UUID
    token: str
    expires_at: datetime
    is_used: bool = False


class EmailVerificationTokenCreate(EmailVerificationTokenBase):
    pass


class EmailVerificationTokenUpdate(BaseModel):
    is_used: bool | None = None


class EmailVerificationTokenRead(EmailVerificationTokenBase):
    email_verification_token_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Login History
# ==========================================================

class LoginHistoryBase(BaseModel):
    user_id: UUID
    ip_address: str | None = None
    user_agent: str | None = None
    is_successful: bool = True


class LoginHistoryCreate(LoginHistoryBase):
    pass


class LoginHistoryUpdate(BaseModel):
    logout_time: datetime | None = None


class LoginHistoryRead(LoginHistoryBase):
    login_history_id: UUID
    login_time: datetime
    logout_time: datetime | None = None

    model_config = ConfigDict(from_attributes=True)