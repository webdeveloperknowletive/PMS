from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.documentation import service
from app.modules.documentation.schema import DocumentCreate, DocumentRead, DocumentUpdate
from app.modules.documentation.permissions import can_delete_documents, can_upload_documents, can_view_documents
from app.modules.users.model import User

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


@router.get(
    "/",
    response_model=list[DocumentRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_documents)],
)
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_documents(db, skip=skip, limit=limit)


@router.get(
    "/project/{project_id}",
    response_model=list[DocumentRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_documents)],
)
async def get_project_documents(
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_documents_by_project(db, project_id, current_user.organization_id, skip=skip, limit=limit)


@router.get(
    "/{document_id}",
    response_model=DocumentRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_documents)],
)
async def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_document(db, document_id)


@router.post(
    "/",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_upload_documents)],
)
async def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_upload_documents),
):
    return service.create_document(db, payload, current_user)


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    project_id: UUID = Form(...),
    title: str = Form(..., max_length=255),
    version: str = Form("1.0", max_length=20),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(can_upload_documents),
):
    return await service.upload_document_file(db, project_id, title, version, file, current_user)


@router.put(
    "/{document_id}",
    response_model=DocumentRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_upload_documents)],
)
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_upload_documents),
):
    return service.update_document(db, document_id, payload, current_user)


@router.put("/{document_id}/file", response_model=DocumentRead)
async def replace_document_upload(
    document_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(can_upload_documents),
):
    return await service.replace_document_file(db, document_id, file, current_user)


@router.get("/{document_id}/download", dependencies=[Depends(can_view_documents)])
async def download_document(document_id: UUID, db: Session = Depends(get_db)):
    document = service.get_document(db, document_id)
    return FileResponse(
        service.document_file_path(document),
        filename=document.original_filename or "document",
        media_type=document.mime_type or "application/octet-stream",
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_delete_documents)],
)
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_document(db, document_id, current_user)
