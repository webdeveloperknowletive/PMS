"""
Constants for the notifications module.
"""

# ==========================================================
# Notification Type
# ==========================================================
# `Notification.notification_type` is a free-form String(50) with no
# DB-level CHECK constraint; these are the values the app emits.

NOTIFICATION_TYPE_TASK_ASSIGNED = "Task Assigned"
NOTIFICATION_TYPE_DEADLINE_REMINDER = "Deadline Reminder"
NOTIFICATION_TYPE_STATUS_UPDATE = "Status Update"
NOTIFICATION_TYPE_MENTION = "Mention"
NOTIFICATION_TYPE_SYSTEM = "System"

NOTIFICATION_TYPES = (
    NOTIFICATION_TYPE_TASK_ASSIGNED,
    NOTIFICATION_TYPE_DEADLINE_REMINDER,
    NOTIFICATION_TYPE_STATUS_UPDATE,
    NOTIFICATION_TYPE_MENTION,
    NOTIFICATION_TYPE_SYSTEM,
)


# ==========================================================
# Defaults
# ==========================================================
# Matches app.modules.notifications.model.Notification.is_read (default=False).

DEFAULT_IS_READ = False
NOTIFICATION_TITLE_MAX_LENGTH = 255
