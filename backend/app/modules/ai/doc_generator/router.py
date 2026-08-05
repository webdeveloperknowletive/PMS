from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.doc_generator.model import AIDocumentGeneration
from app.modules.ai.doc_generator.schema import (
    AIDocumentGenerationCreate,
    AIDocumentGenerationRead,
    AIDocumentGenerationUpdate,
)

router = APIRouter(
    prefix="/ai/document-generations",
    tags=["AI Documentation"]
)


@router.get("/", response_model=list[AIDocumentGenerationRead], status_code=status.HTTP_200_OK)
async def get_generated_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(AIDocumentGeneration).offset(skip).limit(limit).all()


@router.get(
    "/{document_generation_id}",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_200_OK,
)
async def get_generated_document(
    document_generation_id: UUID,
    db: Session = Depends(get_db),
):
    document = db.get(AIDocumentGeneration, document_generation_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return document


@router.post("/", response_model=AIDocumentGenerationRead, status_code=status.HTTP_201_CREATED)
async def generate_document(
    payload: AIDocumentGenerationCreate,
    db: Session = Depends(get_db),
):
    document = AIDocumentGeneration(**payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.put(
    "/{document_generation_id}",
    response_model=AIDocumentGenerationRead,
    status_code=status.HTTP_200_OK,
)
async def update_generated_document(
    document_generation_id: UUID,
    payload: AIDocumentGenerationUpdate,
    db: Session = Depends(get_db),
):
    document = db.get(AIDocumentGeneration, document_generation_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_generation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_generated_document(
    document_generation_id: UUID,
    db: Session = Depends(get_db),
):
    document = db.get(AIDocumentGeneration, document_generation_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

    db.delete(document)
    db.commit()
