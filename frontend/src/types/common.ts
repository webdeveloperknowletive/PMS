/** Standard list-query params accepted by every GET /<resource>/ endpoint (skip/limit pagination). */
export interface ListParams {
  skip?: number;
  limit?: number;
}

export interface TaskListParams extends ListParams {
  search?: string;
  project_id?: string;
  assignee_id?: string;
  status?: string;
  priority?: string;
  component_id?: string;
  release_id?: string;
  label?: string;
  overdue?: boolean;
  due_after?: string;
  due_before?: string;
  backlog?: boolean;
  blocked?: boolean;
}

/** Shape returned by FastAPI's default validation error handler (422). */
export interface ApiValidationError {
  detail: { loc: (string | number)[]; msg: string; type: string }[];
}

/** Shape returned by app/core/exceptions.py for HTTPException-style errors. */
export interface ApiError {
  detail: string;
}
