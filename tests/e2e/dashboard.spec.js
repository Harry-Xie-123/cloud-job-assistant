import { expect, test } from "@playwright/test";

test("dashboard shows tracker, exports, reminders, and SEEK capture", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tracked Jobs", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText("SEEK Capture", { exact: true })).toBeVisible();
  await expect(page.locator(".priority-job").first()).toBeVisible();
});

test("SEEK listing text can be preview-parsed", async ({ page }) => {
  await page.goto("/#import");

  await page.getByLabel("SEEK job URL").fill("https://www.seek.com.au/job/12345678");
  await page.getByLabel("SEEK listing text").fill(`
Graduate Cloud Engineer
Company: Example Cloud Services
Location: Brisbane QLD
Applications close: 31/07/2026
AWS Docker Python SQL
This role accepts international students.
  `);
  await page.getByRole("button", { name: "Preview Parse" }).click();

  const preview = page.locator(".parse-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Graduate Cloud Engineer", { exact: true })).toBeVisible();
  await expect(preview.getByText("Example Cloud Services", { exact: true })).toBeVisible();
  await expect(preview.getByText("2026-07-31", { exact: true })).toBeVisible();
});

test("each main route shows one focused page", async ({ page }) => {
  const routes = [
    ["Overview", "Application Control Room"],
    ["Jobs", "Tracked Jobs"],
    ["Import", "Add A Job"],
    ["Drafts", "Application Drafts"],
    ["SEEK", "SEEK Connector"],
    ["Profile", "Candidate Profile"]
  ];

  await page.goto("/");
  for (const [linkName, headingName] of routes) {
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page.getByRole("heading", { name: headingName, exact: true })).toBeVisible();
    await expect(page.locator(".view-page:not([hidden])")).toHaveCount(1);
  }
});

test("job status can be changed and restored", async ({ page }) => {
  await page.goto("/#jobs");
  const job = page.locator(".job-row").filter({ hasText: "Cyber Security Graduate" });
  const status = job.getByRole("combobox", { name: "Status for Cyber Security Graduate" });

  await status.selectOption("shortlisted");
  await expect(page.getByText("Status updated to Shortlisted.")).toBeVisible();
  await expect(status).toHaveValue("shortlisted");

  await status.selectOption("saved");
  await expect(page.getByText("Status updated to Saved.")).toBeVisible();
  await expect(status).toHaveValue("saved");
});

test("draft generation exposes reusable copy actions", async ({ page }) => {
  await page.goto("/#draft");
  await page.getByRole("button", { name: "Generate Draft" }).click();

  await expect(page.getByRole("button", { name: "Copy bullets" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy letter" })).toBeVisible();
  await expect(page.getByText("Cover-letter draft", { exact: true })).toBeVisible();
});
