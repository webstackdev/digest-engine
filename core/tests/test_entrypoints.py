import importlib
import os
import sys
from urllib.parse import urlparse

from channels.routing import ProtocolTypeRouter

from digest_engine.settings import RABBITMQ_URL, TASKIQ_RESULT_BACKEND_URL
from digest_engine.taskiq import broker, result_backend, scheduler


def _import_fresh(module_name: str):
    sys.modules.pop(module_name, None)
    return importlib.import_module(module_name)


def test_asgi_module_sets_default_settings_and_builds_application(mocker):
    setdefault_mock = mocker.patch.object(os.environ, "setdefault")
    get_app_mock = mocker.patch(
        "django.core.asgi.get_asgi_application", return_value="asgi-app"
    )

    module = _import_fresh("digest_engine.asgi")

    setdefault_mock.assert_called_once_with(
        "DJANGO_SETTINGS_MODULE", "digest_engine.settings"
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

    module = _import_fresh("digest_engine.wsgi")

    setdefault_mock.assert_called_once_with(
        "DJANGO_SETTINGS_MODULE", "digest_engine.settings"
    )
    get_app_mock.assert_called_once_with()
    assert module.application == "wsgi-app"


def test_taskiq_bootstrap_uses_rabbitmq_and_label_schedule_source():
    parsed_result_backend_url = urlparse(TASKIQ_RESULT_BACKEND_URL)

    assert broker.url == RABBITMQ_URL
    assert (
        result_backend.redis_pool.connection_kwargs["host"]
        == parsed_result_backend_url.hostname
    )
    assert (
        result_backend.redis_pool.connection_kwargs["port"]
        == parsed_result_backend_url.port
    )
    assert result_backend.redis_pool.connection_kwargs["db"] == int(
        parsed_result_backend_url.path.removeprefix("/") or "0"
    )
    assert scheduler.broker is broker
    assert len(scheduler.sources) == 1
    assert scheduler.sources[0].__class__.__name__ == "LabelScheduleSource"
