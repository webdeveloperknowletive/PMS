from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.roles import service
from app.modules.roles.schema import (
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserRoleCreate,
    UserRoleRead,
)
from app.modules.roles.model import Permission, Role, RolePermission, UserRole
from app.core.permissions import get_user_permission_codes, has_permission, is_system_role_assigned
from app.core.exceptions import ForbiddenException
from app.modules.roles.schema import PermissionRead, RolePermissionsUpdate
from app.modules.roles.schema import UserRoleAssignmentsRead
from app.modules.users.model import User
from app.modules.users.schema import UserRead

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)


@router.get("/", response_model=list[RoleRead], status_code=status.HTTP_200_OK)
async def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_roles(db, skip=skip, limit=limit)


@router.get("/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def get_permissions(db: Session = Depends(get_db)):
    return db.query(Permission).order_by(Permission.category, Permission.name).all()


@router.get("/me/permissions", response_model=list[str], status_code=status.HTTP_200_OK)
async def get_my_permissions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_permission_codes(db, current_user)


@router.get("/assignments", response_model=list[UserRoleAssignmentsRead], status_code=status.HTTP_200_OK)
async def get_role_assignments(
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return role assignments in one batched query for enterprise workspaces."""
    query = db.query(User).options(selectinload(User.user_roles).joinedload(UserRole.role))
    if not is_system_role_assigned(db, current_user):
        query = query.filter(~User.user_roles.any(UserRole.role.has(Role.is_system.is_(True))))
    users = query.order_by(User.name, User.user_id).offset(skip).limit(limit).all()
    return [{"user": UserRead.model_validate(user), "roles": user.user_roles} for user in users]


@router.get("/{role_id}/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def get_role_permissions(role_id: UUID, db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return [link.permission for link in role.permission_links]


@router.put("/{role_id}/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def update_role_permissions(role_id: UUID, payload: RolePermissionsUpdate, db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=409, detail="Workspace owner permissions are managed by the system")
    selected = db.query(Permission).filter(Permission.permission_id.in_(payload.permission_ids)).all()
    if len({permission.permission_id for permission in selected}) != len(set(payload.permission_ids)):
        raise HTTPException(status_code=400, detail="One or more permissions are not available in this workspace")
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete(synchronize_session=False)
    db.add_all(RolePermission(role_id=role_id, permission_id=permission.permission_id) for permission in selected)
    db.commit()
    # Bulk deletion does not synchronize an already-loaded relationship.
    # Return the validated selection instead of potentially stale links.
    return sorted(selected, key=lambda permission: (permission.category, permission.name))


@router.get("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK)
async def get_role(
    role_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_role(db, role_id)


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(payload: RoleCreate, db: Session = Depends(get_db)):
    return service.create_role(db, payload)


@router.put("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK)
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
):
    return service.update_role(db, role_id, payload)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(role_id: UUID, db: Session = Depends(get_db)):
    service.delete_role(db, role_id)


# ==========================================================
# User <-> Role Assignments
# ==========================================================

@router.get("/users/{user_id}", response_model=list[UserRoleRead], status_code=status.HTTP_200_OK)
async def get_user_roles(
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_id != user_id and not has_permission(db, current_user, "roles.assignments.view"):
        raise ForbiddenException(message="You may only view your own role assignments")
    target = db.get(User, user_id)
    if target is not None and target.user_id != current_user.user_id and not is_system_role_assigned(db, current_user) and is_system_role_assigned(db, target):
        raise HTTPException(status_code=404, detail="User not found")
    return service.get_user_roles(db, user_id)


@router.post("/users/{user_id}", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    user_id: UUID,
    payload: UserRoleCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.assign_role_to_user(db, user_id, payload)


@router.delete("/users/{user_id}/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.remove_role_from_user(db, user_id, role_id)
