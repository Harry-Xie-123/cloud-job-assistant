# SEEK Capture and Official API Adapter

The project supports two SEEK data paths.

## Official API Adapter

When approved SEEK partner credentials are available, configure:

```text
SEEK_API_BASE_URL=https://api.partner.example
SEEK_API_KEY=<secret>
SEEK_API_KEY_HEADER=authorization
SEEK_API_JOB_PATH_TEMPLATE=/jobs/{id}
```

Then `POST /api/integrations/seek/fetch-url` can retrieve structured job data from a SEEK job URL, and `POST /api/integrations/seek/import-url` will use the official adapter when only a URL is supplied.

The adapter is intentionally configurable because real partner API paths and payloads can vary by agreement. The normalizer accepts common fields such as `title`, `company.name`, `advertiser.name`, `location`, `closingDate`, `skills`, `requiredSkills`, `workRights`, and `degreeDisciplines`.

## User-Approved Bookmarklet Capture

Without official API credentials, the dashboard exposes a `SEEK Capture` bookmarklet. The user opens a SEEK listing, runs the bookmarklet, and the visible page text is posted to the local app for parsing and import.

This is different from unattended scraping:

- The user is viewing the page directly.
- The action is initiated by the user.
- Data is sent to the user's local app.
- The app does not bypass logins, anti-automation controls, or SEEK application flows.

If dashboard authentication is enabled with `ADMIN_AUTH_ENABLED=true`, set `BOOKMARKLET_TOKEN` and install the bookmarklet from an authenticated dashboard session.
