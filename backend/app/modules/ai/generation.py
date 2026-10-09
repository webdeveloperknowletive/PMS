"""Shared, structured Groq generation for the AI workspace modules."""

from fastapi import HTTPException, status

from app.modules.ai.doc_generator.ai.llm_client import generate_json


def generate_structured(system_prompt: str, user_prompt: str) -> dict:
    try:
        return generate_json(system_prompt, user_prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
