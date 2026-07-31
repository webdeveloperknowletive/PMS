"""
==========================================================
                DATABASE CONFIGURATION
==========================================================

Creates the SQLAlchemy Engine.

The Engine is responsible for establishing and managing
the connection with the PostgreSQL database.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from sqlalchemy import create_engine

from core.config import DATABASE_URL

# ==========================================================
# SQLAlchemy Engine
# ==========================================================

engine = create_engine(
    DATABASE_URL,
    echo=False,           # Set True to view SQL queries
    future=True,
    pool_pre_ping=True,
)