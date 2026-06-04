__defaults__(
	{
		(python_test_utils, python_tests): {
			"dependencies": [
				"//:python",
				"//content",
				"//core",
				"//digest_engine",
				"//digest_engine/settings",
				"//entities",
				"//ingestion",
				"//messaging",
				"//newsletters",
				"//notifications",
				"//pipeline",
				"//projects",
				"//trends",
				"//users",
			],
		},
	}
)

python_requirements(
	name="python",
	source="pyproject.toml",
	module_mapping={
		"dj-database-url": ["dj_database_url"],
		"django-allauth": ["allauth"],
		"django-anymail": ["anymail"],
		"django-cors-headers": ["corsheaders"],
		"django-import-export": ["import_export"],
		"django-storages": ["storages"],
		"django-stubs-ext": ["django_stubs_ext"],
		"django-unfold": ["unfold"],
		"Mastodon.py": ["mastodon"],
		"pylint-django": ["pylint_django"],
		"pylint-plugin-utils": ["pylint_plugin_utils"],
		"PyJWT": ["jwt"],
		"psycopg": ["psycopg"],
		"psycopg-binary": ["psycopg"],
		"py-ubjson": ["ubjson"],
		"python-dotenv": ["dotenv"],
		"qdrant-client": ["qdrant_client"],
		"taskiq-aio-pika": ["taskiq_aio_pika"],
		"taskiq-redis": ["taskiq_redis"],
		"sentence-transformers": ["sentence_transformers"],
		"types-Deprecated": ["Deprecated"],
		"types-psycopg2": ["psycopg2"],
		"types-python-dateutil": ["dateutil"],
		"types-pyyaml": ["yaml"],
		"types-requests": ["requests"],
		"uuid-utils": ["uuid_utils"],
	},
	type_stubs_module_mapping={
		"django-stubs": ["django"],
	},
	overrides={
		"django-types": {"modules": ["django_types"]},
	},
)

python_sources(
    name="root",
)

python_test_utils(
    name="test_utils0",
)
