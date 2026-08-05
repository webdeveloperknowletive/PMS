import uuid

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import CreatedAtMixin


class Document(Base, CreatedAtMixin):
    __tablename__ = "documents"

    document_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=True)
    version = Column(String(20), nullable=False, default="1.0")

    project = relationship("Project", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document {self.title} v{self.version}>"
