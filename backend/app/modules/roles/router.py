from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
from app.modules.roles.permissions import can_manage_roles
from app.modules.roles.model import Permission, Role, RolePermission, UserRole
from app.core.permissions import get_user_permission_codes
from app.modules.roles.schema import PermissionRead, RolePermissionsUpdate

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)


@router.get("/", response_model=list[RoleRead], status_code=status.HTTP_200_OK)
async def get_roles(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_roles(db, skip=skip, limit=limit)


@router.get("/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def get_permissions(db: Session = Depends(get_db), _=Depends(can_manage_roles)):
    return db.query(Permission).order_by(Permission.category, Permission.name).all()


@router.get("/me/permissions", response_model=list[str], status_code=status.HTTP_200_OK)
async def get_my_permissions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_permission_codes(db, current_user)


@router.get("/{role_id}/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def get_role_permissions(role_id: UUID, db: Session = Depends(get_db), _=Depends(can_manage_roles)):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return [link.permission for link in role.permission_links]


@router.put("/{role_id}/permissions", response_model=list[PermissionRead], status_code=status.HTTP_200_OK)
async def update_role_permissions(role_id: UUID, payload: RolePermissionsUpdate, db: Session = Depends(get_db), _=Depends(can_manage_roles)):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    permissions = db.query(Permission).filter(Permission.permission_id.in_(payload.permission_ids)).all() if payload.permission_ids else []
    if len(permissions) != len(set(payload.permission_ids)):
        raise HTTPException(status_code=400, detail="One or more selected permissions do not exist")
    if not any(permission.code == "roles.manage" for permission in permissions):
        other_admin = db.query(UserRole.user_role_id).join(RolePermission, UserRole.role_id == RolePermission.role_id).join(
            Permission, Permission.permission_id == RolePermission.permission_id
        ).filter(Permission.code == "roles.manage", UserRole.role_id != role_id).first()
        if not other_admin:
            raise HTTPException(status_code=400, detail="Keep Manage roles and access on a role assigned to an admin user")
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete(synchronize_session=False)
    db.flush()
    db.add_all([RolePermission(role_id=role_id, permission_id=permission.permission_id) for permission in permissions])
    db.commit()
    return permissions


@router.get("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK)
async def get_role(
    role_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_role(db, role_id)


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
):
    return service.create_role(db, payload)


@router.put("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_roles)])
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
):
    return service.update_role(db, role_id, payload)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is not None and any(link.permission.code == "roles.manage" for link in role.permission_links):
        other_admin = db.query(UserRole.user_role_id).join(RolePermission, UserRole.role_id == RolePermission.role_id).join(
            Permission, Permission.permission_id == RolePermission.permission_id
        ).filter(Permission.code == "roles.manage", UserRole.role_id != role_id).first()
        if not other_admin:
            raise HTTPException(status_code=400, detail="Cannot delete the last role assigned to an admin user")
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
    return service.get_user_roles(db, user_id)


@router.post("/users/{user_id}", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def assign_role_to_user(
    user_id: UUID,
    payload: UserRoleCreate,
    db: Session = Depends(get_db),
):
    return service.assign_role_to_user(db, user_id, payload)


@router.delete("/users/{user_id}/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is not None and any(link.permission.code == "roles.manage" for link in role.permission_links):
        other_admin = db.query(UserRole.user_role_id).join(RolePermission, UserRole.role_id == RolePermission.role_id).join(
            Permission, Permission.permission_id == RolePermission.permission_id
        ).filter(Permission.code == "roles.manage", UserRole.user_id != user_id).first()
        if not other_admin:
            another_assignment = db.query(UserRole.user_role_id).join(RolePermission, UserRole.role_id == RolePermission.role_id).join(
                Permission, Permission.permission_id == RolePermission.permission_id
            ).filter(Permission.code == "roles.manage", UserRole.user_id == user_id, UserRole.role_id != role_id).first()
            if not another_assignment:
                raise HTTPException(status_code=400, detail="Cannot remove the last admin role assignment")
    service.remove_role_from_user(db, user_id, role_id)
