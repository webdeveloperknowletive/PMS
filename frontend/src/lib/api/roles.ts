import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { Permission, Role, RoleCreate, RoleUpdate, UserRole, UserRoleCreate } from "@/types/role";
import type { User } from "@/types/user";

const base = createCrudApi<Role, RoleCreate, RoleUpdate>("/roles", "role_id");

export const rolesApi = {
  ...base,

  getPermissions: async (): Promise<Permission[]> => (await apiClient.get<Permission[]>("/roles/permissions")).data,
  getMyPermissions: async (): Promise<string[]> => (await apiClient.get<string[]>("/roles/me/permissions")).data,
  getAllRoleAssignments: async (): Promise<{ user: User; roles: UserRole[] }[]> =>
    (await apiClient.get<{ user: User; roles: UserRole[] }[]>("/roles/assignments", { params: { limit: 10000 } })).data,
  getRolePermissions: async (roleId: string): Promise<Permission[]> => (await apiClient.get<Permission[]>(`/roles/${roleId}/permissions`)).data,
  setRolePermissions: async (roleId: string, permissionIds: string[]): Promise<Permission[]> =>
    (await apiClient.put<Permission[]>(`/roles/${roleId}/permissions`, { permission_ids: permissionIds })).data,

  /** GET /roles/users/{user_id} — roles assigned to a specific user */
  getUserRoles: async (userId: string): Promise<UserRole[]> => {
    const { data } = await apiClient.get<UserRole[]>(`/roles/users/${userId}`);
    return data;
  },

  /** POST /roles/users/{user_id} — assign a role to a user */
  assignRole: async (userId: string, payload: UserRoleCreate): Promise<UserRole> => {
    const { data } = await apiClient.post<UserRole>(`/roles/users/${userId}`, payload);
    return data;
  },

  /** DELETE /roles/users/{user_id}/{role_id} */
  removeRole: async (userId: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/roles/users/${userId}/${roleId}`);
  },
};
