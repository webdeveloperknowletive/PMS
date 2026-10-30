"""Create only the frozen starting tables used by the workspace migration."""

from pathlib import Path

from sqlalchemy import Connection, inspect


def create_baseline_tables(connection: Connection) -> None:
    # The initial migration must not use live Base.metadata.create_all(): that
    # also creates objects which later revisions still need to add. Keep this
    # snapshot fixed and evolve the schema through the revision chain instead.
    schema = Path(__file__).with_name("migration_baseline.sql").read_text(encoding="utf-8")
    existing_tables = set(inspect(connection).get_table_names())
    for block in schema.split("-- table: ")[1:]:
        table_name, statements = block.split("\n", 1)
        if table_name not in existing_tables:
            connection.exec_driver_sql(statements)

