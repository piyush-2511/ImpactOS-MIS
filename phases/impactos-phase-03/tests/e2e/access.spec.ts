import { expect, test } from '@playwright/test';

/**
 * Access-control journeys. Need local Supabase with a seeded Secretary (SEED_SECRETARY_EMAIL / _PASSWORD, TOTP
 * secret in SEED_SECRETARY_TOTP) and the app on the app host. Run with E2E_SUPABASE=1 npm run test:e2e.
 */
const enabled = process.env.E2E_SUPABASE === '1' && !!process.env.SEED_SECRETARY_EMAIL;
test.skip(!enabled, 'Requires local Supabase and a seeded Secretary');

test('signed-out visitors cannot reach admin pages', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusers/);
});

test('Secretary sees Users, Roles, Positions and Activity log in the sidebar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.SEED_SECRETARY_EMAIL!);
  await page.getByLabel('Password').fill(process.env.SEED_SECRETARY_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/mfa/);
  // TOTP is computed by the test helper in CI; locally sign in once by hand to store state.
  test.skip(!process.env.E2E_TOTP_CODE, 'Provide E2E_TOTP_CODE for the MFA step');
  await page.getByLabel('6-digit code').fill(process.env.E2E_TOTP_CODE!);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByRole('button', { name: 'Admin' }).click();
  for (const name of ['Users', 'Roles', 'Positions', 'Activity log'])
    await expect(page.getByRole('link', { name })).toBeVisible();
  await page.getByRole('link', { name: 'Roles' }).click();
  await expect(page.getByRole('cell', { name: /Secretary \/ Owner/ })).toBeVisible();
});

test('a username account gets a one-time password slip', async ({ page }) => {
  test.skip(!process.env.E2E_TOTP_CODE, 'Needs a signed-in Secretary');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Create username account' }).click();
  await page.getByLabel('Full name').fill('Sunita Kumari');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('One-time password')).toBeVisible();
});
