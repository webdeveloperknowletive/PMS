import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

RiskLevel = Literal["Low", "Medium", "High"]


class AIRiskPredictionBase(BaseModel):
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    risk_type: str = Field(..., max_length=100)
    risk_level: RiskLevel
    probability: Decimal = Field(..., ge=0, le=100)
    impact: str | None = Field(None, max_length=50)
    recommendation: str
    ai_model: str = Field(..., max_length=100)
    prompt: str
    prediction_result: dict[str, Any]
    confidence_score: Decimal | None = Field(None, ge=0, le=100)


class AIRiskPredictionCreate(AIRiskPredictionBase):
    pass


class AIRiskPredictionUpdate(BaseModel):
    risk_type: str | None = Field(None, max_length=100)
    risk_level: RiskLevel | None = None
    probability: Decimal | None = Field(None, ge=0, le=100)
    impact: str | None = Field(None, max_length=50)
    recommendation: str | None = None


class AIRiskPredictionGenerationRequest(BaseModel):
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    prompt: str = "Review the current project information and identify the most material delivery risk."


class AIRiskPredictionRead(AIRiskPredictionBase):
    model_config = ConfigDict(from_attributes=True)

    prediction_id: uuid.UUID
    created_at: datetime
