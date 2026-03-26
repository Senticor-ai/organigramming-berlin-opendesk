# Runtime Configuration

This fork can run in two modes from the same container image:

- default mode: plain standalone organigram application
- openDesk mode: adds an openDesk-flavored shell and same-origin backend APIs

The mode is controlled at container startup by the runtime server, which serves
`runtime-config.js` dynamically from environment variables.

## Environment variables

All variables are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORGANIGRAM_OPENDESK_ENABLED` | `false` | Enables the openDesk shell |
| `ORGANIGRAM_OPENDESK_PORTAL_URL` | empty | Portal URL for the `Portal` action |
| `ORGANIGRAM_OPENDESK_KEYCLOAK_ISSUER_URL` | empty | Keycloak issuer URL used to build the logout chain |
| `ORGANIGRAM_OPENDESK_OIDC_CLIENT_ID` | `organigram` | OIDC client id for Keycloak logout |
| `ORGANIGRAM_OPENDESK_POST_LOGOUT_REDIRECT_URL` | empty | Final URL after logout |
| `ORGANIGRAM_OPENDESK_NAVIGATION_LANGUAGE` | `de-DE` | Requested locale for central navigation |
| `ORGANIGRAM_OPENDESK_SUITE_LABEL` | `openDesk` | Label shown in the shell header |
| `ORGANIGRAM_OPENDESK_PORTAL_SERVER_URL` | `http://ums-portal-server.opendesk.svc.cluster.local/portal` | In-cluster Central Navigation API base URL |
| `ORGANIGRAM_OPENDESK_CENTRAL_NAVIGATION_SHARED_SECRET` | empty | Shared secret for the Central Navigation API |
| `ORGANIGRAM_OPENDESK_NEXTCLOUD_URL` | empty | Base URL of the openDesk Nextcloud deployment |
| `ORGANIGRAM_OPENDESK_NEXTCLOUD_FOLDER` | `Organigramme` | User folder for JSON save/open |
| `ORGANIGRAM_OPENDESK_NEXTCLOUD_PRINCIPAL_CLAIM` | `opendesk_useruuid` | OIDC claim used to build the Nextcloud WebDAV principal path |

## What openDesk mode adds

- a fixed shell header with:
  - app switcher button
  - suite label
  - portal link
  - Nextcloud shortcut
  - logout action
-  signed-in user identity
- a navigation drawer backed by the documented Central Navigation API
- same-origin APIs for:
  - shell context
  - Central Navigation lookup
  - Nextcloud JSON save/open
- a favicon and browser theme color aligned with the portal tile

In the openDesk reference setup, the server-side Nextcloud bridge uses the
`opendesk_useruuid` claim and the `opendesk-nextcloud-scope` client scope that
the Keycloak bootstrap attaches to the `organigram` client.

## What openDesk mode does not solve yet

- persistent application-owned server-side storage
- deep in-app embedding of the Nubus portal frontend

The Provisioning API is also not part of the current implementation. It is more
appropriate for future org-directory synchronization than for the shell,
navigation, or Nextcloud file flow.
