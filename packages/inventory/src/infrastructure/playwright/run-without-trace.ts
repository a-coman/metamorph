import type { Page } from 'playwright';

type PlaywrightChannelOwner = {
  _wrapApiCall?<T>(
    func: () => Promise<T>,
    options?: { internal?: boolean; title?: string },
  ): Promise<T>;
};

/**
 * Runs nested Playwright calls without recording them in context traces.
 * Probe traces should show user steps, not inventory validation noise.
 */
export async function runWithoutTrace<T>(
  page: Page,
  fn: () => Promise<T>,
  options?: { title?: string },
): Promise<T> {
  const owner = page as Page & PlaywrightChannelOwner;
  if (typeof owner._wrapApiCall !== 'function') {
    return fn();
  }

  return owner._wrapApiCall(() => fn(), {
    internal: true,
    title: options?.title ?? 'Internal',
  });
}
