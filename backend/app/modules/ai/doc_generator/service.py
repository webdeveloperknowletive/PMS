"""
==========================================================
                AI DOC GENERATOR SERVICE
==========================================================

Business logic layer for AI-generated documents. Orchestrates
calls to repository.py and translates "not found" into HTTP
errors. Routers should only ever call this layer, never the
model or repository directly.

NOTE: This module currently stores AI generation results — it
does not call any LLM itself. `prompt` and `generated_content`
are supplied by the caller at creation time. The `ai/` subfolder
(llm_client.py, langchain_setup.py, embeddings.py, vector_store.py)
is scaffolded but empty; real AI integration is a separate,
larger piece of work, deliberately not done here.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.doc_generator import repository
from app.modules.ai.doc_generator.model import AIDocumentGeneration
from app.modules.ai.doc_generator.schema import AIDocumentGenerationCreate, AIDocumentGenerationUpdate


def get_generated_documents(db: Session, skip: int = 0, limit: int = 100) -> list[AIDocumentGeneration]:
    return repository.get_document_generations(db, skip=skip, limit=limit)


def get_generated_document(db: Session, document_generation_id: UUID) -> AIDocumentGeneration:
    document = repository.get_document_generation(db, document_generation_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return document


def generate_document(db: Session, payload: AIDocumentGenerationCreate) -> AIDocumentGeneration:
    return repository.create_document_generation(db, payload)


def update_generated_document(db: Session, document_generation_id: UUID, payload: AIDocumentGenerationUpdate) -> AIDocumentGeneration:
    document = repository.update_document_generation(db, document_generation_id, payload)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return document


def delete_generated_document(db: Session, document_generation_id: UUID) -> None:
    deleted = repository.delete_document_generation(db, document_generation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
