import importlib
import os
import sys

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
    assert module.application == "asgi-app"


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
