# Upstream Sync

This repository is intended to be published as a Senticor-maintained fork of:

```text
https://github.com/technologiestiftung/organigramming-berlin
```

The deployment additions live outside the upstream app source so that upstream
merges stay mechanical.

## Recommended remote layout

After creating the new GitHub repository under `senticor-ai`, rewire the remotes
like this:

```bash
git remote rename origin upstream
git remote add origin git@github.com:senticor-ai/organigramming-berlin-opendesk.git
git fetch --all
```

## Updating from upstream

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

Resolve conflicts only if upstream changes overlap with:

- `Dockerfile`
- `nginx.conf`
- `.github/workflows/`
- `deploy/`
- `scripts/`
- `docs/`

The `app/` directory should otherwise remain close to upstream.

