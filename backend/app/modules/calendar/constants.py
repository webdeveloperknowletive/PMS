"""
Constants for the calendar module.
"""

# ==========================================================
# Event Type
# ==========================================================
# `CalendarEvent.event_type` is a free-form String(50) with no DB-level
# CHECK constraint; these are the values the app offers by default.

EVENT_TYPE_MEETING = "Meeting"
EVENT_TYPE_DEADLINE = "Deadline"
EVENT_TYPE_REVIEW = "Review"
EVENT_TYPE_MILESTONE = "Milestone"
EVENT_TYPE_OTHER = "Other"

EVENT_TYPES = (
    EVENT_TYPE_MEETING,
    EVENT_TYPE_DEADLINE,
    EVENT_TYPE_REVIEW,
    EVENT_TYPE_MILESTONE,
    EVENT_TYPE_OTHER,
)


# ==========================================================
# Validation
# ==========================================================
# Matches app.modules.calendar.model.CalendarEvent.title (String(255)).

EVENT_TITLE_MAX_LENGTH = 255
EVENT_LOCATION_MAX_LENGTH = 255
