#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/senticor-ai/organigramming-berlin-opendesk}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo dev)}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-false}"

if ! docker buildx inspect >/dev/null 2>&1; then
  docker buildx create --use >/dev/null
fi

cmd=(
  docker buildx build
  --platform "${PLATFORM}"
  --file "${ROOT_DIR}/Dockerfile"
  --tag "${IMAGE_REPO}:${IMAGE_TAG}"
  "${ROOT_DIR}"
)

if [[ "${PUSH}" == "true" ]]; then
  cmd+=(--push)
else
  cmd+=(--load)
fi

"${cmd[@]}"

printf 'Built %s:%s\n' "${IMAGE_REPO}" "${IMAGE_TAG}"

