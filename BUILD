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
		"dj-rest-auth": ["dj_rest_auth"],
		"django-allauth": ["allauth"],
		"django-anymail": ["anymail"],
		"django-cors-headers": ["corsheaders"],
		"django-import-export": ["import_export"],
		"django-storages": ["storages"],
		"django-stubs-ext": ["django_stubs_ext"],
		"django-unfold": ["unfold"],
		"djangochannelsrestframework": ["djangochannelsrestframework"],
		"djangorestframework": ["rest_framework"],
		"djangorestframework-simplejwt": ["rest_framework_simplejwt"],
		"drf-nested-routers": ["rest_framework_nested"],
		"drf-spectacular": ["drf_spectacular"],
		"drf-standardized-errors": ["drf_standardized_errors"],
		"Mastodon.py": ["mastodon"],
		"pylint-django": ["pylint_django"],
		"pylint-plugin-utils": ["pylint_plugin_utils"],
		"psycopg": ["psycopg"],
		"psycopg-binary": ["psycopg"],
		"py-ubjson": ["ubjson"],
		"python-dotenv": ["dotenv"],
		"qdrant-client": ["qdrant_client"],
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
