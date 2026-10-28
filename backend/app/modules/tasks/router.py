from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.tasks import service
from app.modules.tasks import attachments as task_attachments
from app.modules.tasks.schema import BlockedTasksSummaryRead, BlockerOwnerRead, CardChecklistUpdate, CardDatesUpdate, CardLabelsUpdate, SavedTaskFilterCreate, SavedTaskFilterRead, SprintCreate, SprintRead, SprintReportRead, SprintUpdate, TaskActivityRead, TaskStatusHistoryRead, TaskAssigneeCandidateRead, TaskChecklistMemberOptionRead, TaskAttachmentRead, TaskBulkPriorityResult, TaskBulkUpdate, TaskCommentCreate, TaskCommentRead, TaskCreate, TaskDeadlineReminderCheck, TaskDeadlineReminderCheckResult, TaskDependencyListRead, TaskLinkCreate, TaskLinkOwnerUpdate, TaskLinkRead, TaskRead, TaskUpdate, TaskWorkTimeRead, WorkSessionRead, WorkSessionStart
from app.core.permissions import require_permission
from app.modules.tasks import saved_filters
from app.modules.tasks import links as task_links
from app.modules.tasks.permissions import can_manage_tasks, can_update_task, can_view_tasks
from app.modules.users.model import User

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
    dependencies=[Depends(can_view_tasks)],
)


@router.patch("/{task_id}/card-labels", response_model=TaskRead)
async def update_card_labels(task_id: UUID, payload: CardLabelsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.get_task(db, task_id, current_user=current_user)
    return service.update_task(db, task_id, TaskUpdate(labels=payload.labels), assigned_by=current_user)


@router.patch("/{task_id}/card-dates", response_model=TaskRead)
async def update_card_dates(task_id: UUID, payload: CardDatesUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.get_task(db, task_id, current_user=current_user)
    return service.update_task(
        db, task_id,
        TaskUpdate(start_date=payload.start_date, due_date=payload.due_date, reminder_days_before=payload.reminder_days_before),
        assigned_by=current_user,
    )


@router.post("/deadline-reminders/check", response_model=TaskDeadlineReminderCheckResult)
async def check_task_deadline_reminders(
    payload: TaskDeadlineReminderCheck,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created_count = service.deliver_task_deadline_reminders(db, current_user, payload.local_date)
    return TaskDeadlineReminderCheckResult(created_count=created_count)


@router.patch("/{task_id}/card-checklist", response_model=TaskRead)
async def update_card_checklist(task_id: UUID, payload: CardChecklistUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.get_checklist_task(db, task_id, current_user)
    return service.update_task(db, task_id, TaskUpdate(checklist_items=payload.checklist_items), assigned_by=current_user)


@router.get("/{task_id}/checklist-member-options", response_model=list[TaskChecklistMemberOptionRead], dependencies=[Depends(require_permission("kanban.card_checklists.items.manage"))])
async def get_checklist_member_options(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = service.get_checklist_task(db, task_id, current_user)
    return service.get_checklist_member_options(db, task.project_id, current_user)


@router.get("/{task_id}/attachments", response_model=list[TaskAttachmentRead], dependencies=[Depends(require_permission("kanban.card_attachments.view"))])
async def list_card_attachments(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_attachments.list_attachments(db, task_id, current_user)


@router.post("/{task_id}/attachments", response_model=TaskAttachmentRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("kanban.card_attachments.upload"))])
async def upload_card_attachment(task_id: UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await task_attachments.upload_attachment(db, task_id, file, current_user)


@router.get("/{task_id}/attachments/{attachment_id}/download", dependencies=[Depends(require_permission("kanban.card_attachments.view"))])
async def download_card_attachment(task_id: UUID, attachment_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attachment, path = task_attachments.get_attachment(db, task_id, attachment_id, current_user)
    return FileResponse(path, filename=attachment.original_filename, media_type="application/octet-stream", content_disposition_type="attachment")


@router.delete("/{task_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("kanban.card_attachments.delete"))])
async def delete_card_attachment(task_id: UUID, attachment_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task_attachments.delete_attachment(db, task_id, attachment_id, current_user)


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


@router.get("/blockers/summary", response_model=BlockedTasksSummaryRead)
async def get_blocked_tasks_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_blocked_tasks_summary(db, current_user)


@router.get("/dependencies", response_model=TaskDependencyListRead)
async def get_task_dependencies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    project_id: UUID | None = None,
    owner_id: UUID | None = None,
    unassigned: bool = False,
    overdue: bool = False,
    search: str | None = Query(None, min_length=1, max_length=120),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_task_dependencies(
        db,
        current_user,
        skip=skip,
        limit=limit,
        project_id=project_id,
        owner_id=owner_id,
        unassigned=unassigned,
        overdue=overdue,
        search=search.strip() if search else None,
    )


@router.get("/sprints", response_model=list[SprintRead], status_code=status.HTTP_200_OK)
async def get_sprints(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_sprints(db, project_id, current_user)


@router.get("/projects/{project_id}/assignee-candidates", response_model=list[TaskAssigneeCandidateRead])
async def get_project_assignee_candidates(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_project_assignee_candidates(db, project_id, current_user)


@router.get("/sprints/{sprint_id}/report", response_model=SprintReportRead)
async def get_sprint_report(sprint_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_sprint_report(db, sprint_id, current_user)


@router.post("/sprints", response_model=SprintRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_tasks)])
async def create_sprint(payload: SprintCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.create_sprint(db, payload, current_user)


@router.put("/sprints/{sprint_id}", response_model=SprintRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_tasks)])
async def update_sprint(sprint_id: UUID, payload: SprintUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.update_sprint(db, sprint_id, payload, current_user)


@router.get("/saved-filters", response_model=list[SavedTaskFilterRead])
async def get_saved_filters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return saved_filters.list_saved_filters(db, current_user)


@router.post("/saved-filters", response_model=SavedTaskFilterRead, status_code=status.HTTP_201_CREATED)
async def create_saved_filter(payload: SavedTaskFilterCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return saved_filters.create_saved_filter(db, payload, current_user)


@router.delete("/saved-filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_filter(filter_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    saved_filters.delete_saved_filter(db, filter_id, current_user)


@router.get("/projects/{project_id}/links", response_model=list[TaskLinkRead])
async def get_project_task_links(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_links.list_project_links(db, project_id, current_user)


@router.get("/projects/{project_id}/blocker-owners", response_model=list[BlockerOwnerRead], dependencies=[Depends(can_manage_tasks)])
async def get_blocker_owner_candidates(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_links.list_blocker_owner_candidates(db, project_id, current_user)


@router.get(
    "/",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None, min_length=1, max_length=120),
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    status_filter: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] | None = Query(None, alias="status"),
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None,
    component_id: UUID | None = None,
    release_id: UUID | None = None,
    label: str | None = Query(None, min_length=1, max_length=40),
    overdue: bool = False,
    due_after: date | None = None,
    due_before: date | None = None,
    backlog: bool = False,
    blocked: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_tasks(
        db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        search=search.strip() if search else None,
        project_id=project_id,
        assignee_id=assignee_id,
        task_status=status_filter,
        priority=priority,
        component_id=component_id,
        release_id=release_id,
        label=label.strip().casefold() if label else None,
        overdue=overdue,
        due_after=due_after,
        due_before=due_before,
        backlog=backlog,
        blocked=blocked,
    )


@router.post("/backlog/{task_id}/move", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_tasks)])
async def move_backlog_task(task_id: UUID, direction: Literal["UP", "DOWN"], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.move_backlog_task(db, task_id, direction, current_user)


@router.patch("/bulk", response_model=TaskBulkPriorityResult, dependencies=[Depends(can_manage_tasks)])
@router.patch("/bulk/priority", response_model=TaskBulkPriorityResult, dependencies=[Depends(can_manage_tasks)])
async def bulk_update_tasks(payload: TaskBulkUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated_count = service.bulk_update_tasks(db, payload, current_user)
    return TaskBulkPriorityResult(updated_count=updated_count)


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


@router.get("/{task_id}/comments", response_model=list[TaskCommentRead], status_code=status.HTTP_200_OK, dependencies=[Depends(require_permission("tasks.comments.view"))])
async def get_task_comments(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_comments(db, task_id, current_user)


@router.post("/{task_id}/comments", response_model=TaskCommentRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("tasks.comments.create"))])
async def add_task_comment(task_id: UUID, payload: TaskCommentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.add_comment(db, task_id, payload, current_user)


@router.get("/{task_id}/activity", response_model=list[TaskActivityRead], status_code=status.HTTP_200_OK)
async def get_task_activity(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_activity(db, task_id, current_user)


@router.get("/{task_id}/status-history", response_model=list[TaskStatusHistoryRead], status_code=status.HTTP_200_OK, dependencies=[Depends(can_view_tasks)])
async def get_task_status_history(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_status_history(db, task_id, current_user)


@router.get("/{task_id}/links", response_model=list[TaskLinkRead])
async def get_task_links(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_links.list_links(db, task_id, current_user)


@router.post("/{task_id}/links", response_model=TaskLinkRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_tasks)])
async def create_task_link(task_id: UUID, payload: TaskLinkCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_links.create_link(db, task_id, payload, current_user)


@router.patch("/{task_id}/links/{link_id}", response_model=TaskLinkRead, dependencies=[Depends(can_manage_tasks)])
async def update_task_link_owner(task_id: UUID, link_id: UUID, payload: TaskLinkOwnerUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return task_links.update_link_owner(db, task_id, link_id, payload, current_user)


@router.delete("/{task_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_tasks)])
async def delete_task_link(task_id: UUID, link_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task_links.delete_link(db, task_id, link_id, current_user)


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
