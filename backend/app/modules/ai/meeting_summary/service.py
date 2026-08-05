from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.meeting_summary.model import AIMeetingSummary
from app.modules.ai.meeting_summary.schema import (
    AIMeetingSummaryCreate,
    AIMeetingSummaryUpdate,
)


def get_meeting_summaries(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all AI meeting summaries.
    """
    return (
        db.query(AIMeetingSummary)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_meeting_summary(
    db: Session,
    summary_id: UUID,
):
    """
    Get AI meeting summary by ID.
    """
    summary = db.get(
        AIMeetingSummary,
        summary_id,
    )

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting summary not found",
        )

    return summary


def generate_meeting_summary(
    db: Session,
    payload: AIMeetingSummaryCreate,
):
    """
    Generate a new AI meeting summary.
    """
    summary = AIMeetingSummary(
        **payload.model_dump()
    )

    db.add(summary)
    db.commit()
    db.refresh(summary)

    return summary


def update_meeting_summary(
    db: Session,
    summary_id: UUID,
    payload: AIMeetingSummaryUpdate,
):
    """
    Update an existing AI meeting summary.
    """
    summary = db.get(
        AIMeetingSummary,
        summary_id,
    )

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting summary not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(summary, field, value)

    db.commit()
    db.refresh(summary)

    return summary


def delete_meeting_summary(
    db: Session,
    summary_id: UUID,
):
    """
    Delete an AI meeting summary.
    """
    summary = db.get(
        AIMeetingSummary,
        summary_id,
    )

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting summary not found",
        )

    db.delete(summary)
    db.commit()

    return None