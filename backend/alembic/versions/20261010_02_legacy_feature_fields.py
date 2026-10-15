"""Version the older chat, document, and profile schema additions.

Revision ID: 20261010_02
Revises: 20261010_01
Create Date: 2026-10-10
"""

from uuid import uuid4

from alembic import op
from sqlalchemy import inspect, text

revision = "20261010_02"
down_revision = "20261010_01"
branch_labels = None
depends_on = None


def _add_column_if_missing(connection, table_name: str, column_name: str, definition: str) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
    if column_name not in columns:
        connection.exec_driver_sql(
            f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {definition}'
        )


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        raise RuntimeError("SprintIX workspace migrations currently require PostgreSQL.")

    # Existing installations need these columns added. On a new installation,
    # revision 20261010_01 has already created the latest table definitions.
    document_columns = {
        "resource_type": "VARCHAR(20) NOT NULL DEFAULT 'FILE'",
        "stored_filename": "VARCHAR(255)",
        "original_filename": "VARCHAR(255)",
        "mime_type": "VARCHAR(150)",
        "file_size": "BIGINT",
        "created_by": "VARCHAR(255)",
        "updated_by": "VARCHAR(255)",
        "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP",
    }
    for column_name, definition in document_columns.items():
        _add_column_if_missing(connection, "documents", column_name, definition)

    _add_column_if_missing(
        connection,
        "users",
        "profile_picture_filename",
        "VARCHAR(255)",
    )
    _add_column_if_missing(
        connection,
        "users",
        "profile_picture_mime_type",
        "VARCHAR(100)",
    )
    _add_column_if_missing(
        connection,
        "users",
        "is_email_verified",
        "BOOLEAN NOT NULL DEFAULT TRUE",
    )
    _add_column_if_missing(
        connection,
        "users",
        "terms_accepted_at",
        "TIMESTAMP WITH TIME ZONE",
    )
    _add_column_if_missing(connection, "users", "terms_version", "VARCHAR(30)")

    _add_column_if_missing(
        connection,
        "notifications",
        "chat_conversation_id",
        "UUID REFERENCES chat_conversations(conversation_id) ON DELETE SET NULL",
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_notifications_chat_conversation_id "
        "ON notifications (chat_conversation_id)"
    )

    chat_message_columns = {
        "message_type": "VARCHAR(20) NOT NULL DEFAULT 'TEXT'",
        "attachment_filename": "VARCHAR(255)",
        "attachment_mime_type": "VARCHAR(255)",
        "attachment_original_name": "VARCHAR(255)",
        "reply_to_message_id": "UUID REFERENCES chat_messages(message_id) ON DELETE SET NULL",
    }
    for column_name, definition in chat_message_columns.items():
        _add_column_if_missing(connection, "chat_messages", column_name, definition)

    chat_setting_columns = {
        "volume_percent": "INTEGER NOT NULL DEFAULT 70",
        "font_size": "VARCHAR(12) NOT NULL DEFAULT 'medium'",
        "theme": "VARCHAR(8) NOT NULL DEFAULT 'light'",
    }
    for column_name, definition in chat_setting_columns.items():
        _add_column_if_missing(connection, "chat_user_settings", column_name, definition)
    _add_column_if_missing(
        connection,
        "chat_conversation_members",
        "is_group_admin",
        "BOOLEAN NOT NULL DEFAULT FALSE",
    )

    # Preserve the previous document-type classification behavior.
    connection.execute(
        text(
            "UPDATE documents SET resource_type = 'GITHUB' "
            "WHERE file_url ILIKE :github_url AND resource_type = 'FILE'"
        ),
        {"github_url": "%github.com%"},
    )
    connection.execute(
        text(
            "UPDATE documents SET resource_type = 'DRIVE' "
            "WHERE file_url IS NOT NULL AND resource_type = 'FILE'"
        )
    )

    # Keep the historical contributor document-delete grant, but apply it
    # independently to each company's own role and permission records.
    organizations = connection.execute(
        text("SELECT organization_id FROM organizations")
    ).all()
    for (organization_id,) in organizations:
        permission = connection.execute(
            text(
                "SELECT permission_id FROM permissions "
                "WHERE organization_id = :organization_id AND code = 'documents.delete'"
            ),
            {"organization_id": organization_id},
        ).first()
        if permission is None:
            continue
        roles = connection.execute(
            text(
                "SELECT role_id FROM roles WHERE organization_id = :organization_id "
                "AND role_name IN ('Project Manager', 'Developer', 'Tester')"
            ),
            {"organization_id": organization_id},
        ).all()
        for (role_id,) in roles:
            exists = connection.execute(
                text(
                    "SELECT 1 FROM role_permissions WHERE organization_id = :organization_id "
                    "AND role_id = :role_id AND permission_id = :permission_id"
                ),
                {
                    "organization_id": organization_id,
                    "role_id": role_id,
                    "permission_id": permission[0],
                },
            ).first()
            if exists is None:
                connection.execute(
                    text(
                        "INSERT INTO role_permissions "
                        "(role_permission_id, organization_id, role_id, permission_id) "
                        "VALUES (:id, :organization_id, :role_id, :permission_id)"
                    ),
                    {
                        "id": uuid4(),
                        "organization_id": organization_id,
                        "role_id": role_id,
                        "permission_id": permission[0],
                    },
                )

    # Organization-level defaults are initialized for old workspaces here;
    # new workspaces receive the same defaults during signup.
    default_settings = {
        "meeting_reminder_lead_minutes": "60",
        "toast_duration_seconds": "8",
        "notification_sound_key": "gentle_chime",
        "chat_sound_key": "double_ping",
        "chat_master_volume_percent": "100",
    }
    for (organization_id,) in organizations:
        for setting_key, setting_value in default_settings.items():
            connection.execute(
                text(
                    "INSERT INTO notification_settings "
                    "(organization_id, setting_key, setting_value) "
                    "VALUES (:organization_id, :setting_key, :setting_value) "
                    "ON CONFLICT (organization_id, setting_key) DO NOTHING"
                ),
                {
                    "organization_id": organization_id,
                    "setting_key": setting_key,
                    "setting_value": setting_value,
                },
            )


def downgrade() -> None:
    raise RuntimeError(
        "This data-preserving schema migration cannot be safely reversed automatically. "
        "Restore a verified database backup instead."
    )
