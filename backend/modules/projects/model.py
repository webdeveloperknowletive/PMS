import uuid

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)

    # --- Relationships ---
    teams = relationship("Team", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="project", cascade="all, delete-orphan")
    sprint_plans = relationship("AISprintPlan", back_populates="project", cascade="all, delete-orphan")
    risk_predictions = relationship("AIRiskPrediction", back_populates="project", cascade="all, delete-orphan")
    document_generations = relationship("AIDocumentGeneration", back_populates="project", cascade="all, delete-orphan")
    task_estimations = relationship("AITaskEstimation", back_populates="project", cascade="all, delete-orphan")
    meeting_summaries = relationship("AIMeetingSummary", back_populates="project", cascade="all, delete-orphan")
    kanban_columns = relationship("KanbanColumn", back_populates="project", cascade="all, delete-orphan")
    gantt_tasks = relationship("GanttTask", back_populates="project", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="project", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="project", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Project {self.project_name}>"
