import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AIDocumentGenerationBase(BaseModel):
    project_id: uuid.UUID
    generated_by: uuid.UUID | None = None
    document_type: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    prompt: str
    generated_content: str
    document_url: str | None = None
    version: str = Field("1.0", max_length=20)
    ai_model: str = Field(..., max_length=100)
    status: str = Field("Generated", max_length=20)


class AIDocumentGenerationCreate(AIDocumentGenerationBase):
    pass


class AIDocumentGenerationUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    document_url: str | None = None
    version: str | None = Field(None, max_length=20)
    status: str | None = Field(None, max_length=20)


class AIDocumentGenerationRead(AIDocumentGenerationBase):
    model_config = ConfigDict(from_attributes=True)

    document_generation_id: uuid.UUID
    created_at: datetime
