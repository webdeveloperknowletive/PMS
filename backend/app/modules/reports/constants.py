"""
Constants for the reports module.
"""

from typing import Literal

# ==========================================================
# Report Format
# ==========================================================
# Matches app.modules.reports.model.Report `ck_reports_report_format`
# CHECK constraint and app.modules.reports.schema.ReportFormat Literal.

REPORT_FORMAT_PDF = "PDF"
REPORT_FORMAT_EXCEL = "Excel"
REPORT_FORMAT_CSV = "CSV"

REPORT_FORMATS = (
    REPORT_FORMAT_PDF,
    REPORT_FORMAT_EXCEL,
    REPORT_FORMAT_CSV,
)

ReportFormatLiteral = Literal["PDF", "Excel", "CSV"]


# ==========================================================
# Report Status
# ==========================================================
# `Report.status` defaults to "Completed" (see model.py).

REPORT_STATUS_PROCESSING = "Processing"
REPORT_STATUS_COMPLETED = "Completed"
REPORT_STATUS_FAILED = "Failed"

REPORT_STATUSES = (
    REPORT_STATUS_PROCESSING,
    REPORT_STATUS_COMPLETED,
    REPORT_STATUS_FAILED,
)

DEFAULT_REPORT_STATUS = REPORT_STATUS_COMPLETED
