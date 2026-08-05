"""
==========================================================
                APPLICATION CONFIGURATION
==========================================================

This file loads all application settings from the .env file.

Instead of reading environment variables throughout the
project, every file imports values from this file.

Example:
    from core.config import DATABASE_URL, APP_NAME
"""

# ==========================================================
# Import Required Modules
# ==========================================================

import os

from dotenv import load_dotenv

# ==========================================================
# Load Environment Variables
# ==========================================================

load_dotenv()

# ==========================================================
# Application Configuration
# ==========================================================

APP_NAME = os.getenv("APP_NAME", "Project Management System")

APP_VERSION = os.getenv("APP_VERSION", "1.0.0")

API_V1_PREFIX = os.getenv("API_V1_PREFIX", "/api/v1")

APP_DESCRIPTION = os.getenv("APP_DESCRIPTION",  "Production Ready Project Management API",)

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# ==========================================================
# Database Configuration
# ==========================================================

DB_HOST = os.getenv("DB_HOST", "localhost")

DB_PORT = int(os.getenv("DB_PORT", 5432))

DB_NAME = os.getenv("DB_NAME", "pms_db")

DB_USER = os.getenv("DB_USER", "postgres")

DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# ==========================================================
# Logging Configuration
# ==========================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

LOG_FILE = os.getenv(
    "LOG_FILE",
    "logs/application.log",
)

# ==========================================================
# JWT Configuration
# ==========================================================

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "change_this_secret_key"
)

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
)

# ==========================================================
# CORS Configuration
# ==========================================================

ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
]

# ==========================================================
# Display Configuration (For Learning)
# ==========================================================


if __name__ == "__main__":

    print("=" * 50)
    print("Application Configuration")
    print("=" * 50)

    print(f"App Name      : {APP_NAME}")
    print(f"Version       : {APP_VERSION}")
    print(f"Debug Mode    : {DEBUG}")

    print("\nDatabase")
    print("-" * 50)
    print(f"Host          : {DB_HOST}")
    print(f"Port          : {DB_PORT}")
    print(f"Database      : {DB_NAME}")
    print(f"Username      : {DB_USER}")

    print("\nLogging")
    print("-" * 50)
    print(f"Level         : {LOG_LEVEL}")
    print(f"Log File      : {LOG_FILE}")

    print("\nDatabase URL")
    print("-" * 50)
    print(DATABASE_URL)