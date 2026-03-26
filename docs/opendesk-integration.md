# openDesk Integration

This fork keeps the upstream Berlin organigram application intact and adds the
minimum infrastructure required to expose it as a companion tool in an
openDesk/Nubus environment:

- container image build
- Kubernetes manifests
- `oauth2-proxy` in front of the SPA
- Keycloak client bootstrap against the existing openDesk realm
- a portal tile pointing to the public host

## Architecture

The integration model is intentionally shallow:

- the app runs in its own `organigram` namespace
- the app remains a static frontend with browser-local working state
- openDesk Keycloak is used only for access control
- users reach it through a normal Nubus portal entry

That means you get SSO-gated access without pretending the app already supports
deeper openDesk features such as shared storage, LDAP-backed data, or embedded
navigation.

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
ghcr.io/senticor-ai/organigramming-berlin-opendesk:<git-sha>
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

The example `oauth2-proxy` configuration in this repo also enables
`--insecure-oidc-allow-unverified-email=true`. That is intentional for openDesk
realms where users may receive an `email` claim without `email_verified=true`;
without it, the OAuth callback can fail with HTTP 500.

## Apply the manifests

The cognitive-hive overlay is the concrete example for the current openDesk
installation:

```bash
./scripts/apply-opendesk.sh
```

Manual apply is also fine:

```bash
kubectl apply -k deploy/kustomize/overlays/cognitive-hive
```

## Verify

```bash
kubectl -n organigram rollout status deployment/organigram
kubectl -n organigram rollout status deployment/oauth2-proxy
./scripts/smoke.sh
```

## Add the Nubus portal entry

In the Nubus portal editor add a tile that points to the companion host:

- title: `Organigramme`
- description: `Verwaltungsorganigramme erstellen und bearbeiten`
- URL: `https://organigram.cognitive-hive.ai/`

## Current limitations

- working state is still stored in the browser until users export files
- Nextcloud, xWiki, and other openDesk integrations are not part of this fork
- direct host access is SSO-gated, but the application itself stays stateless
