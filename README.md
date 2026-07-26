# Cloud Job Matching and Application Assistant

A portfolio project that helps a graduate technology candidate find, score, track, and tailor applications for internship and graduate roles.

The project is intentionally built around a real job-search workflow:

- Track internship and graduate roles from SEEK URLs, SEEK searches, company pages, or manual links.
- Score each role against a candidate profile using skills, location, work rights, degree fit, and closing date.
- Generate targeted CV bullet suggestions and cover-letter drafts.
- Keep application status, notes, and next actions in one dashboard.
- Generate next-action reminders from closing dates, scores, work-right risk, and application status.
- Export tracked jobs, scores, statuses, closing dates, skill gaps, and links to CSV.
- Export job tracker reports to PDF and reminder deadlines to calendar `.ics`.
- Capture visible SEEK listings through a user-approved bookmarklet.
- Optionally protect the dashboard API with password-based admin authentication.
- Ship with Docker, GitHub Actions, and AWS deployment notes for S3, ECS/Lambda, RDS/Postgres, IAM, and CloudWatch.

## Current Status

This is an MVP, not a mature production product. See [docs/maturity-roadmap.md](docs/maturity-roadmap.md) for what is implemented and what is still missing.

The API can still run with the local JSON store for quick review. It now also includes a Postgres data layer for Docker Postgres or AWS RDS. The React/Vite client under `apps/web` implements the same six-page workflow as the no-download dashboard served by the API: Overview, Jobs, Import, Drafts, SEEK, and Profile.

The committed seed data is anonymous. It does not include a real candidate name, phone number, email address, real application history, or real imported job URLs.

## Private Local Data

The public repository keeps `apps/api/src/data/profile.json` and `apps/api/src/data/jobs.json` anonymous. Real local edits are saved separately to:

```text
apps/api/src/data/profile.local.json
apps/api/src/data/jobs.local.json
```

Both files are ignored by Git through `*.local.json`. The dashboard can therefore store profile changes, imported URLs, application status, and local job history without changing the public seed files.

When `DATA_STORE=postgres` is enabled, jobs and private profile edits are stored in PostgreSQL instead of local JSON files.

## SEEK Integration

This project treats SEEK as a first-class integration:

- Generate SEEK search URLs from keywords, location, and graduate/intern filters.
- Import a SEEK job URL into the tracker.
- Fetch structured job details through the official SEEK API adapter when partner credentials are configured.
- Parse user-pasted SEEK listing text locally into title, company, location, closing date, skills, degree fit, and work-right hints.
- Capture visible listing text with a user-approved bookmarklet.
- Store the external SEEK apply URL on each job.
- Open the original SEEK listing from the dashboard.
- Expose a `/api/integrations/seek/status` endpoint that reports link, bookmarklet, and official API mode.

Direct SEEK API access usually requires approved partner credentials. The open-source version therefore uses safe deep links, user-approved bookmarklet capture, and URL import by default, with `SEEK_API_BASE_URL` and `SEEK_API_KEY` enabling the official API adapter. It does not bypass SEEK access controls, scrape private candidate data, or auto-submit applications. See [docs/seek-capture.md](docs/seek-capture.md).

## Tech Stack

- Frontend: React, Vite, lucide-react
- Backend: Node.js HTTP API
- Data: JSON fallback store plus PostgreSQL/RDS adapter
- Infrastructure: Docker, GitHub Actions, AWS deployment guide

## Run Locally

```bash
pnpm install
pnpm dev
```

The no-download dashboard is then available at:

```text
http://localhost:8080
```

To work on the React client, keep the API running and start Vite in a second terminal:

```bash
pnpm --filter @cja/web dev
```

Open the React development client at:

```text
http://localhost:5173
```

Vite proxies `/api` requests to the API on port `8080`. If packages are not installed yet, the backend and its built-in dashboard can still run directly:

```bash
node apps/api/src/server.js
```

To test the same optimized React build used by Docker:

```bash
pnpm build
pnpm verify:web
pnpm start:production
```

## Run With Postgres

For a local Docker Postgres database:

```powershell
$env:DATA_STORE="postgres"
$env:DATABASE_URL="postgres://app:app_password@postgres:5432/cloud_job_assistant"
docker compose --profile postgres up --build
```

The app auto-creates the schema in development and seeds anonymous sample jobs into an empty database. For RDS, see [docs/postgres-rds.md](docs/postgres-rds.md).

## API Endpoints

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PUT /api/profile/local`
- `GET /api/jobs`
- `POST /api/jobs/import`
- `GET /api/jobs/:id/score`
- `GET /api/jobs/:id/draft`
- `PATCH /api/jobs/:id/status`
- `GET /api/export/jobs.csv`
- `GET /api/export/jobs.pdf`
- `GET /api/export/reminders.ics`
- `GET /api/reminders`
- `GET /api/integrations/seek/status`
- `GET /api/integrations/seek/search-url`
- `POST /api/integrations/seek/parse-text`
- `POST /api/integrations/seek/fetch-url`
- `POST /api/integrations/seek/import-url`
- `POST /api/capture/bookmarklet`

## Test

```bash
pnpm test
```

Or directly:

```bash
node apps/api/tests/run-tests.js
```

End-to-end browser tests are included for CI:

```bash
pnpm test:e2e
```

This command builds and verifies the production React client before opening the browser tests.

## Docker

```bash
docker build -t cloud-job-assistant .
docker run --rm -p 8080:8080 cloud-job-assistant
```

The Docker image builds the React client in a separate stage, copies only the optimized files into the runtime image, and serves them from the API process. Its health check uses `/api/health`.

## GitHub Publishing

See [docs/github-publish.md](docs/github-publish.md).

Before the first public commit, run:

```bash
node scripts/check-public-data.mjs
```

The repository includes privacy-aware issue templates, a pull-request checklist, Dependabot configuration, and CI checks for public seed data.

## Project Handover

See [PROJECT_HANDOVER.zh.md](PROJECT_HANDOVER.zh.md) for the Chinese deployment, implementation, architecture, and interview explanation guide.

## AWS Deployment

See [infra/aws/README.md](infra/aws/README.md).
See [docs/postgres-rds.md](docs/postgres-rds.md) for the database/RDS setup.

## Optional Admin Authentication

Set these variables to require login for private API routes:

```text
ADMIN_AUTH_ENABLED=true
ADMIN_PASSWORD=<strong password>
ADMIN_SESSION_SECRET=<long random secret>
```

Leave `ADMIN_AUTH_ENABLED=false` for local portfolio demo mode.

## Important Privacy Note

Before making the repository public, keep `apps/api/src/data/profile.json` anonymous. Put real private candidate data in local-only files or environment-backed storage, not in committed seed data.
