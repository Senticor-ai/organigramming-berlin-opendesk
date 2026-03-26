#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-organigram}"
REGISTRY_SECRET_NAME="${REGISTRY_SECRET_NAME:-stackit-registry}"
REGISTRY_HOST="${REGISTRY_HOST:-registry.onstackit.cloud}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-${STACKIT_REGISTRY_USERNAME:-}}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-${STACKIT_REGISTRY_PASSWORD:-}}"
DOCKER_CONFIG_FILE="${DOCKER_CONFIG_FILE:-${HOME}/.docker/config.json}"

kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}" >/dev/null

if kubectl -n "${NAMESPACE}" get secret "${REGISTRY_SECRET_NAME}" >/dev/null 2>&1; then
  printf 'Registry pull secret %s/%s already exists\n' \
    "${NAMESPACE}" \
    "${REGISTRY_SECRET_NAME}"
  exit 0
fi

if [[ -n "${REGISTRY_USERNAME}" && -n "${REGISTRY_PASSWORD}" ]]; then
  kubectl create secret docker-registry "${REGISTRY_SECRET_NAME}" \
    --namespace "${NAMESPACE}" \
    --docker-server="${REGISTRY_HOST}" \
    --docker-username="${REGISTRY_USERNAME}" \
    --docker-password="${REGISTRY_PASSWORD}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  printf 'Reconciled %s/%s from environment credentials for %s\n' \
    "${NAMESPACE}" \
    "${REGISTRY_SECRET_NAME}" \
    "${REGISTRY_HOST}"
  exit 0
fi

if command -v jq >/dev/null 2>&1 && [[ -f "${DOCKER_CONFIG_FILE}" ]]; then
  if jq -e --arg host "${REGISTRY_HOST}" '.auths[$host].auth? | length > 0' \
    "${DOCKER_CONFIG_FILE}" >/dev/null 2>&1; then
    kubectl create secret generic "${REGISTRY_SECRET_NAME}" \
      --namespace "${NAMESPACE}" \
      --type=kubernetes.io/dockerconfigjson \
      --from-file=.dockerconfigjson="${DOCKER_CONFIG_FILE}" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    printf 'Reconciled %s/%s from %s\n' \
      "${NAMESPACE}" \
      "${REGISTRY_SECRET_NAME}" \
      "${DOCKER_CONFIG_FILE}"
    exit 0
  fi
fi

printf '%s\n' \
  "Missing registry credentials. Set REGISTRY_USERNAME/REGISTRY_PASSWORD or STACKIT_REGISTRY_USERNAME/STACKIT_REGISTRY_PASSWORD, or populate ${DOCKER_CONFIG_FILE} with auth for ${REGISTRY_HOST}." >&2
exit 1
