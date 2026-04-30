import pytest

from core.utils import dashboard_callback
from projects.models import Project, ProjectConfig

pytestmark = pytest.mark.django_db


def test_dashboard_callback_uses_zero_when_no_project_configs():
    context = {"existing": True}

    result = dashboard_callback(request=None, context=context)

    assert result["existing"] is True
    assert result["avg_authority_weight"] == 0


def test_dashboard_callback_rounds_average_authority_weight():
    project_one = Project.objects.create(
        name="Utils Project 1", topic_description="Infra"
    )
    project_two = Project.objects.create(
        name="Utils Project 2", topic_description="Data"
    )
    ProjectConfig.objects.create(project=project_one, upvote_authority_weight=0.1234)
    ProjectConfig.objects.create(project=project_two, upvote_authority_weight=0.5678)

    result = dashboard_callback(request=None, context={})

    assert result["avg_authority_weight"] == 0.35
