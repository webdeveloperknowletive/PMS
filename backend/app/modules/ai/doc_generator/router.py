from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.ai.doc_generator import service
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationRead,
    DocumentGenerationRequest,
    GeneratedDocumentPreview,
    SaveDocumentRequest,
)
from app.modules.ai.doc_generator.permissions import can_generate, can_view_results
from app.modules.users.model import User

router = APIRouter(
    prefix="/ai/documentation",
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
    "/generate",
    response_model=GeneratedDocumentPreview,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def generate_document_preview(
    payload: DocumentGenerationRequest,
    db: Session = Depends(get_db),
):
    """
    Generates a document preview — collects PMS data, calls Groq,
    validates the structured response. Nothing is saved yet; call
    /save afterward if the user wants to keep it.
    """
    return service.generate_document_preview(db, payload)


@router.post(
    "/save",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def save_document(
    payload: SaveDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persists a previewed (and possibly user-edited) document."""
    return service.save_document(db, payload, generated_by=current_user.user_id)
