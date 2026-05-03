import os

from celery import Celery

from newsletter_maker.telemetry import configure_telemetry

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "newsletter_maker.settings")

app = Celery("newsletter_maker")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
configure_telemetry(celery_app=app)


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
