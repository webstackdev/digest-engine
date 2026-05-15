#!/usr/bin/env sh
set -eu

echo "Bootstrapping Digest Engine development environment..."

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! command -v pants >/dev/null 2>&1; then
  echo "Installing Pants..."
  curl --proto '=https' --tlsv1.2 -fsSL https://static.pantsbuild.org/setup/get-pants.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.example frontend/.env.local
fi

uv python install 3.13
uv sync --frozen

corepack enable
corepack prepare pnpm@11.1.0 --activate
pnpm install --filter=@digestengine/frontend
pnpm install --filter=@digestengine/marketing

if git rev-parse --git-dir >/dev/null 2>&1; then
  .venv/bin/pre-commit install --install-hooks
fi

echo "Bootstrap complete. Next steps: just build && just dev"