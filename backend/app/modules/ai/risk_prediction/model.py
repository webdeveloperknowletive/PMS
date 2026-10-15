import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import CreatedAtMixin


class AIRiskPrediction(Base, OrganizationScopedMixin, CreatedAtMixin):
    __tablename__ = "ai_risk_predictions"

    prediction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="SET NULL"), nullable=True, index=True)
    risk_type = Column(String(100), nullable=False)
    risk_level = Column(String(10), nullable=False, index=True)  # CHECK: Low | Medium | High
    probability = Column(Numeric(5, 2), nullable=False)
    impact = Column(String(50), nullable=True)
    recommendation = Column(Text, nullable=False)
    ai_model = Column(String(100), nullable=False)
    prompt = Column(Text, nullable=False)
    prediction_result = Column(JSONB, nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=True)

    __table_args__ = (
        CheckConstraint("risk_level IN ('Low', 'Medium', 'High')", name="ck_ai_risk_predictions_risk_level"),
        CheckConstraint("probability BETWEEN 0 AND 100", name="ck_ai_risk_predictions_probability_range"),
        CheckConstraint(
            "confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100",
            name="ck_ai_risk_predictions_confidence_range",
        ),
    )

    project = relationship("Project", back_populates="risk_predictions")
    task = relationship("Task", back_populates="risk_predictions")

    def __repr__(self) -> str:
        return f"<AIRiskPrediction {self.risk_type} ({self.risk_level})>"
