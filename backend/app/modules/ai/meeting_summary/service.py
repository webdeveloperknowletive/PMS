"""
==========================================================
                AI MEETING SUMMARY SERVICE
==========================================================

Business logic layer for AI meeting summaries. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import GROQ_MODEL
from app.modules.ai.generation import generate_structured
from app.modules.ai.meeting_summary import repository
from app.modules.ai.meeting_summary.model import AIMeetingSummary
from app.modules.ai.meeting_summary.schema import AIMeetingSummaryCreate, AIMeetingSummaryGenerationRequest, AIMeetingSummaryUpdate
from app.modules.projects.model import Project


class _MeetingOutput(BaseModel):
    summary: str
    action_items: list[Any] = Field(default_factory=list)
    decisions: list[Any] = Field(default_factory=list)
    attendees: list[Any] = Field(default_factory=list)


def get_meeting_summaries(db: Session, skip: int = 0, limit: int = 100) -> list[AIMeetingSummary]:
    return repository.get_meeting_summaries(db, skip=skip, limit=limit)


def get_meeting_summary(db: Session, summary_id: UUID) -> AIMeetingSummary:
    summary = repository.get_meeting_summary(db, summary_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
    return summary


def generate_meeting_summary(db: Session, payload: AIMeetingSummaryCreate) -> AIMeetingSummary:
    return repository.create_meeting_summary(db, payload)


def generate_meeting_summary_with_ai(db: Session, payload: AIMeetingSummaryGenerationRequest, created_by: UUID) -> AIMeetingSummary:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    user_prompt = f"Project: {project.project_name}\nMeeting: {payload.meeting_title}\nDate: {payload.meeting_date.isoformat()}\nTranscript:\n{payload.transcript}"
    raw = generate_structured(
        "Summarize the meeting transcript faithfully. Do not invent attendees, owners, deadlines, or decisions. "
        "Return JSON with summary (concise structured prose), action_items (array of objects with task, owner, due_date when stated), "
        "decisions (array), and attendees (array of names explicitly present).", user_prompt,
    )
    try:
        result = _MeetingOutput.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="The AI returned an invalid meeting summary. Please try again.") from exc
    return repository.create_meeting_summary(db, AIMeetingSummaryCreate(
        project_id=payload.project_id, created_by=created_by, meeting_title=payload.meeting_title,
        meeting_date=payload.meeting_date, transcript=payload.transcript, summary=result.summary,
        action_items=result.action_items, decisions=result.decisions, attendees=result.attendees, ai_model=GROQ_MODEL,
    ))


def update_meeting_summary(db: Session, summary_id: UUID, payload: AIMeetingSummaryUpdate) -> AIMeetingSummary:
    summary = repository.update_meeting_summary(db, summary_id, payload)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
    return summary


def delete_meeting_summary(db: Session, summary_id: UUID) -> None:
    deleted = repository.delete_meeting_summary(db, summary_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
