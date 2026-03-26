#!/usr/bin/env bash
# Bootstrap the openDesk Keycloak client and oauth2-proxy secret for organigram.
set -euo pipefail

NAMESPACE="${NAMESPACE:-organigram}"
KEYCLOAK_NAMESPACE="${KEYCLOAK_NAMESPACE:-opendesk}"
KEYCLOAK_SECRET_NAME="${KEYCLOAK_SECRET_NAME:-ums-keycloak-credentials}"
KEYCLOAK_SECRET_KEY="${KEYCLOAK_SECRET_KEY:-adminPassword}"
KEYCLOAK_POD_NAME="${KEYCLOAK_POD_NAME:-ums-keycloak-0}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-opendesk}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-kcadmin}"
PUBLIC_HOST="${PUBLIC_HOST:-organigram.cognitive-hive.ai}"
CLIENT_ID="${CLIENT_ID:-organigram}"
SECRET_NAME="${SECRET_NAME:-organigram-oauth2-proxy-secrets}"
KEYCLOAK_ISSUER_URL="${KEYCLOAK_ISSUER_URL:-https://id.cognitive-hive.ai/realms/${KEYCLOAK_REALM}}"
REDIRECT_URI="${REDIRECT_URI:-https://${PUBLIC_HOST}/oauth2/callback}"
POST_LOGOUT_REDIRECT_URI="${POST_LOGOUT_REDIRECT_URI:-https://${PUBLIC_HOST}/}"
PORTAL_POST_LOGOUT_REDIRECT_URI="${PORTAL_POST_LOGOUT_REDIRECT_URI:-https://portal.cognitive-hive.ai/univention/portal/}"
WEB_ORIGIN="${WEB_ORIGIN:-https://${PUBLIC_HOST}}"
FRONTCHANNEL_LOGOUT_URL="${FRONTCHANNEL_LOGOUT_URL:-https://${PUBLIC_HOST}/oauth2/sign_out}"

for required_bin in kubectl openssl base64; do
  if ! command -v "${required_bin}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${required_bin}" >&2
    exit 1
  fi
done

kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}" >/dev/null

if ! kubectl -n "${KEYCLOAK_NAMESPACE}" get pod "${KEYCLOAK_POD_NAME}" >/dev/null 2>&1; then
  KEYCLOAK_POD_NAME="$(
    kubectl -n "${KEYCLOAK_NAMESPACE}" get pod \
      -l app.kubernetes.io/name=keycloak \
      -o jsonpath='{.items[0].metadata.name}'
  )"
fi

if [[ -z "${KEYCLOAK_POD_NAME}" ]]; then
  printf 'Unable to locate a Keycloak pod in namespace %s\n' "${KEYCLOAK_NAMESPACE}" >&2
  exit 1
fi

KC_ADMIN_PASSWORD="$(
  kubectl -n "${KEYCLOAK_NAMESPACE}" get secret "${KEYCLOAK_SECRET_NAME}" \
    -o "jsonpath={.data.${KEYCLOAK_SECRET_KEY}}" | base64 --decode
)"

COOKIE_SECRET="$(
  kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
    -o jsonpath='{.data.cookie-secret}' 2>/dev/null | base64 --decode || true
)"

if [[ -z "${COOKIE_SECRET}" ]]; then
  COOKIE_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
fi

CLIENT_SECRET="$(
  kubectl -n "${KEYCLOAK_NAMESPACE}" exec "${KEYCLOAK_POD_NAME}" -- env \
    KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD}" \
    KC_ADMIN_USER="${KEYCLOAK_ADMIN_USER}" \
    KEYCLOAK_REALM="${KEYCLOAK_REALM}" \
    CLIENT_ID="${CLIENT_ID}" \
    REDIRECT_URI="${REDIRECT_URI}" \
    POST_LOGOUT_REDIRECT_URI="${POST_LOGOUT_REDIRECT_URI}" \
    PORTAL_POST_LOGOUT_REDIRECT_URI="${PORTAL_POST_LOGOUT_REDIRECT_URI}" \
    WEB_ORIGIN="${WEB_ORIGIN}" \
    FRONTCHANNEL_LOGOUT_URL="${FRONTCHANNEL_LOGOUT_URL}" \
    bash -lc '
      set -euo pipefail
      KC=/opt/keycloak/bin/kcadm.sh

      "${KC}" config credentials \
        --server http://127.0.0.1:8080 \
        --realm master \
        --user "${KC_ADMIN_USER}" \
        --password "${KC_ADMIN_PASSWORD}" >/dev/null

      client_uuid="$(
        "${KC}" get clients -r "${KEYCLOAK_REALM}" -q clientId="${CLIENT_ID}" \
          --fields id --format csv --noquotes | tail -n1
      )"

      cat > /tmp/organigram-client.json <<EOF
      {
        "clientId": "${CLIENT_ID}",
        "name": "${CLIENT_ID}",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": false,
        "standardFlowEnabled": true,
        "implicitFlowEnabled": false,
        "directAccessGrantsEnabled": false,
        "serviceAccountsEnabled": false,
        "frontchannelLogout": true,
        "redirectUris": ["${REDIRECT_URI}"],
        "webOrigins": ["${WEB_ORIGIN}"],
        "attributes": {
          "frontchannel.logout.url": "${FRONTCHANNEL_LOGOUT_URL}",
          "frontchannel.logout.session.required": "false",
          "post.logout.redirect.uris": "${POST_LOGOUT_REDIRECT_URI}##${PORTAL_POST_LOGOUT_REDIRECT_URI}"
        }
      }
EOF

      if [[ -z "${client_uuid}" ]]; then
        "${KC}" create clients -r "${KEYCLOAK_REALM}" -f /tmp/organigram-client.json >/dev/null

        client_uuid="$(
          "${KC}" get clients -r "${KEYCLOAK_REALM}" -q clientId="${CLIENT_ID}" \
            --fields id --format csv --noquotes | tail -n1
        )"
      else
        "${KC}" update "clients/${client_uuid}" -r "${KEYCLOAK_REALM}" -f /tmp/organigram-client.json >/dev/null
      fi

      mapper_name="audience-${CLIENT_ID}"
      if ! "${KC}" get "clients/${client_uuid}/protocol-mappers/models" -r "${KEYCLOAK_REALM}" \
        --fields name | grep -Fq "\"${mapper_name}\""; then
        "${KC}" create "clients/${client_uuid}/protocol-mappers/models" -r "${KEYCLOAK_REALM}" \
          -s name="${mapper_name}" \
          -s protocol=openid-connect \
          -s protocolMapper=oidc-audience-mapper \
          -s '"'"'config."included.client.audience"='"'"'"${CLIENT_ID}" \
          -s '"'"'config."id.token.claim"=true'"'"' \
          -s '"'"'config."access.token.claim"=true'"'"' >/dev/null
      fi

      "${KC}" get "clients/${client_uuid}/client-secret" -r "${KEYCLOAK_REALM}" \
        --fields value | sed -n '"'"'s/.*"value" *: *"\([^"]*\)".*/\1/p'"'"' | head -n1
    '
)"

kubectl create secret generic "${SECRET_NAME}" \
  --namespace "${NAMESPACE}" \
  --from-literal=client-id="${CLIENT_ID}" \
  --from-literal=client-secret="${CLIENT_SECRET}" \
  --from-literal=cookie-secret="${COOKIE_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

printf 'Reconciled %s/%s for client %s via %s\n' \
  "${NAMESPACE}" \
  "${SECRET_NAME}" \
  "${CLIENT_ID}" \
  "${KEYCLOAK_ISSUER_URL}"
