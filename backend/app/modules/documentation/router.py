from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.documentation.model import Document
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
    return db.query(Document).offset(skip).limit(limit).all()


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
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


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
    document = Document(**payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


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
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)

    db.commit()
    db.refresh(document)
    return document


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_delete_documents)],
)
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    db.delete(document)
    db.commit()