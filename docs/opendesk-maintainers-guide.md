# openDesk Maintainers Guide

This guide defines the maintenance boundary for the Senticor fork. The goal is
to keep the upstream app easy to rebase while still preserving the openDesk
integration contract.

## 1. Ownership boundaries

Prefer to keep openDesk-specific work in these paths:

- `server/`
- `app/src/integration/`
- `app/public/favicon*`
- `app/public/logo192.png`
- `app/public/logo512.png`
- `deploy/`
- `scripts/`
- `docs/`

Treat the rest of `app/src/` as upstream territory unless an integration need
cannot be solved in the shell or runtime layer.

## 2. Non-negotiable contract

When `ORGANIGRAM_OPENDESK_ENABLED=false`, the image must still behave like a
plain standalone organigram app.

When `ORGANIGRAM_OPENDESK_ENABLED=true`, the image must provide:

- a same-origin runtime config via `runtime-config.js`
- a shell header with portal entrypoints
- server-side Central Navigation access
- a user context endpoint
- front-channel logout chaining
- the optional Nextcloud JSON bridge when the related environment variables are set

The concrete implementation lives in:

- [server.js](../server/server.js)
- [runtimeConfig.js](../app/src/integration/runtimeConfig.js)
- [opendeskApi.js](../app/src/integration/opendeskApi.js)
- [OpenDeskShell.js](../app/src/integration/OpenDeskShell.js)

## 3. Supported same-origin API surface

These endpoints are now part of the fork’s integration contract:

- `GET /api/opendesk/context`
- `GET /api/opendesk/navigation`
- `GET /api/opendesk/nextcloud/documents`
- `GET /api/opendesk/nextcloud/documents/:fileName`
- `PUT /api/opendesk/nextcloud/documents/:fileName`
- `GET /runtime-config.js`
- `GET /healthz`

If any of these change, update:

- [opendesk-integration.md](./opendesk-integration.md)
- [runtime-configuration.md](./runtime-configuration.md)
- the infra smoke and rollout helpers in the infrastructure repo

## 4. Upgrade rules

When syncing from upstream:

1. fetch and fast-forward or rebase from `upstream/main`
2. resolve conflicts by preserving the integration boundary above
3. avoid moving openDesk-specific logic into random upstream components
4. rerun the local production build
5. verify the runtime server contract still works

If an upstream UI change forces integration edits, prefer wrapping it in
`app/src/integration/` rather than carrying broad downstream diffs across the
main application.

## 5. Release checklist

For any change that touches the shell, identity flow, or storage bridge:

1. run `cd app && NODE_OPTIONS=--openssl-legacy-provider npm run build`
2. push to `main` and confirm the container workflow succeeds
3. roll the deployment or reapply the overlay
4. verify fresh-login behavior in a browser
5. verify app switcher, portal link, files link, and logout
6. verify Nextcloud save/open if the bridge was touched
7. hard-refresh once before judging favicon or shell asset regressions

## 6. Design policy

There is no documented reusable openDesk header component for third-party apps.
The supported integration path is:

- Central Navigation API
- portal branding assets
- Keycloak/OIDC session wiring

So the shell should stay visually aligned with openDesk, but it must remain a
small adapter owned by this fork, not an attempt to copy the entire mail UI.

## 7. What should stay infra-specific

Do not push these concerns into the public fork:

- tenant DNS values
- live Keycloak admin credentials
- portal UDM reconciliation against the real environment
- vault-backed secret sync
- tenant-specific host inventory

Those belong in the infrastructure repo that consumes this fork.
