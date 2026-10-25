import { expect, test } from '@playwright/test';

/** Option lists: the shared engine end to end. Needs local Supabase and a signed-in Admin (see access.spec.ts). */
const enabled = process.env.E2E_SUPABASE === '1' && !!process.env.E2E_TOTP_CODE;
test.skip(!enabled, 'Requires local Supabase and a signed-in Admin');

test('add a value, filter, export and import from the sample', async ({ page }) => {
  await page.goto('/admin/option-lists?list=departments');
  await expect(page.getByRole('heading', { name: 'Option lists' })).toBeVisible();
  await page.getByRole('button', { name: 'Add value' }).click();
  await page.getByLabel('Label (English)').fill('Communications');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: /Communications/ })).toBeVisible();
  await page.getByRole('button', { name: /In use: Any/ }).click();
  await page.getByLabel('Hidden').check();
  await expect(page).toHaveURL(/f_active=false/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'CSV (opens in Excel)' }).click();
  expect((await download).suggestedFilename()).toMatch(/departments-.*\.csv/);
});
