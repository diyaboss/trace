import { expect, test, type Page } from '@playwright/test';
import { drawer, resetFixtures, usingFixtures } from './helpers';

/**
 * Captures real rendered screens for visual review (not pixel assertions):
 *   npx playwright test visual
 * Screenshots land in test-results/screens/.
 */
test.skip(!usingFixtures, 'Visual capture uses the fixture dataset.');

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(1200); // let entrance animations settle
  return page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: false });
};

const LONG_TITLE =
  'Repeated authentication failures from an unrecognised network range against the finance reconciliation workstation during the month-end close window';

test.beforeEach(async ({ page }) => {
  await resetFixtures(page);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // stable frames
});

for (const size of [
  { name: 'desktop', width: 1280, height: 860 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`screens at ${size.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    // A long-titled, unattributed incident for layout stress.
    const created = await page.request.post('/api/incidents', {
      data: {
        title: LONG_TITLE,
        description: 'Long-title layout check.\n\nSecond paragraph to confirm line breaks are preserved.',
        severity: 'CRITICAL',
        status: 'OPEN',
        detected_at: new Date().toISOString(),
        resolved_at: null,
        employee_id: 4,
        threat_actor_id: null,
      },
    });
    const id = (await created.json()).data.incident_id;

    await page.goto('/');
    await expect(page.getByText(/unresolved incidents/)).toBeVisible();
    await shot(page, `${size.name}-overview`);

    await page.goto('/explore');
    await expect(page.getByRole('table')).toBeVisible();
    await shot(page, `${size.name}-explorer`);

    await page.goto(`/explore?incident=${id}`);
    await expect(drawer(page).getByRole('heading', { name: LONG_TITLE })).toBeVisible();
    await shot(page, `${size.name}-drawer-long-title`);

    await drawer(page).getByRole('button', { name: 'Edit' }).click();
    await expect(drawer(page).getByRole('button', { name: 'Save changes' })).toBeVisible();
    await shot(page, `${size.name}-drawer-edit`);

    await page.goto('/explore');
    await page.getByRole('banner').getByRole('button', { name: 'New incident' }).click();
    await drawer(page).getByRole('button', { name: 'Create incident' }).click();
    await expect(drawer(page).getByText('Enter a title.')).toBeVisible();
    await shot(page, `${size.name}-drawer-validation`);

    await page.goto('/explore?filter.severity.eq=CRITICAL&q=zzzz');
    await expect(page.getByRole('heading', { name: 'No incidents match these filters.' })).toBeVisible();
    await shot(page, `${size.name}-explorer-no-match`);

    await page.route('**/api/incidents?**', (route) => route.abort('connectionrefused'));
    await page.goto('/');
    await expect(page.getByText('Couldn’t load incidents.')).toBeVisible();
    await shot(page, `${size.name}-overview-error`);
    await page.unroute('**/api/incidents?**');

    await page.goto(`/explore?q=${encodeURIComponent(LONG_TITLE.slice(0, 40))}`);
    await page.getByRole('row', { name: /Repeated authentication/ }).hover();
    await page.getByRole('button', { name: `Delete INC-${id}` }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await shot(page, `${size.name}-delete-confirm`);
  });
}
