import logging
from pathlib import Path
from logging.handlers import RotatingFileHandler
from app.core.config import LOG_FILE

# ==========================================================
# Create Logs Directory
# ==========================================================

LOG_PATH = Path(LOG_FILE)
if not LOG_PATH.is_absolute():
    LOG_PATH = Path(__file__).resolve().parents[2] / LOG_PATH
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

# ==========================================================
# Log Formatter
# ==========================================================

LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | "
    "%(name)s | %(filename)s:%(lineno)d | %(message)s"
)

formatter = logging.Formatter(LOG_FORMAT)

# ==========================================================
# Console Handler
# ==========================================================

console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

# ==========================================================
# File Handler
# ==========================================================

file_handler = RotatingFileHandler(
    filename=str(LOG_PATH),
    maxBytes=5 * 1024 * 1024,   # 5 MB
    backupCount=5,
    encoding="utf-8",
)

file_handler.setFormatter(formatter)

# ==========================================================
# Logger Configuration
# ==========================================================

logger = logging.getLogger("ProjectManagementAPI")

logger.setLevel(logging.INFO)

logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Prevent duplicate logs
logger.propagate = False
