"""Create a developer-company platform admin explicitly.

Usage (development only):
  python scripts/create_platform_admin.py --name "Platform Admin" --email admin@example.com
The password is read from PLATFORM_ADMIN_PASSWORD and is never accepted on
the command line.
"""

import argparse
import os
import sys
from pathlib import Path

# Allow this script to be run directly from backend\scripts with the exact
# command documented for Windows users.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Register all application models and relationship targets before SQLAlchemy
# configures the PlatformAdmin mapper.
import app.router  # noqa: F401,E402

from sqlalchemy import func

from app.core.config import APP_ENV
from db.session import SessionLocal
from app.modules.auth.service import hash_password
from app.modules.platform.model import PlatformAdmin


def main() -> None:
    if APP_ENV == "production":
        raise SystemExit("Refusing to create platform admins from this development script in production.")
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    password = os.getenv("PLATFORM_ADMIN_PASSWORD")
    if not password or len(password) < 8:
        raise SystemExit("Set PLATFORM_ADMIN_PASSWORD to a password of at least 8 characters.")
    db = SessionLocal()
    try:
        email = args.email.strip().lower()
        if db.query(PlatformAdmin).filter(func.lower(PlatformAdmin.email) == email).first():
            raise SystemExit("A platform admin with that email already exists.")
        db.add(PlatformAdmin(name=args.name.strip(), email=email, password_hash=hash_password(password)))
        db.commit()
        print(f"Created platform admin: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
