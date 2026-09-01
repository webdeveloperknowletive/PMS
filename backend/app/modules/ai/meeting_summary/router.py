from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.meeting_summary import service
from app.modules.ai.meeting_summary.schema import (
    AIMeetingSummaryCreate,
    AIMeetingSummaryRead,
    AIMeetingSummaryUpdate,
)
from app.modules.ai.meeting_summary.permissions import can_generate, can_view_results

router = APIRouter(
    prefix="/ai/meeting-summaries",
    tags=["AI Meeting Summary"]
)


@router.get(
    "/",
    response_model=list[AIMeetingSummaryRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_meeting_summaries(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_meeting_summaries(db, skip=skip, limit=limit)


@router.get(
    "/{summary_id}",
    response_model=AIMeetingSummaryRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_meeting_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_meeting_summary(db, summary_id)


@router.post(
    "/",
    response_model=AIMeetingSummaryRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def generate_meeting_summary(
    payload: AIMeetingSummaryCreate,
    db: Session = Depends(get_db),
):
    return service.generate_meeting_summary(db, payload)


@router.put(
    "/{summary_id}",
    response_model=AIMeetingSummaryRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def update_meeting_summary(
    summary_id: UUID,
    payload: AIMeetingSummaryUpdate,
    db: Session = Depends(get_db),
):
    return service.update_meeting_summary(db, summary_id, payload)


@router.delete(
    "/{summary_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_generate)],
)
async def delete_meeting_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_meeting_summary(db, summary_id)
