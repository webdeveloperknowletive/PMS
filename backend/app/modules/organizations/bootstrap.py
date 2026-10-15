"""Workspace schema helpers shared by Alembic and app initialization."""

from uuid import uuid4

from sqlalchemy import Connection, inspect, text
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.modules.organizations.model import Organization

LEGACY_SLUG = "existing-workspace"


def migrate_organization_schema(connection: Connection):
    """Create workspace tables and move pre-SaaS rows into one legacy workspace.

    This is called by the explicit Alembic revision. It accepts Alembic's
    connection so DDL and the data backfill are part of the same migration.
    """
    # Register every product table before create_all and find which tables need
    # their first organization_id column.
    import app.router  # noqa: F401

    Organization.__table__.create(bind=connection, checkfirst=True)
    Base.metadata.create_all(bind=connection, checkfirst=True)

    inspector = inspect(connection)
    scoped_tables = [
        table for table in Base.metadata.sorted_tables
        if table.name != "organizations" and "organization_id" in table.columns
        and inspector.has_table(table.name)
    ]

    row = connection.execute(
        text("SELECT organization_id FROM organizations WHERE slug = :slug"),
        {"slug": LEGACY_SLUG},
    ).first()
    if row:
        legacy_id = row[0]
    else:
        legacy_id = uuid4()
        connection.execute(
            text(
                "INSERT INTO organizations (organization_id, name, slug, status, plan_code) "
                "VALUES (:id, :name, :slug, 'ACTIVE', 'TRIAL' )"
            ),
            {"id": legacy_id, "name": "Existing SprintIX Workspace", "slug": LEGACY_SLUG},
        )

    # Keep the pre-existing installation active without pretending it has a
    # payment-provider subscription. New workspaces begin a real trial record.
    connection.execute(
        text(
            "INSERT INTO organization_subscriptions "
            "(subscription_id, organization_id, billing_provider, plan_code, status, cancel_at_period_end) "
            "VALUES (:subscription_id, :organization_id, 'none', 'TRIAL', 'ACTIVE', FALSE) "
            "ON CONFLICT (organization_id) DO NOTHING"
        ),
        {"subscription_id": uuid4(), "organization_id": legacy_id},
    )

    # Backfill old rows before making organization ownership mandatory.
    current_inspector = inspect(connection)
    for table in scoped_tables:
        columns = {column["name"] for column in current_inspector.get_columns(table.name)}
        if "organization_id" not in columns:
            connection.exec_driver_sql(
                f'ALTER TABLE "{table.name}" ADD COLUMN organization_id UUID '
                "REFERENCES organizations(organization_id) ON DELETE CASCADE"
            )
        connection.execute(
            text(f'UPDATE "{table.name}" SET organization_id = :org WHERE organization_id IS NULL'),
            {"org": legacy_id},
        )
        connection.exec_driver_sql(
            f'ALTER TABLE "{table.name}" ALTER COLUMN organization_id SET NOT NULL'
        )
        connection.exec_driver_sql(
            f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_organization_id" '
            f'ON "{table.name}" (organization_id)'
        )

    if connection.dialect.name == "postgresql":
        # Role names and permission codes used to be globally unique. Each
        # workspace now owns its own role/permission records.
        identifier_preparer = connection.dialect.identifier_preparer
        for table_name, globally_unique_columns in (
            ("roles", ["role_name"]),
            ("permissions", ["code"]),
        ):
            table_inspector = inspect(connection)
            for constraint in table_inspector.get_unique_constraints(table_name):
                if constraint.get("column_names") == globally_unique_columns and constraint.get("name"):
                    table = identifier_preparer.quote(table_name)
                    name = identifier_preparer.quote(constraint["name"])
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name}"
                    )
            # Some older database versions created single-column uniqueness
            # as a standalone unique index instead of a table constraint.
            # Remove those too before creating the workspace-scoped unique
            # constraints below, otherwise the first new tenant still fails
            # when it receives its standard permission catalog.
            for index in table_inspector.get_indexes(table_name):
                if index.get("unique") and index.get("column_names") == globally_unique_columns and index.get("name"):
                    table = identifier_preparer.quote(table_name)
                    name = identifier_preparer.quote(index["name"])
                    connection.exec_driver_sql(f"DROP INDEX IF EXISTS {name}")
        connection.exec_driver_sql("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_roles_org_name') THEN
                    ALTER TABLE roles ADD CONSTRAINT uq_roles_org_name UNIQUE (organization_id, role_name);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_permissions_org_code') THEN
                    ALTER TABLE permissions ADD CONSTRAINT uq_permissions_org_code UNIQUE (organization_id, code);
                END IF;
            END $$;
        """)
        primary_key = inspect(connection).get_pk_constraint("notification_settings")
        if primary_key.get("constrained_columns") != ["organization_id", "setting_key"]:
            old_pk_name = primary_key.get("name")
            if old_pk_name:
                connection.exec_driver_sql(f'ALTER TABLE notification_settings DROP CONSTRAINT "{old_pk_name}"')
            connection.exec_driver_sql(
                "ALTER TABLE notification_settings ADD CONSTRAINT pk_notification_settings_org_key "
                "PRIMARY KEY (organization_id, setting_key)"
            )
    return legacy_id


def get_default_organization_id():
    with Session(bind=engine) as db:
        organization = db.query(Organization).filter_by(slug=LEGACY_SLUG).one()
        return organization.organization_id
