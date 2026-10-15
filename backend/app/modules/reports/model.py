import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class Report(Base, OrganizationScopedMixin):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("report_format IN ('PDF', 'Excel', 'CSV')", name="ck_reports_report_format"),
    )

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    report_name = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)
    report_format = Column(String(10), nullable=False)  # CHECK: PDF | Excel | CSV
    file_url = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status = Column(String(30), nullable=False, default="Completed")

    project = relationship("Project", back_populates="reports")
    generated_by_user = relationship("User", back_populates="generated_reports")

    def __repr__(self) -> str:
        return f"<Report {self.report_name} ({self.report_format})>"
