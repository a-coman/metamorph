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
    scanAndLabelPage: () => scanAndLabelPage
  });
  function scanAndLabelPage(options) {
    const { maxItems } = options;
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
    const isVisibleEnough = (el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false;
      if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
      let curr = el;
      while (curr && curr !== document.documentElement && curr !== document.body) {
        const style = window.getComputedStyle(curr);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || curr.getAttribute("aria-hidden") === "true") {
          return false;
        }
        if (style.overflow !== "visible" && style.overflow !== "") {
          const parentRect = curr.getBoundingClientRect();
          if (parentRect.width === 0 || parentRect.height === 0) return false;
          if (Math.ceil(rect.bottom) <= Math.floor(parentRect.top) || Math.floor(rect.top) >= Math.ceil(parentRect.bottom) || Math.ceil(rect.right) <= Math.floor(parentRect.left) || Math.floor(rect.left) >= Math.ceil(parentRect.right)) {
            return false;
          }
        }
        curr = curr.parentElement;
      }
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
      const inTopNav = Boolean(
        el.closest(
          'header, nav, [role="navigation"], [id*="nav" i], [class*="nav" i]'
        )
      );
      if (inTopNav && rect.top > 120) {
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
    const getImplicitRole = (el) => {
      const tagName = el.tagName.toLowerCase();
      if (tagName === "a" && el.hasAttribute("href")) return "link";
      if (tagName === "button") return "button";
      if (tagName === "input") {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (type === "search") return "searchbox";
        if (type === "checkbox") return "checkbox";
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
      if (role && accessibleName) {
        return `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(accessibleName)} })`;
      }
      if (tagName === "a" && accessibleName) {
        return `getByRole("link", { name: ${JSON.stringify(accessibleName)} })`;
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
      const role = el.getAttribute("role");
      if (role && [
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "menuitem",
        "tab"
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
      if (role && [
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "menuitem",
        "tab"
      ].includes(role)) {
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
      return false;
    };
    const scoreElement = (el) => {
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || "";
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      const inTopNav = Boolean(
        el.closest(
          'header, nav, [role="navigation"], [id*="nav" i], [class*="nav" i]'
        )
      );
      const inCookieLayer = Boolean(
        el.closest(
          "[role='dialog'], [aria-modal='true'], [id*='consent' i], [class*='cookie' i], [class*='consent' i]"
        )
      );
      let score = 0;
      if (el.getAttribute("data-testid")) score += 120;
      if (el.id) score += 100;
      if (el.getAttribute("name")) score += 70;
      if (el.getAttribute("aria-label")) score += 70;
      if (["button", "input", "select", "textarea"].includes(tagName)) score += 60;
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
      "a",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='menuitem']",
      "[role='tab']",
      "[role='combobox']",
      "[role='searchbox']",
      "[data-testid]",
      "[aria-label]",
      "[onclick]:not([onclick=''])"
    ].join(", ");
    const allCandidates = Array.from(document.querySelectorAll(candidateSelector));
    const cursorCandidates = Array.from(document.querySelectorAll("body *")).filter(
      isTopmostPointerElement
    );
    const seenNodes = /* @__PURE__ */ new Set();
    const uniqueCandidates = [...allCandidates, ...cursorCandidates].filter((el) => {
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
      if ([
        "button",
        "link",
        "textbox",
        "combobox",
        "searchbox",
        "checkbox",
        "menuitem",
        "tab"
      ].includes(role)) {
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
    const chosen = filteredCandidates.slice(0, maxItems);
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
    const shortIdFor = (index) => `E${String(index + 1).padStart(2, "0")}`;
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
    const overlayRoot = document.createElement("div");
    overlayRoot.id = legendId;
    overlayRoot.style.position = "absolute";
    overlayRoot.style.left = "0";
    overlayRoot.style.top = "0";
    overlayRoot.style.width = `${pageWidth}px`;
    overlayRoot.style.height = `${pageHeight}px`;
    overlayRoot.style.pointerEvents = "none";
    overlayRoot.style.zIndex = "2147483645";
    document.body.appendChild(overlayRoot);
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
        const position = shouldHideByElementOverlap ? null : placeLabel(pageRect) ?? {
          left: Math.max(2, pageRect.left + 4),
          top: Math.max(2, pageRect.top + 4),
          right: Math.max(2, pageRect.left + 38),
          bottom: Math.max(2, pageRect.top + 20)
        };
        const theme = labelThemes[index % labelThemes.length];
        if (position && !shouldHideByElementOverlap) {
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
        return {
          index,
          shortId,
          locator,
          selector,
          score,
          labelShown: Boolean(position && !shouldHideByElementOverlap),
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          role: el.getAttribute("role"),
          name: el.getAttribute("name"),
          ariaLabel: el.getAttribute("aria-label"),
          textPreview: textPreview || null,
          ...selectorMatchCount !== void 0 ? { selectorMatchCount } : {},
          ...locatorMatchCount !== void 0 ? { locatorMatchCount } : {},
          boundingBox: {
            x: pageRect.left,
            y: pageRect.top,
            width: pageRect.width,
            height: pageRect.height
          }
        };
      }
    );
  }
  return __toCommonJS(inventory_browser_exports);
})();
