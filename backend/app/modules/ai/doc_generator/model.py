import uuid

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import CreatedAtMixin


class AIDocumentGeneration(Base, OrganizationScopedMixin, CreatedAtMixin):
    __tablename__ = "ai_document_generations"

    document_generation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    document_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    generated_content = Column(Text, nullable=False)
    document_url = Column(Text, nullable=True)
    version = Column(String(20), nullable=False, default="1.0")
    ai_model = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="Generated")

    project = relationship("Project", back_populates="document_generations")
    generated_by_user = relationship("User", back_populates="generated_documents")

    def __repr__(self) -> str:
        return f"<AIDocumentGeneration {self.title}>"
