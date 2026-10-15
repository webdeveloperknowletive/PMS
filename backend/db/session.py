"""
==========================================================
                DATABASE SESSION
==========================================================

Creates database sessions.

A session is used to perform CRUD operations.

Every API request gets its own session.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from sqlalchemy import event, inspect as sa_inspect
from fastapi import HTTPException
from sqlalchemy.orm import Session, sessionmaker, with_loader_criteria

from db.base import Base
from db.database import engine
from app.shared.mixins import OrganizationScopedMixin

# ==========================================================
# Session Factory
# ==========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


@event.listens_for(Session, "before_flush")
def attach_workspace_to_new_records(session, _flush_context, _instances):
    """Every tenant-owned write inherits the authenticated workspace."""
    organization_id = session.info.get("organization_id")
    if organization_id is None:
        return
    for instance in session.new:
        if isinstance(instance, OrganizationScopedMixin) and instance.organization_id is None:
            instance.organization_id = organization_id

    # Foreign keys also need to point to records in the same workspace. A
    # tenant filter protects reads, while this check prevents a crafted ID
    # from attaching another company's user/project to a new or edited row.
    models_by_table = {mapper.local_table.name: mapper.class_ for mapper in Base.registry.mappers}
    candidates = list(session.new) + list(session.dirty)
    for instance in candidates:
        if not isinstance(instance, OrganizationScopedMixin):
            continue
        if instance.organization_id != organization_id:
            raise HTTPException(status_code=404, detail="Related record is unavailable in this workspace")
        state = sa_inspect(instance)
        for column in state.mapper.columns:
            if column.key == "organization_id" or (instance in session.dirty and not state.attrs[column.key].history.has_changes()):
                continue
            value = getattr(instance, column.key, None)
            if value is None:
                continue
            for foreign_key in column.foreign_keys:
                target_table_name = foreign_key.column.table.name
                target_model = models_by_table.get(target_table_name)
                if target_model is None or not issubclass(target_model, OrganizationScopedMixin):
                    continue
                target = next(
                    (pending for pending in session.new
                     if isinstance(pending, target_model)
                     and getattr(pending, foreign_key.column.name, None) == value),
                    None,
                )
                if target is not None:
                    if target.organization_id != organization_id:
                        raise HTTPException(status_code=404, detail="Related record is unavailable in this workspace")
                    continue
                with session.no_autoflush:
                    # Session.get() can return an already-loaded identity
                    # without issuing SQL, which would skip tenant criteria.
                    # Query by both the referenced key and workspace so even
                    # a stale/cross-workspace identity-map entry is rejected.
                    target = session.query(target_model).filter(
                        getattr(target_model, foreign_key.column.name) == value,
                        target_model.organization_id == organization_id,
                    ).one_or_none()
                if target is None:
                    raise HTTPException(status_code=404, detail="Related record is unavailable in this workspace")


@event.listens_for(Session, "do_orm_execute")
def limit_queries_to_active_workspace(execute_state):
    """Keep ORM reads and bulk writes inside the current workspace."""
    organization_id = execute_state.session.info.get("organization_id")
    if organization_id is None:
        return
    if execute_state.is_select or execute_state.is_update or execute_state.is_delete:
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                OrganizationScopedMixin,
                lambda model: model.organization_id == organization_id,
                include_aliases=True,
            )
        )

# ==========================================================
# Dependency
# ==========================================================

def get_db():
    """
    Creates a database session.

    Automatically closes the session
    after the request is completed.
    """

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
