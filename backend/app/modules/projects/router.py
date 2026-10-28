from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.projects import service
from app.modules.projects.schema import ProjectAssignmentCandidateRead, ProjectAssignmentRead, ProjectCreate, ProjectRead, ProjectUpdate
from app.modules.projects.permissions import can_manage_projects, can_view_projects
from app.modules.projects.goal_schema import ProjectGoalCreate, ProjectGoalPortfolioRead, ProjectGoalRead, ProjectGoalUpdate
from app.modules.projects import goals_service
from app.modules.projects.release_schema import ProjectReleaseCreate, ProjectReleaseRead, ProjectReleaseScopeChangeRead, ProjectReleaseUpdate
from app.modules.projects import releases_service
from app.modules.projects import components_service
from app.modules.projects.component_schema import ProjectComponentCreate, ProjectComponentRead, ProjectComponentUpdate
from app.modules.projects.custom_field_schema import ProjectCustomFieldCreate, ProjectCustomFieldRead
from app.modules.projects import custom_fields_service
from app.modules.projects import templates_service
from app.modules.projects.template_schema import ProjectTemplateCreate, ProjectTemplateRead
from app.core.dependencies import get_current_user
from app.modules.users.model import User

router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


@router.get("/templates", response_model=list[ProjectTemplateRead], dependencies=[Depends(can_manage_projects)])
async def get_project_templates(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return templates_service.list_templates(db, current_user)


@router.post("/templates", response_model=ProjectTemplateRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_projects)])
async def create_project_template(payload: ProjectTemplateCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return templates_service.create_template(db, payload, current_user)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_projects)])
async def delete_project_template(template_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    templates_service.delete_template(db, template_id, current_user)


@router.get("/{project_id}/custom-fields", response_model=list[ProjectCustomFieldRead], dependencies=[Depends(can_view_projects)])
async def get_project_custom_fields(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return custom_fields_service.list_fields(db, project_id, current_user)


@router.post("/{project_id}/custom-fields", response_model=ProjectCustomFieldRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_projects)])
async def create_project_custom_field(project_id: UUID, payload: ProjectCustomFieldCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return custom_fields_service.create_field(db, project_id, payload, current_user)


@router.delete("/{project_id}/custom-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_projects)])
async def delete_project_custom_field(project_id: UUID, field_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    custom_fields_service.delete_field(db, project_id, field_id, current_user)


@router.get("/{project_id}/components", response_model=list[ProjectComponentRead], dependencies=[Depends(can_view_projects)])
async def get_project_components(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return components_service.list_components(db, project_id, current_user)


@router.post("/{project_id}/components", response_model=ProjectComponentRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_projects)])
async def create_project_component(project_id: UUID, payload: ProjectComponentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return components_service.create_component(db, project_id, payload, current_user)


@router.put("/{project_id}/components/{component_id}", response_model=ProjectComponentRead, dependencies=[Depends(can_manage_projects)])
async def update_project_component(project_id: UUID, component_id: UUID, payload: ProjectComponentUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return components_service.update_component(db, project_id, component_id, payload, current_user)


@router.delete("/{project_id}/components/{component_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_projects)])
async def delete_project_component(project_id: UUID, component_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    components_service.delete_component(db, project_id, component_id, current_user)


@router.get("/goals/portfolio", response_model=list[ProjectGoalPortfolioRead], dependencies=[Depends(can_view_projects)])
async def get_goal_portfolio(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goals_service.list_portfolio_goals(db, current_user)


@router.get("/{project_id}/goals", response_model=list[ProjectGoalRead], dependencies=[Depends(can_view_projects)])
async def get_project_goals(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goals_service.list_goals(db, project_id, current_user)


@router.post("/{project_id}/goals", response_model=ProjectGoalRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_projects)])
async def create_project_goal(project_id: UUID, payload: ProjectGoalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goals_service.create_goal(db, project_id, payload, current_user)


@router.put("/{project_id}/goals/{goal_id}", response_model=ProjectGoalRead, dependencies=[Depends(can_manage_projects)])
async def update_project_goal(project_id: UUID, goal_id: UUID, payload: ProjectGoalUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return goals_service.update_goal(db, project_id, goal_id, payload, current_user)


@router.delete("/{project_id}/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_projects)])
async def delete_project_goal(project_id: UUID, goal_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goals_service.delete_goal(db, project_id, goal_id, current_user)


@router.get("/{project_id}/releases", response_model=list[ProjectReleaseRead], dependencies=[Depends(can_view_projects)])
async def get_project_releases(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return releases_service.list_releases(db, project_id, current_user)


@router.get("/{project_id}/release-scope-history", response_model=list[ProjectReleaseScopeChangeRead], dependencies=[Depends(can_view_projects)])
async def get_project_release_scope_history(
    project_id: UUID,
    release_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return releases_service.list_release_scope_history(db, project_id, release_id, current_user, limit=limit)


@router.post("/{project_id}/releases", response_model=ProjectReleaseRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_projects)])
async def create_project_release(project_id: UUID, payload: ProjectReleaseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return releases_service.create_release(db, project_id, payload, current_user)


@router.put("/{project_id}/releases/{release_id}", response_model=ProjectReleaseRead, dependencies=[Depends(can_manage_projects)])
async def update_project_release(project_id: UUID, release_id: UUID, payload: ProjectReleaseUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return releases_service.update_release(db, project_id, release_id, payload, current_user)


@router.delete("/{project_id}/releases/{release_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_projects)])
async def delete_project_release(project_id: UUID, release_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    releases_service.delete_release(db, project_id, release_id, current_user)


@router.get(
    "/",
    response_model=list[ProjectRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_projects)],
)
async def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_projects(db, current_user, skip=skip, limit=limit)


@router.get(
    "/assignment-candidates",
    response_model=list[ProjectAssignmentCandidateRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def get_project_assignment_candidates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project_assignment_candidates(db, current_user)


@router.get(
    "/{project_id}/assignment",
    response_model=ProjectAssignmentRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def get_project_assignment(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project_assignment(db, project_id, current_user)


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_projects)],
)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project(db, project_id, current_user)


@router.post(
    "/",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_projects)],
)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_project(db, payload, actor=current_user)


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_projects)],
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_project(db, project_id, payload, actor=current_user)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_projects)],
)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_project(db, project_id, actor=current_user)
