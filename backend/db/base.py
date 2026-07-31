"""
==========================================================
                    BASE MODEL
==========================================================

All SQLAlchemy models inherit from Base.

Example:

class Student(Base):
    ...
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from sqlalchemy.orm import DeclarativeBase

# ==========================================================
# Base Class
# ==========================================================

class Base(DeclarativeBase):
    pass