import uuid

from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import CreatedAtMixin, TimestampMixin


class TeamLead(Base, CreatedAtMixin):
    """One-to-one extension of users: only promoted users get a row here."""

    __tablename__ = "team_leads"

    team_lead_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # enforces 1:1 with users
    )

    user = relationship("User", back_populates="team_lead")
    teams_led = relationship("Team", back_populates="team_lead")
    workflows = relationship("Workflow", back_populates="team_lead")

    def __repr__(self) -> str:
        return f"<TeamLead user_id={self.user_id}>"


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    team_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    team_lead_id = Column(
        UUID(as_uuid=True),
        ForeignKey("team_leads.team_lead_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    team_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    max_members = Column(Integer, nullable=False, default=10)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)

    __table_args__ = (CheckConstraint("max_members > 0", name="ck_teams_max_members_positive"),)

    project = relationship("Project", back_populates="teams")
    team_lead = relationship("TeamLead", back_populates="teams_led")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Team {self.team_name}>"


class TeamMember(Base):
    """Many-to-many bridge: users <-> teams."""

    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_members"),)

    member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.team_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(Date, nullable=False, server_default=func.current_date())
    responsibility = Column(String(100), nullable=True)

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")

    def __repr__(self) -> str:
        return f"<TeamMember team_id={self.team_id} user_id={self.user_id}>"
