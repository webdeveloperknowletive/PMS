from fastapi import HTTPException
from app.modules.organizations.model import Organization


def require_active_workspace(db, organization_id):
    workspace = db.get(Organization, organization_id)
    if workspace is None or workspace.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Workspace access is suspended or unavailable. Contact your administrator.")
    return workspace
