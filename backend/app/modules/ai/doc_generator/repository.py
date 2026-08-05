"""
==========================================================
                AI DOC GENERATOR REPOSITORY
==========================================================

Data-access layer for the AIDocumentGeneration model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.ai.doc_generator.model import AIDocumentGeneration
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationCreate,
    AIDocumentGenerationUpdate,
)


# ==========================================================
# Create
# ==========================================================

def create_document_generation(
    db: Session,
    payload: AIDocumentGenerationCreate,
) -> AIDocumentGeneration:

    document_generation = AIDocumentGeneration(**payload.model_dump())

    db.add(document_generation)
    db.commit()
    db.refresh(document_generation)

    return document_generation


# ==========================================================
# Read
# ==========================================================

def get_document_generation(
    db: Session,
    document_generation_id: UUID,
) -> AIDocumentGeneration | None:

    return db.get(AIDocumentGeneration, document_generation_id)


def get_document_generations_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[AIDocumentGeneration]:

    return (
        db.query(AIDocumentGeneration)
        .filter(AIDocumentGeneration.project_id == project_id)
        .order_by(AIDocumentGeneration.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_document_generations_by_user(
    db: Session,
    generated_by: UUID,
) -> list[AIDocumentGeneration]:

    return (
        db.query(AIDocumentGeneration)
        .filter(AIDocumentGeneration.generated_by == generated_by)
        .all()
    )


def get_document_generations_by_type(
    db: Session,
    project_id: UUID,
    document_type: str,
) -> list[AIDocumentGeneration]:

    return (
        db.query(AIDocumentGeneration)
        .filter(
            AIDocumentGeneration.project_id == project_id,
            AIDocumentGeneration.document_type == document_type,
        )
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_document_generation(
    db: Session,
    document_generation_id: UUID,
    payload: AIDocumentGenerationUpdate,
) -> AIDocumentGeneration | None:

    document_generation = db.get(AIDocumentGeneration, document_generation_id)

    if document_generation is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document_generation, field, value)

    db.commit()
    db.refresh(document_generation)

    return document_generation


# ==========================================================
# Delete
# ==========================================================

def delete_document_generation(
    db: Session,
    document_generation_id: UUID,
) -> bool:

    document_generation = db.get(AIDocumentGeneration, document_generation_id)

    if document_generation is None:
        return False

    db.delete(document_generation)
    db.commit()

    return True
