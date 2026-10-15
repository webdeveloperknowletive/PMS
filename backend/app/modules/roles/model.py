import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import CreatedAtMixin


class Role(Base, OrganizationScopedMixin, CreatedAtMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("organization_id", "role_name", name="uq_roles_org_name"),)

    role_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, nullable=False, default=False, server_default="false")

    user_roles = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")
    permission_links = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Role {self.role_name}>"


class UserRole(Base, OrganizationScopedMixin):
    """Many-to-many bridge: users <-> roles."""

    __tablename__ = "user_role"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_role_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")

    def __repr__(self) -> str:
        return f"<UserRole user_id={self.user_id} role_id={self.role_id}>"


class Permission(Base, OrganizationScopedMixin):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_permissions_org_code"),)

    permission_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(255), nullable=False)
    category = Column(String(80), nullable=False)

    role_links = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(Base, OrganizationScopedMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_permission_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.permission_id", ondelete="CASCADE"), nullable=False, index=True)

    role = relationship("Role", back_populates="permission_links")
    permission = relationship("Permission", back_populates="role_links")
