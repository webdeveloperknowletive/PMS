from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
from app.core.config import DATABASE_URL

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
from db.base import Base

# Import every module's models so their tables register on Base.metadata
from app.modules.auth import model as auth_model
from app.modules.audit import model as audit_model
from app.modules.organizations import model as organizations_model
from app.modules.platform import model as platform_model
from app.modules.users import model as users_model
from app.modules.teams import model as teams_model
from app.modules.projects import model as projects_model
from app.modules.tasks import model as tasks_model
from app.modules.kanban import model as kanban_model
from app.modules.gantt import model as gantt_model
from app.modules.milestones import model as milestones_model
from app.modules.workflow import model as workflow_model
from app.modules.calendar import model as calendar_model
from app.modules.documentation import model as documentation_model
from app.modules.notifications import model as notifications_model
from app.modules.reports import model as reports_model
from app.modules.roles import model as roles_model
from app.modules.ai.doc_generator import model as ai_doc_generator_model
from app.modules.ai.meeting_summary import model as ai_meeting_summary_model
from app.modules.ai.risk_prediction import model as ai_risk_prediction_model
from app.modules.ai.sprint_planning import model as ai_sprint_planning_model
from app.modules.ai.task_estimation import model as ai_task_estimation_model

target_metadata = Base.metadata
# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # An explicit connection lets migration tests run in an isolated schema
    # inside a transaction that is rolled back after verification.
    connection = config.attributes.get("connection")
    if connection is not None:
        do_run_migrations(connection)
        return

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
