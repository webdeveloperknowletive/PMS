import pytest
from pydantic import ValidationError

from app.modules.projects.custom_field_schema import ProjectCustomFieldCreate


def test_custom_field_create_trims_text_and_options():
    field = ProjectCustomFieldCreate(
        name="  Environment  ",
        field_type="SINGLE_SELECT",
        options=[" Dev ", " QA "],
        default_value="Dev",
    )

    assert field.name == "Environment"
    assert field.options == ["Dev", "QA"]
    assert field.default_value == "Dev"


def test_custom_field_select_options_are_required_and_unique():
    with pytest.raises(ValidationError, match="require between 1 and 50 options"):
        ProjectCustomFieldCreate(name="Environment", field_type="SINGLE_SELECT")
    with pytest.raises(ValidationError, match="Options must be unique"):
        ProjectCustomFieldCreate(name="Environment", field_type="SINGLE_SELECT", options=["Dev", "dev"])


def test_custom_field_defaults_match_their_type_and_required_rule():
    with pytest.raises(ValidationError, match="configured options"):
        ProjectCustomFieldCreate(name="Environment", field_type="SINGLE_SELECT", options=["Dev"], default_value="QA")
    with pytest.raises(ValidationError, match="must be a number"):
        ProjectCustomFieldCreate(name="Estimate", field_type="NUMBER", default_value="2")
    with pytest.raises(ValidationError, match="must be a number"):
        ProjectCustomFieldCreate(name="Estimate", field_type="NUMBER", default_value=10**13)
    with pytest.raises(ValidationError, match="required rule"):
        ProjectCustomFieldCreate(name="Approved", field_type="CHECKBOX", is_required=True, default_value=False)
