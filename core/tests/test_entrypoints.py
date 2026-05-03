import importlib
import os
import sys

from channels.routing import ProtocolTypeRouter

from newsletter_maker.celery import app


def _import_fresh(module_name: str):
    sys.modules.pop(module_name, None)
    return importlib.import_module(module_name)


def test_asgi_module_sets_default_settings_and_builds_application(mocker):
    setdefault_mock = mocker.patch.object(os.environ, "setdefault")
    get_app_mock = mocker.patch(
        "django.core.asgi.get_asgi_application", return_value="asgi-app"
    )

    module = _import_fresh("newsletter_maker.asgi")

    setdefault_mock.assert_called_once_with(
        "DJANGO_SETTINGS_MODULE", "newsletter_maker.settings"
    )
    get_app_mock.assert_called_once_with()
    assert module.django_asgi_application == "asgi-app"
    assert isinstance(module.application, ProtocolTypeRouter)
    assert module.application.application_mapping["http"] == "asgi-app"
    assert "websocket" in module.application.application_mapping


def test_wsgi_module_sets_default_settings_and_builds_application(mocker):
    setdefault_mock = mocker.patch.object(os.environ, "setdefault")
    get_app_mock = mocker.patch(
        "django.core.wsgi.get_wsgi_application", return_value="wsgi-app"
    )

    module = _import_fresh("newsletter_maker.wsgi")

    setdefault_mock.assert_called_once_with(
        "DJANGO_SETTINGS_MODULE", "newsletter_maker.settings"
    )
    get_app_mock.assert_called_once_with()
    assert module.application == "wsgi-app"


def test_celery_app_redirects_worker_stdout_at_info_level():
    assert app.conf.worker_redirect_stdouts_level == "INFO"


def test_celery_app_schedules_source_quality_before_authority_recompute():
    beat_schedule = app.conf.beat_schedule

    assert (
        beat_schedule["run-all-source-quality-recomputations-nightly"]["task"]
        == "core.tasks.run_all_source_quality_recomputations"
    )
    assert (
        beat_schedule["run-all-scheduled-newsletter-drafts-every-minute"]["task"]
        == "core.tasks.run_all_scheduled_newsletter_drafts"
    )
    assert (
        beat_schedule["run-all-authority-recomputations-nightly"]["task"]
        == "core.tasks.run_all_authority_recomputations"
    )
