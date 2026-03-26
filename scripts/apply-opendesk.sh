#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OVERLAY="${OVERLAY:-${ROOT_DIR}/deploy/kustomize/overlays/cognitive-hive}"
NAMESPACE="${NAMESPACE:-organigram}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"

"${SCRIPT_DIR}/bootstrap-registry-secret.sh"
"${SCRIPT_DIR}/bootstrap-keycloak-client.sh"
"${SCRIPT_DIR}/bootstrap-opendesk-api-secrets.sh"
kubectl apply -k "${OVERLAY}" >/dev/null

kubectl -n "${NAMESPACE}" rollout status deployment/organigram --timeout="${ROLLOUT_TIMEOUT}"
kubectl -n "${NAMESPACE}" rollout status deployment/oauth2-proxy --timeout="${ROLLOUT_TIMEOUT}"
