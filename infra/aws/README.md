# AWS Deployment Plan

This MVP can be deployed in two stages.

## Stage 1: Simple Portfolio Deployment

- Frontend: S3 static website hosting plus CloudFront.
- Backend: ECS Fargate service running the Node API container.
- Logs: CloudWatch log group for the ECS task.
- Secrets: AWS Systems Manager Parameter Store or Secrets Manager.
- SEEK: Store official SEEK API credentials in Parameter Store or Secrets Manager if approved partner access is available.

## Stage 2: Production-Like Graduate Project

- Database: RDS PostgreSQL for jobs, application events, and private profile overrides.
- Backend: ECS Fargate or Lambda behind API Gateway.
- Auth: Cognito or simple admin-only auth for a private dashboard.
- Observability: CloudWatch metrics, alarms, and structured logs.
- CI/CD: GitHub Actions builds the Docker image, pushes to ECR, and updates ECS.
- Integrations: Use SEEK deep links by default; enable official SEEK API mode only with approved credentials and documented terms.

## Suggested AWS Services To Mention On Your CV

- S3
- CloudFront
- ECS Fargate
- ECR
- RDS PostgreSQL
- IAM
- CloudWatch
- GitHub Actions

## Postgres/RDS Data Layer

The backend now supports PostgreSQL through `DATA_STORE=postgres` and `DATABASE_URL`. The schema lives in `apps/api/src/db/schema.sql`, and the setup guide lives in [../../docs/postgres-rds.md](../../docs/postgres-rds.md).

For production, store `DATABASE_URL` in Secrets Manager or SSM Parameter Store, set `DATABASE_SSL=true`, and run `pnpm db:migrate` as a one-off deployment task before the ECS service starts.

## Infrastructure Templates

- `rds-production.yml`: private RDS PostgreSQL instance with managed master password, security group ingress from the app service, backups, and deletion protection.
- `ecs-service-skeleton.yml`: ECS/Fargate API task and service configured for `DATA_STORE=postgres`, CloudWatch logs, and a Secrets Manager `DATABASE_URL`.
- `cloudformation-skeleton.yml`: earlier minimal portfolio scaffold for S3/logs/IAM.

These templates are intentionally parameterized so they can be deployed into an existing VPC. They do not create public inbound database access.
