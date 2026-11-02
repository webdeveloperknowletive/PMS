from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.ai.meeting_summary.schema import AIMeetingApplyRequest
from app.modules.ai.sprint_planning.schema import AISprintPlanApplyRequest
from app.router import api_router  # noqa: F401 - register all mapped classes before ORM model construction
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.modules.gantt import service as gantt_service
from app.modules.gantt.schema import GanttTaskUpdate


def test_ai_apply_requests_require_unique_selection():
    task_id = uuid4()
    with pytest.raises(ValidationError, match="once"):
        AISprintPlanApplyRequest(selected_task_ids=[task_id, task_id])
    with pytest.raises(ValidationError, match="once"):
        AIMeetingApplyRequest(item_indexes=[1, 1])
    with pytest.raises(ValidationError, match="Choose each action item once"):
        AIMeetingApplyRequest(item_indexes=[-1])


def test_automatic_milestone_events_keep_a_stable_relation():
    class CollectingSession:
        def __init__(self):
            self.items = []

        def add(self, item):
            self.items.append(item)

    db = CollectingSession()
    milestone_id = uuid4()
    add_automatic_calendar_entries(
        db,
        project_id=uuid4(),
        actor_id=uuid4(),
        title="Milestone: First release",
        description="Review release readiness.",
        event_type="Milestone",
        related_milestone_id=milestone_id,
        personal_user_ids={uuid4(), uuid4()},
        event_date=date(2026, 11, 15),
    )
    assert len(db.items) == 3
    assert {event.related_milestone_id for event in db.items} == {milestone_id}
    assert {event.calendar_scope for event in db.items} == {"ORGANIZATION", "PERSONAL"}


def test_gantt_date_edit_updates_linked_task_using_task_date_validation(monkeypatch):
    gantt_id, task_id, project_id, organization_id = uuid4(), uuid4(), uuid4(), uuid4()
    start_date, end_date = date(2026, 11, 2), date(2026, 11, 12)
    task = SimpleNamespace(task_id=task_id, project_id=project_id, organization_id=organization_id,
                           start_date=date(2026, 11, 1), due_date=date(2026, 11, 10))
    gantt = SimpleNamespace(gantt_id=gantt_id, task_id=task_id, project_id=project_id,
                            start_date=task.start_date, end_date=task.due_date, dependency_task=None)

    class Query:
        def filter(self, *_args):
            return self

        def one_or_none(self):
            return task

    db = SimpleNamespace(query=lambda _model: Query())
    actor = SimpleNamespace(organization_id=organization_id, user_id=uuid4(), name="Admin")
    monkeypatch.setattr(gantt_service, "get_gantt_task", lambda *_args: gantt)
    monkeypatch.setattr(gantt_service.repository, "update_gantt_task", lambda _db, _id, _payload: gantt)
    monkeypatch.setattr(gantt_service, "_validate_task_due_date", lambda *_args: None)
    validated_ranges = []
    monkeypatch.setattr(gantt_service, "_validate_task_date_range", lambda *values: validated_ranges.append(values))
    monkeypatch.setattr(gantt_service, "notify_project_users", lambda *_args, **_kwargs: None)

    result = gantt_service.update_gantt_task(
        db, gantt_id, GanttTaskUpdate(start_date=start_date, end_date=end_date), actor,
    )

    assert result is gantt
    assert (task.start_date, task.due_date) == (start_date, end_date)
    assert validated_ranges == [(start_date, end_date)]


def test_gantt_date_edit_rejects_reversed_range_before_writing(monkeypatch):
    start_date, end_date = date(2026, 11, 12), date(2026, 11, 2)
    gantt = SimpleNamespace(gantt_id=uuid4(), task_id=uuid4(), project_id=uuid4(),
                            start_date=date(2026, 11, 1), end_date=date(2026, 11, 10), dependency_task=None)
    monkeypatch.setattr(gantt_service, "get_gantt_task", lambda *_args: gantt)
    monkeypatch.setattr(gantt_service.repository, "update_gantt_task", lambda *_args: pytest.fail("must not write"))
    with pytest.raises(ValidationError, match="end_date must be on or after start_date"):
        gantt_service.update_gantt_task(
            SimpleNamespace(), gantt.gantt_id,
            GanttTaskUpdate(start_date=start_date, end_date=end_date),
            SimpleNamespace(organization_id=uuid4()),
        )
