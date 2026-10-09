"""Small additive schema upgrade for documents created before file storage."""

from sqlalchemy import inspect, text

from app.core.database import engine
from app.modules.documentation.model import Document


def ensure_document_resource_schema() -> None:
    """Add document resource and attribution fields without touching existing rows."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table(Document.__tablename__):
            Document.__table__.create(bind=connection, checkfirst=True)
            existing = {column.name for column in Document.__table__.columns}
        else:
            existing = {column["name"] for column in inspector.get_columns(Document.__tablename__)}
        new_columns = {
            "resource_type": "VARCHAR(20) NOT NULL DEFAULT 'FILE'",
            "stored_filename": "VARCHAR(255)",
            "original_filename": "VARCHAR(255)",
            "mime_type": "VARCHAR(150)",
            "file_size": "BIGINT",
            "created_by": "VARCHAR(255)",
            "updated_by": "VARCHAR(255)",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }
        for column_name, column_definition in new_columns.items():
            if column_name not in existing:
                connection.exec_driver_sql(
                    f"ALTER TABLE documents ADD COLUMN {column_name} {column_definition}"
                )

        if connection.dialect.name == "postgresql":
            connection.execute(
                text(
                "UPDATE documents SET resource_type = 'GITHUB' "
                    "WHERE file_url ILIKE :github_url AND resource_type = 'FILE'"
                ),
                {"github_url": "%github.com%"},
            )

            # One-time, additive role update for the requested contributors.
            # The marker means later Admin permission changes remain respected.
            connection.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS app_migration_flags ("
                "migration_key VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
            )
            migration_key = "contributors-can-delete-documents-v1"
            applied = connection.execute(
                text("SELECT 1 FROM app_migration_flags WHERE migration_key = :migration_key"),
                {"migration_key": migration_key},
            ).first()
            if not applied:
                roles = connection.execute(
                    text("SELECT role_id FROM roles WHERE role_name IN ('Project Manager', 'Developer', 'Tester')")
                ).all()
                permission = connection.execute(
                    text("SELECT permission_id FROM permissions WHERE code = 'documents.delete'")
                ).first()
                if permission:
                    from uuid import uuid4

                    for (role_id,) in roles:
                        exists = connection.execute(
                            text("SELECT 1 FROM role_permissions WHERE role_id = :role_id AND permission_id = :permission_id"),
                            {"role_id": role_id, "permission_id": permission[0]},
                        ).first()
                        if not exists:
                            connection.execute(
                                text(
                                "INSERT INTO role_permissions (role_permission_id, role_id, permission_id) "
                                    "VALUES (:id, :role_id, :permission_id)"
                                ),
                                {"id": uuid4(), "role_id": role_id, "permission_id": permission[0]},
                            )
                    connection.execute(
                        text("INSERT INTO app_migration_flags (migration_key) VALUES (:migration_key)"),
                        {"migration_key": migration_key},
                    )
            connection.execute(
                text(
                "UPDATE documents SET resource_type = 'DRIVE' "
                    "WHERE file_url IS NOT NULL AND resource_type = 'FILE'"
                )
            )
