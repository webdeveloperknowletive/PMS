import csv
from datetime import datetime
from io import StringIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import has_permission
from app.modules.audit.model import AuditEvent
from app.modules.audit.schema import AuditEventRead
from app.modules.users.model import User

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


def _filtered_audit_query(
    db: Session,
    current_user: User,
    actor_id: UUID | None,
    method: str | None,
    from_date: datetime | None,
    to_date: datetime | None,
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be earlier than or equal to to_date")

    query = db.query(AuditEvent).filter(AuditEvent.organization_id == current_user.organization_id)
    if actor_id:
        query = query.filter(AuditEvent.actor_id == actor_id)
    if method:
        query = query.filter(AuditEvent.method == method.upper())
    if from_date:
        query = query.filter(AuditEvent.created_at >= from_date)
    if to_date:
        query = query.filter(AuditEvent.created_at <= to_date)
    return query


def _csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    # Prevent spreadsheet formulas when an administrator opens the export.
    if text.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


@router.get("/", response_model=list[AuditEventRead])
async def list_audit_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    actor_id: UUID | None = None,
    method: str | None = Query(None, min_length=3, max_length=10),
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not has_permission(db, current_user, "roles.manage"):
        raise HTTPException(status_code=403, detail="Workspace administrator permission required")

    query = _filtered_audit_query(db, current_user, actor_id, method, from_date, to_date)
    return query.order_by(AuditEvent.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/export")
async def export_audit_events(
    actor_id: UUID | None = None,
    method: str | None = Query(None, min_length=3, max_length=10),
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not has_permission(db, current_user, "roles.manage"):
        raise HTTPException(status_code=403, detail="Workspace administrator permission required")

    events = _filtered_audit_query(db, current_user, actor_id, method, from_date, to_date) \
        .order_by(AuditEvent.created_at.desc()).limit(10_000).all()
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["event_id", "created_at", "actor_id", "actor_name", "actor_roles", "method", "path", "status_code"])
    for event in events:
        writer.writerow([
            _csv_safe(event.event_id),
            _csv_safe(event.created_at.isoformat() if event.created_at else ""),
            _csv_safe(event.actor_id),
            _csv_safe(event.actor_name),
            _csv_safe(event.actor_roles),
            _csv_safe(event.method),
            _csv_safe(event.path),
            _csv_safe(event.status_code),
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-events.csv"'},
    )
