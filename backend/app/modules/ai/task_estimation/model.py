import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import CreatedAtMixin


class AITaskEstimation(Base, OrganizationScopedMixin, CreatedAtMixin):
    __tablename__ = "ai_task_estimations"

    estimation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    estimated_hours = Column(Numeric(6, 2), nullable=False)
    estimated_cost = Column(Numeric(12, 2), nullable=True)
    complexity = Column(String(10), nullable=False)  # CHECK: Low | Medium | High
    story_points = Column(Integer, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    prompt = Column(Text, nullable=False)
    ai_model = Column(String(100), nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=True)

    __table_args__ = (
        CheckConstraint("estimated_hours >= 0", name="ck_ai_task_estimations_hours_nonneg"),
        CheckConstraint(
            "estimated_cost IS NULL OR estimated_cost >= 0", name="ck_ai_task_estimations_cost_nonneg"
        ),
        CheckConstraint("complexity IN ('Low', 'Medium', 'High')", name="ck_ai_task_estimations_complexity"),
        CheckConstraint(
            "story_points IS NULL OR story_points >= 0", name="ck_ai_task_estimations_story_points_nonneg"
        ),
        CheckConstraint(
            "confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100",
            name="ck_ai_task_estimations_confidence_range",
        ),
    )

    task = relationship("Task", back_populates="estimations")
    project = relationship("Project", back_populates="task_estimations")

    def __repr__(self) -> str:
        return f"<AITaskEstimation task_id={self.task_id} complexity={self.complexity}>"
