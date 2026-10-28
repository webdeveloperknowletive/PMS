import pytest
from pydantic import ValidationError

from app.modules.projects.component_schema import ProjectComponentCreate, ProjectComponentUpdate


def test_component_text_is_trimmed_and_bounded():
    component = ProjectComponentCreate(name="  API  ", description="  Shared backend  ")

    assert component.name == "API"
    assert component.description == "Shared backend"


def test_component_rejects_blank_or_too_short_names():
    with pytest.raises(ValidationError):
        ProjectComponentCreate(name="  ")
    with pytest.raises(ValidationError):
        ProjectComponentUpdate(name=" ")


def test_component_update_requires_a_field_and_cannot_clear_name():
    with pytest.raises(ValidationError, match="Provide a component field"):
        ProjectComponentUpdate()
    with pytest.raises(ValidationError, match="name cannot be cleared"):
        ProjectComponentUpdate(name=None)
