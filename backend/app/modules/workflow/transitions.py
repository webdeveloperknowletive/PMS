TASK_WORKFLOW_STATUSES = (
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "BLOCKED",
    "CANCELLED",
)

DEFAULT_TASK_TRANSITIONS = {
    "TODO": ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
    "IN_PROGRESS": ["TODO", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"],
    "IN_REVIEW": ["IN_PROGRESS", "BLOCKED", "DONE"],
    "DONE": ["IN_PROGRESS"],
    "BLOCKED": ["TODO", "IN_PROGRESS", "CANCELLED"],
    "CANCELLED": ["TODO"],
}


def default_task_transitions() -> dict[str, list[str]]:
    """Return a fresh copy so ORM instances never share mutable defaults."""
    return {status: list(targets) for status, targets in DEFAULT_TASK_TRANSITIONS.items()}


def validate_task_transitions(value: object) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        raise ValueError("Allowed transitions must be a status-to-status mapping")

    unknown_sources = set(value) - set(TASK_WORKFLOW_STATUSES)
    if unknown_sources:
        raise ValueError(f"Unknown workflow status: {sorted(unknown_sources)[0]}")

    normalized = {status: [] for status in TASK_WORKFLOW_STATUSES}
    for source, targets in value.items():
        if not isinstance(targets, list):
            raise ValueError(f"Transitions from {source} must be a list")
        if any(target not in TASK_WORKFLOW_STATUSES for target in targets):
            raise ValueError(f"Transitions from {source} contain an unknown status")
        if source in targets:
            raise ValueError(f"A task cannot transition from {source} to itself")
        if len(targets) != len(set(targets)):
            raise ValueError(f"Transitions from {source} contain duplicates")
        normalized[source] = list(targets)

    if not normalized["TODO"]:
        raise ValueError("Tasks in To Do must have at least one allowed next status")
    if not normalized["IN_PROGRESS"]:
        raise ValueError("Tasks In Progress must have at least one allowed next status")
    return normalized
