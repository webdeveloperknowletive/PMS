"""
==========================================================
                AI MEETING SUMMARY REPOSITORY
==========================================================

Data-access layer for the AIMeetingSummary model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.ai.meeting_summary.model import AIMeetingSummary
from app.modules.ai.meeting_summary.schema import (
    AIMeetingSummaryCreate,
    AIMeetingSummaryUpdate,
)


# ==========================================================
# Create
# ==========================================================

def create_meeting_summary(
    db: Session,
    payload: AIMeetingSummaryCreate,
) -> AIMeetingSummary:

    meeting_summary = AIMeetingSummary(**payload.model_dump())

    db.add(meeting_summary)
    db.commit()
    db.refresh(meeting_summary)

    return meeting_summary


# ==========================================================
# Read
# ==========================================================

def get_meeting_summary(
    db: Session,
    summary_id: UUID,
) -> AIMeetingSummary | None:

    return db.get(AIMeetingSummary, summary_id)


def get_meeting_summaries_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[AIMeetingSummary]:

    return (
        db.query(AIMeetingSummary)
        .filter(AIMeetingSummary.project_id == project_id)
        .order_by(AIMeetingSummary.meeting_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_meeting_summaries_by_user(
    db: Session,
    created_by: UUID,
) -> list[AIMeetingSummary]:

    return (
        db.query(AIMeetingSummary)
        .filter(AIMeetingSummary.created_by == created_by)
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_meeting_summary(
    db: Session,
    summary_id: UUID,
    payload: AIMeetingSummaryUpdate,
) -> AIMeetingSummary | None:

    meeting_summary = db.get(AIMeetingSummary, summary_id)

    if meeting_summary is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting_summary, field, value)

    db.commit()
    db.refresh(meeting_summary)

    return meeting_summary


# ==========================================================
# Delete
# ==========================================================

def delete_meeting_summary(
    db: Session,
    summary_id: UUID,
) -> bool:

    meeting_summary = db.get(AIMeetingSummary, summary_id)

    if meeting_summary is None:
        return False

    db.delete(meeting_summary)
    db.commit()

    return True
