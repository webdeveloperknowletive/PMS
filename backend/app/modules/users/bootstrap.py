"""Add optional profile photo metadata to existing user tables."""

from sqlalchemy import inspect

from app.core.database import engine
from app.modules.users.model import User


def ensure_user_profile_schema() -> None:
    with engine.begin() as connection:
        if not inspect(connection).has_table(User.__tablename__):
            return
        columns = {column["name"] for column in inspect(connection).get_columns(User.__tablename__)}
        for name, column_type in (("profile_picture_filename", "VARCHAR(255)"), ("profile_picture_mime_type", "VARCHAR(100)")):
            if name not in columns:
                connection.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {name} {column_type}")
