"""
==========================================================
                DATABASE SESSION
==========================================================

Creates database sessions.

A session is used to perform CRUD operations.

Every API request gets its own session.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from sqlalchemy.orm import sessionmaker

from db.database import engine

# ==========================================================
# Session Factory
# ==========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

# ==========================================================
# Dependency
# ==========================================================

def get_db():
    """
    Creates a database session.

    Automatically closes the session
    after the request is completed.
    """

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()