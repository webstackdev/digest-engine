from __future__ import annotations

from email.utils import parseaddr
from html import escape
from html.parser import HTMLParser
from typing import Any, Iterable, cast

from celery import current_app
from django.conf import settings as django_settings
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse

from core.models import IntakeAllowlist, NewsletterIntake, Project
from core.newsletter_extraction import extract_newsletter_items
from core.settings_types import CoreSettings

settings = cast(CoreSettings, django_settings)

__all__ = ["extract_newsletter_items"]


def normalize_sender_email(value: str) -> str:
    _, email_address = parseaddr(value)
    return email_address.strip().lower()


def sanitize_newsletter_html(raw_html: str) -> str:
    without_scripts = _strip_script_blocks(raw_html)
    parser = _InlineHandlerStrippingParser()
    parser.feed(without_scripts)
    parser.close()
    return parser.get_html()


def _strip_script_blocks(raw_html: str) -> str:
    sanitized_parts: list[str] = []
    index = 0
    raw_length = len(raw_html)
    while index < raw_length:
        script_start = _find_script_start(raw_html, index)
        if script_start == -1:
            sanitized_parts.append(raw_html[index:])
            break

        sanitized_parts.append(raw_html[index:script_start])
        opening_tag_end = _find_tag_end(raw_html, script_start + 1)
        if opening_tag_end == -1:
            break

        script_end = _find_script_end(raw_html, opening_tag_end + 1)
        if script_end == -1:
            break
        index = script_end

    return "".join(sanitized_parts)


def _find_script_start(raw_html: str, start_index: int) -> int:
    search_index = start_index
    while True:
        candidate = raw_html.lower().find("<script", search_index)
        if candidate == -1:
            return -1
        tag_name_end = candidate + len("<script")
        if tag_name_end >= len(raw_html) or raw_html[tag_name_end] in " \t\r\n\f/>":
            return candidate
        search_index = candidate + 1


def _find_script_end(raw_html: str, start_index: int) -> int:
    search_index = start_index
    lower_html = raw_html.lower()
    while True:
        candidate = lower_html.find("</script", search_index)
        if candidate == -1:
            return -1
        tag_name_end = candidate + len("</script")
        if tag_name_end < len(raw_html) and raw_html[tag_name_end] not in " \t\r\n\f>":
            search_index = candidate + 1
            continue
        closing_tag_end = _find_tag_end(raw_html, candidate + 1)
        if closing_tag_end == -1:
            return len(raw_html)
        return closing_tag_end + 1


def _find_tag_end(raw_html: str, start_index: int) -> int:
    quote_char: str | None = None
    for index in range(start_index, len(raw_html)):
        current_char = raw_html[index]
        if quote_char is not None:
            if current_char == quote_char:
                quote_char = None
            continue
        if current_char in {'"', "'"}:
            quote_char = current_char
            continue
        if current_char == ">":
            return index
    return -1


class _InlineHandlerStrippingParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self._parts: list[str] = []

    def get_html(self) -> str:
        return "".join(self._parts)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._parts.append(self._render_tag(tag, attrs))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        rendered = self._render_tag(tag, attrs)
        if rendered.endswith(">"):
            rendered = f"{rendered[:-1]} />"
        self._parts.append(rendered)

    def handle_endtag(self, tag: str) -> None:
        self._parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self._parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._parts.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self._parts.append(f"<!--{data}-->")

    def handle_decl(self, decl: str) -> None:
        self._parts.append(f"<!{decl}>")

    def unknown_decl(self, data: str) -> None:
        self._parts.append(f"<![{data}]>")

    @staticmethod
    def _render_tag(tag: str, attrs: list[tuple[str, str | None]]) -> str:
        rendered_attrs: list[str] = []
        for name, value in attrs:
            if name.lower().startswith("on"):
                continue
            if value is None:
                rendered_attrs.append(name)
                continue
            rendered_attrs.append(f'{name}="{escape(value, quote=True)}"')
        attr_suffix = f" {' '.join(rendered_attrs)}" if rendered_attrs else ""
        return f"<{tag}{attr_suffix}>"


def extract_project_token(recipient: str) -> str | None:
    _, email_address = parseaddr(recipient)
    local_part = email_address.partition("@")[0]
    prefix, separator, token = local_part.partition("+")
    if prefix != "intake" or separator != "+" or not token:
        return None
    return token


def send_confirmation_email(
    *, to_email: str, confirm_url: str, project_name: str
) -> None:
    subject = f"Confirm newsletter intake for {project_name}"
    text_body = (
        "Confirm this sender for newsletter ingestion.\n\n"
        f"Confirm sender: {confirm_url}"
    )
    html_body = (
        "<p>Confirm this sender for newsletter ingestion.</p>"
        f'<p><a href="{confirm_url}">Confirm sender</a></p>'
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send()


def build_confirmation_url(token: str) -> str:
    base_url = settings.NEWSLETTER_API_BASE_URL.rstrip("/")
    return f"{base_url}{reverse('confirm-newsletter-sender', kwargs={'token': token})}"


def process_inbound_newsletter(
    *,
    recipients: Iterable[str],
    sender_email: str,
    subject: str,
    raw_html: str,
    raw_text: str,
    message_id: str,
) -> dict[str, Any]:
    project = _find_intake_project(recipients)
    if project is None:
        return {"status": "ignored", "reason": "no_matching_project"}

    normalized_sender_email = normalize_sender_email(sender_email)
    normalized_message_id = message_id.strip()
    if not normalized_sender_email or not normalized_message_id:
        return {"status": "ignored", "reason": "missing_sender_or_message_id"}

    defaults = {
        "project": project,
        "sender_email": normalized_sender_email,
        "subject": subject[:512],
        "raw_html": sanitize_newsletter_html(raw_html),
        "raw_text": raw_text,
    }
    intake, created = NewsletterIntake.objects.get_or_create(
        message_id=normalized_message_id,
        defaults=defaults,
    )
    if not created:
        return {"id": intake.id, "status": intake.status, "duplicate": True}

    allowlist, allowlist_created = IntakeAllowlist.objects.get_or_create(
        project=project,
        sender_email=normalized_sender_email,
    )

    if allowlist.is_confirmed:
        queue_newsletter_intake(intake.id)
        return {"id": intake.id, "status": intake.status}

    if allowlist_created:
        send_confirmation_email(
            to_email=normalized_sender_email,
            confirm_url=build_confirmation_url(allowlist.confirmation_token),
            project_name=project.name,
        )

    return {"id": intake.id, "status": intake.status, "confirmation_required": True}


def queue_newsletter_intake(intake_id: int) -> None:
    process_newsletter_intake = current_app.tasks[
        "core.tasks.process_newsletter_intake"
    ]
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_newsletter_intake.apply(args=(intake_id,), throw=True)
    else:
        process_newsletter_intake.delay(intake_id)


def _find_intake_project(recipients: Iterable[str]) -> Project | None:
    for recipient in recipients:
        token = extract_project_token(recipient)
        if token is None:
            continue
        project = Project.objects.filter(
            intake_token=token, intake_enabled=True
        ).first()
        if project is not None:
            return project
    return None
