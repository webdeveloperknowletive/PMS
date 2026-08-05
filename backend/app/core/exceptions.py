from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException


# ==========================================================
# Standard Error Response
# ==========================================================

def error_response(
    *,
    status_code: int,
    error_code: str,
    message: str,
    details: Any = None,
) -> JSONResponse:
    """
    Standard API error response.
    """

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "status_code": status_code,
            "error_code": error_code,
            "message": message,
            "details": details,
        },
    )


# ==========================================================
# Base Exception
# ==========================================================

class AppException(Exception):
    """
    Base application exception.
    """

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str = "APPLICATION_ERROR",
        details: Any = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details

        super().__init__(message)


# ==========================================================
# Authentication Exceptions
# ==========================================================

class UnauthorizedException(AppException):

    def __init__(
        self,
        message: str = "Authentication required",
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED",
        )


class ForbiddenException(AppException):

    def __init__(
        self,
        message: str = "Permission denied",
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="FORBIDDEN",
        )


# ==========================================================
# Resource Exceptions
# ==========================================================

class NotFoundException(AppException):

    def __init__(
        self,
        resource: str = "Resource",
    ):
        super().__init__(
            message=f"{resource} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
        )


class AlreadyExistsException(AppException):

    def __init__(
        self,
        resource: str = "Resource",
    ):
        super().__init__(
            message=f"{resource} already exists",
            status_code=status.HTTP_409_CONFLICT,
            error_code="ALREADY_EXISTS",
        )


# ==========================================================
# Validation Exception
# ==========================================================

class ValidationException(AppException):

    def __init__(
        self,
        message: str,
        details: Any = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details,
        )


# ==========================================================
# Database Exception
# ==========================================================

class DatabaseException(AppException):

    def __init__(
        self,
        message: str = "Database operation failed",
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
        )


# ==========================================================
# Conflict Exception
# ==========================================================

class ConflictException(AppException):

    def __init__(
        self,
        message: str,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
        )


# ==========================================================
# Bad Request Exception
# ==========================================================

class BadRequestException(AppException):

    def __init__(
        self,
        message: str,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BAD_REQUEST",
        )


# ==========================================================
# Exception Handlers
# ==========================================================

async def app_exception_handler(
    request: Request,
    exc: AppException,
):

    return error_response(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):

    return error_response(
        status_code=exc.status_code,
        error_code="HTTP_EXCEPTION",
        message=str(exc.detail),
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):

    return error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="REQUEST_VALIDATION_ERROR",
        message="Validation failed",
        details=exc.errors(),
    )


async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
):

    return error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="DATABASE_ERROR",
        message="Database operation failed",
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
):

    return error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected error occurred.",
    )


# ==========================================================
# Register Handlers
# ==========================================================

def register_exception_handlers(app: FastAPI) -> None:
    """
    Register all global exception handlers.
    """

    app.add_exception_handler(
        AppException,
        app_exception_handler,
    )

    app.add_exception_handler(
        StarletteHTTPException,
        http_exception_handler,
    )

    app.add_exception_handler(
        RequestValidationError,
        validation_exception_handler,
    )

    app.add_exception_handler(
        SQLAlchemyError,
        database_exception_handler,
    )

    app.add_exception_handler(
        Exception,
        unhandled_exception_handler,
    )