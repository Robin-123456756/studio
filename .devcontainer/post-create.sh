#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/studio

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
