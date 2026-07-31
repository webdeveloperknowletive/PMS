import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")

DB_PORT = os.getenv("DB_PORT")

DB_NAME = os .getenv("DB_NAME")

DB_USER = os .getenv("DB_USER")

DB_PASSWORD = os .getenv("DB_PASSWORD")


# Application Confrigation

APP_NAME = os.getenv("APP_NAME")

APP_VERSION = os.getenv("APP_VERSION")

DEBUG = os.getenv("DEBUG")


# Logging Configration

LOG_LEVEL = os.getenv("LOG_LEVEL")

LOG_FILE = os.environ("LOG_FILE")


# SQLAlchemy Db Url

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Display Confrigation

if __name__ == "__main__":

    print()