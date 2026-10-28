import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class KanbanColumn(Base, OrganizationScopedMixin):
    __tablename__ = "kanban_columns"
    __table_args__ = (UniqueConstraint("project_id", "position", name="uq_kanban_columns_project_position"),)

    column_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    column_name = Column(String(100), nullable=False)
    position = Column(Integer, nullable=False)
    color = Column(String(20), nullable=True)
    wip_limit = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="kanban_columns")
    tasks = relationship("KanbanTask", back_populates="column", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<KanbanColumn {self.column_name}>"


class KanbanTask(Base, OrganizationScopedMixin):
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
    moved_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    task = relationship("Task", back_populates="kanban_entry")
    column = relationship("KanbanColumn", back_populates="tasks")
    moved_by_user = relationship("User", back_populates="kanban_moves")

    def __repr__(self) -> str:
        return f"<KanbanTask task_id={self.task_id} column_id={self.column_id}>"


class KanbanCardMember(Base, OrganizationScopedMixin):
    """Additional people assigned to a task card alongside its primary assignee."""

    __tablename__ = "kanban_card_members"
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_kanban_card_members_task_user"),)

    card_member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="kanban_member_assignments")
    user = relationship("User", foreign_keys=[user_id], back_populates="kanban_card_memberships")
    assigned_by = relationship("User", foreign_keys=[assigned_by_user_id])

    def __repr__(self) -> str:
        return f"<KanbanCardMember task_id={self.task_id} user_id={self.user_id}>"


class KanbanLabel(Base, OrganizationScopedMixin):
    """Workspace label definition used to render task labels with a saved color."""

    __tablename__ = "kanban_labels"
    __table_args__ = (UniqueConstraint("organization_id", "label_key", name="uq_kanban_labels_org_key"),)

    label_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label_key = Column(String(40), nullable=False)
    name = Column(String(40), nullable=False)
    color = Column(String(7), nullable=False, default="#64748B", server_default="#64748B")
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    created_by = relationship("User", foreign_keys=[created_by_user_id])

    def __repr__(self) -> str:
        return f"<KanbanLabel {self.name}>"
