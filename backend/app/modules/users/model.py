import uuid

from sqlalchemy import Boolean, Column, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    profile_picture_filename = Column(String(255), nullable=True)
    profile_picture_mime_type = Column(String(100), nullable=True)

    @property
    def profile_picture_url(self) -> str | None:
        return f"/users/{self.user_id}/profile-picture" if self.profile_picture_filename else None

    # --- Relationships (string targets: avoids circular imports across modules) ---
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    team_lead = relationship("TeamLead", back_populates="user", uselist=False, cascade="all, delete-orphan")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="assignee")
    generated_sprint_plans = relationship("AISprintPlan", back_populates="generated_by_user")
    generated_documents = relationship("AIDocumentGeneration", back_populates="generated_by_user")
    meeting_summaries = relationship("AIMeetingSummary", back_populates="created_by_user")
    kanban_moves = relationship("KanbanTask", back_populates="moved_by_user")
    organized_calendar_events = relationship("CalendarEvent", back_populates="organizer_user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    generated_reports = relationship("Report", back_populates="generated_by_user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship("LoginHistory", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
