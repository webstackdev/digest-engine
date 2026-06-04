#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if [ -e node_modules/turbo/bin/turbo ]; then
  exit 0
fi

target=$(node <<'NODE'
const fs = require('fs');
const path = require('path');

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
if (!fs.existsSync(pnpmDir)) {
  process.exit(1);
}

const candidates = fs
  .readdirSync(pnpmDir)
  .filter((name) => /^turbo@\d/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

const match = candidates.at(-1);
if (!match) {
  process.exit(1);
}

process.stdout.write(path.join('.pnpm', match, 'node_modules', 'turbo'));
NODE
)

if [ -z "$target" ]; then
  echo "Unable to locate the installed turbo package. Run 'pnpm install --frozen-lockfile' from the repo root." >&2
  exit 1
fi

rm -rf node_modules/turbo
ln -s "$target" node_modules/turbo
