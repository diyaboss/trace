import { expect, test } from '@playwright/test';
import { deleteViaApi, drawer, drawerIncidentId, resetFixtures, uniqueTitle, usingFixtures } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetFixtures(page);
});

test('filters and search survive opening and closing a record', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Add filter' }).click();
  const builder = page.getByRole('dialog', { name: 'Add filter' });
  await builder.getByLabel('Field').selectOption('severity');
  await builder.getByLabel('Condition').selectOption('eq');
  await builder.getByLabel('Value').selectOption('CRITICAL');
  await builder.getByRole('button', { name: 'Apply filter' }).click();

  await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Severity is Critical');
  await expect(page).toHaveURL(/filter\.severity\.eq=CRITICAL/);
  const rows = page.getByRole('table').getByRole('row');
  for (const badge of await page.getByRole('table').locator('tbody tr td:nth-child(3)').allInnerTexts()) {
    expect(badge).toMatch(/critical/i); // labels are uppercased by CSS
  }

  // Open a record from the list; Back closes the drawer and keeps the filter.
  const firstLink = page.getByRole('table').locator('tbody a').first();
  await firstLink.click();
  await expect(drawer(page)).toBeVisible();
  await page.goBack();
  await expect(drawer(page)).toBeHidden();
  await expect(page).toHaveURL(/filter\.severity\.eq=CRITICAL/);
  await expect(page).not.toHaveURL(/incident=/);
  await expect(firstLink).toBeFocused();
  expect(await rows.count()).toBeGreaterThan(1);

  // Clear filters leaves search alone.
  await page.getByLabel('Search incident titles').fill('endpoint');
  await expect(page).toHaveURL(/q=endpoint/);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/filter\./);
  await expect(page).toHaveURL(/q=endpoint/);
});

test('no-match state is distinct and offers a reset', async ({ page }) => {
  await page.goto('/explore?q=zzzz-no-such-title');
  await expect(page.getByRole('heading', { name: 'No incidents match these filters.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters and search' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByLabel('Search incident titles')).toHaveValue('');
});

test('sorting uses the column header and server ordering', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Severity' }).click();
  await expect(page).toHaveURL(/sort=severity&order=desc/);
  await expect(page.getByRole('columnheader', { name: 'Severity' })).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('Critical');
});

test('row delete asks for confirmation and removes the row after success', async ({ page }) => {
  // Create a disposable incident through the API so this works on the real backend too.
  const title = uniqueTitle('row-delete');
  const created = await page.request.post('/api/incidents', {
    data: {
      title,
      description: null,
      severity: 'LOW',
      status: 'OPEN',
      detected_at: new Date().toISOString(),
      resolved_at: null,
      employee_id: 7,
      threat_actor_id: null,
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.incident_id as number;
  try {
    await page.goto(`/explore?q=${encodeURIComponent(title)}`);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await row.hover();
    await row.getByRole('button', { name: `Delete INC-${id}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete incident' }).click();
    await expect(page.getByRole('heading', { name: 'No incidents match these filters.' })).toBeVisible();
  } finally {
    await deleteViaApi(page, id);
  }
});

test('keyboard only: create an incident and return focus', async ({ page }) => {
  await page.goto('/explore');
  const newButton = page.getByRole('banner').getByRole('button', { name: 'New incident' });
  await newButton.focus();
  await page.keyboard.press('Enter');
  await expect(drawer(page).getByRole('heading', { name: 'New incident' })).toBeFocused();

  const title = uniqueTitle('keyboard');
  await page.keyboard.press('Tab'); // Title follows the heading
  await expect(drawer(page).getByLabel('Title')).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Tab'); // Severity group (first radio)
  await page.keyboard.press('ArrowRight'); // Medium
  await expect(drawer(page).getByRole('radio', { name: 'Medium' })).toBeChecked();
  await page.keyboard.press('Tab'); // Status group (checked radio: Open)
  await page.keyboard.press('Tab'); // Reporter
  await expect(drawer(page).getByRole('combobox', { name: /Reported by/ })).toBeFocused();
  await page.keyboard.type('Leena');
  await expect(page.getByRole('option', { name: /Leena Shah/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(drawer(page).getByRole('combobox', { name: /Reported by/ })).toHaveValue('Leena Shah');
  await page.keyboard.press('Control+Enter');

  await expect(drawer(page).getByRole('heading', { name: title })).toBeVisible();
  const id = await drawerIncidentId(page);
  try {
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
    await expect(newButton).toBeFocused();
  } finally {
    await deleteViaApi(page, id);
  }
});

test.describe('small screens', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the drawer becomes full screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Suspicious access to finance workstation/ }).click();
    const panel = drawer(page);
    await expect(panel).toBeVisible();
    await expect.poll(async () => (await panel.boundingBox())?.x).toBe(0);
    const box = await panel.boundingBox();
    expect(Math.round(box!.width)).toBe(375);
    // No horizontal page scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('drawer opens without movement and shimmer is disabled', async ({ page }) => {
    await page.route('**/api/incidents/101', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.fallback();
    });
    await page.goto('/?incident=101');
    const panel = drawer(page);
    await expect(panel).toBeVisible();
    // While the record loads, skeletons are static.
    const animation = await panel.locator('.skeleton').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
    // Motion is told to skip transforms: the drawer never sits offset.
    const transform = await panel.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});

test('overview lists unresolved incidents by severity and opens the drawer', async ({ page }) => {
  test.skip(!usingFixtures, 'Depends on the seeded incident set.');
  await page.goto('/');
  await expect(page.getByText(/^\d+ unresolved incidents\. Highest severity first\.$/)).toBeVisible();
  const links = page.getByRole('main').getByRole('list').getByRole('link');
  await expect(links).toHaveCount(5);
  await expect(links.first()).toContainText('Critical');
  await links.nth(1).click();
  await expect(drawer(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(links.nth(1)).toBeFocused();
  await page.getByRole('link', { name: 'View all unresolved' }).click();
  await expect(page).toHaveURL(/\/explore\?filter\.status\.ne=RESOLVED&sort=severity&order=desc/);
  await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Status is not Resolved');
});
