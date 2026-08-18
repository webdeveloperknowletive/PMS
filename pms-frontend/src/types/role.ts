export interface RoleBase {
  role_name: string;
  description?: string | null;
}

export interface RoleCreate extends RoleBase {}

export interface RoleUpdate {
  role_name?: string;
  description?: string | null;
}

export interface Role extends RoleBase {
  role_id: string;
  created_at: string;
}

export interface UserRoleBase {
  user_id: string;
  role_id: string;
}

export interface UserRoleCreate extends UserRoleBase {}

export interface UserRole extends UserRoleBase {
  user_role_id: string;
  assigned_at: string;
}
