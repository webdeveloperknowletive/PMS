from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.reports.model import Report
from app.modules.reports.schema import (
    ReportCreate,
    ReportUpdate,
)


def get_reports(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all reports.
    """
    return (
        db.query(Report)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_report(
    db: Session,
    report_id: UUID,
):
    """
    Get a report by ID.
    """
    report = db.get(
        Report,
        report_id,
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    return report


def generate_report(
    db: Session,
    payload: ReportCreate,
):
    """
    Generate a new report.
    """
    report = Report(
        **payload.model_dump()
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return report


def update_report(
    db: Session,
    report_id: UUID,
    payload: ReportUpdate,
):
    """
    Update an existing report.
    """
    report = db.get(
        Report,
        report_id,
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            report,
            field,
            value,
        )

    db.commit()
    db.refresh(report)

    return report


def delete_report(
    db: Session,
    report_id: UUID,
):
    """
    Delete a report.
    """
    report = db.get(
        Report,
        report_id,
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    db.delete(report)
    db.commit()

    return None