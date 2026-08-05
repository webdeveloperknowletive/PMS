"""
Constants for the ai.doc_generator module.
"""

# ==========================================================
# Status
# ==========================================================
# `AIDocumentGeneration.status` defaults to "Generated" (see model.py).

DOC_GENERATION_STATUS_GENERATED = "Generated"
DOC_GENERATION_STATUS_REVIEWED = "Reviewed"
DOC_GENERATION_STATUS_PUBLISHED = "Published"

DOC_GENERATION_STATUSES = (
    DOC_GENERATION_STATUS_GENERATED,
    DOC_GENERATION_STATUS_REVIEWED,
    DOC_GENERATION_STATUS_PUBLISHED,
)

DEFAULT_DOC_GENERATION_STATUS = DOC_GENERATION_STATUS_GENERATED


# ==========================================================
# Versioning
# ==========================================================
# Matches app.modules.ai.doc_generator.model.AIDocumentGeneration.version
# (String(20), default="1.0").

DEFAULT_DOCUMENT_VERSION = "1.0"
