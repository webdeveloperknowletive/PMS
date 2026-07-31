import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import TimestampMixin


class AISprintPlan(Base, TimestampMixin):
    __tablename__ = "ai_sprint_plans"

    sprint_plan_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    sprint_name = Column(String(150), nullable=False)
    sprint_goal = Column(Text, nullable=False)
    sprint_duration_days = Column(Integer, nullable=False)
    suggested_tasks = Column(JSONB, nullable=False, default=list)
    estimated_story_points = Column(Integer, nullable=True)
    ai_model = Column(String(100), nullable=False)
    prompt = Column(Text, nullable=False)
    ai_response = Column(JSONB, nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    status = Column(String(30), nullable=False, default="Generated", index=True)

    __table_args__ = (
        CheckConstraint("sprint_duration_days > 0", name="ck_ai_sprint_plans_duration_positive"),
        CheckConstraint(
            "confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100",
            name="ck_ai_sprint_plans_confidence_range",
        ),
    )

    project = relationship("Project", back_populates="sprint_plans")
    generated_by_user = relationship("User", back_populates="generated_sprint_plans")
    tasks = relationship("Task", back_populates="sprint_plan")

    def __repr__(self) -> str:
        return f"<AISprintPlan {self.sprint_name}>"
