from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.projects.schema import ProjectCreate
from app.modules.projects.service import _project_key_base


def test_project_key_base_uses_initials_or_short_word_key():
    assert _project_key_base("SprintIX Delivery Platform") == "SDP"
    assert _project_key_base("Simple") == "SIMP"
    assert _project_key_base("###") == "PROJ"


def test_project_create_accepts_only_supported_board_presets():
    base = {
        "project_name": "Support project",
        "team_lead_user_id": uuid4(),
        "project_manager_user_id": uuid4(),
    }
    assert ProjectCreate(**base, board_template="BLOCKED").board_template == "BLOCKED"
    assert ProjectCreate(**base).board_template == "STANDARD"
    with pytest.raises(ValidationError):
        ProjectCreate(**base, board_template="CUSTOM")
