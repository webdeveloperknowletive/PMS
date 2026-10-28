from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.tasks.schema import SprintCreate, SprintUpdate, TaskBulkUpdate, TaskCreate, TaskUpdate
from app.modules.projects.goal_schema import ProjectGoalCreate, ProjectGoalUpdate
from app.modules.projects.schema import ProjectUpdate
from app.modules.tasks.service import _build_sprint_burndown, _validate_task_transition
from app.modules.workflow.schema import WorkflowCreate
from app.modules.workflow.transitions import DEFAULT_TASK_TRANSITIONS
from app.core.exceptions import ForbiddenException
from app.modules.calendar.schema import CalendarEventCreate, CalendarEventUpdate


def test_bulk_update_accepts_assignee_and_explicit_unassignment():
    task_id = uuid4()
    assignee_id = uuid4()

    assign = TaskBulkUpdate(task_ids=[task_id], assignee_id=assignee_id)
    unassign = TaskBulkUpdate(task_ids=[task_id], assignee_id=None)

    assert assign.assignee_id == assignee_id
    assert unassign.assignee_id is None
    assert "assignee_id" in unassign.model_fields_set


def test_bulk_update_requires_unique_tasks_and_at_least_one_change():
    task_id = uuid4()

    with pytest.raises(ValidationError, match="unique"):
        TaskBulkUpdate(task_ids=[task_id, task_id], priority="HIGH")
    with pytest.raises(ValidationError, match="Provide a priority, due date, or assignee change"):
        TaskBulkUpdate(task_ids=[task_id])


def test_task_create_supports_spike_work_type():
    task = TaskCreate(project_id=uuid4(), task_name="Investigate queue latency", task_type="SPIKE")

    assert task.task_type == "SPIKE"
    with pytest.raises(ValidationError):
        TaskCreate(project_id=uuid4(), task_name="Invalid type", task_type="RESEARCH")


def test_task_labels_are_trimmed_casefolded_and_unique():
    task = TaskCreate(project_id=uuid4(), task_name="Labeled task", labels=[" Bug ", "API"])

    assert task.labels == ["bug", "api"]
    with pytest.raises(ValidationError, match="unique"):
        TaskCreate(project_id=uuid4(), task_name="Duplicate labels", labels=["Bug", " bug "])
    with pytest.raises(ValidationError, match="1 to 40 characters"):
        TaskCreate(project_id=uuid4(), task_name="Long label", labels=["x" * 41])
    with pytest.raises(ValidationError, match="labels cannot be null"):
        TaskUpdate(labels=None)
    assert TaskUpdate(labels=[]).labels == []


def test_goal_schema_supports_owner_outcome_and_parent_updates():
    owner_id = uuid4()
    parent_goal_id = uuid4()
    goal = ProjectGoalCreate(
        name="Improve reliability",
        success_measure="99.9% uptime",
        owner_id=owner_id,
        parent_goal_id=parent_goal_id,
    )
    assert goal.owner_id == owner_id
    assert goal.parent_goal_id == parent_goal_id
    assert ProjectGoalUpdate(owner_id=None, parent_goal_id=None).model_dump(exclude_unset=True) == {
        "owner_id": None,
        "parent_goal_id": None,
    }
    with pytest.raises(ValidationError):
        ProjectGoalCreate(name="Goal", success_measure="x" * 2001)


def test_sprint_capacity_is_optional_and_bounded():
    project_id = uuid4()
    assert SprintCreate(project_id=project_id, sprint_name="Sprint 2").capacity_points is None
    assert SprintCreate(project_id=project_id, sprint_name="Sprint 2", capacity_points=40).capacity_points == 40
    assert SprintUpdate(capacity_points=None).capacity_points is None
    with pytest.raises(ValidationError):
        SprintCreate(project_id=project_id, sprint_name="Sprint 2", capacity_points=10001)
    with pytest.raises(ValidationError):
        SprintUpdate(capacity_points=1.5)


def test_project_sprint_and_calendar_date_ranges_reject_reversed_dates():
    first_day = date(2026, 1, 10)
    prior_day = date(2026, 1, 9)
    with pytest.raises(ValidationError, match="Due date must be on or after the start date"):
        ProjectUpdate(start_date=first_day, due_date=prior_day)
    with pytest.raises(ValidationError, match="Sprint end date must be on or after its start date"):
        SprintCreate(project_id=uuid4(), sprint_name="Dates", start_date=first_day, end_date=prior_day)
    with pytest.raises(ValidationError, match="Sprint end date must be on or after its start date"):
        SprintUpdate(start_date=first_day, end_date=prior_day)

    start_datetime = datetime(2026, 1, 10, 10, tzinfo=timezone.utc)
    end_datetime = datetime(2026, 1, 10, 9, tzinfo=timezone.utc)
    with pytest.raises(ValidationError, match="end_datetime must be on or after start_datetime"):
        CalendarEventCreate(
            project_id=uuid4(), title="Planning", event_type="Meeting",
            start_datetime=start_datetime, end_datetime=end_datetime,
        )
    with pytest.raises(ValidationError, match="end_datetime cannot be cleared"):
        CalendarEventUpdate(end_datetime=None)
    with pytest.raises(ValidationError, match="end_datetime must be on or after start_datetime"):
        CalendarEventUpdate(start_datetime=start_datetime, end_datetime=end_datetime)


def test_task_transitions_enforce_explicit_rules_and_reviewer_condition():
    _validate_task_transition("TODO", "IN_PROGRESS", can_manage=False, review_pending=False, assigned_reviewer=False)
    _validate_task_transition("IN_REVIEW", "DONE", can_manage=False, review_pending=True, assigned_reviewer=True)
    _validate_task_transition("TODO", "DONE", can_manage=True, review_pending=False, assigned_reviewer=False)
    with pytest.raises(ForbiddenException):
        _validate_task_transition("TODO", "DONE", can_manage=False, review_pending=False, assigned_reviewer=False)
    with pytest.raises(ForbiddenException):
        _validate_task_transition("IN_REVIEW", "DONE", can_manage=True, review_pending=True, assigned_reviewer=False)


def test_project_workflow_transitions_are_validated_and_enforced():
    project_id, lead_id = uuid4(), uuid4()
    workflow = WorkflowCreate(
        project_id=project_id,
        team_lead_id=lead_id,
        workflow_name="Delivery",
        allowed_transitions={**DEFAULT_TASK_TRANSITIONS, "TODO": ["BLOCKED"]},
    )
    assert workflow.allowed_transitions["TODO"] == ["BLOCKED"]

    with pytest.raises(ValidationError, match="cannot transition from TODO to itself"):
        WorkflowCreate(
            project_id=project_id,
            team_lead_id=lead_id,
            workflow_name="Invalid",
            allowed_transitions={**DEFAULT_TASK_TRANSITIONS, "TODO": ["TODO"]},
        )

    configured = {status: set(targets) for status, targets in workflow.allowed_transitions.items()}
    _validate_task_transition(
        "TODO", "BLOCKED", can_manage=False, review_pending=False,
        assigned_reviewer=False, allowed_transitions=configured,
    )
    with pytest.raises(ForbiddenException, match="cannot move"):
        _validate_task_transition(
            "TODO", "IN_PROGRESS", can_manage=False, review_pending=False,
            assigned_reviewer=False, allowed_transitions=configured,
        )


def test_sprint_burndown_reconstructs_scope_and_completion_by_day():
    task_one, task_two, task_three = uuid4(), uuid4(), uuid4()
    start = datetime(2026, 1, 1, 9, tzinfo=timezone.utc)

    def scope(change_id, task_id, event_type, at, points_after=None, points_before=None):
        return SimpleNamespace(
            scope_change_id=change_id,
            task_id=task_id,
            event_type=event_type,
            created_at=at,
            points_after=points_after,
            points_before=points_before,
        )

    def status(history_id, task_id, at, before, after):
        return SimpleNamespace(
            history_id=history_id,
            task_id=task_id,
            created_at=at,
            from_status=before,
            to_status=after,
        )

    scope_events = [
        scope("1", task_one, "BASELINE", start, 5),
        scope("2", task_two, "BASELINE", start, 3),
        scope("3", task_three, "ADDED", datetime(2026, 1, 2, 9, tzinfo=timezone.utc), 2),
        scope("4", task_two, "REMOVED", datetime(2026, 1, 3, 9, tzinfo=timezone.utc), points_before=3),
    ]
    status_events = [
        status("1", task_one, datetime(2025, 12, 20, tzinfo=timezone.utc), None, "TODO"),
        status("2", task_two, datetime(2025, 12, 20, tzinfo=timezone.utc), None, "TODO"),
        status("3", task_three, datetime(2026, 1, 2, 8, tzinfo=timezone.utc), None, "TODO"),
        status("4", task_one, datetime(2026, 1, 1, 12, tzinfo=timezone.utc), "TODO", "IN_PROGRESS"),
        status("5", task_one, datetime(2026, 1, 2, 12, tzinfo=timezone.utc), "IN_PROGRESS", "DONE"),
    ]
    sprint = SimpleNamespace(
        status="COMPLETED",
        started_at=start,
        completed_at=datetime(2026, 1, 3, 12, tzinfo=timezone.utc),
        end_date=date(2026, 1, 3),
    )

    series, baseline_points, cycle_time_days = _build_sprint_burndown(
        sprint, scope_events, status_events,
        {task_one: "DONE", task_two: "TODO", task_three: "TODO"},
    )

    assert baseline_points == 8
    assert [point.remaining_points for point in series] == [8, 5, 2]
    assert [point.completed_points for point in series] == [0, 5, 5]
    assert [point.remaining_tasks for point in series] == [2, 2, 1]
    assert [point.throughput_completed_tasks for point in series] == [0, 1, 0]
    assert [point.status_counts["TODO"] for point in series] == [1, 2, 1]
    assert cycle_time_days == [1.0]
