from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID
    organization_id: UUID
    actor_id: UUID | None
    actor_name: str
    actor_roles: str
    method: str
    path: str
    status_code: int
    created_at: datetime
