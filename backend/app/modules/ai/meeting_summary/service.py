"""
==========================================================
                AI MEETING SUMMARY SERVICE
==========================================================

Business logic layer for AI meeting summaries. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.meeting_summary import repository
from app.modules.ai.meeting_summary.model import AIMeetingSummary
from app.modules.ai.meeting_summary.schema import AIMeetingSummaryCreate, AIMeetingSummaryUpdate


def get_meeting_summaries(db: Session, skip: int = 0, limit: int = 100) -> list[AIMeetingSummary]:
    return repository.get_meeting_summaries(db, skip=skip, limit=limit)


def get_meeting_summary(db: Session, summary_id: UUID) -> AIMeetingSummary:
    summary = repository.get_meeting_summary(db, summary_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
    return summary


def generate_meeting_summary(db: Session, payload: AIMeetingSummaryCreate) -> AIMeetingSummary:
    return repository.create_meeting_summary(db, payload)


def update_meeting_summary(db: Session, summary_id: UUID, payload: AIMeetingSummaryUpdate) -> AIMeetingSummary:
    summary = repository.update_meeting_summary(db, summary_id, payload)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
    return summary


def delete_meeting_summary(db: Session, summary_id: UUID) -> None:
    deleted = repository.delete_meeting_summary(db, summary_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
