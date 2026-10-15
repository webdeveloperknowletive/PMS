from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.projects import service
from app.modules.projects.schema import ProjectAssignmentCandidateRead, ProjectCreate, ProjectRead, ProjectUpdate
from app.modules.projects.permissions import can_manage_projects, can_view_projects
from app.core.dependencies import get_current_user
from app.modules.users.model import User

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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_projects(db, current_user, skip=skip, limit=limit)


@router.get(
    "/assignment-candidates",
    response_model=list[ProjectAssignmentCandidateRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def get_project_assignment_candidates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project_assignment_candidates(db, current_user)


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_projects)],
)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project(db, project_id, current_user)


@router.post(
    "/",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_projects)],
)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_project(db, payload, actor=current_user)


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_project(db, project_id, payload, actor=current_user)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_projects)],
)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_project(db, project_id, actor=current_user)
