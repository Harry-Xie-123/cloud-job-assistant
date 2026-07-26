# Project Maturity Roadmap

This repository is currently an MVP, not a mature production product.

## Implemented

- Anonymous candidate profile seed data.
- Anonymous SEEK-oriented sample jobs.
- Job scoring by skills, location, degree fit, work-right risk, and closing date.
- Job status tracking across saved, shortlisted, applied, and rejected states.
- Manual SEEK URL import.
- Official SEEK API adapter interface for approved partner credentials.
- Automatic SEEK URL retrieval through the official adapter when credentials are configured.
- Local parser for user-pasted SEEK listing text.
- User-approved SEEK bookmarklet capture flow.
- Private local profile and job storage separated from public seed data.
- Optional password-based admin authentication.
- SEEK search URL generation.
- External SEEK open buttons.
- CSV export for tracked jobs, scores, statuses, closing dates, skill gaps, and source links.
- Next-action reminders based on closing dates, score, status, and work-right risk.
- Calendar `.ics` export for reminders.
- PDF export for tracked jobs.
- PostgreSQL data layer with JSON fallback, schema migration, Docker Postgres support, and RDS configuration notes.
- Tailored CV bullet and cover-letter draft generation with copy actions.
- Six-page React/Vite client with responsive navigation and feature parity with the built-in dashboard.
- Multi-stage Docker production build that serves the optimized React client from the API.
- CI workflow that verifies the React artifacts, tests the production client, and builds the Docker image.
- Playwright E2E tests and AWS deployment templates.

## External Setup Still Required

- Supplying real SEEK partner credentials and confirming the exact partner API path/payload.
- Creating the AWS account resources and running the provided RDS/ECS templates.
- Supplying production secrets such as `DATABASE_URL`, `ADMIN_AUTH_ENABLED`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`.
- Publishing a public production URL and DNS name.

## SEEK Integration Reality

The open-source version cannot honestly claim full SEEK integration unless official SEEK partner/API access is available.

Allowed and implemented now:

- Open SEEK search pages.
- Store user-provided SEEK URLs.
- Open the original SEEK link.
- Fetch via the official API adapter when approved credentials are configured.
- Capture visible listing text through a user-approved bookmarklet.

Not implemented by design:

- Unauthorised scraping.
- Automated application submission.
- Uploading or submitting candidate personal data to SEEK.
- Bypassing login, anti-automation controls, or SEEK terms.

The implemented user-approved capture flow is:

1. User opens a SEEK job listing.
2. User copies the URL and key listing text into the app, or uses a browser bookmarklet.
3. The app parses the user-provided text locally.
4. The app scores the role and generates application drafts.
5. User reviews and applies manually on SEEK.

## Recommended Next Sprint

1. Run the AWS templates in a real AWS account.
2. Add a public HTTPS domain and production auth secret rotation.
3. Replace the configurable SEEK adapter path with the exact partner contract once credentials are approved.
