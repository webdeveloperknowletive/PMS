import uuid
from datetime import date, datetime
from typing import Literal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TaskChecklistItem(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=80, str_strip_whitespace=True)
    text: str = Field(..., min_length=1, max_length=255, str_strip_whitespace=True)
    is_completed: bool = False
    assignee_user_id: uuid.UUID | None = None
    assignee_name: str | None = Field(None, max_length=150)
    due_date: date | None = None


class TaskChecklistMemberOptionRead(BaseModel):
    user_id: uuid.UUID
    name: str


class TaskAssigneeCandidateRead(BaseModel):
    user_id: uuid.UUID
    name: str
    role_name: str = "Developer"
    team_id: uuid.UUID
    team_name: str


class TaskCardMemberRead(BaseModel):
    user_id: uuid.UUID
    name: str
    profile_picture_url: str | None = None
    is_primary: bool = False
    assigned_at: datetime | None = None


class TaskBase(BaseModel):
    project_id: uuid.UUID
    goal_id: uuid.UUID | None = None
    release_id: uuid.UUID | None = None
    component_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    task_name: str = Field(..., min_length=1, max_length=255, str_strip_whitespace=True)
    description: str | None = Field(None, max_length=10000, str_strip_whitespace=True)
    task_type: Literal["EPIC", "STORY", "TASK", "BUG", "SPIKE", "SUBTASK"] = "TASK"
    story_points: int | None = Field(None, ge=0, le=100)
    status: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] = "TODO"
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    start_date: date | None = None
    due_date: date | None = None
    reminder_days_before: Literal[0, 1, 2, 7] | None = None
    checklist_items: list[TaskChecklistItem] = Field(default_factory=list, max_length=100)
    labels: list[str] = Field(default_factory=list, max_length=20)
    custom_fields: dict[str, Any] = Field(default_factory=dict)

    @field_validator("labels", mode="before")
    @classmethod
    def _normalize_labels(cls, value):
        return _normalize_task_labels(value, allow_none=False)

    @field_validator("checklist_items")
    @classmethod
    def _validate_checklist_items(cls, value):
        return _validate_unique_checklist_items(value)

    @model_validator(mode="after")
    def _validate_date_range(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("Task due date must be on or after its start date")
        if self.reminder_days_before is not None and self.due_date is None:
            raise ValueError("Choose a due date before setting a reminder")
        return self


class TaskCreate(TaskBase):
    labels: list[str] = Field(..., min_length=1, max_length=20)
    kanban_column_id: uuid.UUID | None = None
    kanban_position: int | None = Field(None, ge=0)


class TaskUpdate(BaseModel):
    goal_id: uuid.UUID | None = None
    release_id: uuid.UUID | None = None
    component_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    task_name: str | None = Field(None, min_length=1, max_length=255, str_strip_whitespace=True)
    description: str | None = Field(None, max_length=10000, str_strip_whitespace=True)
    task_type: Literal["EPIC", "STORY", "TASK", "BUG", "SPIKE", "SUBTASK"] | None = None
    story_points: int | None = Field(None, ge=0, le=100)
    status: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None
    start_date: date | None = None
    due_date: date | None = None
    reminder_days_before: Literal[0, 1, 2, 7] | None = None
    checklist_items: list[TaskChecklistItem] = Field(default_factory=list, max_length=100)
    labels: list[str] | None = Field(None, max_length=20)
    custom_fields: dict[str, Any] | None = None

    @field_validator("labels", mode="before")
    @classmethod
    def _normalize_labels(cls, value):
        return _normalize_task_labels(value, allow_none=True)

    @field_validator("checklist_items")
    @classmethod
    def _validate_checklist_items(cls, value):
        return _validate_unique_checklist_items(value)

    @model_validator(mode="after")
    def _reject_null_required_values(self):
        for field in ("task_name", "task_type", "status", "priority"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        if "labels" in self.model_fields_set and self.labels is None:
            raise ValueError("labels cannot be null; use an empty list to clear labels")
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("Task due date must be on or after its start date")
        return self


class CardLabelsUpdate(BaseModel):
    labels: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("labels", mode="before")
    @classmethod
    def _normalize_labels(cls, value):
        return _normalize_task_labels(value, allow_none=False)


class CardDatesUpdate(BaseModel):
    start_date: date | None = None
    due_date: date | None = None
    reminder_days_before: Literal[0, 1, 2, 7] | None = None

    @model_validator(mode="after")
    def _validate_date_range(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("Task due date must be on or after its start date")
        if self.reminder_days_before is not None and self.due_date is None:
            raise ValueError("Choose a due date before setting a reminder")
        return self


class TaskDeadlineReminderCheck(BaseModel):
    local_date: date


class TaskDeadlineReminderCheckResult(BaseModel):
    created_count: int = Field(..., ge=0)


class CardChecklistUpdate(BaseModel):
    checklist_items: list[TaskChecklistItem] = Field(default_factory=list, max_length=100)

    @field_validator("checklist_items")
    @classmethod
    def _validate_checklist_items(cls, value):
        return _validate_unique_checklist_items(value)


class TaskAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attachment_id: uuid.UUID
    task_id: uuid.UUID
    uploaded_by: uuid.UUID | None
    uploader_name: str | None = None
    original_filename: str
    mime_type: str
    file_size: int
    created_at: datetime


def _normalize_task_labels(value, *, allow_none: bool):
    if value is None:
        if not allow_none:
            raise ValueError("labels must be a list")
        return None
    if not isinstance(value, list):
        raise ValueError("labels must be a list")
    normalized = []
    seen = set()
    for label in value:
        if not isinstance(label, str):
            raise ValueError("labels must contain text values")
        label = label.strip()
        if not label or len(label) > 40:
            raise ValueError("each label must contain 1 to 40 characters")
        key = label.casefold()
        if key in seen:
            raise ValueError("labels must be unique")
        seen.add(key)
        normalized.append(label.casefold())
    return normalized


def _validate_unique_checklist_items(items: list[TaskChecklistItem]) -> list[TaskChecklistItem]:
    item_ids = [item.item_id for item in items]
    if len(item_ids) != len(set(item_ids)):
        raise ValueError("Checklist item IDs must be unique")
    return items


class TaskBulkUpdate(BaseModel):
    task_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=100)
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _validate_update(self):
        if len(self.task_ids) != len(set(self.task_ids)):
            raise ValueError("task_ids must be unique")
        if not ({"priority", "due_date", "assignee_id"} & self.model_fields_set):
            raise ValueError("Provide a priority, due date, or assignee change")
        if "priority" in self.model_fields_set and self.priority is None:
            raise ValueError("priority cannot be cleared")
        return self


class TaskBulkPriorityResult(BaseModel):
    updated_count: int = Field(..., ge=0)


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    task_id: uuid.UUID
    backlog_rank: int = 0
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None
    review_feedback: str | None = None
    archived_at: datetime | None = None
    archived_by_user_id: uuid.UUID | None = None
    card_members: list[TaskCardMemberRead] = Field(default_factory=list)


class SprintCreate(BaseModel):
    project_id: uuid.UUID
    sprint_name: str = Field(..., min_length=2, max_length=150, str_strip_whitespace=True)
    goal: str | None = Field(None, max_length=5000, str_strip_whitespace=True)
    start_date: date | None = None
    end_date: date | None = None
    capacity_points: int | None = Field(None, ge=0, le=10000)

    @model_validator(mode="after")
    def _check_date_range(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Sprint end date must be on or after its start date")
        return self


class SprintUpdate(BaseModel):
    sprint_name: str | None = Field(None, min_length=2, max_length=150, str_strip_whitespace=True)
    goal: str | None = Field(None, max_length=5000, str_strip_whitespace=True)
    start_date: date | None = None
    end_date: date | None = None
    capacity_points: int | None = Field(None, ge=0, le=10000)
    status: Literal["PLANNED", "ACTIVE", "COMPLETED"] | None = None

    @model_validator(mode="after")
    def _reject_null_required_values(self):
        for field in ("sprint_name", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Sprint end date must be on or after its start date")
        return self


class SprintRead(SprintCreate):
    model_config = ConfigDict(from_attributes=True)

    sprint_id: uuid.UUID
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class SprintScopeChangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope_change_id: uuid.UUID
    task_id: uuid.UUID | None
    task_name: str
    actor_id: uuid.UUID | None
    event_type: Literal["BASELINE", "ADDED", "REMOVED", "POINTS_CHANGED"]
    points_before: int | None
    points_after: int | None
    created_at: datetime


class SprintBurndownPointRead(BaseModel):
    date: date
    remaining_points: int
    ideal_points: float
    completed_points: int
    remaining_tasks: int
    throughput_completed_tasks: int
    status_counts: dict[str, int] = Field(default_factory=dict)


class SprintVelocityRead(BaseModel):
    sprint_id: uuid.UUID
    sprint_name: str
    completed_at: datetime
    delivered_points: int


class SprintReportRead(BaseModel):
    sprint_id: uuid.UUID
    total_tasks: int
    completed_tasks: int
    remaining_tasks: int
    overdue_tasks: int
    current_scope_points: int
    completed_points: int
    remaining_points: int
    capacity_points: int | None = None
    original_scope_points: int | None = None
    scope_added_points: int = 0
    scope_removed_points: int = 0
    scope_changes: list[SprintScopeChangeRead] = Field(default_factory=list)
    status_counts: dict[str, int]
    started_at: datetime | None = None
    completed_at: datetime | None = None
    history_start_date: date | None = None
    burndown_history_available: bool = False
    burndown: list[SprintBurndownPointRead] = Field(default_factory=list)
    velocity_points: int | None = None
    velocity_basis: Literal["PROJECT", "MY_ASSIGNED_TASKS"] = "PROJECT"
    velocity_history: list[SprintVelocityRead] = Field(default_factory=list)
    average_velocity_points: float | None = None
    total_throughput_tasks: int = 0
    average_cycle_time_days: float | None = None
    median_cycle_time_days: float | None = None
    cycle_time_sample_count: int = 0


class BlockedTaskRead(BaseModel):
    link_id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    source_task_id: uuid.UUID
    source_task_name: str
    target_task_id: uuid.UUID
    target_task_name: str
    target_due_date: date | None
    owner_id: uuid.UUID | None
    owner_name: str | None


class BlockedTasksSummaryRead(BaseModel):
    count: int = Field(..., ge=0)
    items: list[BlockedTaskRead] = Field(default_factory=list)


class TaskDependencyListRead(BaseModel):
    total_count: int = Field(..., ge=0)
    items: list[BlockedTaskRead] = Field(default_factory=list)


class SavedTaskFilterCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=60)
    search: str | None = Field(None, max_length=120)
    project_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    label: str | None = Field(None, min_length=1, max_length=40, str_strip_whitespace=True)
    component_id: uuid.UUID | None = None
    release_id: uuid.UUID | None = None
    status: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None
    overdue: bool = False
    is_shared: bool = False


class SavedTaskFilterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filter_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    search: str | None
    project_id: uuid.UUID | None
    assignee_id: uuid.UUID | None
    label: str | None = None
    component_id: uuid.UUID | None = None
    release_id: uuid.UUID | None = None
    status: str | None
    priority: str | None
    overdue: bool
    is_shared: bool = False
    created_at: datetime
    updated_at: datetime


class TaskCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000, str_strip_whitespace=True)


class TaskCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comment_id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID | None
    content: str
    created_at: datetime
    author_name: str | None = None
    author_profile_picture_url: str | None = None


class TaskActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_id: uuid.UUID
    task_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    details: str
    created_at: datetime
    actor_name: str | None = None


class TaskStatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: uuid.UUID
    task_id: uuid.UUID
    task_name: str
    actor_id: uuid.UUID | None
    from_status: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] | None
    to_status: Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"]
    created_at: datetime


class TaskLinkCreate(BaseModel):
    target_task_id: uuid.UUID
    link_type: Literal["BLOCKS", "RELATES_TO", "DUPLICATES"] = "BLOCKS"
    owner_id: uuid.UUID | None = None


class TaskLinkOwnerUpdate(BaseModel):
    owner_id: uuid.UUID | None


class BlockerOwnerRead(BaseModel):
    user_id: uuid.UUID
    name: str


class TaskLinkRead(BaseModel):
    link_id: uuid.UUID
    source_task_id: uuid.UUID
    target_task_id: uuid.UUID
    owner_id: uuid.UUID | None = None
    owner_name: str | None = None
    source_task_name: str
    target_task_name: str
    link_type: str
    created_by: uuid.UUID | None
    created_at: datetime


class WorkSessionStart(BaseModel):
    task_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=25)


class WorkSessionRead(BaseModel):
    work_session_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int
    is_running: bool
    task_ids: list[uuid.UUID]
    task_names: list[str]


class TaskWorkTimeRead(BaseModel):
    task_id: uuid.UUID
    duration_seconds: int
    reported_duration_seconds: int = 0
    pending_review_seconds: int = 0
    is_tracking: bool
    is_reported_tracking: bool = False
    active_since: datetime | None = None
