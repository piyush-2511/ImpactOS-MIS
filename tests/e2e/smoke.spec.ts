import { expect, test } from '@playwright/test';

test('marketing home renders in English and switches to Hindi', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Run your NGO');
  await page.getByRole('button', { name: /हि/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('अपने NGO');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});

test('pricing page lists three plans', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('₹5,999')).toBeVisible();
});

test('health check responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).status).toBe('ok');
});

test('unknown pages show the not-found page', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBe(404);
});
