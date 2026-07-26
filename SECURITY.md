# Security Notes

This project is designed as a public portfolio project. Keep committed seed data anonymous.

## Secrets

Do not commit:

- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `SEEK_API_KEY`
- AWS credentials
- Real candidate details or application history

Use `.env` locally and AWS Secrets Manager or SSM Parameter Store in production.
The local JSON mode writes candidate changes to ignored `*.local.json` files so imported job URLs and status history are not added to the public seed data.

## Authentication

Authentication is disabled by default for local demo mode.

Enable it only when hosting a private deployment:

```text
ADMIN_AUTH_ENABLED=true
ADMIN_PASSWORD=<strong password>
ADMIN_SESSION_SECRET=<long random secret>
```

## SEEK

The open-source version does not bypass SEEK access controls, auto-submit applications, or scrape private candidate data. Official API mode requires approved partner credentials.
