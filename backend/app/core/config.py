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
import re
from urllib.parse import urlencode, urlsplit

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
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "http://localhost:3000")
WORKSPACE_DOMAIN = os.getenv("WORKSPACE_DOMAIN", "localhost:3000").strip().lower()
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
APP_ENV = {"dev": "development", "test": "testing", "prod": "production", "staging": "production"}.get(APP_ENV, APP_ENV)
if APP_ENV not in {"development", "testing", "production"}:
    raise RuntimeError("APP_ENV must be development, testing, staging, or production.")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
TRIAL_DURATION_DAYS = max(0, int(os.getenv("TRIAL_DURATION_DAYS", "14")))
TERMS_VERSION = os.getenv("TERMS_VERSION", "demo-2026-10")


def workspace_app_url(
    workspace_slug: str,
    path: str,
    query: dict[str, str] | None = None,
) -> str:
    """Build a company link: local path-based routing or its production subdomain."""
    parameters = dict(query or {})
    if APP_ENV == "production":
        scheme = urlsplit(PUBLIC_APP_URL).scheme or "https"
        base_url = f"{scheme}://{workspace_slug}.{WORKSPACE_DOMAIN}"
    else:
        base_url = PUBLIC_APP_URL.rstrip("/")
        parameters["workspace_slug"] = workspace_slug

    suffix = f"?{urlencode(parameters)}" if parameters else ""
    return f"{base_url}{path}{suffix}"

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
# AI / Groq Configuration
# ==========================================================
# Free tier — no card required. Get a key at https://console.groq.com
# Model choice matters here: Groq periodically deprecates older Llama
# models. openai/gpt-oss-120b is the current recommended general-purpose
# model as of writing — check https://console.groq.com/docs/deprecations
# if generation starts failing with a "model decommissioned" error.

GROQ_API_KEY = os.getenv(
    "GROQ_API_KEY",
    ""
)

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

# ==========================================================
# CORS Configuration
# ==========================================================

ALLOW_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOW_ORIGINS",
        "http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
workspace_domain_url = urlsplit(f"https://{WORKSPACE_DOMAIN}") if WORKSPACE_DOMAIN else None
WORKSPACE_ORIGIN_REGEX = None
if workspace_domain_url and workspace_domain_url.hostname and not workspace_domain_url.path:
    allowed_scheme = "https" if APP_ENV == "production" else "https?"
    escaped_workspace_domain = re.escape(WORKSPACE_DOMAIN)
    WORKSPACE_ORIGIN_REGEX = (
        rf"^{allowed_scheme}://(?:[a-z0-9](?:[a-z0-9-]{{0,61}}[a-z0-9])?\.)?"
        rf"{escaped_workspace_domain}$"
    )

if APP_ENV == "production":
    placeholder_secrets = {
        "change_this_secret_key",
        "replace_with_a_long_random_secret",
        "changeme",
        "secret",
    }
    if SECRET_KEY.strip().lower() in placeholder_secrets or len(SECRET_KEY) < 32:
        raise RuntimeError("Production requires a randomly generated SECRET_KEY of at least 32 characters.")
    placeholder_passwords = {"", "postgres", "change_me", "changeme", "password"}
    if not os.getenv("DATABASE_URL") and DB_PASSWORD.strip().lower() in placeholder_passwords:
        raise RuntimeError("Production requires DATABASE_URL or an explicitly configured non-default DB_PASSWORD.")
    if DEBUG:
        raise RuntimeError("Production requires DEBUG=False.")
    if (
        not WORKSPACE_DOMAIN
        or not workspace_domain_url
        or not workspace_domain_url.hostname
        or workspace_domain_url.path
        or workspace_domain_url.hostname == "localhost"
        or workspace_domain_url.hostname.endswith(".localhost")
        or "." not in workspace_domain_url.hostname
    ):
        raise RuntimeError("Production requires WORKSPACE_DOMAIN as a hostname, without a scheme or path.")
    public_url = urlsplit(PUBLIC_APP_URL)
    if public_url.scheme != "https" or not public_url.hostname or public_url.username or public_url.password:
        raise RuntimeError("Production PUBLIC_APP_URL must use HTTPS.")
    if not ALLOW_ORIGINS or any(
        urlsplit(origin).scheme != "https"
        or not urlsplit(origin).hostname
        or urlsplit(origin).username
        or urlsplit(origin).password
        or urlsplit(origin).path not in ("", "/")
        or urlsplit(origin).query
        or urlsplit(origin).fragment
        or "*" in origin
        for origin in ALLOW_ORIGINS
    ):
        raise RuntimeError("Production ALLOW_ORIGINS must contain only explicit HTTPS frontend origins.")

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

    # Never print DATABASE_URL: it may contain a live database password.
