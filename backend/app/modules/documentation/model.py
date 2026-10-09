import uuid

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import CreatedAtMixin
from sqlalchemy.sql import func


class Document(Base, CreatedAtMixin):
    __tablename__ = "documents"

    document_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=True)
    version = Column(String(20), nullable=False, default="1.0")
    resource_type = Column(String(20), nullable=False, default="FILE", server_default=text("'FILE'"))
    stored_filename = Column(String(255), nullable=True)
    original_filename = Column(String(255), nullable=True)
    mime_type = Column(String(150), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document {self.title} v{self.version}>"
