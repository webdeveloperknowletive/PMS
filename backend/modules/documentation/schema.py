import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentBase(BaseModel):
    project_id: uuid.UUID
    title: str = Field(..., max_length=255)
    file_url: str | None = None
    version: str = Field("1.0", max_length=20)


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    file_url: str | None = None
    version: str | None = Field(None, max_length=20)


class DocumentRead(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    document_id: uuid.UUID
    created_at: datetime
