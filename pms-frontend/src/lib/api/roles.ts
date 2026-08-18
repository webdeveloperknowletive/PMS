import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { Role, RoleCreate, RoleUpdate, UserRole, UserRoleCreate } from "@/types/role";

const base = createCrudApi<Role, RoleCreate, RoleUpdate>("/roles", "role_id");

export const rolesApi = {
  ...base,

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
