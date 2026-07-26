# Postgres and AWS RDS Data Layer

The API can run with two data stores:

- `DATA_STORE=json`: local JSON files under `apps/api/src/data`.
- `DATA_STORE=postgres`: PostgreSQL tables, suitable for Docker Postgres or AWS RDS.

If `DATABASE_URL` is set and `DATA_STORE` is not set, the API automatically uses Postgres.

## Tables

The schema is defined in:

```text
apps/api/src/db/schema.sql
```

It creates:

- `jobs`: tracked roles, SEEK URLs, status, notes, closing dates, skills, degree fit, and work-right hints.
- `candidate_profiles`: private candidate profile overrides stored as JSONB.
- `application_events`: status-change history for tracked jobs.

## Local Docker Postgres

PowerShell:

```powershell
$env:DATA_STORE="postgres"
$env:DATABASE_URL="postgres://app:app_password@postgres:5432/cloud_job_assistant"
docker compose --profile postgres up --build
```

Then open:

```text
http://localhost:8080
```

The API runs the schema automatically by default through `DATABASE_AUTO_MIGRATE=true`. It also seeds anonymous sample jobs into an empty database through `DATABASE_SEED_ON_EMPTY=true`.

## Manual Migration

When running the API outside Docker:

```bash
pnpm install
DATABASE_URL=postgres://app:app_password@localhost:5432/cloud_job_assistant pnpm db:migrate
DATA_STORE=postgres DATABASE_URL=postgres://app:app_password@localhost:5432/cloud_job_assistant pnpm dev
```

## AWS RDS Setup

For AWS:

1. Create an RDS PostgreSQL instance in private subnets.
2. Allow inbound traffic only from the ECS task security group.
3. Store `DATABASE_URL` in Secrets Manager or SSM Parameter Store.
4. Set ECS task environment variables:

```text
DATA_STORE=postgres
DATABASE_URL=<from Secrets Manager or SSM>
DATABASE_SSL=true
DATABASE_AUTO_MIGRATE=false
DATABASE_SEED_ON_EMPTY=false
```

5. Run `pnpm db:migrate` as a one-off deployment task before starting the API service.

Use automatic migration only for development. In production, keeping migrations explicit is easier to audit and safer for real application data.

## Privacy

The public seed profile remains anonymous in Git. With Postgres enabled, real profile edits are stored in `candidate_profiles`, not in committed JSON files.
