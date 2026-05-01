"""Embedding generation and Qdrant vector-store helpers.

The rest of the application treats this module as the integration boundary for
vector search. It normalizes provider differences, creates per-project Qdrant
collections, and stores the payload fields later used by relevance scoring and
related-content search.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Any, cast
from uuid import uuid4

import httpx
from django.conf import settings as django_settings
from django.db.models import Model
from django.utils.dateparse import parse_datetime
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from content.models import Content
from core.settings_types import CoreSettings
from entities.models import Entity

SentenceTransformer = None
settings = cast(CoreSettings, django_settings)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed Qdrant payload construction."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def get_sentence_transformer_class():
    """Lazily import and cache the sentence-transformer class.

    Returns:
        The ``SentenceTransformer`` class from the optional dependency.
    """

    global SentenceTransformer

    if SentenceTransformer is None:
        from sentence_transformers import (
            SentenceTransformer as sentence_transformer_class,
        )

        SentenceTransformer = sentence_transformer_class

    return SentenceTransformer


class EmbeddingProvider(ABC):
    """Abstract interface implemented by all embedding backends."""

    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        """Embed normalized text into a dense vector."""

        raise NotImplementedError

    def get_embedding_dimension(self) -> int:
        """Infer the output vector size for the provider.

        Returns:
            The number of dimensions produced by ``embed_text``.
        """

        return len(self.embed_text("dimension probe"))


class SentenceTransformerEmbeddingProvider(EmbeddingProvider):
    """Embedding provider backed by ``sentence-transformers`` models."""

    def __init__(self):
        sentence_transformer_class = get_sentence_transformer_class()
        self.model = sentence_transformer_class(
            settings.EMBEDDING_MODEL,
            trust_remote_code=settings.EMBEDDING_TRUST_REMOTE_CODE,
        )

    def embed_text(self, text: str) -> list[float]:
        """Encode text with normalized sentence-transformer embeddings."""

        return self.model.encode(text, normalize_embeddings=True).tolist()

    def get_embedding_dimension(self) -> int:
        """Return the model's native embedding dimension without probing text."""

        dimension = self.model.get_sentence_embedding_dimension()
        if dimension is None:
            raise RuntimeError("Embedding model did not report a vector dimension.")
        return int(dimension)


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Embedding provider backed by an Ollama server."""

    def embed_text(self, text: str) -> list[float]:
        """Request embeddings from the Ollama HTTP API."""

        normalized_text = normalize_text(text)
        response = httpx.post(
            f"{settings.OLLAMA_URL.rstrip('/')}/api/embed",
            json={"model": settings.EMBEDDING_MODEL, "input": [normalized_text]},
            timeout=30.0,
        )
        if response.status_code == 404:
            legacy_response = httpx.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/embeddings",
                json={"model": settings.EMBEDDING_MODEL, "prompt": normalized_text},
                timeout=30.0,
            )
            legacy_response.raise_for_status()
            return legacy_response.json()["embedding"]
        response.raise_for_status()
        return response.json()["embeddings"][0]


class OpenRouterEmbeddingProvider(EmbeddingProvider):
    """Embedding provider backed by OpenRouter's embeddings endpoint."""

    def embed_text(self, text: str) -> list[float]:
        """Request embeddings from OpenRouter using the configured model.

        Raises:
            RuntimeError: If the OpenRouter API key is not configured.
        """

        if not settings.OPENROUTER_API_KEY:
            raise RuntimeError(
                "OPENROUTER_API_KEY must be set when using the openrouter embedding provider."
            )
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }
        if settings.OPENROUTER_APP_URL:
            headers["HTTP-Referer"] = settings.OPENROUTER_APP_URL
        if settings.OPENROUTER_APP_NAME:
            headers["X-OpenRouter-Title"] = settings.OPENROUTER_APP_NAME
        response = httpx.post(
            f"{settings.OPENROUTER_API_BASE.rstrip('/')}/embeddings",
            headers=headers,
            json={
                "model": settings.EMBEDDING_MODEL,
                "input": normalize_text(text),
                "encoding_format": "float",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]


def collection_name_for_project(project_id: int) -> str:
    """Return the Qdrant collection name for a project."""

    return f"project_{project_id}_content"


def entity_collection_name_for_project(project_id: int) -> str:
    """Return the Qdrant collection name for a project's tracked entities."""

    return f"project_{project_id}_entities"


def centroid_collection_name_for_project(project_id: int) -> str:
    """Return the Qdrant collection name for a project's feedback centroid."""

    return f"project_{project_id}_centroid"


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    """Create and cache the shared Qdrant client instance."""

    return QdrantClient(url=settings.QDRANT_URL, timeout=10, check_compatibility=False)


@lru_cache(maxsize=1)
def get_embedding_provider() -> EmbeddingProvider:
    """Resolve the configured embedding provider implementation.

    Returns:
        The provider instance selected by ``EMBEDDING_PROVIDER``.

    Raises:
        ValueError: If the configured provider name is unsupported.
    """

    provider_name = settings.EMBEDDING_PROVIDER
    if provider_name == "sentence-transformers":
        return SentenceTransformerEmbeddingProvider()
    if provider_name == "ollama":
        return OllamaEmbeddingProvider()
    if provider_name == "openrouter":
        return OpenRouterEmbeddingProvider()
    raise ValueError(f"Unsupported embedding provider: {provider_name}")


def get_embedding_dimension() -> int:
    """Return the current embedding model's output dimension."""

    return get_embedding_provider().get_embedding_dimension()


def embed_text(text: str) -> list[float]:
    """Normalize and embed arbitrary text with the active provider."""

    return get_embedding_provider().embed_text(normalize_text(text))


def upsert_content_embedding(content: Content) -> str:
    """Write or update a content embedding in the project's Qdrant collection.

    Args:
        content: The content row whose embedding should be stored.

    Returns:
        The Qdrant point identifier associated with the content row.
    """

    client = get_qdrant_client()
    project_id = _require_pk(content.project)
    content_id = _require_pk(content)
    ensure_project_collection(project_id)
    embedding_id = content.embedding_id or str(uuid4())
    vector = embed_text(build_content_embedding_text(content))
    client.upsert(
        collection_name=collection_name_for_project(project_id),
        points=[
            PointStruct(
                id=embedding_id,
                vector=vector,
                payload={
                    "content_id": content_id,
                    "project_id": project_id,
                    "url": content.url,
                    "title": content.title,
                    "published_date": serialize_published_date(content.published_date),
                    "source_plugin": content.source_plugin,
                    "is_reference": content.is_reference,
                },
            )
        ],
        wait=True,
    )
    if content.embedding_id != embedding_id:
        content.embedding_id = embedding_id
        content.save(update_fields=["embedding_id"])
    return embedding_id


def upsert_entity_embedding(entity: Entity) -> str:
    """Write or update an entity embedding in the project's entity collection."""

    client = get_qdrant_client()
    project_id = _require_pk(entity.project)
    entity_id = _require_pk(entity)
    ensure_project_entity_collection(project_id)
    vector = embed_text(build_entity_embedding_text(entity))
    embedding_id = f"entity-{entity_id}"
    client.upsert(
        collection_name=entity_collection_name_for_project(project_id),
        points=[
            PointStruct(
                id=embedding_id,
                vector=vector,
                payload={
                    "entity_id": entity_id,
                    "project_id": project_id,
                    "name": entity.name,
                    "type": entity.type,
                },
            )
        ],
        wait=True,
    )
    return embedding_id


def sync_project_entity_embeddings(project_id: int) -> None:
    """Ensure all tracked entities for a project are present in Qdrant."""

    entities = Entity.objects.filter(project_id=project_id).only(
        "id",
        "project_id",
        "name",
        "type",
        "description",
        "website_url",
        "github_url",
        "linkedin_url",
        "bluesky_handle",
        "mastodon_handle",
        "twitter_handle",
    )
    if not entities.exists():
        return
    ensure_project_entity_collection(project_id)
    for entity in entities:
        upsert_entity_embedding(entity)


def search_similar(
    project_id: int,
    query_vector: list[float],
    limit: int = 10,
    *,
    is_reference: bool | None = None,
    exclude_content_id: int | None = None,
):
    """Search a project's Qdrant collection for nearest-neighbor matches.

    Args:
        project_id: Project whose collection should be queried.
        query_vector: Embedded query vector to compare against stored points.
        limit: Maximum number of results to return.
        is_reference: Optional filter limiting matches to reference or non-reference
            content.
        exclude_content_id: Optional content ID to exclude from the result set.

    Returns:
        A list of scored Qdrant points. Returns an empty list when the collection
        does not exist yet.
    """

    if not project_collection_exists(project_id):
        return []
    query_filter = build_search_filter(
        is_reference=is_reference, exclude_content_id=exclude_content_id
    )
    client = cast(Any, get_qdrant_client())
    return client.search(
        collection_name=collection_name_for_project(project_id),
        query_vector=query_vector,
        limit=limit,
        query_filter=query_filter,
        with_payload=True,
    )


def search_similar_content(
    content: Content, limit: int = 10, *, is_reference: bool | None = None
):
    """Find content similar to an existing content row within the same project."""

    return search_similar(
        _require_pk(content.project),
        embed_text(build_content_embedding_text(content)),
        limit=limit,
        is_reference=is_reference,
        exclude_content_id=_require_pk(content),
    )


def search_similar_entities(
    project_id: int, query_vector: list[float], limit: int = 10
):
    """Search the tracked-entity collection for nearest matches."""

    if not project_entity_collection_exists(project_id):
        return []
    client = cast(Any, get_qdrant_client())
    return client.search(
        collection_name=entity_collection_name_for_project(project_id),
        query_vector=query_vector,
        limit=limit,
        with_payload=True,
    )


def search_similar_entities_for_content(content: Content, limit: int = 8):
    """Find tracked entities whose embeddings are close to a content item."""

    project_id = _require_pk(content.project)
    sync_project_entity_embeddings(project_id)
    return search_similar_entities(
        project_id,
        embed_text(build_content_embedding_text(content)),
        limit=limit,
    )


def get_reference_similarity(
    project_id: int, vector: list[float], limit: int = 5
) -> float:
    """Average the top reference-item similarity scores for a vector.

    Args:
        project_id: Project whose reference corpus should be searched.
        vector: Embedded representation of the candidate content.
        limit: Number of reference matches to average.

    Returns:
        The mean cosine similarity of the top matching reference items, or ``0.0``
        when the project has no reference corpus.
    """

    scored_points = search_similar(project_id, vector, limit=limit, is_reference=True)
    if not scored_points:
        return 0.0
    return sum(point.score for point in scored_points) / len(scored_points)


def get_topic_centroid_similarity(project_id: int, vector: list[float]) -> float:
    """Return similarity against the project's stored feedback centroid."""

    if not project_centroid_collection_exists(project_id):
        return 0.0
    client = cast(Any, get_qdrant_client())
    scored_points = client.search(
        collection_name=centroid_collection_name_for_project(project_id),
        query_vector=vector,
        limit=1,
        with_payload=True,
    )
    if not scored_points:
        return 0.0
    return float(scored_points[0].score)


def ensure_project_collection(project_id: int) -> None:
    """Create the per-project Qdrant collection when it does not yet exist."""

    client = get_qdrant_client()
    collection_name = collection_name_for_project(project_id)
    if project_collection_exists(project_id):
        return
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=get_embedding_dimension(), distance=Distance.COSINE
        ),
    )


def ensure_project_entity_collection(project_id: int) -> None:
    """Create the per-project entity collection when it does not yet exist."""

    client = get_qdrant_client()
    collection_name = entity_collection_name_for_project(project_id)
    if project_entity_collection_exists(project_id):
        return
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=get_embedding_dimension(), distance=Distance.COSINE
        ),
    )


def ensure_project_centroid_collection(project_id: int) -> None:
    """Create the per-project centroid collection when it does not yet exist."""

    client = get_qdrant_client()
    collection_name = centroid_collection_name_for_project(project_id)
    if project_centroid_collection_exists(project_id):
        return
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=get_embedding_dimension(), distance=Distance.COSINE
        ),
    )


def project_collection_exists(project_id: int) -> bool:
    """Return whether the project's Qdrant collection already exists."""

    try:
        get_qdrant_client().get_collection(collection_name_for_project(project_id))
    except Exception:
        return False
    return True


def project_entity_collection_exists(project_id: int) -> bool:
    """Return whether the project's entity collection already exists."""

    try:
        get_qdrant_client().get_collection(
            entity_collection_name_for_project(project_id)
        )
    except Exception:
        return False
    return True


def project_centroid_collection_exists(project_id: int) -> bool:
    """Return whether the project's centroid collection already exists."""

    try:
        get_qdrant_client().get_collection(
            centroid_collection_name_for_project(project_id)
        )
    except Exception:
        return False
    return True


def upsert_topic_centroid(
    project_id: int,
    vector: list[float],
    *,
    upvote_count: int,
    downvote_count: int,
    feedback_count: int,
) -> None:
    """Write or update the project's single feedback-centroid vector."""

    client = get_qdrant_client()
    ensure_project_centroid_collection(project_id)
    client.upsert(
        collection_name=centroid_collection_name_for_project(project_id),
        points=[
            PointStruct(
                id="topic-centroid",
                vector=vector,
                payload={
                    "project_id": project_id,
                    "upvote_count": upvote_count,
                    "downvote_count": downvote_count,
                    "feedback_count": feedback_count,
                },
            )
        ],
        wait=True,
    )


def delete_topic_centroid(project_id: int) -> None:
    """Remove the stored centroid point for a project when it is no longer usable."""

    if not project_centroid_collection_exists(project_id):
        return
    get_qdrant_client().delete(
        collection_name=centroid_collection_name_for_project(project_id),
        points_selector=["topic-centroid"],
        wait=True,
    )


def build_content_embedding_text(content: Content) -> str:
    """Build the text blob used to generate content embeddings."""

    return "\n\n".join(part for part in [content.title, content.content_text] if part)


def build_entity_embedding_text(entity: Entity) -> str:
    """Build the text blob used to generate entity embeddings."""

    aliases = [
        entity.bluesky_handle,
        entity.mastodon_handle,
        entity.twitter_handle,
        entity.website_url,
        entity.github_url,
        entity.linkedin_url,
    ]
    return "\n\n".join(
        part
        for part in [entity.name, entity.type, entity.description, *aliases]
        if part
    )


def normalize_text(text: str) -> str:
    """Trim input text and replace empty input with a stable placeholder."""

    normalized_text = text.strip()
    if not normalized_text:
        return "empty content"
    return normalized_text


def serialize_published_date(value) -> str:
    """Convert supported published-date values into a string payload for Qdrant."""

    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, str):
        parsed_value = parse_datetime(value)
        if parsed_value is not None:
            return parsed_value.isoformat()
        return value
    return str(value)


def build_search_filter(
    *, is_reference: bool | None = None, exclude_content_id: int | None = None
) -> Filter | None:
    """Build a Qdrant filter for reference scoping and self-exclusion."""

    conditions = []
    if is_reference is not None:
        conditions.append(
            FieldCondition(key="is_reference", match=MatchValue(value=is_reference))
        )
    if exclude_content_id is not None:
        conditions.append(
            FieldCondition(key="content_id", match=MatchValue(value=exclude_content_id))
        )
    if not conditions:
        return None
    must_conditions = conditions if exclude_content_id is None else conditions[:-1]
    must_not_conditions = conditions[-1:] if exclude_content_id is not None else None
    return Filter(
        must=cast(Any, must_conditions),
        must_not=cast(Any, must_not_conditions),
    )
