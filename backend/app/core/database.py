"""
==========================================================
                CORE DATABASE (APP-FACING)
==========================================================

Thin re-export layer over the real SQLAlchemy setup in `db/`.

Every model in `app/modules/*/model.py` does:

    from app.core.database import Base

so this module exists purely so those models depend on `app.core`
instead of reaching into the top-level `db/` package directly -
matching the same re-export pattern `app.core.dependencies.get_database()`
already uses for `db.session.get_db`.

The actual implementations live in:
    - db/base.py     -> Base (DeclarativeBase)
    - db/database.py -> engine (SQLAlchemy Engine)
    - db/session.py  -> SessionLocal, get_db
"""

# ==========================================================
# Re-exports
# ==========================================================

from db.base import Base
from db.database import engine

__all__ = [
    "Base",
    "engine",
]
