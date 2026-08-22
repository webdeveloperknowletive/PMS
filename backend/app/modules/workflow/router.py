from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.workflow.model import Workflow
from app.modules.workflow.schema import WorkflowCreate, WorkflowRead, WorkflowUpdate
from app.modules.workflow.permissions import can_manage_workflows, can_view_workflows

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
    return db.query(Workflow).offset(skip).limit(limit).all()


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
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.post(
    "/",
    response_model=WorkflowRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_workflows)],
)
async def create_workflow(
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
):
    workflow = Workflow(**payload.model_dump())
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.put(
    "/{workflow_id}",
    response_model=WorkflowRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_workflows)],
)
async def update_workflow(
    workflow_id: UUID,
    payload: WorkflowUpdate,
    db: Session = Depends(get_db),
):
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)

    db.commit()
    db.refresh(workflow)
    return workflow


@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_workflows)],
)
async def delete_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
):
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    db.delete(workflow)
    db.commit()