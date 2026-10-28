from datetime import date
import math
import re
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


CustomFieldType = Literal["TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "CHECKBOX"]


class ProjectCustomFieldCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    field_type: CustomFieldType
    is_required: bool = False
    options: list[str] = Field(default_factory=list, max_length=50)
    default_value: Any = None

    @field_validator("name", mode="before")
    @classmethod
    def _trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("options", mode="before")
    @classmethod
    def _trim_options(cls, value):
        return [option.strip() if isinstance(option, str) else option for option in value] if isinstance(value, list) else value

    @model_validator(mode="after")
    def _validate_type_options_and_default(self):
        if self.field_type == "SINGLE_SELECT":
            if not 1 <= len(self.options) <= 50:
                raise ValueError("Select fields require between 1 and 50 options")
            if any(not option or len(option) > 100 for option in self.options):
                raise ValueError("Options must contain 1 to 100 characters")
            if "__no_custom_field_value__" in self.options:
                raise ValueError("This option value is reserved")
            if len({option.casefold() for option in self.options}) != len(self.options):
                raise ValueError("Options must be unique")
        elif self.options:
            raise ValueError("Options are only supported for single-select fields")

        if self.default_value is not None:
            normalized_default = _validate_value(self.field_type, self.default_value, self.options, "default value")
            if self.is_required and ((self.field_type == "TEXT" and normalized_default == "") or (self.field_type == "CHECKBOX" and normalized_default is not True)):
                raise ValueError("A required field's default must satisfy its required rule")
            self.default_value = normalized_default
        return self


class ProjectCustomFieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    field_id: UUID
    project_id: UUID
    name: str
    field_type: CustomFieldType
    is_required: bool
    options: list[str]
    default_value: Any = None


def _validate_value(field_type: CustomFieldType, value: Any, options: list[str], label: str) -> Any:
    if field_type == "TEXT":
        if not isinstance(value, str) or len(value.strip()) > 1000:
            raise ValueError(f"{label} must be text of at most 1000 characters")
        return value.strip()
    if field_type == "NUMBER":
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or (isinstance(value, float) and not math.isfinite(value))
            or abs(value) > 1_000_000_000_000
        ):
            raise ValueError(f"{label} must be a number")
        return value
    if field_type == "DATE":
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError(f"{label} must be a date in YYYY-MM-DD format")
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError as error:
            raise ValueError(f"{label} must be a date in YYYY-MM-DD format") from error
    if field_type == "SINGLE_SELECT":
        if not isinstance(value, str) or value not in options:
            raise ValueError(f"{label} must match one of the configured options")
        return value
    if field_type == "CHECKBOX":
        if not isinstance(value, bool):
            raise ValueError(f"{label} must be true or false")
        return value
    raise ValueError("Unsupported custom field type")
