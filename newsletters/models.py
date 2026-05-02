"""Newsletter-domain models split out from the historical core app."""

import secrets

import markdown  # type: ignore[import-untyped]
from django.db import models


def generate_confirmation_token() -> str:
    """Generate a one-time token for newsletter sender confirmation links."""

    return secrets.token_urlsafe(24)


class NewsletterIntakeStatus(models.TextChoices):
    """Lifecycle states for a raw inbound newsletter email."""

    PENDING = "pending", "Pending"
    EXTRACTED = "extracted", "Extracted"
    FAILED = "failed", "Failed"
    REJECTED = "rejected", "Rejected"


class NewsletterDraftStatus(models.TextChoices):
    """Workflow states for generated editor-facing newsletter drafts."""

    GENERATING = "generating", "Generating"
    READY = "ready", "Ready"
    EDITED = "edited", "Edited"
    PUBLISHED = "published", "Published"
    DISCARDED = "discarded", "Discarded"


class IntakeAllowlist(models.Model):
    """Tracks who is allowed to send newsletters into a project inbox."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="intake_allowlist"
    )
    sender_email = models.EmailField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmation_token = models.CharField(
        max_length=64, unique=True, default=generate_confirmation_token
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sender_email"]
        db_table = "core_intakeallowlist"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "sender_email"],
                name="core_allowlist_unique_project_sender",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sender_email} for {self.project.name}"

    @property
    def is_confirmed(self) -> bool:
        """Return whether the sender has confirmed newsletter intake access."""

        return self.confirmed_at is not None


class NewsletterIntake(models.Model):
    """Stores a raw inbound newsletter email before extraction."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="newsletter_intakes",
    )
    sender_email = models.EmailField()
    subject = models.CharField(max_length=512)
    received_at = models.DateTimeField(auto_now_add=True)
    raw_html = models.TextField(blank=True)
    raw_text = models.TextField(blank=True)
    message_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        max_length=16,
        choices=NewsletterIntakeStatus.choices,
        default=NewsletterIntakeStatus.PENDING,
    )
    extraction_result = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-received_at"]
        db_table = "core_newsletterintake"
        indexes = [
            models.Index(
                fields=["project", "sender_email", "status"],
                name="core_newsle_project_eee7a4_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.subject or self.message_id}"


class NewsletterDraft(models.Model):
    """Persist one generated newsletter draft and its editorial metadata."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="drafts",
    )
    title = models.CharField(max_length=255)
    intro = models.TextField(blank=True)
    outro = models.TextField(blank=True)
    target_publish_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=NewsletterDraftStatus.choices,
        default=NewsletterDraftStatus.GENERATING,
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    last_edited_at = models.DateTimeField(null=True, blank=True)
    generation_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-generated_at", "id"]
        db_table = "core_newsletterdraft"
        indexes = [
            models.Index(
                fields=["project", "-generated_at"],
                name="core_nldraft_projgen_idx",
            )
        ]

    def __str__(self) -> str:
        return self.title

    def render_markdown(self) -> str:
        """Render the current draft tree into editor-friendly Markdown."""

        sections = list(self.sections.all())
        original_pieces = list(self.original_pieces.all())
        lines = [f"# {self.title}"]
        if self.intro.strip():
            lines.extend(["", self.intro.strip()])
        for section in sections:
            lines.extend(["", f"## {section.title}"])
            if section.lede.strip():
                lines.extend(["", section.lede.strip()])
            for item in section.items.all():
                lines.extend(
                    [
                        "",
                        f"- [{item.content.title}]({item.content.url})",
                        f"  {item.summary_used.strip()}",
                        f"  Why it matters: {item.why_it_matters.strip()}",
                    ]
                )
        if original_pieces:
            lines.extend(["", "## Original Ideas"])
            for original_piece in original_pieces:
                lines.extend(
                    [
                        "",
                        f"### {original_piece.title}",
                        original_piece.pitch.strip(),
                        "",
                        "Suggested outline:",
                        original_piece.suggested_outline.strip(),
                    ]
                )
        if self.outro.strip():
            lines.extend(["", self.outro.strip()])
        return "\n".join(line.rstrip() for line in lines).strip()

    def render_html(self) -> str:
        """Render the current draft tree into paste-ready HTML."""

        return markdown.markdown(self.render_markdown(), extensions=["extra"])


class NewsletterDraftSection(models.Model):
    """Store one ordered draft section derived from an accepted theme."""

    draft = models.ForeignKey(
        NewsletterDraft,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    theme_suggestion = models.ForeignKey(
        "trends.ThemeSuggestion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="draft_sections",
    )
    title = models.CharField(max_length=255)
    lede = models.TextField(blank=True)
    order = models.IntegerField()

    class Meta:
        ordering = ["order", "id"]
        db_table = "core_newsletterdraftsection"
        indexes = [
            models.Index(
                fields=["draft", "order"],
                name="core_nldsec_draftord_idx",
            )
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def project(self):
        """Return the owning project for project-scoped permission checks."""

        return self.draft.project


class NewsletterDraftItem(models.Model):
    """Store one ordered newsletter item under a generated draft section."""

    section = models.ForeignKey(
        NewsletterDraftSection,
        on_delete=models.CASCADE,
        related_name="items",
    )
    content = models.ForeignKey(
        "content.Content",
        on_delete=models.PROTECT,
        related_name="newsletter_draft_items",
    )
    summary_used = models.TextField()
    why_it_matters = models.TextField()
    order = models.IntegerField()

    class Meta:
        ordering = ["order", "id"]
        db_table = "core_newsletterdraftitem"
        indexes = [
            models.Index(
                fields=["section", "order"],
                name="core_nlditem_secord_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.section.title}: {self.content.title}"

    @property
    def project(self):
        """Return the owning project for project-scoped permission checks."""

        return self.section.draft.project


class NewsletterDraftOriginalPiece(models.Model):
    """Store one accepted original-content idea in a generated draft."""

    draft = models.ForeignKey(
        NewsletterDraft,
        on_delete=models.CASCADE,
        related_name="original_pieces",
    )
    idea = models.ForeignKey(
        "trends.OriginalContentIdea",
        on_delete=models.PROTECT,
        related_name="newsletter_draft_original_pieces",
    )
    title = models.CharField(max_length=255)
    pitch = models.TextField()
    suggested_outline = models.TextField()
    order = models.IntegerField()

    class Meta:
        ordering = ["order", "id"]
        db_table = "core_newsletterdraftoriginalpiece"
        indexes = [
            models.Index(
                fields=["draft", "order"],
                name="core_nldorig_draftord_idx",
            )
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def project(self):
        """Return the owning project for project-scoped permission checks."""

        return self.draft.project
