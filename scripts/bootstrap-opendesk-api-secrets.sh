#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-organigram}"
PORTAL_NAMESPACE="${PORTAL_NAMESPACE:-opendesk}"
SOURCE_SECRET_NAME="${SOURCE_SECRET_NAME:-ums-portal-server-central-navigation}"
TARGET_SECRET_NAME="${TARGET_SECRET_NAME:-organigram-opendesk-api-secrets}"

for required_bin in base64 kubectl; do
  if ! command -v "${required_bin}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${required_bin}" >&2
    exit 1
  fi
done

kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}" >/dev/null

SHARED_SECRET="$(
  kubectl -n "${PORTAL_NAMESPACE}" get secret "${SOURCE_SECRET_NAME}" \
    -o jsonpath='{.data.shared_secret}' | base64 --decode
)"

kubectl create secret generic "${TARGET_SECRET_NAME}" \
  --namespace "${NAMESPACE}" \
  --from-literal=central-navigation-shared-secret="${SHARED_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

printf 'Reconciled %s/%s from %s/%s\n' \
  "${NAMESPACE}" \
  "${TARGET_SECRET_NAME}" \
  "${PORTAL_NAMESPACE}" \
  "${SOURCE_SECRET_NAME}"
