import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ==========================================================
# Internal DB-shaped schema (used by repository.py — unchanged
# by the Phase 1 rebuild, since ai_document_generations already
# has every column a generated document needs)
# ==========================================================

class AIDocumentGenerationBase(BaseModel):
    project_id: uuid.UUID
    generated_by: uuid.UUID | None = None
    document_type: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    prompt: str
    generated_content: str
    document_url: str | None = None
    version: str = Field("1.0", max_length=20)
    ai_model: str = Field(..., max_length=100)
    status: str = Field("Generated", max_length=20)


class AIDocumentGenerationCreate(AIDocumentGenerationBase):
    pass


class AIDocumentGenerationUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    document_url: str | None = None
    version: str | None = Field(None, max_length=20)
    status: str | None = Field(None, max_length=20)


class AIDocumentGenerationRead(AIDocumentGenerationBase):
    model_config = ConfigDict(from_attributes=True)

    document_generation_id: uuid.UUID
    created_at: datetime


# ==========================================================
# Public request schema
# ==========================================================
# Matches the technical spec's DocumentGenerationRequest, minus
# `sprint_id` (no Sprint entity exists in this schema — see the
# module's README note) and with `task_id` added instead, since
# TASK_DESCRIPTION needs a specific task rather than a sprint.

DOCUMENT_TYPES = (
    "PROJECT_OVERVIEW",
    "PROJECT_STATUS_REPORT",
    "TASK_DESCRIPTION",
)

TONES = ("professional", "technical", "executive", "concise", "formal")
LENGTHS = ("short", "standard", "detailed")
AUDIENCES = ("project_team", "project_manager", "management", "client", "technical_team", "stakeholders")
TEMPLATES = ("standard", "executive", "technical", "agile", "client", "internal")


class DocumentGenerationRequest(BaseModel):
    project_id: uuid.UUID
    document_type: str
    task_id: uuid.UUID | None = None
    tone: str = "professional"
    length: str = "standard"
    audience: str = "management"
    template: str = "standard"
    language: str = "english"
    additional_instructions: str | None = None

    @field_validator("document_type")
    @classmethod
    def check_document_type(cls, value: str) -> str:
        if value not in DOCUMENT_TYPES:
            raise ValueError(f"document_type must be one of: {', '.join(DOCUMENT_TYPES)}")
        return value

    @field_validator("tone")
    @classmethod
    def check_tone(cls, value: str) -> str:
        if value not in TONES:
            raise ValueError(f"tone must be one of: {', '.join(TONES)}")
        return value

    @field_validator("length")
    @classmethod
    def check_length(cls, value: str) -> str:
        if value not in LENGTHS:
            raise ValueError(f"length must be one of: {', '.join(LENGTHS)}")
        return value

    @field_validator("audience")
    @classmethod
    def check_audience(cls, value: str) -> str:
        if value not in AUDIENCES:
            raise ValueError(f"audience must be one of: {', '.join(AUDIENCES)}")
        return value

    @field_validator("template")
    @classmethod
    def check_template(cls, value: str) -> str:
        if value not in TEMPLATES:
            raise ValueError(f"template must be one of: {', '.join(TEMPLATES)}")
        return value


# ==========================================================
# Structured AI response schemas (per document type)
# ==========================================================
# The AI's raw JSON is validated against one of these before it's ever
# shown to the user — an invalid/malformed response is rejected rather
# than displayed, per the spec's "validate AI responses" requirement.

class WorkItem(BaseModel):
    title: str
    description: str = ""


class ProjectOverviewDocument(BaseModel):
    title: str
    executive_summary: str
    project_goals: list[str] = Field(default_factory=list)
    scope: str
    team_summary: str
    milestones_summary: str
    conclusion: str


class ProjectStatusReportDocument(BaseModel):
    title: str
    executive_summary: str
    task_summary: str
    completed_work: list[WorkItem] = Field(default_factory=list)
    in_progress_work: list[WorkItem] = Field(default_factory=list)
    blocked_work: list[WorkItem] = Field(default_factory=list)
    milestones_status: str
    recommendations: list[str] = Field(default_factory=list)
    conclusion: str


class TaskDescriptionDocument(BaseModel):
    title: str
    description: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    notes: str | None = None


# ==========================================================
# Preview response — what /generate returns
# ==========================================================
# Deliberately NOT persisted yet (per spec section 13): the user
# reviews this and calls /save separately if they want to keep it.

class DocumentSourceMetadata(BaseModel):
    """Source transparency (spec section 22) — which PMS data actually
    got used, so the user can see where the content came from."""
    sources_used: list[str]
    task_count: int | None = None
    team_count: int | None = None
    milestone_count: int | None = None


class GeneratedDocumentPreview(BaseModel):
    document_type: str
    title: str
    content: dict  # one of the structured schemas above, as a plain dict
    ai_model: str
    source_metadata: DocumentSourceMetadata


class SaveDocumentRequest(BaseModel):
    """Sent to /save once the user has reviewed (and optionally edited)
    the preview. `content` is the same structured dict from the preview
    — the frontend can let the user edit individual string fields
    before sending it back."""
    project_id: uuid.UUID
    document_type: str
    title: str
    content: dict
    ai_model: str
