# Runtime Configuration

This fork can run in two modes from the same container image:

- default mode: plain standalone organigram application
- openDesk mode: adds an openDesk-flavored shell around the app

The mode is controlled at container startup through `runtime-config.js`, which
is rendered from environment variables by
[docker-entrypoint.sh](../docker-entrypoint.sh).

## Environment variables

All variables are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORGANIGRAM_OPENDESK_ENABLED` | `false` | Enables the openDesk shell |
| `ORGANIGRAM_OPENDESK_PORTAL_URL` | empty | Portal URL for the `Portal` action |
| `ORGANIGRAM_OPENDESK_ICS_URL` | empty | UCS Intercom Service base URL used for central navigation |
| `ORGANIGRAM_OPENDESK_KEYCLOAK_ISSUER_URL` | empty | Keycloak issuer URL used to build the logout chain |
| `ORGANIGRAM_OPENDESK_OIDC_CLIENT_ID` | `organigram` | OIDC client id for Keycloak logout |
| `ORGANIGRAM_OPENDESK_POST_LOGOUT_REDIRECT_URL` | empty | Final URL after logout |
| `ORGANIGRAM_OPENDESK_NAVIGATION_LANGUAGE` | `de-DE` | Requested locale for central navigation |
| `ORGANIGRAM_OPENDESK_SUITE_LABEL` | `openDesk` | Label shown in the shell header |

## What openDesk mode adds

- a fixed shell header with:
  - app switcher button
  - suite label
  - portal link
  - logout action
  - best-effort user email display
- a navigation drawer that tries to load application links through ICS
- a favicon and browser theme color aligned with the portal tile

## What openDesk mode does not solve yet

- persistent server-side document storage
- direct save/open against Nextcloud
- deep in-app embedding of the Nubus portal frontend

Those remain follow-up integration work and should be treated separately from
the shell mode.
