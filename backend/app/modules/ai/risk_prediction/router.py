from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.risk_prediction.model import AIRiskPrediction
from app.modules.ai.risk_prediction.schema import (
    AIRiskPredictionCreate,
    AIRiskPredictionRead,
    AIRiskPredictionUpdate,
)
from app.modules.ai.risk_prediction.permissions import can_generate, can_view_results

router = APIRouter(
    prefix="/ai/risk-predictions",
    tags=["AI Risk Prediction"]
)


@router.get(
    "/",
    response_model=list[AIRiskPredictionRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_risk_predictions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(AIRiskPrediction).offset(skip).limit(limit).all()


@router.get(
    "/{prediction_id}",
    response_model=AIRiskPredictionRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_risk_prediction(
    prediction_id: UUID,
    db: Session = Depends(get_db),
):
    prediction = db.get(AIRiskPrediction, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
    return prediction


@router.post(
    "/",
    response_model=AIRiskPredictionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def generate_risk_prediction(
    payload: AIRiskPredictionCreate,
    db: Session = Depends(get_db),
):
    prediction = AIRiskPrediction(**payload.model_dump())
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


@router.put(
    "/{prediction_id}",
    response_model=AIRiskPredictionRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def update_risk_prediction(
    prediction_id: UUID,
    payload: AIRiskPredictionUpdate,
    db: Session = Depends(get_db),
):
    prediction = db.get(AIRiskPrediction, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prediction, field, value)

    db.commit()
    db.refresh(prediction)
    return prediction


@router.delete(
    "/{prediction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_generate)],
)
async def delete_risk_prediction(
    prediction_id: UUID,
    db: Session = Depends(get_db),
):
    prediction = db.get(AIRiskPrediction, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")

    db.delete(prediction)
    db.commit()