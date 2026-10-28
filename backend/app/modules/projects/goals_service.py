from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.projects.model import Project, ProjectGoal
from app.modules.projects import service as project_service
from app.modules.projects.goal_schema import ProjectGoalCreate, ProjectGoalUpdate
from app.modules.tasks.model import Task
from app.modules.users.model import User


def _read(db: Session, goal: ProjectGoal) -> dict:
    task_count, completed = db.query(
        func.count(Task.task_id),
        func.count(Task.task_id).filter(Task.status == "DONE"),
    ).filter(Task.goal_id == goal.goal_id).one()
    owner_name = db.query(User.name).filter(
        User.user_id == goal.owner_id,
        User.organization_id == goal.organization_id,
    ).scalar() if goal.owner_id else None
    return {
        "goal_id": goal.goal_id,
        "project_id": goal.project_id,
        "name": goal.name,
        "description": goal.description,
        "success_measure": goal.success_measure,
        "owner_id": goal.owner_id,
        "owner_name": owner_name,
        "parent_goal_id": goal.parent_goal_id,
        "status": goal.status,
        "target_date": goal.target_date,
        "task_count": task_count,
        "completed_task_count": completed,
        "progress_percent": round(completed * 100 / task_count) if task_count else 0,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at,
    }


def list_goals(db: Session, project_id: UUID, user: User) -> list[dict]:
    project_service.get_project(db, project_id, user)
    goals = db.query(ProjectGoal).filter(
        ProjectGoal.project_id == project_id,
        ProjectGoal.organization_id == user.organization_id,
    ).order_by(ProjectGoal.created_at.desc()).all()
    return [_read(db, goal) for goal in goals]


def list_portfolio_goals(db: Session, user: User) -> list[dict]:
    projects = project_service.get_projects(db, user, skip=0, limit=500)
    project_names = {project.project_id: project.project_name for project in projects}
    if not project_names:
        return []
    goals = db.query(ProjectGoal).filter(
        ProjectGoal.project_id.in_(project_names),
        ProjectGoal.organization_id == user.organization_id,
    ).order_by(ProjectGoal.target_date.asc().nullslast(), ProjectGoal.name.asc()).all()
    return [{**_read(db, goal), "project_name": project_names[goal.project_id]} for goal in goals]


def _validate_goal_references(
    db: Session,
    project: Project,
    *,
    owner_id: UUID | None,
    parent_goal_id: UUID | None,
    current_goal_id: UUID | None = None,
) -> None:
    if owner_id is not None and db.query(User.user_id).filter(
        User.user_id == owner_id,
        User.organization_id == project.organization_id,
        User.is_active.is_(True),
    ).one_or_none() is None:
        raise HTTPException(status_code=400, detail="Choose an active owner from this workspace")
    if parent_goal_id is None:
        return
    parent = db.query(ProjectGoal).filter(
        ProjectGoal.goal_id == parent_goal_id,
        ProjectGoal.project_id == project.project_id,
        ProjectGoal.organization_id == project.organization_id,
    ).one_or_none()
    if parent is None:
        raise HTTPException(status_code=400, detail="Choose a parent goal from this project")
    seen: set[UUID] = set()
    cursor = parent
    while cursor is not None:
        if cursor.goal_id == current_goal_id:
            raise HTTPException(status_code=400, detail="A goal cannot be nested under itself or one of its descendants")
        if cursor.goal_id in seen:
            raise HTTPException(status_code=400, detail="The selected parent belongs to an invalid goal hierarchy")
        seen.add(cursor.goal_id)
        cursor = db.query(ProjectGoal).filter(
            ProjectGoal.goal_id == cursor.parent_goal_id,
            ProjectGoal.project_id == project.project_id,
            ProjectGoal.organization_id == project.organization_id,
        ).one_or_none() if cursor.parent_goal_id else None


def create_goal(db: Session, project_id: UUID, payload: ProjectGoalCreate, user: User) -> dict:
    project = project_service.get_project(db, project_id, user)
    _validate_goal_references(db, project, owner_id=payload.owner_id, parent_goal_id=payload.parent_goal_id)
    goal = ProjectGoal(project_id=project_id, organization_id=project.organization_id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _read(db, goal)


def update_goal(db: Session, project_id: UUID, goal_id: UUID, payload: ProjectGoalUpdate, user: User) -> dict:
    project = project_service.get_project(db, project_id, user)
    goal = db.query(ProjectGoal).filter(
        ProjectGoal.goal_id == goal_id,
        ProjectGoal.project_id == project_id,
        ProjectGoal.organization_id == user.organization_id,
    ).one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    values = payload.model_dump(exclude_unset=True)
    _validate_goal_references(
        db, project,
        owner_id=values.get("owner_id", goal.owner_id),
        parent_goal_id=values.get("parent_goal_id", goal.parent_goal_id),
        current_goal_id=goal.goal_id,
    )
    for key, value in values.items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return _read(db, goal)


def delete_goal(db: Session, project_id: UUID, goal_id: UUID, user: User) -> None:
    project_service.get_project(db, project_id, user)
    goal = db.query(ProjectGoal).filter(
        ProjectGoal.goal_id == goal_id,
        ProjectGoal.project_id == project_id,
        ProjectGoal.organization_id == user.organization_id,
    ).one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
