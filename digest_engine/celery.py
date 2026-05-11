import os

from celery import Celery

from digest_engine.telemetry import configure_telemetry

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "digest_engine.settings")

app = Celery("digest_engine")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
configure_telemetry(celery_app=app)


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
