FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:/root/.local/bin:${PATH}"

ARG UV_VERSION=0.8.17

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends build-essential curl libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install uv==${UV_VERSION}

COPY .python-version pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY . .

RUN chmod +x docker/web/entrypoint.sh

ENTRYPOINT ["/bin/sh", "./docker/web/entrypoint.sh"]
