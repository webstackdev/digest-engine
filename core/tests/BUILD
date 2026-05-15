python_sources()

python_tests(
    name="tests0",
    overrides={
        "test_bootstrap_live_sources.py": {
            "dependencies": ["//core/management/commands:commands"],
        },
        "test_embeddings.py": {
            "dependencies": ["//core/management/commands:commands"],
        },
    },
)
