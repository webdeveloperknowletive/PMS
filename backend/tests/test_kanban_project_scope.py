from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.modules.kanban import service
from app.modules.kanban.schema import KanbanTaskUpdate
from app.modules.kanban.model import KanbanColumn
from app.modules.projects.model import Project
from app.modules.tasks.model import Task
from app.modules.teams.model import Team, TeamLead


class ProjectQuery:
    def __init__(self, project):
        self.project = project

    def filter(self, *_conditions):
        return self

    def one_or_none(self):
        return self.project


class ProjectDatabase:
    def __init__(self, project):
        self.project = project

    def query(self, entity):
        assert entity is Project
        return ProjectQuery(self.project)


def test_project_scope_allows_only_ids_in_the_users_board_scope(monkeypatch):
    org_id, project_id = uuid4(), uuid4()
    actor = SimpleNamespace(organization_id=org_id)
    project = SimpleNamespace(project_id=project_id, organization_id=org_id)
    monkeypatch.setattr(service, "_board_scope", lambda _db, _user: ({project_id}, False))

    assert service._require_project_access(ProjectDatabase(project), actor, project_id) is project


def test_project_scope_hides_projects_outside_the_users_board_scope(monkeypatch):
    org_id, project_id = uuid4(), uuid4()
    actor = SimpleNamespace(organization_id=org_id)
    project = SimpleNamespace(project_id=project_id, organization_id=org_id)
    monkeypatch.setattr(service, "_board_scope", lambda _db, _user: ({uuid4()}, False))

    with pytest.raises(HTTPException) as error:
        service._require_project_access(ProjectDatabase(project), actor, project_id)
    assert error.value.status_code == 404


def test_project_scope_hides_projects_from_another_organization(monkeypatch):
    org_id, project_id = uuid4(), uuid4()
    actor = SimpleNamespace(organization_id=org_id)
    monkeypatch.setattr(service, "_board_scope", lambda _db, _user: (None, True))

    with pytest.raises(HTTPException) as error:
        service._require_project_access(ProjectDatabase(None), actor, project_id)
    assert error.value.status_code == 404


def test_board_scope_includes_projects_with_directly_assigned_tasks(monkeypatch):
    org_id, user_id, project_id = uuid4(), uuid4(), uuid4()

    class Query:
        def __init__(self, entity, rows=()):
            self.entity = entity
            self.rows = rows
            self.conditions = []

        def filter(self, *conditions):
            self.conditions.extend(conditions)
            return self

        def subquery(self):
            return select(self.entity).where(*self.conditions).subquery()

        def distinct(self):
            return self

        def all(self):
            return self.rows

    class Database:
        def query(self, entity):
            if entity is Project.project_id:
                return Query(entity)
            if entity is TeamLead.team_lead_id:
                return Query(entity)
            if entity is Team.project_id:
                return Query(entity)
            if entity is Task.project_id:
                return Query(entity, [(project_id,)])
            raise AssertionError(f"Unexpected query entity: {entity}")

    monkeypatch.setattr(service, "has_permission", lambda *_args: False)
    monkeypatch.setattr(service, "get_visible_project_ids", lambda *_args: set())

    project_ids, can_view_project_tasks = service._board_scope(
        Database(), SimpleNamespace(organization_id=org_id, user_id=user_id)
    )

    assert project_ids == {project_id}
    assert can_view_project_tasks is False


def test_placement_update_rejects_a_column_from_another_project(monkeypatch):
    org_id, source_project_id, target_project_id, target_column_id = uuid4(), uuid4(), uuid4(), uuid4()
    actor = SimpleNamespace(organization_id=org_id)
    placement = SimpleNamespace(
        task=SimpleNamespace(project_id=source_project_id, archived_at=None),
    )
    target_column = SimpleNamespace(
        organization_id=org_id,
        project_id=target_project_id,
    )
    class Database:
        def get(self, entity, _entity_id):
            assert entity is KanbanColumn
            return target_column

    monkeypatch.setattr(service, "get_kanban_task", lambda *_args: placement)

    with pytest.raises(HTTPException) as error:
        service.update_kanban_task(Database(), uuid4(), KanbanTaskUpdate(column_id=target_column_id), actor)
    assert error.value.status_code == 400
