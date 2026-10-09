from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.workflow import service
from app.modules.workflow.schema import WorkflowCreate, WorkflowRead, WorkflowUpdate
from app.modules.workflow.permissions import can_manage_workflows, can_view_workflows
from app.core.dependencies import get_current_user
from app.modules.users.model import User

router = APIRouter(
    prefix="/workflows",
    tags=["Workflows"]
)


@router.get(
    "/",
    response_model=list[WorkflowRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_workflows)],
)
async def get_workflows(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_workflows(db, skip=skip, limit=limit)


@router.get(
    "/{workflow_id}",
    response_model=WorkflowRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_workflows)],
)
async def get_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_workflow(db, workflow_id)


@router.post(
    "/",
    response_model=WorkflowRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_workflows)],
)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_workflow(db, payload, actor=current_user)


@router.put(
    "/{workflow_id}",
    response_model=WorkflowRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_workflows)],
)
async def update_workflow(
    workflow_id: UUID,
    payload: WorkflowUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_workflow(db, workflow_id, payload, actor=current_user)


@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_workflows)],
)
async def delete_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_workflow(db, workflow_id, actor=current_user)
