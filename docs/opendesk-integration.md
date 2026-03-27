# openDesk Integration

This fork keeps the upstream Berlin organigram application intact and adds the
infrastructure and runtime glue required to expose it as a companion tool in
an openDesk/Nubus environment:

- container image build
- Kubernetes manifests
- `oauth2-proxy` in front of the SPA
- Keycloak client bootstrap against the existing openDesk realm
- a small Node runtime that serves the frontend and same-origin integration APIs
- a feature-flagged openDesk shell mode in the frontend
- a portal tile pointing to the public host

For the maintenance contract of this fork, see
[opendesk-maintainers-guide.md](./opendesk-maintainers-guide.md).

## Architecture

The integration model is no longer just a plain tile link:

- the app runs in its own `organigram` namespace
- the frontend still stays close to upstream
- a runtime server adds openDesk-aware endpoints on the same origin
- openDesk Keycloak is used for access control
- users reach it through a normal Nubus portal entry
- the openDesk shell uses the documented Central Navigation API through the
  in-cluster portal server, not the older ICS/browser-side approximation
- JSON documents can be saved to and opened from the signed-in user’s
  Nextcloud account under a dedicated folder

This keeps the application reasonably upstream-friendly while still making it
behave like part of the openDesk experience.

## DNS

Create a dedicated public host for the tool, for example:

```text
organigram.cognitive-hive.ai
```

The DNS record should point to the same browser ingress endpoint that already
serves your openDesk web apps. In a typical setup that means the shared ingress
load balancer IP or hostname, not a separate application node IP.

For the current cognitive-hive deployment, the matching overlay assumes:

- public host: `organigram.cognitive-hive.ai`
- Keycloak issuer: `https://id.cognitive-hive.ai/realms/opendesk`
- ingress class: `haproxy`

## Build the image

Build the container from the fork itself:

```bash
PUSH=true ./scripts/build-image.sh
```

The default image target is:

```text
registry.onstackit.cloud/senticor/organigram:<git-sha>
```

Override `IMAGE_REPO`, `IMAGE_TAG`, or `PLATFORM` if needed.

## Bootstrap Keycloak

The bootstrap helper assumes a standard openDesk-in-cluster Keycloak layout:

- namespace: `opendesk`
- admin secret: `ums-keycloak-credentials`
- secret key: `adminPassword`
- pod: `ums-keycloak-0`

Run it like this:

```bash
PUBLIC_HOST=organigram.cognitive-hive.ai ./scripts/bootstrap-keycloak-client.sh
```

This creates or updates:

- Keycloak confidential client `organigram`
- Kubernetes secret `organigram/organigram-oauth2-proxy-secrets`

The bootstrap now configures the client for:

- front-channel logout back to `https://organigram.<host>/oauth2/sign_out`
- post-logout redirects to both the organigram host and the portal URL
- the default client scope `opendesk-nextcloud-scope` so bearer tokens include
  `opendesk_useruuid` for Nextcloud WebDAV access
- an extra audience mapper for `opendesk-nextcloud`, because Nextcloud bearer
  validation checks the token audience against its own OIDC client id

The example `oauth2-proxy` configuration in this repo also enables
`--insecure-oidc-allow-unverified-email=true`. That is intentional for openDesk
realms where users may receive an `email` claim without `email_verified=true`;
without it, the OAuth callback can fail with HTTP 500.

It also enables:

- `--code-challenge-method=S256`
- `--cookie-refresh=5m` so long-lived sessions refresh their access token
- `--whitelist-domain=.cognitive-hive.ai` in the concrete overlay so logout
  redirects can pass through Keycloak and back to the portal
- `--pass-access-token=true`
- `--pass-user-headers=true`

The access token passthrough is required for the server-side Nextcloud proxy.

For break-the-session auth changes, the bootstrap helper can also rotate the
companion app `oauth2-proxy` cookie secret with `ROTATE_COOKIE_SECRET=true` to
force a fresh login for that specific app.

## Bootstrap Central Navigation access

The documented Central Navigation API requires a shared secret from the portal
server. The helper copies it into the `organigram` namespace:

```bash
./scripts/bootstrap-opendesk-api-secrets.sh
```

This creates or updates:

- Kubernetes secret `organigram/organigram-opendesk-api-secrets`

with:

- `central-navigation-shared-secret`

## Apply the manifests

The cognitive-hive overlay is the concrete example for the current openDesk
installation:

```bash
export STACKIT_REGISTRY_USERNAME=...
export STACKIT_REGISTRY_PASSWORD=...
./scripts/apply-opendesk.sh
```

Manual apply is also fine:

```bash
export STACKIT_REGISTRY_USERNAME=...
export STACKIT_REGISTRY_PASSWORD=...
./scripts/bootstrap-registry-secret.sh
kubectl apply -k deploy/kustomize/overlays/cognitive-hive
```

The overlay enables the runtime shell mode with:

- `ORGANIGRAM_OPENDESK_ENABLED=true`
- `ORGANIGRAM_OPENDESK_PORTAL_URL=https://portal.cognitive-hive.ai/univention/portal/`
- `ORGANIGRAM_OPENDESK_KEYCLOAK_ISSUER_URL=https://id.cognitive-hive.ai/realms/opendesk`
- `ORGANIGRAM_OPENDESK_POST_LOGOUT_REDIRECT_URL=https://portal.cognitive-hive.ai/univention/portal/`
- `ORGANIGRAM_OPENDESK_PORTAL_SERVER_URL=http://ums-portal-server.opendesk.svc.cluster.local/portal`
- `ORGANIGRAM_OPENDESK_NEXTCLOUD_URL=https://drive.cognitive-hive.ai`
- `ORGANIGRAM_OPENDESK_NEXTCLOUD_API_URL=http://opendesk-nextcloud-aio.opendesk.svc.cluster.local`
- `ORGANIGRAM_OPENDESK_NEXTCLOUD_FOLDER=Organigramme`
- `ORGANIGRAM_OPENDESK_NEXTCLOUD_PRINCIPAL_CLAIM=opendesk_useruuid`

See also [runtime-configuration.md](./runtime-configuration.md).

## Verify

```bash
kubectl -n organigram rollout status deployment/organigram
kubectl -n organigram rollout status deployment/oauth2-proxy
./scripts/smoke.sh
```

## Portal and central navigation

This fork assumes the operator creates or reconciles two portal aspects:

- the visible portal tile
- the `centralNavigation` list on the portal object

The infra repo that consumes this fork automates both through UDM.

## Current limitations

- working state is still cached in the browser between edits
- JSON save/open is integrated with Nextcloud, but PDF/PNG/SVG/RDF still use browser downloads
- the reference deployment should split the public Nextcloud link from the server-side DAV endpoint
- the shell is integrated, but the app is not embedded into the Nubus portal frontend itself
- the Provisioning API is not used yet; it is a likely next step for directory-driven templates or org-sync features

## Maintenance

The fork now follows a stricter maintenance boundary:

- openDesk-specific work should stay in `server/`, `app/src/integration/`,
  `deploy/`, `scripts/`, and `docs/`
- standalone mode must keep working when `ORGANIGRAM_OPENDESK_ENABLED=false`
- changes to the runtime APIs or shell behavior should be reflected in
  [opendesk-maintainers-guide.md](./opendesk-maintainers-guide.md)
