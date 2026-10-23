import { expect, type Page } from '@playwright/test';

export const usingFixtures = !process.env.TRACE_E2E_BASE_URL;

/** Restores seed data between tests (fixture mode only; real runs clean up their own records). */
export async function resetFixtures(page: Page) {
  if (!usingFixtures) return;
  const response = await page.request.post('/__fixtures/reset');
  expect(response.status()).toBe(204);
}

export const uniqueTitle = (label: string) => `E2E ${label} ${Date.now().toString(36)}`;

export const drawer = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('[data-drawer-heading]') });

/** Opens the create drawer from the header and fills the required fields. */
export async function fillNewIncident(page: Page, title: string, severity = 'High') {
  await page.getByRole('banner').getByRole('button', { name: 'New incident' }).click();
  const panel = drawer(page);
  await expect(panel.getByRole('heading', { name: 'New incident' })).toBeVisible();
  await panel.getByLabel('Title').fill(title);
  await panel.getByRole('radio', { name: severity }).check({ force: true });
  await chooseReporter(page, 'Aditi', 'Aditi Rao');
}

export async function chooseReporter(page: Page, query: string, name: string) {
  const picker = drawer(page).getByRole('combobox', { name: /Reported by/ });
  await picker.fill(query);
  await page.getByRole('option', { name: new RegExp(name) }).click();
  await expect(picker).toHaveValue(name);
}

/** Deletes an incident through the API (cleanup for real-backend runs). */
export async function deleteViaApi(page: Page, id: number) {
  await page.request.delete(`/api/incidents/${id}`);
}

export async function drawerIncidentId(page: Page): Promise<number> {
  await expect(page).toHaveURL(/incident=\d+/);
  return Number(new URL(page.url()).searchParams.get('incident'));
}
