"""
==========================================================
                DOCUMENT CONFIGURATION
==========================================================

The single source of truth for "this document type needs
this PMS data and validates against this schema". Adding a
new document type later means adding one entry here (plus a
prompt in prompts.py and a schema in schema.py) — service.py
itself never needs an if/elif chain per document type.
"""

from app.modules.ai.doc_generator.schema import (
    ProjectOverviewDocument,
    ProjectStatusReportDocument,
    TaskDescriptionDocument,
)

DOCUMENT_CONFIG = {
    "PROJECT_OVERVIEW": {
        "label": "Project Overview",
        "sources": ["project", "team", "milestones"],
        "requires_task": False,
        "response_schema": ProjectOverviewDocument,
    },
    "PROJECT_STATUS_REPORT": {
        "label": "Project Status Report",
        "sources": ["project", "tasks", "team", "milestones"],
        "requires_task": False,
        "response_schema": ProjectStatusReportDocument,
    },
    "TASK_DESCRIPTION": {
        "label": "Task Description",
        "sources": ["task"],
        "requires_task": True,
        "response_schema": TaskDescriptionDocument,
    },
}
