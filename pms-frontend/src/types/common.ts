/** Standard list-query params accepted by every GET /<resource>/ endpoint (skip/limit pagination). */
export interface ListParams {
  skip?: number;
  limit?: number;
}

/** Shape returned by FastAPI's default validation error handler (422). */
export interface ApiValidationError {
  detail: { loc: (string | number)[]; msg: string; type: string }[];
}

/** Shape returned by app/core/exceptions.py for HTTPException-style errors. */
export interface ApiError {
  detail: string;
}
