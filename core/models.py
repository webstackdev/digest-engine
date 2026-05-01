"""Core domain models plus compatibility re-exports during app decomposition.

The admin, API, Celery tasks, and AI pipeline all revolve around the models in this
module. Adding model-level docstrings here gives Django admindocs a useful summary
of the core entities new contributors interact with first.
"""

import secrets

from content.models import Content, FeedbackType, UserFeedback
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
    EntityMentionRole,
    EntityMentionSentiment,
    EntityType,
)
from ingestion.models import IngestionRun, RunStatus
from newsletters.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus
from pipeline.models import ReviewQueue as _ReviewQueue
from pipeline.models import ReviewReason as _ReviewReason
from pipeline.models import ReviewResolution as _ReviewResolution
from pipeline.models import SkillResult as _SkillResult
from pipeline.models import SkillStatus as _SkillStatus
from projects.models import Project as _Project
from trends.models import ContentClusterMembership as _ContentClusterMembership
from trends.models import ThemeSuggestion as _ThemeSuggestion
from trends.models import ThemeSuggestionStatus as _ThemeSuggestionStatus
from trends.models import TopicCentroidSnapshot as _TopicCentroidSnapshot
from trends.models import TopicCluster as _TopicCluster
from trends.models import TopicVelocitySnapshot as _TopicVelocitySnapshot

Project = _Project
ReviewQueue = _ReviewQueue
ReviewReason = _ReviewReason
ReviewResolution = _ReviewResolution
SkillResult = _SkillResult
SkillStatus = _SkillStatus
ContentClusterMembership = _ContentClusterMembership
ThemeSuggestion = _ThemeSuggestion
ThemeSuggestionStatus = _ThemeSuggestionStatus
TopicCluster = _TopicCluster
TopicCentroidSnapshot = _TopicCentroidSnapshot
TopicVelocitySnapshot = _TopicVelocitySnapshot

__all__ = [
    "Content",
    "ContentClusterMembership",
    "Entity",
    "EntityAuthoritySnapshot",
    "EntityCandidate",
    "EntityCandidateStatus",
    "EntityMention",
    "EntityMentionRole",
    "EntityMentionSentiment",
    "EntityType",
    "FeedbackType",
    "IngestionRun",
    "IntakeAllowlist",
    "NewsletterIntake",
    "NewsletterIntakeStatus",
    "Project",
    "RunStatus",
    "ThemeSuggestion",
    "ThemeSuggestionStatus",
    "TopicCluster",
    "TopicCentroidSnapshot",
    "TopicVelocitySnapshot",
    "UserFeedback",
]


def generate_project_intake_token() -> str:
    """Generate the stable token used in project-specific intake email aliases.

    Returns:
        A random hex token that can be embedded in addresses like
        ``intake+<token>@...`` to route inbound newsletters to a project.
    """

    from projects.model_support import generate_project_intake_token as _generate_token

    return _generate_token()


def generate_confirmation_token() -> str:
    """Generate a one-time token for newsletter sender confirmation links.

    Returns:
        A URL-safe random token stored on an allowlist entry until the sender
        confirms newsletter intake access.
    """

    return secrets.token_urlsafe(24)
