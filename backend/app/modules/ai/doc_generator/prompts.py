"""
==========================================================
                PROMPT TEMPLATES
==========================================================

System prompts and JSON-shape descriptions, kept separate
from service.py so a prompt can be tuned without touching
orchestration logic, and separate from collectors.py so
"what data do we have" never gets tangled with "how do we
phrase it for the AI".
"""

import json

HALLUCINATION_GUARD = """
You are an expert project-management documentation assistant.

Use ONLY the project information provided below. Do not invent facts.
Never invent: tasks, people, dates, metrics, risks, milestones, or
technical details that are not present in the supplied data.

If a piece of information you would normally include is not available
in the data provided, write "Information not available in the project
data" for that part instead of guessing or making something up.
""".strip()

_JSON_SHAPES = {
    "PROJECT_OVERVIEW": {
        "title": "string",
        "executive_summary": "string",
        "project_goals": ["string"],
        "scope": "string",
        "team_summary": "string",
        "milestones_summary": "string",
        "conclusion": "string",
    },
    "PROJECT_STATUS_REPORT": {
        "title": "string",
        "executive_summary": "string",
        "task_summary": "string",
        "completed_work": [{"title": "string", "description": "string"}],
        "in_progress_work": [{"title": "string", "description": "string"}],
        "blocked_work": [{"title": "string", "description": "string"}],
        "milestones_status": "string",
        "recommendations": ["string"],
        "conclusion": "string",
    },
    "TASK_DESCRIPTION": {
        "title": "string",
        "description": "string",
        "acceptance_criteria": ["string"],
        "notes": "string or null",
    },
}


def build_system_prompt(document_type: str, tone: str, length: str, audience: str, template: str, language: str) -> str:
    length_guidance = {
        "short": "Keep it brief — a few sentences per section.",
        "standard": "Use a normal, moderate level of detail per section.",
        "detailed": "Be thorough and detailed in every section.",
    }[length]

    return (
        f"{HALLUCINATION_GUARD}\n\n"
        f"Write in a {tone} tone, for a {audience.replace('_', ' ')} audience, "
        f"following a {template} document style. Write the document in {language}. "
        f"{length_guidance}\n\n"
        f"Respond with ONLY a single valid JSON object — no markdown code fences, "
        f"no preamble, no explanation before or after it. The JSON object must "
        f"have exactly this shape (fill in real values, this is only the shape):\n"
        f"{json.dumps(_JSON_SHAPES[document_type], indent=2)}"
    )


def build_user_prompt(document_type: str, collected_data: dict, additional_instructions: str | None) -> str:
    lines = [f"DOCUMENT TYPE: {document_type}", ""]

    for source_name, data in collected_data.items():
        lines.append(f"{source_name.upper()}:")
        lines.append(json.dumps(data, indent=2, default=str))
        lines.append("")

    if additional_instructions:
        lines.append("ADDITIONAL INSTRUCTIONS FROM THE USER:")
        lines.append(additional_instructions)

    return "\n".join(lines)
