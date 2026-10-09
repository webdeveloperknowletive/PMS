"""
==========================================================
                DOCUMENTATION REPOSITORY
==========================================================

Data-access layer for the Document model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.documentation.model import Document
from app.modules.documentation.schema import DocumentCreate, DocumentUpdate


# ==========================================================
# Create
# ==========================================================

def create_document(
    db: Session,
    payload: DocumentCreate,
    actor: str,
) -> Document:

    document = Document(**payload.model_dump(), created_by=actor, updated_by=actor)

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


# ==========================================================
# Read
# ==========================================================

def get_document(
    db: Session,
    document_id: UUID,
) -> Document | None:

    return db.get(Document, document_id)


def get_documents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:

    return (
        db.query(Document)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_documents_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:

    return (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_latest_document_version(
    db: Session,
    project_id: UUID,
    title: str,
) -> Document | None:

    return (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.title == title,
        )
        .order_by(Document.created_at.desc())
        .first()
    )


# ==========================================================
# Update
# ==========================================================

def update_document(
    db: Session,
    document_id: UUID,
    payload: DocumentUpdate,
    actor: str,
) -> Document | None:

    document = db.get(Document, document_id)

    if document is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    document.updated_by = actor

    db.commit()
    db.refresh(document)

    return document


# ==========================================================
# Delete
# ==========================================================

def delete_document(
    db: Session,
    document_id: UUID,
) -> Document | None:

    document = db.get(Document, document_id)

    if document is None:
        return None

    deleted_document = document
    db.delete(document)
    db.commit()

    return deleted_document
