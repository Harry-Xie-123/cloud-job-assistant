# Contributing

Thanks for helping improve Cloud Job Assistant.

## Development

Requirements:

- Node.js 20 or newer
- pnpm 11
- Docker Desktop only when testing PostgreSQL or the production image

Install and validate:

```bash
pnpm install
pnpm check:public
pnpm test
pnpm build
pnpm verify:web
pnpm test:e2e
```

## Pull Requests

- Keep changes focused and explain the user-visible result.
- Add or update tests when behavior changes.
- Keep the committed profile and job data anonymous.
- Do not add real candidate details, application history, private notes, credentials, or direct imported job URLs.
- Do not add unauthorized scraping or automatic application submission.
- Confirm the production React build and API tests pass before requesting review.

## Local Data

Real profile edits and imported jobs belong in ignored files:

```text
apps/api/src/data/profile.local.json
apps/api/src/data/jobs.local.json
```

Use `.env` for local secrets. Commit only `.env.example` with empty values.
