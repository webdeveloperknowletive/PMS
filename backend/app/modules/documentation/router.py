from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.documentation import service
from app.modules.documentation.schema import DocumentCreate, DocumentRead, DocumentUpdate
from app.modules.documentation.permissions import can_delete_documents, can_upload_documents, can_view_documents

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
):
    return service.create_document(db, payload)


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
):
    return service.update_document(db, document_id, payload)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_delete_documents)],
)
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_document(db, document_id)
