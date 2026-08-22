from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.reports.model import Report
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
    return db.query(Report).offset(skip).limit(limit).all()


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
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


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
    report = Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


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
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(report, field, value)

    db.commit()
    db.refresh(report)
    return report


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_reports)],
)
async def delete_report(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    db.delete(report)
    db.commit()