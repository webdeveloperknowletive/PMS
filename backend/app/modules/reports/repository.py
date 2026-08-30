"""
==========================================================
                REPORTS REPOSITORY
==========================================================

Data-access layer for the Report model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.reports.model import Report
from app.modules.reports.schema import ReportCreate, ReportUpdate

def get_reports(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Report]:

    return (
        db.query(Report)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_report(
    db: Session,
    payload: ReportCreate,
) -> Report:

    report = Report(**payload.model_dump())

    db.add(report)
    db.commit()
    db.refresh(report)

    return report


# ==========================================================
# Read
# ==========================================================

def get_report(
    db: Session,
    report_id: UUID,
) -> Report | None:

    return db.get(Report, report_id)


def get_reports_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Report]:

    return (
        db.query(Report)
        .filter(Report.project_id == project_id)
        .order_by(Report.generated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_reports_by_user(
    db: Session,
    generated_by: UUID,
) -> list[Report]:

    return (
        db.query(Report)
        .filter(Report.generated_by == generated_by)
        .all()
    )


def get_reports_by_type(
    db: Session,
    project_id: UUID,
    report_type: str,
) -> list[Report]:

    return (
        db.query(Report)
        .filter(
            Report.project_id == project_id,
            Report.report_type == report_type,
        )
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_report(
    db: Session,
    report_id: UUID,
    payload: ReportUpdate,
) -> Report | None:

    report = db.get(Report, report_id)

    if report is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(report, field, value)

    db.commit()
    db.refresh(report)

    return report


def update_report_status(
    db: Session,
    report_id: UUID,
    status: str,
) -> Report | None:

    report = db.get(Report, report_id)

    if report is None:
        return None

    report.status = status

    db.commit()
    db.refresh(report)

    return report


# ==========================================================
# Delete
# ==========================================================

def delete_report(
    db: Session,
    report_id: UUID,
) -> bool:

    report = db.get(Report, report_id)

    if report is None:
        return False

    db.delete(report)
    db.commit()

    return True
