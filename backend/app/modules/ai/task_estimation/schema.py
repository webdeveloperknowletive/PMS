import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Complexity = Literal["Low", "Medium", "High"]


class AITaskEstimationBase(BaseModel):
    task_id: uuid.UUID
    project_id: uuid.UUID
    estimated_hours: Decimal = Field(..., ge=0)
    estimated_cost: Decimal | None = Field(None, ge=0)
    complexity: Complexity
    story_points: int | None = Field(None, ge=0)
    ai_reasoning: str | None = None
    prompt: str
    ai_model: str = Field(..., max_length=100)
    confidence_score: Decimal | None = Field(None, ge=0, le=100)


class AITaskEstimationCreate(AITaskEstimationBase):
    pass


class AITaskEstimationUpdate(BaseModel):
    estimated_hours: Decimal | None = Field(None, ge=0)
    estimated_cost: Decimal | None = Field(None, ge=0)
    complexity: Complexity | None = None
    story_points: int | None = Field(None, ge=0)
    ai_reasoning: str | None = None


class AITaskEstimationGenerationRequest(BaseModel):
    task_id: uuid.UUID
    hourly_rate: Decimal | None = Field(None, ge=0)
    prompt: str = ""


class AITaskEstimationRead(AITaskEstimationBase):
    model_config = ConfigDict(from_attributes=True)

    estimation_id: uuid.UUID
    created_at: datetime
