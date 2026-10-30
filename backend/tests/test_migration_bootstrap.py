"""Regression coverage for initial setup and legacy workspace upgrades.

PostgreSQL integration cases are opt-in with RUN_MIGRATION_TESTS=1. They create
an isolated schema in the configured development database, use only that schema,
and roll back the entire transaction. Existing application data is not touched.
"""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from db.migration_baseline import create_baseline_tables


BACKEND = Path(__file__).resolve().parents[1]


def test_baseline_does_not_create_later_revision_objects():
    schema = (BACKEND / "db" / "migration_baseline.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE organizations (" in schema
    assert "CREATE TABLE tasks (" in schema
    assert "CREATE TABLE task_work_sessions (" not in schema
    assert "CREATE TABLE task_sprints (" not in schema
    assert "CREATE TABLE task_attachments (" not in schema
    assert "project_manager_user_id" not in schema
    assert "project_key" not in schema
    assert "reminder_days_before" not in schema


@pytest.mark.skipif(os.getenv("RUN_MIGRATION_TESTS") != "1", reason="Opt-in local PostgreSQL migration test")
@pytest.mark.parametrize("legacy", [False, True], ids=["empty-database", "legacy-data"])
def test_full_migration_chain(legacy):
    from app.core.config import DATABASE_URL

    engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 5})
    schema = "migration_test_" + uuid4().hex
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
                connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')
                assert connection.scalar(text("SELECT current_schema()")) == schema
                user_id = uuid4()
                if legacy:
                    create_baseline_tables(connection)
                    connection.exec_driver_sql("ALTER TABLE users DROP COLUMN organization_id CASCADE")
                    connection.execute(text(
                        "INSERT INTO users (user_id, name, email, password_hash, is_active) "
                        "VALUES (:id, 'Migration regression', 'migration@example.test', 'unused', TRUE)"
                    ), {"id": user_id})

                config = Config(str(BACKEND / "alembic.ini"))
                config.set_main_option("script_location", str(BACKEND / "alembic"))
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                head = ScriptDirectory.from_config(config).get_current_head()
                assert MigrationContext.configure(connection).get_current_revision() == head

                inspector = inspect(connection)
                assert inspector.has_table("task_work_sessions")
                assert inspector.has_table("task_reminder_deliveries")
                assert {"linked_at", "ended_at", "duration_seconds"} <= {
                    item["name"] for item in inspector.get_columns("task_work_session_tasks")
                }
                assert connection.scalar(text(
                    "SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "
                    "JOIN pg_namespace n ON n.oid=c.relnamespace "
                    "WHERE n.nspname=current_schema() AND t.tgname='trg_task_status_history_immutable'"
                )) == 1
                assert connection.scalar(text("SELECT COUNT(*) FROM permissions")) > 0
                if legacy:
                    assert connection.scalar(text(
                        "SELECT COUNT(*) FROM users u JOIN organizations o USING (organization_id) "
                        "WHERE u.user_id=:id AND o.slug='existing-workspace' "
                        "AND u.name='Migration regression'"
                    ), {"id": user_id}) == 1

                # A repeat of the normal setup command must be a no-op.
                command.upgrade(config, "head")
                assert MigrationContext.configure(connection).get_current_revision() == head
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
