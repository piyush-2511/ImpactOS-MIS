import { expect, test } from '@playwright/test';

/**
 * Auth journeys. Need the local Supabase stack (`npm run db:start`), Inbucket for emails, and the app on the
 * app host (E2E_BASE_URL=http://app.localhost:3000). Run with E2E_SUPABASE=1 npm run test:e2e.
 */
const enabled = process.env.E2E_SUPABASE === '1';
test.skip(!enabled, 'Requires local Supabase (set E2E_SUPABASE=1)');

const INBUCKET = process.env.INBUCKET_URL ?? 'http://localhost:54324';

async function latestCode(mailbox: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = (await (await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}`)).json()) as { id: string }[];
    const last = list.at(-1);
    if (last) {
      const msg = (await (await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}/${last.id}`)).json()) as { body: { text: string } };
      const m = msg.body.text.match(/\b(\d{6})\b/);
      if (m) return m[1]!;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('No code email arrived');
}

test('sign-up → verify code → set up organisation → home', async ({ page }) => {
  const stamp = Date.now();
  const email = `secretary${stamp}@example.org`;
  await page.goto('/signup');
  await page.getByLabel('Your full name').fill('Asha Kumari');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('New password').fill('a-long-unique-pass-2026');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/\/verify/);
  await page.getByLabel('6-digit code').fill(await latestCode(email.split('@')[0]!));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/setup-org/);
  await page.getByLabel('Organisation name').fill(`Test Foundation ${stamp}`);
  await expect(page.getByText(/is available/)).toBeVisible();
  await page.getByLabel('Legal form').selectOption('trust');
  await page.getByLabel('State / UT').selectOption('Bihar');
  await page.getByRole('button', { name: 'Start my free trial' }).click();
  // Secretary role requires two-step sign-in before the workspace opens.
  await expect(page).toHaveURL(/\/mfa\/setup/);
});

test('wrong password shows a single generic error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@example.org');
  await page.getByLabel('Password').fill('wrong-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match an account');
});

test('username tab asks for organisation code and points to HR for resets', async ({ page }) => {
  await page.goto('/login?tab=username');
  await expect(page.getByLabel('Organisation code')).toBeVisible();
  await expect(page.getByText('Ask your HR manager')).toBeVisible();
});

test('console is unreachable from the app host', async ({ request }) => {
  const res = await request.get('/console/login');
  expect(res.status()).toBe(404);
});
