"""
==========================================================
                REPORTS SERVICE
==========================================================

Business logic layer for Reports. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.reports import repository
from app.modules.reports.model import Report
from app.modules.reports.schema import ReportCreate, ReportUpdate


def get_reports(db: Session, skip: int = 0, limit: int = 100) -> list[Report]:
    """Get all reports (paginated)."""
    return repository.get_reports(db, skip=skip, limit=limit)


def get_report(db: Session, report_id: UUID) -> Report:
    """Get a single report by ID, or raise 404."""
    report = repository.get_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


def generate_report(db: Session, payload: ReportCreate) -> Report:
    """Create (generate) a new report."""
    return repository.create_report(db, payload)


def update_report(db: Session, report_id: UUID, payload: ReportUpdate) -> Report:
    """Update an existing report, or raise 404."""
    report = repository.update_report(db, report_id, payload)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


def delete_report(db: Session, report_id: UUID) -> None:
    """Delete a report, or raise 404."""
    deleted = repository.delete_report(db, report_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
