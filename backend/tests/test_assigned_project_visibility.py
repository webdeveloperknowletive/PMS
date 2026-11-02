from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import select

import app.router  # noqa: F401 - register all string-based ORM relationships
from app.modules.projects import service
from app.modules.projects.model import Project
from app.modules.tasks.model import Task
from app.modules.teams.model import Team, TeamLead, TeamMember


class QueryBuilder:
    def __init__(self, entity, result=()):
        self.entity = entity
        self.result = result
        self.conditions = []
        self.joins = []
        self.is_distinct = False
        self.statement = None

    def filter(self, *conditions):
        self.conditions.extend(conditions)
        return self

    def join(self, target, on_clause):
        self.joins.append((target, on_clause))
        return self

    def distinct(self):
        self.is_distinct = True
        return self

    def subquery(self):
        statement = select(self.entity)
        for target, on_clause in self.joins:
            statement = statement.join(target, on_clause)
        if self.conditions:
            statement = statement.where(*self.conditions)
        if self.is_distinct:
            statement = statement.distinct()
        return statement.subquery()

    def __clause_element__(self):
        statement = select(self.entity)
        for target, on_clause in self.joins:
            statement = statement.join(target, on_clause)
        if self.conditions:
            statement = statement.where(*self.conditions)
        if self.is_distinct:
            statement = statement.distinct()
        return statement

    def order_by(self, *_expressions):
        return self

    def offset(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def all(self):
        if self.entity is Project:
            self.statement = " ".join(str(condition) for condition in self.conditions)
        return list(self.result)


def test_developer_can_select_a_project_when_a_task_is_assigned_to_them(monkeypatch):
    organization_id, user_id, project_id = uuid4(), uuid4(), uuid4()
    project = SimpleNamespace(project_id=project_id)

    class Database:
        def __init__(self):
            self.project_query = None

        def query(self, entity):
            query = QueryBuilder(entity, [project] if entity is Project else ())
            if entity is Project:
                self.project_query = query
            return query

    db = Database()
    monkeypatch.setattr(service, "has_permission", lambda *_args: False)

    projects = service.get_projects(
        db,
        SimpleNamespace(organization_id=organization_id, user_id=user_id),
    )

    assert projects == [project]
    statement = db.project_query.statement
    assert "tasks.project_id" in statement
    assert "tasks.user_id" in statement
    assert "tasks.organization_id" in statement
    assert "tasks.archived_at" in statement
