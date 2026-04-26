# File Organization

In Django, you have one **project** (the container for your settings and main routing) and one or more **apps** (reusable modules that handle specific logic).

## File Breakdown: `newsletter_maker/` (The Project)

This is the "brain." It contains your global settings, main URL configuration, and WSGI/ASGI entry points for the server.

- **`settings.py`**: All configuration (Database URLs, installed apps, Celery broker settings).
- **`urls.py`**: The "main" URL file that imports the `api_urls.py` and `core.urls`.
- **`wsgi.py` / `asgi.py`**: The interface Gunicorn uses to run your app.
- **`celery.py`**: Where Celery is initialized for the project.

## File Breakdown: `core/` (The Application)

This is where the actual "features" live. Django encourages putting logic into apps so you could, in theory, pluck this `core` folder out and drop it into a different project. The `core` name is a popular label for the app that houses "base" functionality—like custom user models, global tasks, or shared logic—that doesn't fit neatly into a more specific feature name.

- **`models.py`**: The most important file. It defines your database schema using Python classes.
- **`serializers.py`**: Part of **DRF** (Django REST Framework). It converts your `models.py` data into JSON for the API.
- **`tasks.py`**: Contains your **Celery** background tasks (e.g., the actual code that sends the newsletter).
- **`api.py`**: This file DRF logic contains **ViewSets** or **Views**. It defines the behavior of the API—such as how it queries the database, applies permissions, and uses serializers to format data.
- **`api_urls.py`**: : This file contains the URL patterns specific to your API. It maps the incoming URL paths (like `/api/v1/newsletter/`) to the logic defined in `api.py`.
- **`admin.py`**: Configures how your models look in the built-in Django `/admin` interface.
- **`views.py` & `urls.py`**: Handle standard web requests and map them to templates.
- **`embeddings.py`**: Likely a custom file for your specific app (given the `qdrant` service you have), probably handling Vector Search or AI logic.
- **`migrations/`**: A history of your database changes.
- **`templates/` & `static/`**: Your HTML files and CSS/JS/images.
- **`management/`**: Contains custom terminal commands (e.g., `python manage.py my_custom_command`).
- **`tests.py`**: Where your automated tests live.

## Simplifying `api.py`

Your file is quite long because you are manually mapping 8 different ViewSets. If you want to keep the **Nested URL** structure (`/tenants/1/entities/`) but use a Router to save space, the most popular tool is a library called **`drf-nested-routers`**. This loses the benefit of seeing endpoints at a glance.

```python
# With drf-nested-routers (Simplified concept)
tenant_router = NestedSimpleRouter(router, r'tenants', lookup='tenant')
tenant_router.register(r'entities', EntityViewSet, basename='tenant-entities')
```

