from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.tasks import service
from app.modules.tasks.schema import SprintCreate, SprintRead, SprintUpdate, TaskActivityRead, TaskCommentCreate, TaskCommentRead, TaskCreate, TaskRead, TaskUpdate, TaskWorkTimeRead, WorkSessionRead, WorkSessionStart
from app.modules.tasks.permissions import can_manage_tasks, can_update_task, can_view_tasks
from app.modules.users.model import User

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
    dependencies=[Depends(can_view_tasks)],
)


@router.get("/work-sessions", response_model=list[WorkSessionRead])
async def get_work_sessions(limit: int = 100, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_work_sessions(db, current_user, limit)


@router.post("/work-sessions/start", response_model=WorkSessionRead, status_code=status.HTTP_200_OK)
async def start_work_session(payload: WorkSessionStart, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.start_work_session(db, payload, current_user)


@router.post("/work-sessions/stop", response_model=WorkSessionRead)
async def stop_work_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.stop_work_session(db, current_user)


@router.get("/work-time", response_model=list[TaskWorkTimeRead])
async def get_task_work_times(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_task_work_times(db, current_user)


@router.get("/sprints", response_model=list[SprintRead], status_code=status.HTTP_200_OK)
async def get_sprints(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_sprints(db, project_id, current_user)


@router.post("/sprints", response_model=SprintRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_tasks)])
async def create_sprint(payload: SprintCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.create_sprint(db, payload, current_user)


@router.put("/sprints/{sprint_id}", response_model=SprintRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_tasks)])
async def update_sprint(sprint_id: UUID, payload: SprintUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.update_sprint(db, sprint_id, payload, current_user)


@router.get(
    "/",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_tasks(db, current_user=current_user, skip=skip, limit=limit)


@router.get(
    "/{task_id}",
    response_model=TaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_task(db, task_id, current_user=current_user)


@router.get("/{task_id}/comments", response_model=list[TaskCommentRead], status_code=status.HTTP_200_OK)
async def get_task_comments(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_comments(db, task_id, current_user)


@router.post("/{task_id}/comments", response_model=TaskCommentRead, status_code=status.HTTP_201_CREATED)
async def add_task_comment(task_id: UUID, payload: TaskCommentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.add_comment(db, task_id, payload, current_user)


@router.get("/{task_id}/activity", response_model=list[TaskActivityRead], status_code=status.HTTP_200_OK)
async def get_task_activity(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_activity(db, task_id, current_user)


@router.post(
    "/",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_tasks)],
)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_task(db, payload, assigned_by=current_user)


@router.put("/{task_id}", response_model=TaskRead, status_code=status.HTTP_200_OK)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetched via the service layer (raises 404 if missing) so we know who
    # this task is assigned to — a static Depends() can't see that, so the
    # ownership check has to happen here, after the fetch.
    task = service.get_task(db, task_id, current_user=current_user)
    can_update_task(task_assignee_id=task.user_id, current_user=current_user, db=db)
    if "user_id" in payload.model_fields_set and payload.user_id != task.user_id:
        can_manage_tasks(current_user=current_user, db=db)

    return service.update_task(db, task_id, payload, assigned_by=current_user)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_tasks)],
)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.get_task(db, task_id, current_user=current_user)
    service.delete_task(db, task_id, deleted_by=current_user)


@router.get(
    "/{task_id}/subtasks",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_subtasks(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_subtasks(db, task_id, current_user=current_user)
