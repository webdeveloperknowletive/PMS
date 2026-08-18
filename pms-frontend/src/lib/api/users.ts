import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { User, UserCreate, UserUpdate } from "@/types/user";

const base = createCrudApi<User, UserCreate, UserUpdate>("/users", "user_id");

export const usersApi = {
  ...base,

  /** PATCH /users/{id}/status — activate/deactivate a user (used on the Users screen toggle). */
  updateStatus: async (userId: string, is_active: boolean): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${userId}/status`, { is_active });
    return data;
  },

  /** PATCH /users/{id}/password */
  changePassword: async (userId: string, new_password: string): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${userId}/password`, { new_password });
    return data;
  },

  /** PATCH /users/{id}/profile */
  updateProfile: async (userId: string, payload: UserUpdate): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${userId}/profile`, payload);
    return data;
  },
};
