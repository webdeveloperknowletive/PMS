"""
==========================================================
                DOCUMENTATION SERVICE
==========================================================

Business logic layer for Documents. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

import mimetypes
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.modules.documentation import repository
from app.modules.documentation.model import Document
from app.modules.documentation.schema import DocumentCreate, DocumentUpdate
from app.modules.users.model import User
from app.modules.notifications.events import notify_project_users

STORAGE_DIR = Path(__file__).resolve().parents[3] / "uploads" / "documents"


async def _store_upload(upload: UploadFile, original_name: str) -> tuple[str, int, str]:
    """Save any uploaded file type in chunks, without an application size cap."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = uuid4().hex
    stored_path = STORAGE_DIR / stored_name
    file_size = 0
    try:
        with stored_path.open("wb") as destination:
            while chunk := await upload.read(1024 * 1024):
                destination.write(chunk)
                file_size += len(chunk)
        if file_size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a file to upload.")
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise

    mime_type = upload.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    return stored_name, file_size, mime_type


def actor_label(user: User) -> str:
    role_names = sorted({assignment.role.role_name for assignment in user.user_roles if assignment.role})
    return f"{user.name} ({', '.join(role_names) if role_names else 'User'})"


def get_documents(db: Session, skip: int = 0, limit: int = 100) -> list[Document]:
    """Get all documents (paginated)."""
    return repository.get_documents(db, skip=skip, limit=limit)


def get_document(db: Session, document_id: UUID) -> Document:
    """Get a single document by ID, or raise 404."""
    document = repository.get_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def create_document(db: Session, payload: DocumentCreate, user: User) -> Document:
    """Create a new document."""
    document = repository.create_document(db, payload, actor_label(user))
    _notify_document_change(db, document, user, "added")
    return document


def _notify_document_change(db: Session, document: Document, user: User, action: str) -> None:
    notify_project_users(
        db, document.project_id, actor_id=user.user_id,
        title=f"Project resource {action}: {document.title}",
        message=f"{actor_label(user)} {action} a project resource.",
        notification_type=f"Document {action.title()}",
    )


async def upload_document_file(
    db: Session, project_id: UUID, title: str, version: str, upload: UploadFile, user: User
) -> Document:
    original_name = Path((upload.filename or "upload").replace("\\", "/")).name
    stored_name, file_size, mime_type = await _store_upload(upload, original_name)
    payload = DocumentCreate(project_id=project_id, title=title, version=version, resource_type="FILE")
    try:
        document = Document(**payload.model_dump(), created_by=actor_label(user), updated_by=actor_label(user))
        db.add(document)
        document.stored_filename = stored_name
        document.original_filename = original_name[:255]
        document.mime_type = mime_type
        document.file_size = file_size
        db.commit()
        db.refresh(document)
        _notify_document_change(db, document, user, "uploaded")
        return document
    except Exception:
        db.rollback()
        (STORAGE_DIR / stored_name).unlink(missing_ok=True)
        raise


def update_document(db: Session, document_id: UUID, payload: DocumentUpdate, user: User) -> Document:
    """Update an existing document, or raise 404."""
    document = repository.update_document(db, document_id, payload, actor_label(user))
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    _notify_document_change(db, document, user, "updated")
    return document


async def replace_document_file(db: Session, document_id: UUID, upload: UploadFile, user: User) -> Document:
    document = get_document(db, document_id)
    original_name = Path((upload.filename or "upload").replace("\\", "/")).name
    stored_name, file_size, mime_type = await _store_upload(upload, original_name)
    old_name = document.stored_filename
    try:
        document.resource_type = "FILE"
        document.file_url = None
        document.stored_filename = stored_name
        document.original_filename = original_name[:255]
        document.mime_type = mime_type
        document.file_size = file_size
        document.updated_by = actor_label(user)
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        (STORAGE_DIR / stored_name).unlink(missing_ok=True)
        raise
    if old_name:
        (STORAGE_DIR / Path(old_name).name).unlink(missing_ok=True)
    _notify_document_change(db, document, user, "replaced")
    return document


def document_file_path(document: Document) -> Path:
    if not document.stored_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded file is stored for this item.")
    path = STORAGE_DIR / Path(document.stored_filename).name
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The stored file is missing.")
    return path


def delete_document(db: Session, document_id: UUID, user: User) -> None:
    """Delete a document, or raise 404."""
    document = repository.get_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    stored_name = document.stored_filename
    project_id = document.project_id
    title = document.title
    repository.delete_document(db, document_id)
    notify_project_users(
        db, project_id, actor_id=user.user_id,
        title=f"Project resource deleted: {title}",
        message=f"{actor_label(user)} deleted a project resource.",
        notification_type="Document Deleted",
    )
    if stored_name:
        (STORAGE_DIR / Path(stored_name).name).unlink(missing_ok=True)
