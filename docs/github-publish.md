# Publish To GitHub

## Option A: GitHub Desktop

1. Open GitHub Desktop.
2. Choose `File > Add local repository`.
3. Select the `cloud-job-assistant` folder.
4. Review the files listed under Changes.
5. Commit all files with the message `Initial cloud job assistant project`.
6. Click `Publish repository`.
7. Keep the repo public if you want recruiters to view it.

## Option B: Command Line

The local repository is already initialized on the `main` branch. From this folder:

```bash
node scripts/check-public-data.mjs
git add .
git commit -m "Initial cloud job assistant project"
git remote add origin https://github.com/YOUR_USERNAME/cloud-job-assistant.git
git push -u origin main
```

Create the GitHub repository first at:

```text
https://github.com/new
```

Recommended settings:

- Repository name: `cloud-job-assistant`
- Visibility: public after confirming seed data is anonymous
- Add no README on GitHub, because this project already has one

## Before The First Commit

Enable `Keep my email addresses private` in GitHub email settings. Use the no-reply address shown by GitHub for the repository-local Git email:

```bash
git config user.name "YOUR_GITHUB_USERNAME"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

Run `pnpm install` once network access is available. This generates `pnpm-lock.yaml`; review and commit that file so CI and Docker use the same resolved dependency versions.

The previous incomplete Git metadata was backed up outside the repository. The active project now contains a clean Git repository on `main`.

## Recruiter-Ready Checklist

- Add a screenshot to the README.
- Commit `pnpm-lock.yaml` after installing dependencies.
- Confirm `node scripts/check-public-data.mjs` passes.
- Keep committed seed data anonymous; do not commit real names, emails, phone numbers, work-right details, real imported URLs, or application history.
- Confirm `profile.local.json` and `jobs.local.json` stay ignored before publishing.
- Add your GitHub Pages, AWS, or live deployment URL.
- Pin the repository on your GitHub profile.
- Add this project to your CV under `Projects`.
