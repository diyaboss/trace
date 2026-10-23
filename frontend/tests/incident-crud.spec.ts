import { expect, test } from '@playwright/test';
import { chooseReporter, deleteViaApi, drawer, drawerIncidentId, fillNewIncident, resetFixtures, uniqueTitle } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetFixtures(page);
});

test('create → view → reload → edit → cancel delete → delete', async ({ page }) => {
  const title = uniqueTitle('lifecycle');
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore Data' })).toBeVisible();

  // Create
  await fillNewIncident(page, title, 'High');
  await drawer(page).getByLabel('Description').fill('Created by the Playwright lifecycle test.');
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();

  // The same drawer shows the saved record, with its server-generated ID.
  const panel = drawer(page);
  await expect(panel.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/Incident INC-\d+ created\./);
  const id = await drawerIncidentId(page);
  await expect(panel.getByText(`INC-${id}`)).toBeVisible();
  await expect(panel.getByText('Aditi Rao')).toBeVisible();
  await expect(panel.getByText('Not attributed')).toBeVisible();

  try {
    // Reload: the record is still there (directly opened URL).
    await page.reload();
    await expect(drawer(page).getByRole('heading', { name: title })).toBeVisible();

    // Edit title and status → RESOLVED reveals and defaults the resolution time.
    await drawer(page).getByRole('button', { name: 'Edit' }).click();
    const edited = `${title} (edited)`;
    await drawer(page).getByLabel('Title').fill(edited);
    await drawer(page).getByRole('radio', { name: 'Resolved' }).check({ force: true });
    await expect(drawer(page).getByLabel(/^Resolved at/)).not.toHaveValue('');
    await drawer(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(drawer(page).getByRole('heading', { name: edited })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Incident updated.');
    await expect(drawer(page).getByText('Resolved', { exact: true }).first()).toBeVisible();
    await expect(drawer(page).getByText('Time to resolve')).toBeVisible();

    // Cancel deletion: the record remains.
    await drawer(page).getByRole('button', { name: 'Delete incident' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Delete “${edited}”?`);
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(drawer(page).getByRole('heading', { name: edited })).toBeVisible();
    expect((await page.request.get(`/api/incidents/${id}`)).status()).toBe(200);

    // Confirm deletion: removed only after the server answers 204.
    await drawer(page).getByRole('button', { name: 'Delete incident' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete incident' }).click();
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole('status')).toContainText(`Incident INC-${id} deleted.`);
    expect((await page.request.get(`/api/incidents/${id}`)).status()).toBe(404);
    await expect(page.getByRole('link', { name: edited })).toHaveCount(0);
  } finally {
    await deleteViaApi(page, id);
  }
});

test('client validation shows field errors and focuses the first invalid field', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('banner').getByRole('button', { name: 'New incident' }).click();
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();

  await expect(drawer(page).getByRole('alert')).toContainText('Please correct the highlighted fields.');
  await expect(drawer(page).getByText('Enter a title.')).toBeVisible();
  await expect(drawer(page).getByText('Choose a severity.')).toBeVisible();
  await expect(drawer(page).getByText('Choose the employee who reported this incident.')).toBeVisible();
  const titleInput = drawer(page).getByLabel('Title');
  await expect(titleInput).toBeFocused();
  await expect(titleInput).toHaveAttribute('aria-invalid', 'true');

  // Invalid (empty) timestamp and a resolution before detection.
  await drawer(page).getByLabel(/^Detected at/).fill('');
  await titleInput.fill('Timestamp check');
  await drawer(page).getByRole('radio', { name: 'Low' }).check({ force: true });
  await chooseReporter(page, 'Maya', 'Maya Sen');
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();
  await expect(drawer(page).getByText('Enter a complete detection date and time.')).toBeVisible();

  await drawer(page).getByLabel(/^Detected at/).fill('2026-10-08T10:00');
  await drawer(page).getByRole('radio', { name: 'Resolved' }).check({ force: true });
  await drawer(page).getByLabel(/^Resolved at/).fill('2026-10-08T09:00');
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();
  await expect(drawer(page).getByText('Resolution time cannot be earlier than detection time.')).toBeVisible();
});

test('server field errors (422) are shown on their fields', async ({ page }) => {
  await page.route('**/api/incidents', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please correct the highlighted fields.',
          field_errors: { employee_id: 'Choose an existing reporting employee.' },
          details: {},
        },
      }),
    });
  });
  await page.goto('/explore');
  await fillNewIncident(page, uniqueTitle('server-422'));
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();
  await expect(drawer(page).getByText('Choose an existing reporting employee.')).toBeVisible();
  await expect(drawer(page).getByRole('combobox', { name: /Reported by/ })).toBeFocused();
});

test('search handles an apostrophe as literal text', async ({ page }) => {
  await page.goto('/explore');
  await page.getByLabel('Search incident titles').fill("Employee's");
  await expect(page).toHaveURL(/q=Employee%27s/);
  await expect(page.getByRole('link', { name: "Employee's workstation reported 100% CPU" })).toBeVisible();
  await expect(page.getByText('1 matching record')).toBeVisible();
});

test('a lost connection keeps form input and does not claim failure', async ({ page }) => {
  const title = uniqueTitle('offline');
  await page.goto('/explore');
  await fillNewIncident(page, title);
  await page.route('**/api/incidents', (route) =>
    route.request().method() === 'POST' ? route.abort('connectionreset') : route.fallback(),
  );
  await drawer(page).getByRole('button', { name: 'Create incident' }).click();
  await expect(drawer(page).getByRole('alert')).toContainText('Refresh and check the record before trying again');
  await expect(drawer(page).getByLabel('Title')).toHaveValue(title);
  await expect(drawer(page).getByRole('button', { name: 'Create incident' })).toBeEnabled();
});

test('a backend failure shows a retryable error, never fake data', async ({ page }) => {
  let fail = true;
  await page.route('**/api/incidents?**', (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable. Check the connection and try again.', field_errors: {}, details: {} },
          }),
        })
      : route.fallback(),
  );
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Couldn’t load incidents.' })).toBeVisible();
  await expect(page.getByText('The database is unavailable.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('unsaved changes prompt on Escape and on browser Back', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('link', { name: 'Unexpected outbound traffic' }).click();
  await drawer(page).getByRole('button', { name: 'Edit' }).click();
  await drawer(page).getByLabel('Title').fill('Changed but not saved');

  await page.keyboard.press('Escape');
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('Discard unsaved changes?');
  await prompt.getByRole('button', { name: 'Keep editing' }).click();
  await expect(drawer(page).getByLabel('Title')).toHaveValue('Changed but not saved');

  await page.goBack();
  await expect(page.getByRole('alertdialog')).toContainText('Discard unsaved changes?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(page).not.toHaveURL(/incident=/);
});
