from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.reports import service
from app.modules.reports.schema import ReportCreate, ReportRead, ReportUpdate
from app.modules.reports.permissions import can_manage_reports, can_view_reports

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


@router.get(
    "/",
    response_model=list[ReportRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_reports)],
)
async def get_reports(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_reports(db, skip=skip, limit=limit)


@router.get(
    "/{report_id}",
    response_model=ReportRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_reports)],
)
async def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_report(db, report_id)


@router.post(
    "/",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_reports)],
)
async def generate_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
):
    return service.generate_report(db, payload)


@router.put(
    "/{report_id}",
    response_model=ReportRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_reports)],
)
async def update_report(
    report_id: UUID,
    payload: ReportUpdate,
    db: Session = Depends(get_db),
):
    return service.update_report(db, report_id, payload)


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_reports)],
)
async def delete_report(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_report(db, report_id)
