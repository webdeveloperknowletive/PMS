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

  uploadProfilePicture: async (userId: string, file: File): Promise<User> => {
    const body = new FormData();
    body.append("file", file);
    const { data } = await apiClient.put<User>(`/users/${userId}/profile-picture`, body, {
      // The shared API client defaults to JSON. Override it for this upload so
      // Axios sends the FormData as multipart and the browser can add its boundary.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  removeProfilePicture: async (userId: string): Promise<User> => {
    const { data } = await apiClient.delete<User>(`/users/${userId}/profile-picture`);
    return data;
  },

  getProfilePicture: async (userId: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(`/users/${userId}/profile-picture`, { responseType: "blob" });
    return data;
  },
};
