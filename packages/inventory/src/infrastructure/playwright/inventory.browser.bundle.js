"use strict";
var __metamorphInventory = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/infrastructure/playwright/inventory.browser.ts
  var inventory_browser_exports = {};
  __export(inventory_browser_exports, {
    paintAdditionalInventoryLabels: () => paintAdditionalInventoryLabels,
    scanAndLabelPage: () => scanAndLabelPage
  });
  function scanAndLabelPage(options = {}) {
    const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
    const paintLabels = options.paintLabels ?? false;
    const overlayClassName = "metamorph-selector-overlay";
    const highlightClassName = "metamorph-highlight-overlay";
    const legendId = "metamorph-selector-legend";
    document.querySelectorAll(`.${overlayClassName}, .${highlightClassName}`).forEach((node) => node.remove());
    document.getElementById(legendId)?.remove();
    const escapeCssString = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ").replace(/\r/g, "\\D ").replace(/\f/g, "\\C ");
    const cssEscape = (value) => {
      const text = String(value);
      if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(text);
      }
      return text.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
    };
    const selectorMatchesUniquely = (selector, element) => {
      if (!selector) return false;
      try {
        const matches = document.querySelectorAll(selector);
        return matches.length === 1 && matches[0] === element;
      } catch {
        return false;
      }
    };
    const hasPointerCursor = (el) => window.getComputedStyle(el).cursor === "pointer";
    const isTopmostPointerElement = (el) => hasPointerCursor(el) && (!el.parentElement || !hasPointerCursor(el.parentElement));
    const calendarScopeSelector = [
      "[role='dialog']",
      "[role='grid']",
      "[aria-modal='true']",
      "[id*='calendar' i]",
      "[id*='datepicker' i]",
      "[data-testid*='calendar' i]",
      "[data-testid*='datepicker' i]"
    ].join(", ");
    const headerNavChromeSelector = 'header, nav, [role="navigation"], [id*="nav" i], [class*="nav" i]';
    const filterPanelSelector = 'aside, [role="complementary"], fieldset, [role="search"]';
    const isInFilterPanel = (el) => Boolean(el.closest(filterPanelSelector));
    const isInCalendarScope = (el) => Boolean(el.closest(calendarScopeSelector));
    const isHeaderNavChrome = (el) => {
      if (!el.closest(headerNavChromeSelector)) return false;
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || "";
      if (["a", "button", "input", "select", "textarea"].includes(tagName)) {
        return true;
      }
      if (["link", "menuitem", "tab", "button"].includes(role)) {
        return true;
      }
      return false;
    };
    const rectsIntersect = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const isVisibleEnough = (el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false;
      if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
      let curr = el;
      while (curr && curr !== document.documentElement && curr !== document.body) {
        const style = window.getComputedStyle(curr);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || curr.getAttribute("aria-hidden") === "true") {
          return false;
        }
        if (style.overflow !== "visible" && style.overflow !== "") {
          const parentRect = curr.getBoundingClientRect();
          if (parentRect.width === 0 || parentRect.height === 0) return false;
          const elementRect = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
          };
          const clipRect = {
            left: parentRect.left,
            top: parentRect.top,
            right: parentRect.right,
            bottom: parentRect.bottom
          };
          if (!rectsIntersect(elementRect, clipRect)) {
            return false;
          }
        }
        curr = curr.parentElement;
      }
      const relaxHitTest = (() => {
        const tagName = el.tagName.toLowerCase();
        const type = (el.getAttribute("type") || "").toLowerCase();
        const role = el.getAttribute("role") || "";
        const isChoice = ["checkbox", "radio"].includes(role) || tagName === "input" && ["checkbox", "radio"].includes(type);
        return isChoice && isInFilterPanel(el);
      })();
      if (!relaxHitTest) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(centerX, centerY);
        if (topEl) {
          const className = typeof topEl.className === "string" ? topEl.className : "";
          if (!className.includes("metamorph-")) {
            if (!el.contains(topEl) && !topEl.contains(el)) {
              return false;
            }
          }
        }
      }
      if (rect.top > 120 && isHeaderNavChrome(el)) {
        return false;
      }
      return true;
    };
    const getAccessibleName = (el) => {
      const ariaLabel = (el.getAttribute("aria-label") || "").trim();
      const title = (el.getAttribute("title") || "").trim();
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      return ariaLabel || title || text;
    };
    const getLabelAssociatedControl = (label) => {
      if (label.tagName.toLowerCase() !== "label") return null;
      const htmlFor = label.getAttribute("for");
      if (htmlFor) {
        return document.getElementById(htmlFor);
      }
      return label.querySelector("input, select, textarea");
    };
    const getLabelDisplayText = (label) => {
      const clone = label.cloneNode(true);
      clone.querySelectorAll("input, select, textarea").forEach((node) => node.remove());
      return (clone.textContent || "").trim().replace(/\s+/g, " ");
    };
    const isChoiceControl = (el) => {
      const tagName = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      const role = el.getAttribute("role") || "";
      if (tagName === "input" && ["checkbox", "radio"].includes(type)) {
        return true;
      }
      return ["checkbox", "radio"].includes(role);
    };
    const isVisuallyHiddenChoiceControl = (el) => {
      if (!isChoiceControl(el)) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return true;
      }
      const clip = style.clip || "";
      if (clip.includes("rect(0") || style.clipPath && style.clipPath !== "none" && style.clipPath.includes("inset")) {
        return true;
      }
      if (rect.width < 10 || rect.height < 10) {
        return true;
      }
      if (el.tagName.toLowerCase() === "input" && style.position === "absolute" && rect.width < 16 && rect.height < 16) {
        return true;
      }
      return false;
    };
    const isHiddenFacetCheckbox = isVisuallyHiddenChoiceControl;
    const isClickableFacetTarget = (el) => {
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || "";
      if (tagName === "label") return true;
      if (tagName === "a" && el.hasAttribute("href")) return true;
      if (["button", "link", "checkbox", "radio"].includes(role)) return true;
      return isTopmostPointerElement(el);
    };
    const getVisibleClickTargetForHiddenControl = (control) => {
      const id = control.id;
      if (id) {
        const associated = document.querySelector(`label[for="${cssEscape(id)}"]`);
        if (associated && isClickableFacetTarget(associated) && isVisibleEnough(associated)) {
          return associated;
        }
      }
      const parentLabel = control.closest("label");
      if (parentLabel && isClickableFacetTarget(parentLabel) && isVisibleEnough(parentLabel)) {
        return parentLabel;
      }
      const labelledBy = control.getAttribute("aria-labelledby");
      if (labelledBy) {
        for (const labelId of labelledBy.split(/\s+/)) {
          const trimmed = labelId.trim();
          if (!trimmed) continue;
          const labelEl = document.getElementById(trimmed);
          if (labelEl && isClickableFacetTarget(labelEl) && isVisibleEnough(labelEl)) {
            return labelEl;
          }
        }
      }
      const wrappingInteractive = control.closest(
        'a[href], button, [role="button"], [role="link"], [role="checkbox"], [role="radio"]'
      );
      if (wrappingInteractive && wrappingInteractive !== control && isClickableFacetTarget(wrappingInteractive) && isVisibleEnough(wrappingInteractive)) {
        return wrappingInteractive;
      }
      const row = control.closest('li, [role="listitem"]');
      if (row) {
        const rowSelectors = [
          "label",
          "a[href]",
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="link"]',
          '[role="button"]'
        ].join(", ");
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
    const resolveChoiceClickTarget = (control) => {
      if (isVisuallyHiddenChoiceControl(control)) {
        return getVisibleClickTargetForHiddenControl(control);
      }
      if (isClickableFacetTarget(control) && isVisibleEnough(control)) {
        return control;
      }
      const row = control.closest('li, [role="listitem"]');
      if (row) {
        const rowSelectors = [
          "label",
          "a[href]",
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="link"]',
          '[role="button"]'
        ].join(", ");
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
    const getVisibleLabelForHiddenControl = getVisibleClickTargetForHiddenControl;
    const getImplicitRole = (el) => {
      const tagName = el.tagName.toLowerCase();
      if (tagName === "a" && el.hasAttribute("href")) return "link";
      if (tagName === "button") return "button";
      if (tagName === "input") {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (type === "search") return "searchbox";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        return "textbox";
      }
      if (tagName === "select") return "combobox";
      if (tagName === "textarea") return "textbox";
      return null;
    };
    const getElementRole = (el) => el.getAttribute("role") || getImplicitRole(el);
    const accessibleNameMatches = (candidateName, queryName) => {
      const normalizedCandidate = candidateName.trim().toLowerCase();
      const normalizedQuery = queryName.trim().toLowerCase();
      return normalizedCandidate.includes(normalizedQuery);
    };
    const elementMatchesRoleAndName = (el, role, name) => getElementRole(el) === role && accessibleNameMatches(getAccessibleName(el), name);
    const countSelectorMatches = (selector) => {
      try {
        return document.querySelectorAll(selector).length;
      } catch {
        return void 0;
      }
    };
    const countByRoleAndName = (role, name) => {
      const candidates = document.querySelectorAll(
        "[role], button, a[href], input, select, textarea"
      );
      let count = 0;
      for (const el of candidates) {
        if (elementMatchesRoleAndName(el, role, name)) {
          count += 1;
        }
      }
      return count;
    };
    const countByLabel = (label) => {
      const candidates = document.querySelectorAll(
        "button, input, select, textarea"
      );
      let count = 0;
      for (const el of candidates) {
        const ariaLabel = (el.getAttribute("aria-label") || "").trim();
        if (ariaLabel && accessibleNameMatches(ariaLabel, label)) {
          count += 1;
        }
      }
      return count;
    };
    const countLocatorMatches = (locator) => {
      const testIdMatch = /^getByTestId\((.+)\)$/.exec(locator);
      if (testIdMatch) {
        try {
          const testId = JSON.parse(testIdMatch[1]);
          return document.querySelectorAll(
            `[data-testid="${escapeCssString(testId)}"]`
          ).length;
        } catch {
          return void 0;
        }
      }
      const roleMatch = /^getByRole\((.+), \{ name: (.+) \}\)$/.exec(locator);
      if (roleMatch) {
        try {
          const role = JSON.parse(roleMatch[1]);
          const name = JSON.parse(roleMatch[2]);
          return countByRoleAndName(role, name);
        } catch {
          return void 0;
        }
      }
      const labelMatch = /^getByLabel\((.+)\)$/.exec(locator);
      if (labelMatch) {
        try {
          const label = JSON.parse(labelMatch[1]);
          return countByLabel(label);
        } catch {
          return void 0;
        }
      }
      return void 0;
    };
    const buildPreferredLocator = (el) => {
      const tagName = el.tagName.toLowerCase();
      const testId = el.getAttribute("data-testid");
      if (testId) {
        return `getByTestId(${JSON.stringify(testId)})`;
      }
      const role = el.getAttribute("role");
      const accessibleName = getAccessibleName(el);
      const ariaLabel = (el.getAttribute("aria-label") || "").trim();
      const implicitRole = getElementRole(el);
      if (implicitRole && accessibleName) {
        return `getByRole(${JSON.stringify(implicitRole)}, { name: ${JSON.stringify(accessibleName)} })`;
      }
      if (role && accessibleName) {
        return `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(accessibleName)} })`;
      }
      if (tagName === "a" && accessibleName) {
        return `getByRole("link", { name: ${JSON.stringify(accessibleName)} })`;
      }
      if (tagName === "label") {
        const labelText = getLabelDisplayText(el);
        const control = getLabelAssociatedControl(el);
        if (labelText && control) {
          const controlRole = getElementRole(control);
          if (controlRole === "checkbox" || controlRole === "radio") {
            return `getByRole(${JSON.stringify(controlRole)}, { name: ${JSON.stringify(labelText)} })`;
          }
          return `getByLabel(${JSON.stringify(labelText)})`;
        }
      }
      if (["button", "input", "select", "textarea"].includes(tagName) && ariaLabel) {
        return `getByLabel(${JSON.stringify(ariaLabel)})`;
      }
      return null;
    };
    const buildSelectorCandidates = (el) => {
      const tagName = el.tagName.toLowerCase();
      const candidates = [];
      const testId = el.getAttribute("data-testid");
      if (testId) {
        candidates.push(`[data-testid="${escapeCssString(testId)}"]`);
      }
      if (el.id) {
        candidates.push(`#${cssEscape(el.id)}`);
      }
      const name = el.getAttribute("name");
      if (name && ["input", "select", "textarea", "button"].includes(tagName)) {
        candidates.push(`${tagName}[name="${escapeCssString(name)}"]`);
      }
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) {
        candidates.push(
          `${tagName}[aria-label="${escapeCssString(ariaLabel)}"]`
        );
      }
      const dataDate = el.getAttribute("data-date");
      if (dataDate) {
        candidates.push(`[data-date="${escapeCssString(dataDate)}"]`);
      }
      const role = el.getAttribute("role");
      if (role && [
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "radio",
        "menuitem",
        "tab",
        "gridcell"
      ].includes(role)) {
        candidates.push(`${tagName}[role="${escapeCssString(role)}"]`);
      }
      const type = el.getAttribute("type");
      if (tagName === "input" && type) {
        candidates.push(`input[type="${escapeCssString(type)}"]`);
      }
      const title = el.getAttribute("title");
      if (title) {
        candidates.push(`${tagName}[title="${escapeCssString(title)}"]`);
      }
      if (tagName === "a") {
        const href = el.getAttribute("href");
        if (href) {
          candidates.push(`a[href="${escapeCssString(href)}"]`);
        }
      }
      return candidates;
    };
    const buildFallbackPathSelector = (el) => {
      const segments = [];
      let node = el;
      while (node && node !== document.documentElement) {
        const tagName = node.tagName.toLowerCase();
        if (node.id) {
          segments.unshift(`#${cssEscape(node.id)}`);
          break;
        }
        const parent = node.parentElement;
        let segment = tagName;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (child) => child.tagName === node.tagName
          );
          if (siblings.length > 1) {
            segment = `${tagName}:nth-of-type(${siblings.indexOf(node) + 1})`;
          }
        }
        segments.unshift(segment);
        node = parent;
      }
      return segments.join(" > ") || el.tagName.toLowerCase();
    };
    const getStableSelector = (el) => {
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
    const isTestingRelevant = (el) => {
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      const style = window.getComputedStyle(el);
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
      if (!isVisible) return false;
      const className = typeof el.className === "string" ? el.className : "";
      if (className.includes("metamorph-")) {
        return false;
      }
      if (isTopmostPointerElement(el)) return true;
      if (["button", "input", "select", "textarea"].includes(tagName)) return true;
      if (tagName === "label") {
        const control = getLabelAssociatedControl(el);
        if (!control) return false;
        return getLabelDisplayText(el).length > 0;
      }
      if (role && [
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "radio",
        "menuitem",
        "tab",
        "gridcell"
      ].includes(role)) {
        return true;
      }
      if (el.getAttribute("data-date")) {
        return true;
      }
      if (tagName === "a") {
        const hasHref = Boolean(el.getAttribute("href"));
        if (!hasHref) return false;
        const hasAria = Boolean(el.getAttribute("aria-label"));
        const hasImage = el.querySelector("img") !== null;
        if (text.length === 0 && !hasAria && !hasImage) return false;
        return true;
      }
      if (el.getAttribute("data-testid") || el.onclick != null) {
        return true;
      }
      if (isHiddenFacetCheckbox(el) && getVisibleClickTargetForHiddenControl(el)) {
        return false;
      }
      return false;
    };
    const isLabelForChoiceControl = (el) => {
      if (el.tagName.toLowerCase() !== "label") return false;
      const control = getLabelAssociatedControl(el);
      if (!control) return false;
      const controlRole = getElementRole(control);
      return controlRole === "checkbox" || controlRole === "radio";
    };
    const scoreElement = (el) => {
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || "";
      const effectiveRole = getElementRole(el) || "";
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      const inTopNav = Boolean(el.closest(headerNavChromeSelector));
      const inCookieLayer = Boolean(
        el.closest(
          "[role='dialog'], [aria-modal='true'], [id*='consent' i], [class*='cookie' i], [class*='consent' i]"
        )
      );
      const inCalendarScope = isInCalendarScope(el);
      let score = 0;
      if (el.getAttribute("data-testid")) score += 120;
      if (el.id) score += 100;
      if (el.getAttribute("name")) score += 70;
      if (el.getAttribute("aria-label")) score += 70;
      if (el.getAttribute("data-date")) score += 55;
      if (role === "gridcell") score += 45;
      if (inCalendarScope && (el.getAttribute("data-date") || role === "gridcell")) {
        score += 100;
      }
      if (["button", "input", "select", "textarea"].includes(tagName)) score += 60;
      if (isLabelForChoiceControl(el)) {
        score += 60;
      }
      if (effectiveRole === "checkbox" || effectiveRole === "radio") {
        score += 55;
        if (isInFilterPanel(el)) {
          score += 85;
        }
      }
      if (isTopmostPointerElement(el)) score += 55;
      if (el.getAttribute("role")) score += 40;
      if (inTopNav) score += 120;
      if (inCookieLayer) score += 90;
      if (tagName === "a") score += 25;
      if (text.length >= 2 && text.length <= 40) score += 20;
      if (rect.width * rect.height > 1800) score += 10;
      if ((el.getAttribute("href") || "").startsWith("#")) score -= 15;
      if (role === "navigation" || role === "main" || role === "banner") {
        score -= 140;
      }
      if (["div", "section", "article", "nav"].includes(tagName) && !el.onclick) {
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
      "[onclick]:not([onclick=''])"
    ].join(", ");
    const allCandidates = Array.from(document.querySelectorAll(candidateSelector));
    const cursorCandidates = Array.from(document.querySelectorAll("body *")).filter(
      isTopmostPointerElement
    );
    const choiceClickTargets = Array.from(
      document.querySelectorAll(
        'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]'
      )
    ).map((control) => resolveChoiceClickTarget(control)).filter((target) => target !== null);
    const seenNodes = /* @__PURE__ */ new Set();
    const uniqueCandidates = [
      ...allCandidates,
      ...cursorCandidates,
      ...choiceClickTargets
    ].filter((el) => {
      if (seenNodes.has(el)) return false;
      seenNodes.add(el);
      return true;
    });
    const scoredCandidates = uniqueCandidates.filter(isVisibleEnough).filter(isTestingRelevant).map((el) => ({
      el,
      locator: buildPreferredLocator(el),
      selector: getStableSelector(el),
      score: scoreElement(el)
    })).sort((a, b) => b.score - a.score);
    const scoredCandidateByElement = new Map(
      scoredCandidates.map((candidate) => [candidate.el, candidate])
    );
    const isStrongInteractiveCandidate = (candidate) => {
      const tagName = candidate.el.tagName.toLowerCase();
      const role = candidate.el.getAttribute("role") || "";
      if (["a", "button", "input", "select", "textarea"].includes(tagName)) {
        return true;
      }
      if (isLabelForChoiceControl(candidate.el)) {
        return true;
      }
      if ([
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "radio",
        "menuitem",
        "tab",
        "gridcell"
      ].includes(role)) {
        return true;
      }
      if (candidate.el.getAttribute("data-date")) {
        return true;
      }
      return isTopmostPointerElement(candidate.el);
    };
    const containsRect = (outer, inner) => outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;
    const filteredCandidates = scoredCandidates.filter((candidate) => {
      const candidateRect = candidate.el.getBoundingClientRect();
      let parent = candidate.el.parentElement;
      while (parent && parent !== document.documentElement) {
        const ancestorCandidate = scoredCandidateByElement.get(parent);
        if (ancestorCandidate) {
          const ancestorRect = ancestorCandidate.el.getBoundingClientRect();
          const ancestorArea = Math.max(1, ancestorRect.width * ancestorRect.height);
          const candidateArea = Math.max(1, candidateRect.width * candidateRect.height);
          if (isStrongInteractiveCandidate(ancestorCandidate) && containsRect(ancestorRect, candidateRect) && ancestorArea >= candidateArea * 1.25) {
            return false;
          }
        }
        parent = parent.parentElement;
      }
      return true;
    });
    const isTier1Control = (candidate) => {
      const tagName = candidate.el.tagName.toLowerCase();
      const role = candidate.el.getAttribute("role") || "";
      const effectiveRole = getElementRole(candidate.el) || "";
      if (["select", "input", "textarea", "button"].includes(tagName)) {
        return true;
      }
      if (isLabelForChoiceControl(candidate.el)) {
        return true;
      }
      return ["combobox", "searchbox", "checkbox", "radio"].includes(role) || ["checkbox", "radio"].includes(effectiveRole);
    };
    const tier1 = filteredCandidates.filter(isTier1Control);
    const tier2 = filteredCandidates.filter((candidate) => !isTier1Control(candidate));
    const orderedCandidates = [...tier1, ...tier2];
    const chosen = Number.isFinite(maxItems) ? orderedCandidates.slice(0, maxItems) : orderedCandidates;
    const chosenWithCounts = chosen.map(({ el, selector, locator, score }) => {
      const selectorMatchCount = countSelectorMatches(selector);
      const locatorMatchCount = locator ? countLocatorMatches(locator) : void 0;
      return {
        el,
        selector,
        locator,
        score,
        selectorMatchCount,
        locatorMatchCount
      };
    });
    const shortIdFor = (index) => `E${index + 1}`;
    const placedRects = [];
    const labeledElementRects = [];
    const overlaps = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    const placeLabel = (rect) => {
      const labelWidth = 34;
      const labelHeight = 16;
      const pageWidth2 = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        window.innerWidth
      );
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
        [0, 36]
      ];
      for (const [dx, dy] of placements) {
        const left = Math.max(
          2,
          Math.min(rect.left + dx, pageWidth2 - labelWidth - 2)
        );
        const top = Math.max(2, rect.top + dy);
        const candidate = {
          left,
          top,
          right: left + labelWidth,
          bottom: top + labelHeight
        };
        if (!placedRects.some((existing) => overlaps(candidate, existing))) {
          placedRects.push(candidate);
          return candidate;
        }
      }
      return null;
    };
    const getIntersectionArea = (a, b) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return width * height;
    };
    const isOverlappingImportantElement = (rect) => {
      const area = Math.max(1, rect.width * rect.height);
      return labeledElementRects.some((existing) => {
        const intersection = getIntersectionArea(rect, existing);
        return intersection / area >= 0.35;
      });
    };
    const labelThemes = [
      { border: "rgba(0, 123, 255, 0.95)", background: "rgba(0, 123, 255, 0.90)" },
      { border: "rgba(0, 168, 120, 0.95)", background: "rgba(0, 168, 120, 0.90)" },
      { border: "rgba(245, 158, 11, 0.95)", background: "rgba(245, 158, 11, 0.90)" },
      { border: "rgba(239, 68, 68, 0.95)", background: "rgba(239, 68, 68, 0.90)" },
      { border: "rgba(14, 165, 233, 0.95)", background: "rgba(14, 165, 233, 0.90)" },
      { border: "rgba(16, 185, 129, 0.95)", background: "rgba(16, 185, 129, 0.90)" },
      { border: "rgba(217, 119, 6, 0.95)", background: "rgba(217, 119, 6, 0.90)" },
      { border: "rgba(99, 102, 241, 0.95)", background: "rgba(99, 102, 241, 0.90)" }
    ];
    const pageWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      window.innerWidth
    );
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight
    );
    let overlayRoot = null;
    if (paintLabels) {
      overlayRoot = document.createElement("div");
      overlayRoot.id = legendId;
      overlayRoot.style.position = "absolute";
      overlayRoot.style.left = "0";
      overlayRoot.style.top = "0";
      overlayRoot.style.width = `${pageWidth}px`;
      overlayRoot.style.height = `${pageHeight}px`;
      overlayRoot.style.pointerEvents = "none";
      overlayRoot.style.zIndex = "2147483645";
      document.body.appendChild(overlayRoot);
    }
    return chosenWithCounts.map(
      ({ el, selector, locator, score, selectorMatchCount, locatorMatchCount }, index) => {
        const shortId = shortIdFor(index);
        const rect = el.getBoundingClientRect();
        const pageRect = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY,
          width: rect.width,
          height: rect.height
        };
        const shouldHideByElementOverlap = isOverlappingImportantElement(pageRect);
        const position = paintLabels && !shouldHideByElementOverlap ? placeLabel(pageRect) ?? {
          left: Math.max(2, pageRect.left + 4),
          top: Math.max(2, pageRect.top + 4),
          right: Math.max(2, pageRect.left + 38),
          bottom: Math.max(2, pageRect.top + 20)
        } : null;
        const theme = labelThemes[index % labelThemes.length];
        if (paintLabels && position && !shouldHideByElementOverlap && overlayRoot) {
          labeledElementRects.push(pageRect);
          const highlight = document.createElement("div");
          highlight.className = highlightClassName;
          highlight.style.position = "absolute";
          highlight.style.left = `${Math.max(0, pageRect.left)}px`;
          highlight.style.top = `${Math.max(0, pageRect.top)}px`;
          highlight.style.width = `${Math.max(2, pageRect.width)}px`;
          highlight.style.height = `${Math.max(2, pageRect.height)}px`;
          highlight.style.border = `2px solid ${theme.border}`;
          highlight.style.boxSizing = "border-box";
          highlight.style.pointerEvents = "none";
          highlight.style.zIndex = "2147483646";
          overlayRoot.appendChild(highlight);
          const label = document.createElement("div");
          label.className = overlayClassName;
          label.textContent = shortId;
          label.style.position = "absolute";
          label.style.padding = "2px 4px";
          label.style.borderRadius = "3px";
          label.style.background = theme.background;
          label.style.border = `1px solid ${theme.border}`;
          label.style.boxShadow = `0 1px 2px rgba(15, 23, 42, 0.35), 0 0 0 1px ${theme.border}`;
          label.style.color = "#fff";
          label.style.font = "11px/1.1 monospace";
          label.style.whiteSpace = "nowrap";
          label.style.pointerEvents = "none";
          label.style.zIndex = "2147483647";
          label.style.left = `${position.left}px`;
          label.style.top = `${position.top}px`;
          overlayRoot.appendChild(label);
        }
        const textPreview = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
        const tagName = el.tagName.toLowerCase();
        const associatedControl = tagName === "label" ? getLabelAssociatedControl(el) : null;
        const labelText = tagName === "label" ? getLabelDisplayText(el) : null;
        const effectiveRole = tagName === "label" && associatedControl ? getElementRole(associatedControl) : getElementRole(el);
        const effectiveTextPreview = labelText && labelText.length > 0 ? labelText.slice(0, 80) : textPreview || null;
        const selectOptions = tagName === "select" ? Array.from(el.querySelectorAll("option")).map((option) => ({
          value: option.value,
          label: (option.textContent ?? "").trim()
        })).filter((option) => option.value.length > 0) : [];
        return {
          index,
          shortId,
          locator,
          selector,
          score,
          labelShown: Boolean(paintLabels && position && !shouldHideByElementOverlap),
          tagName,
          id: el.id || null,
          role: effectiveRole,
          name: el.getAttribute("name"),
          ariaLabel: el.getAttribute("aria-label"),
          textPreview: effectiveTextPreview,
          ...selectorMatchCount !== void 0 ? { selectorMatchCount } : {},
          ...locatorMatchCount !== void 0 ? { locatorMatchCount } : {},
          boundingBox: {
            x: pageRect.left,
            y: pageRect.top,
            width: pageRect.width,
            height: pageRect.height
          },
          ...selectOptions.length > 0 ? { options: selectOptions } : {}
        };
      }
    );
  }
  function paintAdditionalInventoryLabels(items) {
    const overlayClassName = "metamorph-selector-overlay";
    const highlightClassName = "metamorph-highlight-overlay";
    const legendId = "metamorph-selector-legend";
    let overlayRoot = document.getElementById(legendId);
    if (!overlayRoot) {
      const pageWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        window.innerWidth
      );
      const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      );
      overlayRoot = document.createElement("div");
      overlayRoot.id = legendId;
      overlayRoot.style.position = "absolute";
      overlayRoot.style.left = "0";
      overlayRoot.style.top = "0";
      overlayRoot.style.width = `${pageWidth}px`;
      overlayRoot.style.height = `${pageHeight}px`;
      overlayRoot.style.pointerEvents = "none";
      overlayRoot.style.zIndex = "2147483645";
      document.body.appendChild(overlayRoot);
    }
    const labelThemes = [
      { border: "rgba(0, 123, 255, 0.95)", background: "rgba(0, 123, 255, 0.90)" },
      { border: "rgba(0, 168, 120, 0.95)", background: "rgba(0, 168, 120, 0.90)" },
      { border: "rgba(245, 158, 11, 0.95)", background: "rgba(245, 158, 11, 0.90)" },
      { border: "rgba(239, 68, 68, 0.95)", background: "rgba(239, 68, 68, 0.90)" },
      { border: "rgba(14, 165, 233, 0.95)", background: "rgba(14, 165, 233, 0.90)" },
      { border: "rgba(16, 185, 129, 0.95)", background: "rgba(16, 185, 129, 0.90)" },
      { border: "rgba(217, 119, 6, 0.95)", background: "rgba(217, 119, 6, 0.90)" },
      { border: "rgba(99, 102, 241, 0.95)", background: "rgba(99, 102, 241, 0.90)" }
    ];
    const painted = [];
    for (const [index, item] of items.entries()) {
      const pageRect = {
        left: item.boundingBox.x,
        top: item.boundingBox.y,
        right: item.boundingBox.x + item.boundingBox.width,
        bottom: item.boundingBox.y + item.boundingBox.height,
        width: item.boundingBox.width,
        height: item.boundingBox.height
      };
      const theme = labelThemes[index % labelThemes.length];
      const highlight = document.createElement("div");
      highlight.className = highlightClassName;
      highlight.style.position = "absolute";
      highlight.style.left = `${Math.max(0, pageRect.left)}px`;
      highlight.style.top = `${Math.max(0, pageRect.top)}px`;
      highlight.style.width = `${Math.max(2, pageRect.width)}px`;
      highlight.style.height = `${Math.max(2, pageRect.height)}px`;
      highlight.style.border = `2px solid ${theme.border}`;
      highlight.style.boxSizing = "border-box";
      highlight.style.pointerEvents = "none";
      highlight.style.zIndex = "2147483646";
      overlayRoot.appendChild(highlight);
      const label = document.createElement("div");
      label.className = overlayClassName;
      label.textContent = item.shortId;
      label.style.position = "absolute";
      label.style.padding = "2px 4px";
      label.style.borderRadius = "3px";
      label.style.background = theme.background;
      label.style.border = `1px solid ${theme.border}`;
      label.style.boxShadow = `0 1px 2px rgba(15, 23, 42, 0.35), 0 0 0 1px ${theme.border}`;
      label.style.color = "#fff";
      label.style.font = "11px/1.1 monospace";
      label.style.whiteSpace = "nowrap";
      label.style.pointerEvents = "none";
      label.style.zIndex = "2147483647";
      label.style.left = `${Math.max(2, pageRect.left + 4)}px`;
      label.style.top = `${Math.max(2, pageRect.top + 4)}px`;
      overlayRoot.appendChild(label);
      painted.push(item.shortId);
    }
    return painted;
  }
  return __toCommonJS(inventory_browser_exports);
})();
