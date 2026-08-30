"""
==========================================================
                DOCUMENTATION SERVICE
==========================================================

Business logic layer for Documents. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.documentation import repository
from app.modules.documentation.model import Document
from app.modules.documentation.schema import DocumentCreate, DocumentUpdate


def get_documents(db: Session, skip: int = 0, limit: int = 100) -> list[Document]:
    """Get all documents (paginated)."""
    return repository.get_documents(db, skip=skip, limit=limit)


def get_document(db: Session, document_id: UUID) -> Document:
    """Get a single document by ID, or raise 404."""
    document = repository.get_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def create_document(db: Session, payload: DocumentCreate) -> Document:
    """Create a new document."""
    return repository.create_document(db, payload)


def update_document(db: Session, document_id: UUID, payload: DocumentUpdate) -> Document:
    """Update an existing document, or raise 404."""
    document = repository.update_document(db, document_id, payload)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def delete_document(db: Session, document_id: UUID) -> None:
    """Delete a document, or raise 404."""
    deleted = repository.delete_document(db, document_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
