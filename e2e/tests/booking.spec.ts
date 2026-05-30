import { expect, test } from '@playwright/test';

// Pick a Bangkok calendar date ~10 days out that is not a Monday (seed closes Mondays).
function futureOpenDate(): string {
  const now = new Date();
  const d = new Date(now.getTime() + 10 * 24 * 60 * 60_000);
  // Evaluate the weekday in Bangkok (UTC+7).
  while (new Date(d.getTime() + 7 * 60 * 60_000).getUTCDay() === 1) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  // YYYY-MM-DD in Bangkok.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
}

test('the booking page loads with services', async ({ page }) => {
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'Book an appointment' })).toBeVisible();
  await expect(page.getByText('1. Choose a service')).toBeVisible();
  await expect(page.getByText('Haircut', { exact: true })).toBeVisible();
});

test('book a slot, see the confirmation code, then look it up and cancel', async ({ page }) => {
  const date = futureOpenDate();

  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'Book an appointment' })).toBeVisible();

  // Choose the Haircut service.
  await page.getByRole('button', { name: /Haircut/ }).first().click();

  // Pick the date and wait for slots to load.
  await page.getByLabel('Date').fill(date);
  const firstSlot = page.locator('.slot').first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();

  // Fill in customer details and confirm.
  const suffix = Date.now().toString().slice(-6);
  await page.getByLabel('Name', { exact: true }).fill(`E2E Tester ${suffix}`);
  await page.getByLabel('Phone', { exact: true }).fill('0810000000');
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  // Confirmation appears with a code.
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  const code = (await page.getByTestId('booking-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // Look the booking up by code.
  await page.goto('/lookup');
  await page.getByLabel('Booking code').fill(code);
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.getByRole('heading', { name: `Booking ${code}` })).toBeVisible();
  await expect(page.getByText('CONFIRMED')).toBeVisible();

  // Cancel it.
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(page.getByText('CANCELLED')).toBeVisible();
});
