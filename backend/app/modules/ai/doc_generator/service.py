"""
==========================================================
                AI DOCUMENTATION SERVICE
==========================================================

Orchestration layer, per the spec's flow:

  1. Look up the document type's config (sources needed,
     response schema to validate against)
  2. Collect only the PMS data that document type needs
  3. Build the prompt (system + user)
  4. Call Groq in JSON mode
  5. Validate the response against the document type's
     Pydantic schema — retry once on failure, then give up
     with a clear error rather than showing garbage
  6. Return a preview (NOT persisted yet)

Saving is a separate, explicit step (save_document) — this
mirrors the spec's requirement that AI generation and
document persistence stay logically separate, and that the
user gets a review step before anything is written.
"""

from uuid import UUID

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import GROQ_MODEL
from app.modules.ai.doc_generator import repository
from app.modules.ai.doc_generator.ai.llm_client import generate_json
from app.modules.ai.doc_generator.collectors import (
    collect_milestone_data,
    collect_project_data,
    collect_single_task_data,
    collect_task_data,
    collect_team_data,
)
from app.modules.ai.doc_generator.document_config import DOCUMENT_CONFIG
from app.modules.ai.doc_generator.model import AIDocumentGeneration
from app.modules.ai.doc_generator.prompts import build_system_prompt, build_user_prompt
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationCreate,
    AIDocumentGenerationUpdate,
    DocumentGenerationRequest,
    DocumentSourceMetadata,
    GeneratedDocumentPreview,
    SaveDocumentRequest,
)

_COLLECTOR_MAP = {
    "project": lambda db, project_id, task_id: collect_project_data(db, project_id),
    "tasks": lambda db, project_id, task_id: collect_task_data(db, project_id),
    "task": lambda db, project_id, task_id: collect_single_task_data(db, task_id),
    "team": lambda db, project_id, task_id: collect_team_data(db, project_id),
    "milestones": lambda db, project_id, task_id: collect_milestone_data(db, project_id),
}


def get_generated_documents(db: Session, skip: int = 0, limit: int = 100) -> list[AIDocumentGeneration]:
    return repository.get_document_generations(db, skip=skip, limit=limit)


def get_generated_document(db: Session, document_generation_id: UUID) -> AIDocumentGeneration:
    document = repository.get_document_generation(db, document_generation_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return document


def generate_document_preview(db: Session, request: DocumentGenerationRequest) -> GeneratedDocumentPreview:
    """
    Steps 1-6 from the module docstring. Nothing is written to the
    database here — this is the preview/review step.
    """
    config = DOCUMENT_CONFIG.get(request.document_type)
    if config is None:
        # Shouldn't happen — DocumentGenerationRequest already validates
        # document_type against DOCUMENT_TYPES — but guard anyway rather
        # than trust that stays in sync forever.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown document type")

    if config["requires_task"] and request.task_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{config['label']} requires a task_id.",
        )

    # --- Collect only what this document type needs ---
    collected_data: dict[str, dict] = {}
    for source in config["sources"]:
        collector = _COLLECTOR_MAP[source]
        result = collector(db, request.project_id, request.task_id)
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{source.capitalize()} not found")
        collected_data[source] = result

    # --- Build the prompt ---
    system_prompt = build_system_prompt(
        request.document_type,
        request.tone,
        request.length,
        request.audience,
        request.template,
        request.language,
    )
    user_prompt = build_user_prompt(request.document_type, collected_data, request.additional_instructions)

    # --- Call Groq, validate, retry once on a bad response ---
    response_schema = config["response_schema"]
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            raw = generate_json(system_prompt, user_prompt)
            validated = response_schema.model_validate(raw)
            break
        except RuntimeError as exc:
            # Groq itself failed (network, API error, unparseable JSON) —
            # no point retrying a second time for the same root cause.
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
        except ValidationError as exc:
            last_error = exc
            continue
    else:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI returned an invalid document structure. Please regenerate.",
        )

    # --- Source transparency (spec section 22) ---
    source_metadata = DocumentSourceMetadata(
        sources_used=config["sources"],
        task_count=collected_data.get("tasks", {}).get("total") or (1 if "task" in collected_data else None),
        team_count=collected_data.get("team", {}).get("team_count"),
        milestone_count=collected_data.get("milestones", {}).get("total"),
    )

    return GeneratedDocumentPreview(
        document_type=request.document_type,
        title=validated.title,
        content=validated.model_dump(),
        ai_model=GROQ_MODEL,
        source_metadata=source_metadata,
    )


def save_document(db: Session, request: SaveDocumentRequest, generated_by: UUID) -> AIDocumentGeneration:
    """
    Persists a previously-previewed (and possibly user-edited) document.
    Stored in ai_document_generations — see the module's README note on
    why this isn't the `documents` table (no content column there yet).
    """
    import json

    full_payload = AIDocumentGenerationCreate(
        project_id=request.project_id,
        generated_by=generated_by,
        document_type=request.document_type,
        title=request.title,
        prompt="",  # structured flow builds its own internal prompt — not a single user-supplied string anymore
        generated_content=json.dumps(request.content, indent=2),
        document_url=None,
        version="1.0",
        ai_model=request.ai_model,
        status="Saved",
    )

    return repository.create_document_generation(db, full_payload)


def update_generated_document(db: Session, document_generation_id: UUID, payload: AIDocumentGenerationUpdate) -> AIDocumentGeneration:
    document = repository.update_document_generation(db, document_generation_id, payload)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return document


def delete_generated_document(db: Session, document_generation_id: UUID) -> None:
    deleted = repository.delete_document_generation(db, document_generation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
