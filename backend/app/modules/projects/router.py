from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.projects import service
from app.modules.projects.schema import ProjectCreate, ProjectRead, ProjectUpdate
from app.modules.projects.permissions import can_manage_projects, can_view_projects

router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


@router.get(
    "/",
    response_model=list[ProjectRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_projects)],
)
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_projects(db, skip=skip, limit=limit)


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_projects)],
)
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_project(db, project_id)


@router.post(
    "/",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_projects)],
)
async def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
):
    return service.create_project(db, payload)


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
):
    return service.update_project(db, project_id, payload)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_projects)],
)
async def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_project(db, project_id)
