import logging
import os
from logging.handlers import RotatingFileHandler

# ==========================================================
# Create Logs Directory
# ==========================================================

LOG_DIR = "backend/logs"
os.makedirs(LOG_DIR, exist_ok=True)

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
    filename=f"{LOG_DIR}/application.log",
    maxBytes=5 * 1024 * 1024,   # 5 MB
    backupCount=5,
    encoding="utf-8",
)

file_handler.setFormatter(formatter)

# ==========================================================
# Logger Configuration
# ==========================================================

logger = logging.getLogger("StudentManagementAPI")

logger.setLevel(logging.INFO)

logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Prevent duplicate logs
logger.propagate = False