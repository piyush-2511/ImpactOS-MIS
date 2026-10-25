import { expect, test } from '@playwright/test';

/** Billing journeys. Need local Supabase, a signed-in Secretary (see access.spec.ts) and an issued invoice (run the invoice job). */
const enabled = process.env.E2E_SUPABASE === '1' && !!process.env.E2E_TOTP_CODE;
test.skip(!enabled, 'Requires local Supabase and a signed-in Secretary');

test('Secretary sees plan, usage and can report a UPI payment', async ({ page }) => {
  await page.goto('/admin/billing');
  await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
  await expect(page.getByText('Staff seats')).toBeVisible();
  const pay = page.getByRole('button', { name: 'Pay' }).first();
  test.skip(!(await pay.isVisible()), 'No open invoice yet');
  await pay.click();
  await expect(page.getByRole('img', { name: /UPI QR code/ })).toBeVisible();
  await page.getByLabel('UTR / transaction reference').fill(`E2E${Date.now()}`);
  await page.getByRole('button', { name: 'Report payment' }).click();
  await expect(page.getByText('Checking payment')).toBeVisible();
});

test('Secretary can give and end support access', async ({ page }) => {
  await page.goto('/admin/support-access');
  await page.getByLabel('What should they look at?').fill('E2E: checking imports');
  await page.getByRole('button', { name: 'Give access' }).click();
  await expect(page.getByText('Access on')).toBeVisible();
  await page.getByRole('button', { name: 'End access' }).click();
  await expect(page.getByRole('button', { name: 'Give access' })).toBeVisible();
});
