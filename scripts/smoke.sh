#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-organigram.cognitive-hive.ai}"
URL="${URL:-https://${HOST}/}"
ENDPOINT_DIRECT_IP="${ENDPOINT_DIRECT_IP:-}"
EXPECTED_ISSUER="${EXPECTED_ISSUER:-https://id.cognitive-hive.ai/realms/opendesk}"
EXPECTED_AUTH_PREFIX="${EXPECTED_ISSUER}/protocol/openid-connect/auth"

head_cmd=(curl -fsSIL)

if [[ -n "${ENDPOINT_DIRECT_IP}" ]]; then
  head_cmd+=(--resolve "${HOST}:80:${ENDPOINT_DIRECT_IP}" --resolve "${HOST}:443:${ENDPOINT_DIRECT_IP}")
fi

printf '==> checking oauth2-proxy entry redirect for %s\n' "${URL}"
entry_headers="$("${head_cmd[@]}" "${URL}")"
entry_location="$(
  grep -i '^location:' <<<"${entry_headers}" | tail -n1 | cut -d' ' -f2- | tr -d '\r'
)"

if [[ -z "${entry_location}" ]]; then
  echo "FAIL: entrypoint did not return a redirect location" >&2
  exit 1
fi

if [[ "${entry_location}" == *"${EXPECTED_AUTH_PREFIX}"* ]]; then
  echo "PASS: organigram redirects unauthenticated users into openDesk SSO"
  exit 0
fi

if [[ "${entry_location}" != *"/oauth2/"* ]]; then
  echo "FAIL: entrypoint did not redirect into oauth2-proxy" >&2
  printf 'Observed location: %s\n' "${entry_location}" >&2
  exit 1
fi

if [[ "${entry_location}" == /* ]]; then
  oauth_start_url="https://${HOST}${entry_location}"
else
  oauth_start_url="${entry_location}"
fi

printf '==> checking Keycloak redirect for %s\n' "${oauth_start_url}"
oauth_headers="$("${head_cmd[@]}" "${oauth_start_url}")"
oauth_location="$(
  grep -i '^location:' <<<"${oauth_headers}" | tail -n1 | cut -d' ' -f2- | tr -d '\r'
)"

if [[ "${oauth_location}" != *"${EXPECTED_AUTH_PREFIX}"* ]]; then
  echo "FAIL: oauth2-proxy did not redirect to the expected Keycloak realm" >&2
  printf 'Observed location: %s\n' "${oauth_location}" >&2
  exit 1
fi

echo "PASS: organigram redirects unauthenticated users into openDesk SSO"
