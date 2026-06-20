# octynhq/.github

Org-wide GitHub config for OCTYN.

## Reusable workflows

### `vercel-deploy.yml`

Deploys an `octynhq` project to Vercel via CLI (using a personal access token), bypassing Vercel Hobby's "no private org repos" restriction.

Consumer repos call it like this (drop into `.github/workflows/deploy.yml`):

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    uses: octynhq/.github/.github/workflows/vercel-deploy.yml@main
    secrets:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    with:
      production: ${{ github.event_name == 'push' }}
```

Required per-repo secrets (set via `Settings → Secrets and variables → Actions`):

- `VERCEL_TOKEN` — personal access token from https://vercel.com/account/tokens
- `VERCEL_ORG_ID` — the Vercel team's `id` (same value across all OCTYN projects)
- `VERCEL_PROJECT_ID` — unique per Vercel project

If/when org-level secrets become available (PAT with `admin:org` scope or browser-set), the per-repo `VERCEL_TOKEN` and `VERCEL_ORG_ID` can be removed and the workflow switched to `secrets: inherit`.

## One-click adoption for new repos

`workflow-templates/deploy-vercel.yml` shows up as a starter template in any octynhq repo's "New workflow" UI under the **Deployment** category, named **"Deploy to Vercel (OCTYN)"**.

## Why this exists

See `OCTYN-Brain/docs/plans/octynhq-vercel-deploy.md` for the full rationale.
