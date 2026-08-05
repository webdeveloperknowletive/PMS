import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class KanbanColumn(Base):
    __tablename__ = "kanban_columns"
    __table_args__ = (UniqueConstraint("project_id", "position", name="uq_kanban_columns_project_position"),)

    column_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    column_name = Column(String(100), nullable=False)
    position = Column(Integer, nullable=False)
    color = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="kanban_columns")
    tasks = relationship("KanbanTask", back_populates="column", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<KanbanColumn {self.column_name}>"


class KanbanTask(Base):
    """Maps a task to a Kanban board column; a task occupies exactly one slot."""

    __tablename__ = "kanban_tasks"

    kanban_task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.task_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # a task sits in exactly one Kanban slot
    )
    column_id = Column(UUID(as_uuid=True), ForeignKey("kanban_columns.column_id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    moved_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    moved_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="kanban_entry")
    column = relationship("KanbanColumn", back_populates="tasks")
    moved_by_user = relationship("User", back_populates="kanban_moves")

    def __repr__(self) -> str:
        return f"<KanbanTask task_id={self.task_id} column_id={self.column_id}>"
