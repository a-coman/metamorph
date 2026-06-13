import type { Locator, Page } from 'playwright';

const AUTOCOMPLETE_SETTLE_MS = 400;
const OPTION_VISIBLE_TIMEOUT_MS = 2500;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Fill a combobox/searchbox and pick a matching autocomplete suggestion when present. */
export async function fillWithAutocomplete(
  page: Page,
  locator: Locator,
  value: string,
): Promise<void> {
  try {
    await locator.fill(value);
  } catch {
    await locator.click();
    await page.keyboard.type(value);
  }

  await page.waitForTimeout(AUTOCOMPLETE_SETTLE_MS);

  const namePattern = new RegExp(escapeRegExp(value), 'i');
  const optionCandidates = [
    page.getByRole('option', { name: namePattern }).first(),
    page.locator('[role="listbox"] [role="option"]').filter({ hasText: namePattern }).first(),
    page.locator('[role="option"]').filter({ hasText: namePattern }).first(),
  ];

  for (const option of optionCandidates) {
    const visible = await option
      .isVisible({ timeout: OPTION_VISIBLE_TIMEOUT_MS })
      .catch(() => false);
    if (visible) {
      await option.click();
      return;
    }
  }

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
}
