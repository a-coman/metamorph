import type { ElementHandle, Page } from 'playwright';
import { removeInventoryLabels } from './inventory.browser.js';

/**
 * tsx/esbuild transpilation injects `__name(...)` helper calls into functions
 * that contain named inner functions (keepNames). When Playwright serializes
 * such a function into the page, the helper definition stays behind in Node
 * and the browser throws `ReferenceError: __name is not defined`. Installing
 * a global no-op shim before evaluating lets those free references resolve.
 *
 * The shim installer itself must stay free of named inner functions so its
 * own serialized body never references `__name`.
 */
function installEsbuildNameShim(): void {
  const globalRef = globalThis as { __name?: (target: unknown, value: string) => unknown };
  if (typeof globalRef.__name !== 'function') {
    globalRef.__name = (target: unknown) => target;
  }
}

export async function evaluatePageFunction<Arg, R>(
  page: Page,
  fn: (arg: Arg) => R,
  arg: Arg,
): Promise<R> {
  await page.evaluate(installEsbuildNameShim);
  return (await page.evaluate(fn as (arg: unknown) => unknown, arg)) as R;
}

export async function evaluateHandleFunction<E extends Element, R>(
  handle: ElementHandle<E>,
  fn: (el: E) => R,
): Promise<R> {
  await handle.evaluate(installEsbuildNameShim);
  return (await handle.evaluate(fn as (el: E) => unknown)) as R;
}

export async function clearInventoryLabelsFromPage(page: Page): Promise<void> {
  await page.evaluate(installEsbuildNameShim);
  await page.evaluate(removeInventoryLabels);
}
