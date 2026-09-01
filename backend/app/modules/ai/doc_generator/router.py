from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.doc_generator import service
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationCreate,
    AIDocumentGenerationRead,
    AIDocumentGenerationUpdate,
)
from app.modules.ai.doc_generator.permissions import can_generate, can_view_results

router = APIRouter(
    prefix="/ai/document-generations",
    tags=["AI Documentation"]
)


@router.get(
    "/",
    response_model=list[AIDocumentGenerationRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_generated_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_generated_documents(db, skip=skip, limit=limit)


@router.get(
    "/{document_generation_id}",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_generated_document(
    document_generation_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_generated_document(db, document_generation_id)


@router.post(
    "/",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def generate_document(
    payload: AIDocumentGenerationCreate,
    db: Session = Depends(get_db),
):
    return service.generate_document(db, payload)


@router.put(
    "/{document_generation_id}",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def update_generated_document(
    document_generation_id: UUID,
    payload: AIDocumentGenerationUpdate,
    db: Session = Depends(get_db),
):
    return service.update_generated_document(db, document_generation_id, payload)


@router.delete(
    "/{document_generation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_generate)],
)
async def delete_generated_document(
    document_generation_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_generated_document(db, document_generation_id)
