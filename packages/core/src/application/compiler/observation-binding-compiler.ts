import type { ObservableDef, ObservationBinding } from '../../domain/schemas/observable.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { findObservationItem, observationLabelText } from '../../domain/observation-inventory.js';
import { parseLocalizedNumbers } from '../../domain/parse-localized-numbers.js';
import { PlaybookCompileError } from './playbook-compiler.js';
import {
  resolveInventoryItemTarget,
  renderTargetExpression,
} from './resolve-inventory-target.js';
import { PARSE_LOCALIZED_NUMBERS_FN_SOURCE } from '../../domain/parse-localized-numbers.js';

function bindingElementTarget(
  binding: {
    resolved_locator?: string;
    resolved_selector?: string;
  },
  anchorInventories: Map<string, PageSnapshotInventory>,
  snapshotId: string,
  elementId: string,
): string {
  if (binding.resolved_locator) {
    return `page.${binding.resolved_locator}`;
  }
  if ('resolved_selector' in binding && binding.resolved_selector) {
    return `page.locator(${JSON.stringify(binding.resolved_selector)})`;
  }

  const inventory = anchorInventories.get(snapshotId);
  if (!inventory) {
    throw new PlaybookCompileError(
      `Anchor inventory snapshot ${snapshotId} not found`,
    );
  }

  const item = findObservationItem(inventory, elementId);
  if (!item) {
    throw new PlaybookCompileError(
      `element_id ${elementId} not found in observation inventory`,
    );
  }

  return renderTargetExpression(resolveInventoryItemTarget(item));
}

export function resolveObservableBindingTargets(
  observables: ObservableDef[],
  anchorInventories: Map<string, PageSnapshotInventory>,
): ObservableDef[] {
  return observables.map((observable) => ({
    ...observable,
    binding: resolveBindingTargets(observable.binding, anchorInventories),
  }));
}

function resolveBindingTargets(
  binding: ObservationBinding,
  anchorInventories: Map<string, PageSnapshotInventory>,
): ObservationBinding {
  switch (binding.kind) {
    case 'input_value':
    case 'text_content':
    case 'presence': {
      const target = resolveInventoryItemTarget(
        findObservationItem(
          anchorInventories.get(binding.inventory_snapshot_id)!,
          binding.element_id,
        )!,
      );
      const resolved =
        target.kind === 'locator'
          ? { resolved_locator: target.value }
          : { resolved_selector: target.value };
      return { ...binding, ...resolved };
    }
    case 'number_from_label': {
      const target = resolveInventoryItemTarget(
        findObservationItem(
          anchorInventories.get(binding.inventory_snapshot_id)!,
          binding.element_id,
        )!,
      );
      const resolved =
        target.kind === 'locator'
          ? { resolved_locator: target.value }
          : { resolved_selector: target.value };
      return { ...binding, ...resolved };
    }
    case 'list_texts': {
      const resolved_locators = binding.element_ids.map((elementId) => {
        const item = findObservationItem(
          anchorInventories.get(binding.inventory_snapshot_id)!,
          elementId,
        );
        if (!item) {
          throw new PlaybookCompileError(
            `element_id ${elementId} not found in observation inventory`,
          );
        }
        const target = resolveInventoryItemTarget(item);
        return target.kind === 'locator' ? target.value : target.value;
      });
      return { ...binding, resolved_locators };
    }
    case 'composite': {
      return {
        ...binding,
        parts: binding.parts.map((part) => {
          const item = findObservationItem(
            anchorInventories.get(binding.inventory_snapshot_id)!,
            part.element_id,
          );
          if (!item) {
            throw new PlaybookCompileError(
              `element_id ${part.element_id} not found in observation inventory`,
            );
          }
          const target = resolveInventoryItemTarget(item);
          return target.kind === 'locator'
            ? { ...part, resolved_locator: target.value }
            : { ...part, resolved_selector: target.value };
        }),
      };
    }
    default:
      return binding;
  }
}

export function validateObservableBindings(
  observables: ObservableDef[],
  anchorInventories: Map<string, PageSnapshotInventory>,
): void {
  const keys = new Set<string>();

  for (const observable of observables) {
    if (keys.has(observable.key)) {
      throw new PlaybookCompileError(`Duplicate observable key: ${observable.key}`);
    }
    keys.add(observable.key);

    const binding = observable.binding;
    const inventory = anchorInventories.get(binding.inventory_snapshot_id);
    if (!inventory) {
      throw new PlaybookCompileError(
        `Anchor inventory snapshot ${binding.inventory_snapshot_id} not found`,
      );
    }

    switch (binding.kind) {
      case 'input_value':
      case 'text_content':
      case 'presence':
      case 'number_from_label': {
        const item = findObservationItem(inventory, binding.element_id);
        if (!item) {
          throw new PlaybookCompileError(
            `element_id ${binding.element_id} not found for ${observable.key}`,
          );
        }
        if (binding.kind === 'number_from_label') {
          const numbers = parseLocalizedNumbers(observationLabelText(item));
          if (binding.number_index >= numbers.length) {
            throw new PlaybookCompileError(
              `number_index ${binding.number_index} out of range for ${observable.key}`,
            );
          }
        }
        break;
      }
      case 'list_texts':
        for (const elementId of binding.element_ids) {
          if (!findObservationItem(inventory, elementId)) {
            throw new PlaybookCompileError(
              `element_id ${elementId} not found for ${observable.key}`,
            );
          }
        }
        break;
      case 'composite':
        for (const part of binding.parts) {
          if (!findObservationItem(inventory, part.element_id)) {
            throw new PlaybookCompileError(
              `element_id ${part.element_id} not found for ${observable.key}`,
            );
          }
        }
        break;
      case 'url_pathname':
      case 'url_params':
        break;
    }
  }
}

export function renderObservableExtractor(
  observable: ObservableDef,
  anchorInventories: Map<string, PageSnapshotInventory>,
): string {
  const key = observable.key;
  const binding = observable.binding;

  switch (binding.kind) {
    case 'input_value': {
      const target = bindingElementTarget(
        binding,
        anchorInventories,
        binding.inventory_snapshot_id,
        binding.element_id,
      );
      return `    ${key}: await (async () => {
      const loc = ${target};
      try {
        if ((await loc.count()) === 0) return '';
        return (await loc.inputValue({ timeout: 2000 })).trim();
      } catch {
        return '';
      }
    })(),`;
    }
    case 'text_content': {
      const target = bindingElementTarget(
        binding,
        anchorInventories,
        binding.inventory_snapshot_id,
        binding.element_id,
      );
      return `    ${key}: await (async () => {
      const loc = ${target};
      try {
        if ((await loc.count()) === 0) return '';
        return ((await loc.textContent({ timeout: 2000 })) ?? '').trim();
      } catch {
        return '';
      }
    })(),`;
    }
    case 'number_from_label': {
      const target = bindingElementTarget(
        binding,
        anchorInventories,
        binding.inventory_snapshot_id,
        binding.element_id,
      );
      return `    ${key}: await (async () => {
      ${PARSE_LOCALIZED_NUMBERS_FN_SOURCE}
      const label = ${target};
      try {
        if ((await label.count()) === 0) return null;
      } catch {
        return null;
      }
      let text = '';
      try {
        text = (await label.textContent({ timeout: 2000 })) ?? '';
      } catch {
        return null;
      }
      const numbers = parseLocalizedNumbers(text);
      const index = ${binding.number_index};
      if (index < 0 || index >= numbers.length) return null;
      return numbers[index] ?? null;
    })(),`;
    }
    case 'url_pathname':
      return `    ${key}: (() => {
      try {
        return new URL(page.url()).pathname;
      } catch {
        return '';
      }
    })(),`;
    case 'url_params':
      return `    ${key}: (() => {
      try {
        const u = new URL(page.url());
        const stable = new URLSearchParams();
        const keys = ${JSON.stringify(binding.param_keys)};
        for (const paramKey of keys.sort()) {
          const value = u.searchParams.get(paramKey);
          if (value) stable.set(paramKey, value);
        }
        const sorted = new URLSearchParams([...stable.entries()].sort(([a], [b]) => a.localeCompare(b)));
        const query = sorted.toString();
        return query ? \`\${u.pathname}?\${query}\` : u.pathname;
      } catch {
        return '';
      }
    })(),`;
    case 'list_texts': {
      const targets = binding.element_ids.map((elementId, index) => {
        const locator = binding.resolved_locators?.[index];
        if (locator) {
          return locator.startsWith('getBy') || locator.startsWith('locator(')
            ? `page.${locator}`
            : `page.locator(${JSON.stringify(locator)})`;
        }
        return bindingElementTarget(
          {},
          anchorInventories,
          binding.inventory_snapshot_id,
          elementId,
        );
      });
      return `    ${key}: await (async () => {
      const texts = [];
      ${targets
        .map(
          (target, i) => `      try {
        const loc${i} = ${target};
        if ((await loc${i}.count()) > 0) {
          const t = ((await loc${i}.textContent({ timeout: 2000 })) ?? '').trim();
          if (t) texts.push(t);
        }
      } catch { /* skip */ }`,
        )
        .join('\n')}
      return texts;
    })(),`;
    }
    case 'presence': {
      const target = bindingElementTarget(
        binding,
        anchorInventories,
        binding.inventory_snapshot_id,
        binding.element_id,
      );
      return `    ${key}: await (async () => {
      try {
        const loc = ${target};
        return (await loc.count()) > 0 && (await loc.isVisible().catch(() => false));
      } catch {
        return false;
      }
    })(),`;
    }
    case 'composite': {
      const partReads = binding.parts.map((part) => {
        const target = part.resolved_locator
          ? `page.${part.resolved_locator}`
          : part.resolved_selector
            ? `page.locator(${JSON.stringify(part.resolved_selector)})`
            : bindingElementTarget(
                part,
                anchorInventories,
                binding.inventory_snapshot_id,
                part.element_id,
              );
        const prefix = part.prefix ? JSON.stringify(part.prefix + ':') : "''";
        if (part.extract === 'input_value') {
          return `      parts.push(${prefix} + await (async () => {
        const loc = ${target};
        try { return (await loc.inputValue({ timeout: 2000 })).trim(); } catch { return ''; }
      })());`;
        }
        return `      parts.push(${prefix} + await (async () => {
        const loc = ${target};
        try { return ((await loc.textContent({ timeout: 2000 })) ?? '').trim(); } catch { return ''; }
      })());`;
      });
      return `    ${key}: await (async () => {
      const parts = [];
${partReads.join('\n')}
      return parts.filter(Boolean).join(${JSON.stringify(binding.separator)});
    })(),`;
    }
    default:
      throw new PlaybookCompileError(`Unsupported binding kind for ${key}`);
  }
}
