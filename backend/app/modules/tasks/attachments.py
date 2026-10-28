"""Secure file handling for attachments on Kanban task cards."""

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.modules.tasks.model import TaskActivity, TaskAttachment
from app.modules.tasks.service import get_task
from app.modules.users.model import User

STORAGE_DIR = Path(__file__).resolve().parents[3] / "uploads" / "task_attachments"
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".csv", ".doc", ".docx", ".gif", ".jpeg", ".jpg", ".pdf", ".png",
    ".ppt", ".pptx", ".txt", ".webp", ".xls", ".xlsx", ".zip",
}


def _get_task(db: Session, task_id: UUID, user: User):
    return get_task(db, task_id, current_user=user)


def list_attachments(db: Session, task_id: UUID, user: User) -> list[TaskAttachment]:
    _get_task(db, task_id, user)
    return db.query(TaskAttachment).filter(
        TaskAttachment.task_id == task_id,
        TaskAttachment.organization_id == user.organization_id,
    ).order_by(TaskAttachment.created_at.desc()).all()


async def upload_attachment(db: Session, task_id: UUID, upload: UploadFile, user: User) -> TaskAttachment:
    task = _get_task(db, task_id, user)
    original_name = Path((upload.filename or "").replace("\\", "/")).name.strip()
    if not original_name or len(original_name) > 255:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a valid file name no longer than 255 characters.")
    if Path(original_name).suffix.casefold() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="This file type is not supported.")

    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = uuid4().hex
    stored_path = STORAGE_DIR / stored_name
    file_size = 0
    try:
        with stored_path.open("wb") as destination:
            while chunk := await upload.read(1024 * 1024):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Attachments must be 20 MB or smaller.")
                destination.write(chunk)
        if file_size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a non-empty file to upload.")

        attachment = TaskAttachment(
            organization_id=user.organization_id,
            task_id=task.task_id,
            uploaded_by=user.user_id,
            original_filename=original_name,
            stored_filename=stored_name,
            mime_type=(upload.content_type or "application/octet-stream")[:255],
            file_size=file_size,
        )
        db.add(attachment)
        db.add(TaskActivity(
            organization_id=user.organization_id,
            task_id=task.task_id,
            actor_id=user.user_id,
            event_type="ATTACHMENT_ADDED",
            details=f'Added attachment "{original_name}".',
        ))
        db.commit()
        db.refresh(attachment)
        return attachment
    except Exception:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise


def get_attachment(db: Session, task_id: UUID, attachment_id: UUID, user: User) -> tuple[TaskAttachment, Path]:
    _get_task(db, task_id, user)
    attachment = db.query(TaskAttachment).filter(
        TaskAttachment.attachment_id == attachment_id,
        TaskAttachment.task_id == task_id,
        TaskAttachment.organization_id == user.organization_id,
    ).one_or_none()
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")
    path = STORAGE_DIR / Path(attachment.stored_filename).name
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The stored attachment file is missing.")
    return attachment, path


def delete_attachment(db: Session, task_id: UUID, attachment_id: UUID, user: User) -> None:
    attachment, path = get_attachment(db, task_id, attachment_id, user)
    db.add(TaskActivity(
        organization_id=user.organization_id,
        task_id=task_id,
        actor_id=user.user_id,
        event_type="ATTACHMENT_REMOVED",
        details=f'Removed attachment "{attachment.original_filename}".',
    ))
    db.delete(attachment)
    db.commit()
    path.unlink(missing_ok=True)
