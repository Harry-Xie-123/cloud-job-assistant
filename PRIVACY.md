# Privacy Policy For Seed Data

This repository is designed to be public.

Committed seed data must not include:

- Real candidate names
- Phone numbers
- Email addresses
- Visa or work-right details
- Real application history
- Private notes about employers or recruiters
- Imported URLs that reveal a user's personal browsing or application history

Use anonymous sample employers and dummy SEEK job IDs in committed data. Store real local job tracking data outside Git, or in a future database that is not committed to the repository.

Private local profile data belongs in:

```text
apps/api/src/data/profile.local.json
```

Imported jobs, application status, notes, and real listing URLs belong in:

```text
apps/api/src/data/jobs.local.json
```

Both files are excluded by `.gitignore` and should not be included in public release packages. The JSON store reads anonymous records from `jobs.json` until local changes are made, then writes only to `jobs.local.json`.
