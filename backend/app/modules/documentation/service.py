from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.documentation.model import Document
from app.modules.documentation.schema import (
    DocumentCreate,
    DocumentUpdate,
)


def get_documents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all documents.
    """
    return (
        db.query(Document)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_document(
    db: Session,
    document_id: UUID,
):
    """
    Get a document by ID.
    """
    document = db.get(
        Document,
        document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


def create_document(
    db: Session,
    payload: DocumentCreate,
):
    """
    Create a new document.
    """
    document = Document(
        **payload.model_dump()
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


def update_document(
    db: Session,
    document_id: UUID,
    payload: DocumentUpdate,
):
    """
    Update an existing document.
    """
    document = db.get(
        Document,
        document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(document, field, value)

    db.commit()
    db.refresh(document)

    return document


def delete_document(
    db: Session,
    document_id: UUID,
):
    """
    Delete a document.
    """
    document = db.get(
        Document,
        document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    db.delete(document)
    db.commit()

    return None