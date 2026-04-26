from dotenv import load_dotenv


load_dotenv(".env.test", override=True)


def pytest_configure():
    """Load test-specific environment variables before Django settings initialize."""
    load_dotenv(".env.test", override=True)
