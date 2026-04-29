from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedSimpleRouter

from core.api import (
    ContentViewSet,
    EntityCandidateViewSet,
    EntityViewSet,
    IngestionRunViewSet,
    ProjectConfigViewSet,
    ProjectViewSet,
    ReviewQueueViewSet,
    SkillResultViewSet,
    SourceConfigViewSet,
    TopicCentroidSnapshotViewSet,
    UserFeedbackViewSet,
)

app_name = "api"

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

project_router = NestedSimpleRouter(router, r"projects", lookup="project")
project_router.register(
    r"project-configs", ProjectConfigViewSet, basename="project-config"
)
project_router.register(r"entities", EntityViewSet, basename="project-entity")
project_router.register(
    r"entity-candidates",
    EntityCandidateViewSet,
    basename="project-entity-candidate",
)
project_router.register(r"contents", ContentViewSet, basename="project-content")
project_router.register(
    r"skill-results", SkillResultViewSet, basename="project-skill-result"
)
project_router.register(r"feedback", UserFeedbackViewSet, basename="project-feedback")
project_router.register(
    r"ingestion-runs", IngestionRunViewSet, basename="project-ingestion-run"
)
project_router.register(
    r"source-configs", SourceConfigViewSet, basename="project-source-config"
)
project_router.register(
    r"topic-centroid-snapshots",
    TopicCentroidSnapshotViewSet,
    basename="project-topic-centroid-snapshot",
)
project_router.register(
    r"review-queue", ReviewQueueViewSet, basename="project-review-queue"
)

urlpatterns = [
    *router.urls,
    *project_router.urls,
]
