from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.meeting_summary.model import AIMeetingSummary
from app.modules.ai.meeting_summary.schema import (
    AIMeetingSummaryCreate,
    AIMeetingSummaryRead,
    AIMeetingSummaryUpdate,
)

router = APIRouter(
    prefix="/ai/meeting-summaries",
    tags=["AI Meeting Summary"]
)


@router.get("/", response_model=list[AIMeetingSummaryRead], status_code=status.HTTP_200_OK)
async def get_meeting_summaries(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(AIMeetingSummary).offset(skip).limit(limit).all()


@router.get("/{summary_id}", response_model=AIMeetingSummaryRead, status_code=status.HTTP_200_OK)
async def get_meeting_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
):
    summary = db.get(AIMeetingSummary, summary_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")
    return summary


@router.post("/", response_model=AIMeetingSummaryRead, status_code=status.HTTP_201_CREATED)
async def generate_meeting_summary(
    payload: AIMeetingSummaryCreate,
    db: Session = Depends(get_db),
):
    summary = AIMeetingSummary(**payload.model_dump())
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


@router.put("/{summary_id}", response_model=AIMeetingSummaryRead, status_code=status.HTTP_200_OK)
async def update_meeting_summary(
    summary_id: UUID,
    payload: AIMeetingSummaryUpdate,
    db: Session = Depends(get_db),
):
    summary = db.get(AIMeetingSummary, summary_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(summary, field, value)

    db.commit()
    db.refresh(summary)
    return summary


@router.delete("/{summary_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
):
    summary = db.get(AIMeetingSummary, summary_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting summary not found")

    db.delete(summary)
    db.commit()
