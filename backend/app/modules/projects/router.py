from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.projects.model import Project
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
    return db.query(Project).offset(skip).limit(limit).all()


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
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


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
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


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
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_projects)],
)
async def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()