import type { InventoryItem } from '@metamorph/core';

export type ScanPageInventoryOptions = {
  maxItems?: number;
  minVisibleSizePx?: number;
  headerNavBelowFoldPx?: number;
};

/**
 * Runs entirely in the browser via page.evaluate().
 * Must stay free of Node imports and closed-over variables.
 */
export function scanAndLabelPage(
  options: ScanPageInventoryOptions = {},
): InventoryItem[] {
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const minVisibleSizePx = options.minVisibleSizePx ?? 10;
  const headerNavBelowFoldPx = options.headerNavBelowFoldPx ?? 120;
  const overlayClassName = 'metamorph-selector-overlay';
  const highlightClassName = 'metamorph-highlight-overlay';
  const legendId = 'metamorph-selector-legend';

  document
    .querySelectorAll(`.${overlayClassName}, .${highlightClassName}`)
    .forEach((node) => node.remove());
  document.getElementById(legendId)?.remove();

  const escapeCssString = (value: string) =>
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\A ')
      .replace(/\r/g, '\\D ')
      .replace(/\f/g, '\\C ');

  const cssEscape = (value: string) => {
    const text = String(value);
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(text);
    }
    return text.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  };

  const selectorMatchesUniquely = (selector: string, element: Element) => {
    if (!selector) return false;
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  const hasPointerCursor = (el: Element) =>
    window.getComputedStyle(el).cursor === 'pointer';

  const isTopmostPointerElement = (el: Element) =>
    hasPointerCursor(el) &&
    (!el.parentElement || !hasPointerCursor(el.parentElement));

  const calendarScopeSelector = [
    "[role='dialog']",
    "[role='grid']",
    "[aria-modal='true']",
    "[id*='calendar' i]",
    "[id*='datepicker' i]",
    "[data-testid*='calendar' i]",
    "[data-testid*='datepicker' i]",
  ].join(', ');

  const headerNavChromeSelector =
    'header, nav, [role="navigation"], [id*="nav" i], [class*="nav" i]';

  const filterPanelSelector =
    'aside, [role="complementary"], fieldset, [role="search"]';

  const isInFilterPanel = (el: Element) => Boolean(el.closest(filterPanelSelector));

  const isInCalendarScope = (el: Element) =>
    Boolean(el.closest(calendarScopeSelector));

  const isHeaderNavChrome = (el: Element) => {
    if (!el.closest(headerNavChromeSelector)) return false;
    const tagName = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
      return true;
    }
    if (['link', 'menuitem', 'tab', 'button'].includes(role)) {
      return true;
    }
    return false;
  };

  const rectsIntersect = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
  ) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

  const isVisibleEnough = (el: Element) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < minVisibleSizePx || rect.height < minVisibleSizePx) return false;
    if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;

    let curr: Element | null = el;
    while (
      curr &&
      curr !== document.documentElement &&
      curr !== document.body
    ) {
      const style = window.getComputedStyle(curr);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0 ||
        curr.getAttribute('aria-hidden') === 'true'
      ) {
        return false;
      }

      if (style.overflow !== 'visible' && style.overflow !== '') {
        const parentRect = curr.getBoundingClientRect();
        if (parentRect.width === 0 || parentRect.height === 0) return false;
        const elementRect = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
        const clipRect = {
          left: parentRect.left,
          top: parentRect.top,
          right: parentRect.right,
          bottom: parentRect.bottom,
        };
        if (!rectsIntersect(elementRect, clipRect)) {
          return false;
        }
      }
      curr = curr.parentElement;
    }

    const relaxHitTest = (() => {
      const tagName = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      const role = el.getAttribute('role') || '';
      const isChoice =
        ['checkbox', 'radio'].includes(role) ||
        (tagName === 'input' && ['checkbox', 'radio'].includes(type));
      return isChoice && isInFilterPanel(el);
    })();

    if (!relaxHitTest) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topEl = document.elementFromPoint(centerX, centerY);
      if (topEl) {
        const className =
          typeof topEl.className === 'string' ? topEl.className : '';
        if (!className.includes('metamorph-')) {
          if (!el.contains(topEl) && !topEl.contains(el)) {
            return false;
          }
        }
      }
    }

    if (rect.top > headerNavBelowFoldPx && isHeaderNavChrome(el)) {
      return false;
    }

    return true;
  };

  const getAccessibleName = (el: Element) => {
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const title = (el.getAttribute('title') || '').trim();
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return ariaLabel || title || text;
  };

  const getLabelAssociatedControl = (label: Element): Element | null => {
    if (label.tagName.toLowerCase() !== 'label') return null;
    const htmlFor = label.getAttribute('for');
    if (htmlFor) {
      return document.getElementById(htmlFor);
    }
    return label.querySelector('input, select, textarea');
  };

  const getLabelDisplayText = (label: Element): string => {
    const clone = label.cloneNode(true) as Element;
    clone.querySelectorAll('input, select, textarea').forEach((node) => node.remove());
    return (clone.textContent || '').trim().replace(/\s+/g, ' ');
  };

  const isChoiceControl = (el: Element): boolean => {
    const tagName = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const role = el.getAttribute('role') || '';
    if (tagName === 'input' && ['checkbox', 'radio'].includes(type)) {
      return true;
    }
    return ['checkbox', 'radio'].includes(role);
  };

  const isVisuallyHiddenChoiceControl = (el: Element): boolean => {
    if (!isChoiceControl(el)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return true;
    }
    const clip = style.clip || '';
    if (
      clip.includes('rect(0') ||
      (style.clipPath && style.clipPath !== 'none' && style.clipPath.includes('inset'))
    ) {
      return true;
    }
    if (rect.width < 10 || rect.height < 10) {
      return true;
    }
    if (
      el.tagName.toLowerCase() === 'input' &&
      style.position === 'absolute' &&
      rect.width < 16 &&
      rect.height < 16
    ) {
      return true;
    }
    return false;
  };

  const isHiddenFacetCheckbox = isVisuallyHiddenChoiceControl;

  const isClickableFacetTarget = (el: Element): boolean => {
    const tagName = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    if (tagName === 'label') return true;
    if (tagName === 'a' && el.hasAttribute('href')) return true;
    if (['button', 'link', 'checkbox', 'radio'].includes(role)) return true;
    return isTopmostPointerElement(el);
  };

  const getVisibleClickTargetForHiddenControl = (
    control: Element,
  ): Element | null => {
    const id = control.id;
    if (id) {
      const associated = document.querySelector(`label[for="${cssEscape(id)}"]`);
      if (associated && isClickableFacetTarget(associated) && isVisibleEnough(associated)) {
        return associated;
      }
    }

    const parentLabel = control.closest('label');
    if (
      parentLabel &&
      isClickableFacetTarget(parentLabel) &&
      isVisibleEnough(parentLabel)
    ) {
      return parentLabel;
    }

    const labelledBy = control.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const labelId of labelledBy.split(/\s+/)) {
        const trimmed = labelId.trim();
        if (!trimmed) continue;
        const labelEl = document.getElementById(trimmed);
        if (
          labelEl &&
          isClickableFacetTarget(labelEl) &&
          isVisibleEnough(labelEl)
        ) {
          return labelEl;
        }
      }
    }

    const wrappingInteractive = control.closest(
      'a[href], button, [role="button"], [role="link"], [role="checkbox"], [role="radio"]',
    );
    if (
      wrappingInteractive &&
      wrappingInteractive !== control &&
      isClickableFacetTarget(wrappingInteractive) &&
      isVisibleEnough(wrappingInteractive)
    ) {
      return wrappingInteractive;
    }

    const row = control.closest('li, [role="listitem"]');
    if (row) {
      const rowSelectors = [
        'label',
        'a[href]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="link"]',
        '[role="button"]',
      ].join(', ');
      for (const candidate of Array.from(row.querySelectorAll(rowSelectors))) {
        if (candidate === control || control.contains(candidate)) continue;
        if (isVisuallyHiddenChoiceControl(candidate)) continue;
        const name = getAccessibleName(candidate).trim();
        if (!name || name.length > 80) continue;
        if (!isClickableFacetTarget(candidate)) continue;
        if (isVisibleEnough(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  };

  const resolveChoiceClickTarget = (control: Element): Element | null => {
    if (isVisuallyHiddenChoiceControl(control)) {
      return getVisibleClickTargetForHiddenControl(control);
    }

    if (isClickableFacetTarget(control) && isVisibleEnough(control)) {
      return control;
    }

    const row = control.closest('li, [role="listitem"]');
    if (row) {
      const rowSelectors = [
        'label',
        'a[href]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="link"]',
        '[role="button"]',
      ].join(', ');
      for (const candidate of Array.from(row.querySelectorAll(rowSelectors))) {
        if (candidate === control || control.contains(candidate)) continue;
        if (isVisuallyHiddenChoiceControl(candidate)) continue;
        if (!isClickableFacetTarget(candidate)) continue;
        if (isVisibleEnough(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  };

  const getImplicitRole = (el: Element): string | null => {
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'a' && el.hasAttribute('href')) return 'link';
    if (tagName === 'button') return 'button';
    if (tagName === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'hidden') return null;
      if (type === 'search') return 'searchbox';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['submit', 'button', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      return 'textbox';
    }
    if (tagName === 'select') return 'combobox';
    if (tagName === 'textarea') return 'textbox';
    return null;
  };

  const getElementRole = (el: Element): string | null => {
    const explicitRole = el.getAttribute('role');
    if (explicitRole && !['none', 'presentation'].includes(explicitRole.toLowerCase())) {
      return explicitRole;
    }
    return getImplicitRole(el);
  };

  const countSelectorMatches = (selector: string): number | undefined => {
    try {
      return document.querySelectorAll(selector).length;
    } catch {
      return undefined;
    }
  };

  const buildSelectorCandidates = (el: Element) => {
    const tagName = el.tagName.toLowerCase();
    const candidates: string[] = [];
    const testId = el.getAttribute('data-testid');

    if (testId) {
      candidates.push(`[data-testid="${escapeCssString(testId)}"]`);
    }

    if (el.id) {
      candidates.push(`#${cssEscape(el.id)}`);
    }

    const name = el.getAttribute('name');
    if (name && ['input', 'select', 'textarea', 'button'].includes(tagName)) {
      candidates.push(`${tagName}[name="${escapeCssString(name)}"]`);
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      candidates.push(
        `${tagName}[aria-label="${escapeCssString(ariaLabel)}"]`,
      );
    }

    const dataDate = el.getAttribute('data-date');
    if (dataDate) {
      candidates.push(`[data-date="${escapeCssString(dataDate)}"]`);
    }

    const role = el.getAttribute('role');
    if (
      role &&
      [
        'button',
        'link',
        'textbox',
        'combobox',
        'searchbox',
        'checkbox',
        'radio',
        'menuitem',
        'tab',
        'gridcell',
      ].includes(role)
    ) {
      candidates.push(`${tagName}[role="${escapeCssString(role)}"]`);
    }

    const type = el.getAttribute('type');
    if (tagName === 'input' && type) {
      candidates.push(`input[type="${escapeCssString(type)}"]`);
    }

    const title = el.getAttribute('title');
    if (title) {
      candidates.push(`${tagName}[title="${escapeCssString(title)}"]`);
    }

    if (tagName === 'a') {
      const href = el.getAttribute('href');
      if (href) {
        candidates.push(`a[href="${escapeCssString(href)}"]`);
      }
    }

    return candidates;
  };

  const buildFallbackPathSelector = (el: Element) => {
    const segments: string[] = [];
    let node: Element | null = el;

    while (node && node !== document.documentElement) {
      const tagName = node.tagName.toLowerCase();
      if (node.id) {
        segments.unshift(`#${cssEscape(node.id)}`);
        break;
      }

      const parent: Element | null = node.parentElement;
      let segment = tagName;

      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child: Element) => child.tagName === node!.tagName,
        );
        if (siblings.length > 1) {
          segment = `${tagName}:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }

      segments.unshift(segment);
      node = parent;
    }

    return segments.join(' > ') || el.tagName.toLowerCase();
  };

  const getStableSelector = (el: Element) => {
    for (const selector of buildSelectorCandidates(el)) {
      if (selectorMatchesUniquely(selector, el)) {
        return selector;
      }
    }

    const fallbackSelector = buildFallbackPathSelector(el);
    if (selectorMatchesUniquely(fallbackSelector, el)) {
      return fallbackSelector;
    }

    return fallbackSelector;
  };

  const isTestingRelevant = (el: Element) => {
    const tagName = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    const style = window.getComputedStyle(el);
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) > 0;

    if (!isVisible) return false;

    const className = typeof el.className === 'string' ? el.className : '';
    if (className.includes('metamorph-')) {
      return false;
    }

    if (isTopmostPointerElement(el)) return true;
    if (['button', 'input', 'select', 'textarea'].includes(tagName)) return true;
    if (tagName === 'label') {
      const control = getLabelAssociatedControl(el);
      if (!control) return false;
      return getLabelDisplayText(el).length > 0;
    }
    if (
      role &&
      [
        'button',
        'link',
        'textbox',
        'combobox',
        'searchbox',
        'checkbox',
        'radio',
        'menuitem',
        'tab',
        'gridcell',
      ].includes(role)
    ) {
      return true;
    }

    if (el.getAttribute('data-date')) {
      return true;
    }

    if (tagName === 'a') {
      const hasHref = Boolean(el.getAttribute('href'));
      if (!hasHref) return false;
      const hasAria = Boolean(el.getAttribute('aria-label'));
      const hasImage = el.querySelector('img') !== null;
      if (text.length === 0 && !hasAria && !hasImage) return false;
      return true;
    }

    if (el.getAttribute('data-testid') || (el as HTMLElement).onclick != null) {
      return true;
    }

    if (isHiddenFacetCheckbox(el) && getVisibleClickTargetForHiddenControl(el)) {
      return false;
    }

    return false;
  };

  const isLabelForChoiceControl = (el: Element): boolean => {
    if (el.tagName.toLowerCase() !== 'label') return false;
    const control = getLabelAssociatedControl(el);
    if (!control) return false;
    const controlRole = getElementRole(control);
    return controlRole === 'checkbox' || controlRole === 'radio';
  };

  const scoreElement = (el: Element) => {
    const tagName = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const effectiveRole = getElementRole(el) || '';
    const rect = el.getBoundingClientRect();
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    const inTopNav = Boolean(el.closest(headerNavChromeSelector));
    const inCookieLayer = Boolean(
      el.closest(
        "[role='dialog'], [aria-modal='true'], [id*='consent' i], [class*='cookie' i], [class*='consent' i]",
      ),
    );
    const inCalendarScope = isInCalendarScope(el);

    let score = 0;
    if (el.getAttribute('data-testid')) score += 120;
    if (el.id) score += 100;
    if (el.getAttribute('name')) score += 70;
    if (el.getAttribute('aria-label')) score += 70;
    if (el.getAttribute('data-date')) score += 55;
    if (role === 'gridcell') score += 45;
    if (inCalendarScope && (el.getAttribute('data-date') || role === 'gridcell')) {
      score += 100;
    }
    if (['button', 'input', 'select', 'textarea'].includes(tagName)) score += 60;
    if (isLabelForChoiceControl(el)) {
      score += 60;
    }
    if (effectiveRole === 'checkbox' || effectiveRole === 'radio') {
      score += 55;
      if (isInFilterPanel(el)) {
        score += 85;
      }
    }
    if (isTopmostPointerElement(el)) score += 55;
    if (el.getAttribute('role')) score += 40;
    if (inTopNav) score += 120;
    if (inCookieLayer) score += 90;
    if (tagName === 'a') score += 25;
    if (text.length >= 2 && text.length <= 40) score += 20;
    if (rect.width * rect.height > 1800) score += 10;
    if ((el.getAttribute('href') || '').startsWith('#')) score -= 15;
    if (role === 'navigation' || role === 'main' || role === 'banner') {
      score -= 140;
    }
    if (['div', 'section', 'article', 'nav'].includes(tagName) && !(el as HTMLElement).onclick) {
      score -= 60;
    }

    return score;
  };

  const candidateSelector = [
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "a",
    "[role='button']",
    "[role='link']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='menuitem']",
    "[role='tab']",
    "[role='combobox']",
    "[role='searchbox']",
    "[role='gridcell']",
    "[data-date]",
    "[data-testid]",
    "[aria-label]",
    "[onclick]:not([onclick=''])",
  ].join(', ');

  const allCandidates = Array.from(document.querySelectorAll(candidateSelector));
  const cursorCandidates = Array.from(document.querySelectorAll('body *')).filter(
    isTopmostPointerElement,
  );

  const choiceClickTargets = Array.from(
    document.querySelectorAll(
      'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]',
    ),
  )
    .map((control) => resolveChoiceClickTarget(control))
    .filter((target): target is Element => target !== null);

  const seenNodes = new Set<Element>();
  const uniqueCandidates = [
    ...allCandidates,
    ...cursorCandidates,
    ...choiceClickTargets,
  ].filter((el) => {
    if (seenNodes.has(el)) return false;
    seenNodes.add(el);
    return true;
  });

  type ScoredCandidate = {
    el: Element;
    locator: string | null;
    selector: string;
    score: number;
  };

  const scoredCandidates: ScoredCandidate[] = uniqueCandidates
    .filter(isVisibleEnough)
    .filter(isTestingRelevant)
    .map((el) => ({
      el,
      locator: null,
      selector: getStableSelector(el),
      score: scoreElement(el),
    }))
    .sort((a, b) => b.score - a.score);

  const scoredCandidateByElement = new Map(
    scoredCandidates.map((candidate) => [candidate.el, candidate]),
  );

  const isStrongInteractiveCandidate = (candidate: ScoredCandidate) => {
    const tagName = candidate.el.tagName.toLowerCase();
    const role = candidate.el.getAttribute('role') || '';
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
      return true;
    }
    if (isLabelForChoiceControl(candidate.el)) {
      return true;
    }
    if (
      [
        'button',
        'link',
        'textbox',
        'combobox',
        'searchbox',
        'checkbox',
        'radio',
        'menuitem',
        'tab',
        'gridcell',
      ].includes(role)
    ) {
      return true;
    }
    if (candidate.el.getAttribute('data-date')) {
      return true;
    }
    return isTopmostPointerElement(candidate.el);
  };

  const containsRect = (
    outer: { left: number; top: number; right: number; bottom: number },
    inner: { left: number; top: number; right: number; bottom: number },
  ) =>
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom;

  const filteredCandidates = scoredCandidates.filter((candidate) => {
    const candidateRect = candidate.el.getBoundingClientRect();
    let parent = candidate.el.parentElement;

    while (parent && parent !== document.documentElement) {
      const ancestorCandidate = scoredCandidateByElement.get(parent);
      if (ancestorCandidate) {
        const ancestorRect = ancestorCandidate.el.getBoundingClientRect();
        const ancestorArea = Math.max(1, ancestorRect.width * ancestorRect.height);
        const candidateArea = Math.max(1, candidateRect.width * candidateRect.height);

        if (
          isStrongInteractiveCandidate(ancestorCandidate) &&
          containsRect(ancestorRect, candidateRect) &&
          ancestorArea >= candidateArea * 1.25
        ) {
          return false;
        }
      }
      parent = parent.parentElement;
    }

    return true;
  });

  const isTier1Control = (candidate: ScoredCandidate) => {
    const tagName = candidate.el.tagName.toLowerCase();
    const role = candidate.el.getAttribute('role') || '';
    const effectiveRole = getElementRole(candidate.el) || '';
    if (['select', 'input', 'textarea', 'button'].includes(tagName)) {
      return true;
    }
    if (isLabelForChoiceControl(candidate.el)) {
      return true;
    }
    return ['combobox', 'searchbox', 'checkbox', 'radio'].includes(role) ||
      ['checkbox', 'radio'].includes(effectiveRole);
  };

  const tier1 = filteredCandidates.filter(isTier1Control);
  const tier2 = filteredCandidates.filter((candidate) => !isTier1Control(candidate));
  const orderedCandidates = [...tier1, ...tier2];
  const chosen = Number.isFinite(maxItems)
    ? orderedCandidates.slice(0, maxItems)
    : orderedCandidates;
  const chosenWithCounts = chosen.map(({ el, selector, score }) => {
    const selectorMatchCount = countSelectorMatches(selector);

    return {
      el,
      selector,
      score,
      selectorMatchCount,
    };
  });
  const shortIdFor = (index: number) => `E${index + 1}`;

  return chosenWithCounts.map(
    ({ el, selector, score, selectorMatchCount }, index) => {
    const shortId = shortIdFor(index);
    const rect = el.getBoundingClientRect();
    const pageRect = {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      right: rect.right + window.scrollX,
      bottom: rect.bottom + window.scrollY,
      width: rect.width,
      height: rect.height,
    };

    const textPreview = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const tagName = el.tagName.toLowerCase();
    const associatedControl =
      tagName === 'label' ? getLabelAssociatedControl(el) : null;
    const labelText =
      tagName === 'label' ? getLabelDisplayText(el) : null;
    const effectiveRole =
      tagName === 'label' && associatedControl
        ? getElementRole(associatedControl)
        : getElementRole(el);
    const effectiveTextPreview =
      labelText && labelText.length > 0
        ? labelText.slice(0, 80)
        : textPreview || null;
    const selectOptions =
      tagName === 'select'
        ? Array.from(el.querySelectorAll('option'))
            .map((option) => ({
              value: option.value,
              label: (option.textContent ?? '').trim(),
            }))
            .filter((option) => option.value.length > 0)
        : [];

    return {
      index,
      shortId,
      locator: null,
      selector,
      score,
      labelShown: false,
      tagName,
      id: el.id || null,
      role: effectiveRole,
      name: el.getAttribute('name'),
      ariaLabel: el.getAttribute('aria-label'),
      textPreview: effectiveTextPreview,
      source: 'dom',
      ...(selectorMatchCount !== undefined ? { selectorMatchCount } : {}),
      boundingBox: {
        x: pageRect.left,
        y: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
      },
      ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
    };
  },
  );
}

/**
 * Broad DOM inventory for observation anchors: visible nodes with meaningful text
 * or accessibility metadata. No on-page labels; document-order shortIds (E1…).
 */
export function scanObservationPage(
  options: ScanPageInventoryOptions = {},
): InventoryItem[] {
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const minVisibleSizePx = options.minVisibleSizePx ?? 10;

  // Must live inside the function: this code is serialized into the page and
  // loses access to module scope.
  const OBSERVATION_EXCLUDED_TAGS = new Set([
    'script',
    'style',
    'svg',
    'path',
    'noscript',
    'template',
    'head',
    'meta',
    'link',
  ]);

  const tagNameOf = (el: Element) =>
    (typeof el.tagName === 'string' ? el.tagName : el.localName ?? '').toLowerCase();

  const roleAttrOf = (el: Element) => (el.getAttribute('role') ?? '').toLowerCase();

  const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

  const hasMeaningfulText = (value: string) => {
    const normalized = normalizeText(value);
    if (normalized.length < 2) return false;
    return /[\p{L}\p{N}]/u.test(normalized);
  };

  const escapeCssString = (value: string) =>
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\A ')
      .replace(/\r/g, '\\D ')
      .replace(/\f/g, '\\C ');

  const cssEscape = (value: string) => {
    const text = String(value);
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(text);
    }
    return text.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  };

  const selectorMatchesUniquely = (selector: string, element: Element) => {
    if (!selector) return false;
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  const rectsIntersect = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
  ) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

  const isObservationVisible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < minVisibleSizePx || rect.height < minVisibleSizePx) return false;
    if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;

    let curr: Element | null = el;
    while (
      curr &&
      curr !== document.documentElement &&
      curr !== document.body
    ) {
      const style = window.getComputedStyle(curr);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0
      ) {
        return false;
      }

      if (style.overflow !== 'visible' && style.overflow !== '') {
        const parentRect = curr.getBoundingClientRect();
        if (parentRect.width === 0 || parentRect.height === 0) return false;
        const elementRect = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
        const clipRect = {
          left: parentRect.left,
          top: parentRect.top,
          right: parentRect.right,
          bottom: parentRect.bottom,
        };
        if (!rectsIntersect(elementRect, clipRect)) {
          return false;
        }
      }
      curr = curr.parentElement;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(centerX, centerY);
    if (topEl) {
      const className =
        typeof topEl.className === 'string' ? topEl.className : '';
      if (!className.includes('metamorph-')) {
        if (!el.contains(topEl) && !topEl.contains(el)) {
          return false;
        }
      }
    }

    return true;
  };

  const isMetamorphNode = (el: Element) => {
    if (el.hasAttribute('data-metamorph-label')) return true;
    if (el.hasAttribute('data-metamorph-inventory-id')) return true;
    const className = typeof el.className === 'string' ? el.className : '';
    return className.includes('metamorph-');
  };

  const getDirectText = (el: Element) => {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? '';
      }
    }
    return normalizeText(text);
  };

  const resolveAriaLabelledByText = (el: Element) => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (!labelledBy) return '';
    const parts: string[] = [];
    for (const id of labelledBy.split(/\s+/)) {
      const trimmed = id.trim();
      if (!trimmed) continue;
      const ref = document.getElementById(trimmed);
      if (ref) {
        const text = normalizeText(ref.textContent ?? '');
        if (text) parts.push(text);
      }
    }
    return parts.join(' ');
  };

  const getObservationSemanticText = (el: Element): string => {
    const tagName = tagNameOf(el);
    const direct = getDirectText(el);
    if (hasMeaningfulText(direct)) return direct;

    const ariaLabel = normalizeText(el.getAttribute('aria-label') ?? '');
    if (hasMeaningfulText(ariaLabel)) return ariaLabel;

    const labelledBy = resolveAriaLabelledByText(el);
    if (hasMeaningfulText(labelledBy)) return labelledBy;

    const title = normalizeText(el.getAttribute('title') ?? '');
    if (hasMeaningfulText(title)) return title;

    if (tagName === 'img') {
      const alt = normalizeText(el.getAttribute('alt') ?? '');
      if (hasMeaningfulText(alt)) return alt;
    }

    if (['input', 'textarea', 'select'].includes(tagName)) {
      const value = normalizeText((el as HTMLInputElement).value ?? '');
      if (hasMeaningfulText(value)) return value;
      const placeholder = normalizeText(el.getAttribute('placeholder') ?? '');
      if (hasMeaningfulText(placeholder)) return placeholder;
    }

    return '';
  };

  const isObservationRelevant = (el: Element) => {
    const tagName = tagNameOf(el);
    if (OBSERVATION_EXCLUDED_TAGS.has(tagName)) return false;
    if (isMetamorphNode(el)) return false;
    if (!isObservationVisible(el)) return false;
    return hasMeaningfulText(getObservationSemanticText(el));
  };

  const getImplicitRole = (el: Element): string | null => {
    const tagName = tagNameOf(el);
    if (tagName === 'a' && el.hasAttribute('href')) return 'link';
    if (tagName === 'button') return 'button';
    if (tagName === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'hidden') return null;
      if (type === 'search') return 'searchbox';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['submit', 'button', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      return 'textbox';
    }
    if (tagName === 'select') return 'combobox';
    if (tagName === 'textarea') return 'textbox';
    return null;
  };

  const getElementRole = (el: Element): string | null => {
    const explicitRole = el.getAttribute('role');
    const normalizedRole = roleAttrOf(el);
    if (normalizedRole && !['none', 'presentation'].includes(normalizedRole)) {
      return explicitRole;
    }
    return getImplicitRole(el);
  };

  const buildSelectorCandidates = (el: Element) => {
    const tagName = tagNameOf(el);
    const candidates: string[] = [];
    const testId = el.getAttribute('data-testid');

    if (testId) {
      candidates.push(`[data-testid="${escapeCssString(testId)}"]`);
    }

    if (el.id) {
      candidates.push(`#${cssEscape(el.id)}`);
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      candidates.push(
        `${tagName}[aria-label="${escapeCssString(ariaLabel)}"]`,
      );
    }

    const title = el.getAttribute('title');
    if (title) {
      candidates.push(`${tagName}[title="${escapeCssString(title)}"]`);
    }

    return candidates;
  };

  const buildFallbackPathSelector = (el: Element) => {
    const segments: string[] = [];
    let node: Element | null = el;

    while (node && node !== document.documentElement) {
      const tagName = tagNameOf(node);
      if (node.id) {
        segments.unshift(`#${cssEscape(node.id)}`);
        break;
      }

      const parent: Element | null = node.parentElement;
      let segment = tagName;

      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child: Element) => tagNameOf(child) === tagNameOf(node!),
        );
        if (siblings.length > 1) {
          segment = `${tagName}:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }

      segments.unshift(segment);
      node = parent;
    }

    return segments.join(' > ') || tagNameOf(el);
  };

  const getStableSelector = (el: Element) => {
    for (const selector of buildSelectorCandidates(el)) {
      if (selectorMatchesUniquely(selector, el)) {
        return selector;
      }
    }

    const fallbackSelector = buildFallbackPathSelector(el);
    if (selectorMatchesUniquely(fallbackSelector, el)) {
      return fallbackSelector;
    }

    return fallbackSelector;
  };

  const allElements = Array.from(document.querySelectorAll('body *'));
  const relevant = allElements.filter((el) => {
    try {
      return isObservationRelevant(el);
    } catch {
      return false;
    }
  });
  const relevantSet = new Set(relevant);

  const deduped = relevant.filter((el) => {
    try {
      const semantic = getObservationSemanticText(el);
      for (const descendant of el.querySelectorAll('*')) {
        if (!relevantSet.has(descendant)) continue;
        if (getObservationSemanticText(descendant) === semantic) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  const chosen = Number.isFinite(maxItems)
    ? deduped.slice(0, maxItems)
    : deduped;

  const shortIdFor = (index: number) => `E${index + 1}`;

  return chosen.flatMap((el, index) => {
    try {
      const shortId = shortIdFor(index);
      const rect = el.getBoundingClientRect();
      const pageRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
      const tagName = tagNameOf(el);
      const semanticText = getObservationSemanticText(el);
      const textPreview = semanticText.slice(0, 80) || null;
      const selectOptions =
        tagName === 'select'
          ? Array.from(el.querySelectorAll('option'))
              .map((option) => ({
                value: option.value,
                label: normalizeText(option.textContent ?? ''),
              }))
              .filter((option) => option.value.length > 0)
          : [];

      return [
        {
          index,
          shortId,
          locator: null,
          selector: getStableSelector(el),
          score: 0,
          labelShown: false,
          tagName,
          id: el.id || null,
          role: getElementRole(el),
          name: el.getAttribute('name'),
          ariaLabel: el.getAttribute('aria-label'),
          textPreview,
          boundingBox: {
            x: pageRect.left,
            y: pageRect.top,
            width: pageRect.width,
            height: pageRect.height,
          },
          ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
        },
      ];
    } catch {
      return [];
    }
  });
}

export type PaintAdditionalLabelItem = {
  shortId: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

/** Paints Set-of-Marks overlays for inventory items missed during the primary DOM pass. */
export function paintAdditionalInventoryLabels(
  items: PaintAdditionalLabelItem[],
): string[] {
  const overlayClassName = 'metamorph-selector-overlay';
  const highlightClassName = 'metamorph-highlight-overlay';
  const legendId = 'metamorph-selector-legend';

  let overlayRoot = document.getElementById(legendId) as HTMLDivElement | null;
  const pageWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
    window.innerWidth,
  );
  const pageHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    window.innerHeight,
  );

  if (!overlayRoot) {
    overlayRoot = document.createElement('div');
    overlayRoot.id = legendId;
    overlayRoot.style.position = 'absolute';
    overlayRoot.style.left = '0';
    overlayRoot.style.top = '0';
    overlayRoot.style.width = `${pageWidth}px`;
    overlayRoot.style.height = `${pageHeight}px`;
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.zIndex = '2147483645';
    document.body.appendChild(overlayRoot);
  }

  const labelThemes = [
    { border: 'rgba(0, 123, 255, 0.95)', background: 'rgba(0, 123, 255, 0.90)' },
    { border: 'rgba(0, 168, 120, 0.95)', background: 'rgba(0, 168, 120, 0.90)' },
    { border: 'rgba(245, 158, 11, 0.95)', background: 'rgba(245, 158, 11, 0.90)' },
    { border: 'rgba(239, 68, 68, 0.95)', background: 'rgba(239, 68, 68, 0.90)' },
    { border: 'rgba(14, 165, 233, 0.95)', background: 'rgba(14, 165, 233, 0.90)' },
    { border: 'rgba(16, 185, 129, 0.95)', background: 'rgba(16, 185, 129, 0.90)' },
    { border: 'rgba(217, 119, 6, 0.95)', background: 'rgba(217, 119, 6, 0.90)' },
    { border: 'rgba(99, 102, 241, 0.95)', background: 'rgba(99, 102, 241, 0.90)' },
  ];

  const viewportLeft = window.scrollX;
  const viewportTop = window.scrollY;
  const viewportRight = viewportLeft + window.innerWidth;
  const viewportBottom = viewportTop + window.innerHeight;

  const placedRects: Array<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> = [];

  const labeledElementRects: Array<{
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  }> = [];

  const overlaps = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
  ) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

  const placeLabel = (rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) => {
    const labelWidth = 34;
    const labelHeight = 16;
    const placements = [
      [0, -18],
      [0, 0],
      [0, 18],
      [42, -18],
      [42, 0],
      [-42, -18],
      [-42, 0],
      [84, 0],
      [-84, 0],
      [0, 36],
    ] as const;

    for (const [dx, dy] of placements) {
      const left = Math.max(
        2,
        Math.min(rect.left + dx, pageWidth - labelWidth - 2),
      );
      const top = Math.max(2, rect.top + dy);
      const candidate = {
        left,
        top,
        right: left + labelWidth,
        bottom: top + labelHeight,
      };

      if (!placedRects.some((existing) => overlaps(candidate, existing))) {
        placedRects.push(candidate);
        return candidate;
      }
    }

    return null;
  };

  const getIntersectionArea = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
  ) => {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
  };

  const isOverlappingImportantElement = (rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  }) => {
    const area = Math.max(1, rect.width * rect.height);
    return labeledElementRects.some((existing) => {
      const intersection = getIntersectionArea(rect, existing);
      return intersection / area >= 0.35;
    });
  };

  const isInViewport = (rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) =>
    rect.right > viewportLeft &&
    rect.left < viewportRight &&
    rect.bottom > viewportTop &&
    rect.top < viewportBottom;

  const painted: string[] = [];

  for (const [index, item] of items.entries()) {
    const pageRect = {
      left: item.boundingBox.x,
      top: item.boundingBox.y,
      right: item.boundingBox.x + item.boundingBox.width,
      bottom: item.boundingBox.y + item.boundingBox.height,
      width: item.boundingBox.width,
      height: item.boundingBox.height,
    };

    if (!isInViewport(pageRect)) {
      continue;
    }

    const shouldHideByElementOverlap = isOverlappingImportantElement(pageRect);
    if (shouldHideByElementOverlap) {
      continue;
    }

    const position = placeLabel(pageRect);
    if (!position) {
      continue;
    }

    labeledElementRects.push(pageRect);
    const theme = labelThemes[index % labelThemes.length]!;

    const highlight = document.createElement('div');
    highlight.className = highlightClassName;
    highlight.style.position = 'absolute';
    highlight.style.left = `${Math.max(0, pageRect.left)}px`;
    highlight.style.top = `${Math.max(0, pageRect.top)}px`;
    highlight.style.width = `${Math.max(2, pageRect.width)}px`;
    highlight.style.height = `${Math.max(2, pageRect.height)}px`;
    highlight.style.border = `2px solid ${theme.border}`;
    highlight.style.boxSizing = 'border-box';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '2147483646';
    overlayRoot.appendChild(highlight);

    const label = document.createElement('div');
    label.className = overlayClassName;
    label.textContent = item.shortId;
    label.style.position = 'absolute';
    label.style.padding = '2px 4px';
    label.style.borderRadius = '3px';
    label.style.background = theme.background;
    label.style.border = `1px solid ${theme.border}`;
    label.style.boxShadow = `0 1px 2px rgba(15, 23, 42, 0.35), 0 0 0 1px ${theme.border}`;
    label.style.color = '#fff';
    label.style.font = '11px/1.1 monospace';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '2147483647';
    label.style.left = `${position.left}px`;
    label.style.top = `${position.top}px`;
    overlayRoot.appendChild(label);
    painted.push(item.shortId);
  }

  return painted;
}

/** Removes Set-of-Marks overlays so later traced actions show a clean page. */
export function removeInventoryLabels(): void {
  const overlayClassName = 'metamorph-selector-overlay';
  const highlightClassName = 'metamorph-highlight-overlay';
  const legendId = 'metamorph-selector-legend';

  document
    .querySelectorAll(`.${overlayClassName}, .${highlightClassName}`)
    .forEach((node) => node.remove());
  document.getElementById(legendId)?.remove();
}
