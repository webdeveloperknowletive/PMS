from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.doc_generator.model import AIDocumentGeneration
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationCreate,
    AIDocumentGenerationUpdate,
)


def get_generated_documents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all generated documents.
    """
    return (
        db.query(AIDocumentGeneration)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_generated_document(
    db: Session,
    document_generation_id: UUID,
):
    """
    Get generated document by ID.
    """
    document = db.get(
        AIDocumentGeneration,
        document_generation_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated document not found",
        )

    return document


def generate_document(
    db: Session,
    payload: AIDocumentGenerationCreate,
):
    """
    Create a new AI generated document.
    """
    document = AIDocumentGeneration(
        **payload.model_dump()
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


def update_generated_document(
    db: Session,
    document_generation_id: UUID,
    payload: AIDocumentGenerationUpdate,
):
    """
    Update an existing generated document.
    """
    document = db.get(
        AIDocumentGeneration,
        document_generation_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated document not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(document, field, value)

    db.commit()
    db.refresh(document)

    return document


def delete_generated_document(
    db: Session,
    document_generation_id: UUID,
):
    """
    Delete a generated document.
    """
    document = db.get(
        AIDocumentGeneration,
        document_generation_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated document not found",
        )

    db.delete(document)
    db.commit()

    return None