import { apiClient } from "./client";
import type { ListParams } from "@/types/common";

/**
 * Every module router in the backend (projects, tasks, teams, kanban, gantt,
 * milestones, calendar, documentation, notifications, reports, roles, and
 * all 5 ai/* routers) exposes the exact same 5 endpoints:
 *   GET    /<resource>/            -> list
 *   GET    /<resource>/{id}        -> retrieve
 *   POST   /<resource>/            -> create
 *   PUT    /<resource>/{id}        -> update
 *   DELETE /<resource>/{id}        -> delete
 *
 * This factory avoids re-writing that boilerplate 15+ times and keeps every
 * module's API file down to just its resource path + types + any extra
 * non-CRUD routes it has (e.g. tasks/{id}/subtasks).
 */
export function createCrudApi<TRead, TCreate, TUpdate>(resourcePath: string, idParam: string) {
  return {
    list: async (params?: ListParams): Promise<TRead[]> => {
      const { data } = await apiClient.get<TRead[]>(`${resourcePath}/`, { params });
      return data;
    },
    get: async (id: string): Promise<TRead> => {
      const { data } = await apiClient.get<TRead>(`${resourcePath}/${id}`);
      return data;
    },
    create: async (payload: TCreate): Promise<TRead> => {
      const { data } = await apiClient.post<TRead>(`${resourcePath}/`, payload);
      return data;
    },
    update: async (id: string, payload: TUpdate): Promise<TRead> => {
      const { data } = await apiClient.put<TRead>(`${resourcePath}/${id}`, payload);
      return data;
    },
    remove: async (id: string): Promise<void> => {
      await apiClient.delete(`${resourcePath}/${id}`);
    },
    // exposed so module files can build extra routes off the same base path
    _resourcePath: resourcePath,
    _idParam: idParam,
  };
}
