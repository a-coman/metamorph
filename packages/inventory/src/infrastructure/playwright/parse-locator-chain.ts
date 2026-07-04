import type { Frame, FrameLocator, Locator, Page } from 'playwright';

type RoleOptions = {
  name?: string;
  exact?: boolean;
};

type LocatorSegment =
  | { kind: 'frameLocator'; selector: string }
  | { kind: 'locator'; selector: string }
  | { kind: 'getByRole'; role: string; options?: RoleOptions }
  | { kind: 'getByLabel'; label: string; exact?: boolean }
  | { kind: 'getByTestId'; testId: string }
  | { kind: 'nth'; index: number };

type LocatorRoot = Page | Frame | Locator;

export type { LocatorRoot };

function parseJsonString(value: string): string {
  return JSON.parse(value) as string;
}

function extractFirstStringLiteral(
  input: string,
): { literal: string; rest: string } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
  if (!match) return null;
  return { literal: match[0]!, rest: trimmed.slice(match[0]!.length).trim() };
}

function parseRoleOptions(optionsLiteral: string): RoleOptions {
  const options: RoleOptions = {};
  const nameMatch = /name:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/.exec(optionsLiteral);
  if (nameMatch) {
    options.name = parseJsonString(nameMatch[1]!);
  }
  if (/exact:\s*true/.test(optionsLiteral)) {
    options.exact = true;
  }
  return options;
}

function parseCallArguments(args: string): {
  firstLiteral: string;
  optionsLiteral: string | null;
} {
  const first = extractFirstStringLiteral(args);
  if (!first) {
    throw new Error(`Expected quoted string argument in: ${args}`);
  }

  let rest = first.rest;
  if (rest.startsWith(',')) {
    rest = rest.slice(1).trim();
  }

  if (rest.startsWith('{')) {
    let depth = 0;
    let end = -1;
    for (let index = 0; index < rest.length; index += 1) {
      const char = rest[index]!;
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end >= 0) {
      return {
        firstLiteral: first.literal,
        optionsLiteral: rest.slice(0, end + 1),
      };
    }
  }

  return { firstLiteral: first.literal, optionsLiteral: null };
}

function parseSegment(segment: string): LocatorSegment {
  const trimmed = segment.trim();

  const nthMatch = /^nth\((\d+)\)$/.exec(trimmed);
  if (nthMatch) {
    return { kind: 'nth', index: Number(nthMatch[1]) };
  }

  const frameMatch = /^frameLocator\((.*)\)$/.exec(trimmed);
  if (frameMatch) {
    const { firstLiteral } = parseCallArguments(frameMatch[1]!);
    return { kind: 'frameLocator', selector: parseJsonString(firstLiteral) };
  }

  const locatorMatch = /^locator\((.*)\)$/.exec(trimmed);
  if (locatorMatch) {
    const { firstLiteral } = parseCallArguments(locatorMatch[1]!);
    return { kind: 'locator', selector: parseJsonString(firstLiteral) };
  }

  const roleMatch = /^getByRole\((.*)\)$/.exec(trimmed);
  if (roleMatch) {
    const { firstLiteral, optionsLiteral } = parseCallArguments(roleMatch[1]!);
    return {
      kind: 'getByRole',
      role: parseJsonString(firstLiteral),
      options: optionsLiteral ? parseRoleOptions(optionsLiteral) : undefined,
    };
  }

  const labelMatch = /^getByLabel\((.*)\)$/.exec(trimmed);
  if (labelMatch) {
    const { firstLiteral, optionsLiteral } = parseCallArguments(labelMatch[1]!);
    const exact = optionsLiteral ? /exact:\s*true/.test(optionsLiteral) : false;
    return {
      kind: 'getByLabel',
      label: parseJsonString(firstLiteral),
      exact,
    };
  }

  const testIdMatch = /^getByTestId\((.*)\)$/.exec(trimmed);
  if (testIdMatch) {
    const { firstLiteral } = parseCallArguments(testIdMatch[1]!);
    return { kind: 'getByTestId', testId: parseJsonString(firstLiteral) };
  }

  throw new Error(`Unsupported locator segment: ${segment}`);
}

export function parseLocatorSegments(locatorChain: string): LocatorSegment[] {
  const segments: LocatorSegment[] = [];
  let buffer = '';
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escaped = false;

  for (const char of locatorChain) {
    if (inString) {
      buffer += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      buffer += char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    if (char === '.' && depth === 0) {
      if (buffer.trim()) {
        segments.push(parseSegment(buffer));
      }
      buffer = '';
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) {
    segments.push(parseSegment(buffer));
  }

  if (segments.length === 0) {
    throw new Error(`Empty locator chain: ${locatorChain}`);
  }

  return segments;
}

function applySegment(
  base: LocatorRoot | FrameLocator,
  segment: LocatorSegment,
): Locator | FrameLocator {
  switch (segment.kind) {
    case 'frameLocator': {
      if (!('frameLocator' in base)) {
        throw new Error('frameLocator requires a Page root');
      }
      return (base as Page).frameLocator(segment.selector);
    }
    case 'locator':
      return (base as Locator).locator(segment.selector);
    case 'getByRole': {
      const target = 'getByRole' in base ? base : (base as Page);
      if (segment.options?.name !== undefined) {
        return target.getByRole(segment.role as Parameters<Page['getByRole']>[0], {
          name: segment.options.name,
          exact: segment.options.exact ?? false,
        });
      }
      return target.getByRole(segment.role as Parameters<Page['getByRole']>[0]);
    }
    case 'getByLabel': {
      const target = 'getByLabel' in base ? base : (base as Page);
      return target.getByLabel(segment.label, { exact: segment.exact ?? false });
    }
    case 'getByTestId': {
      const target = 'getByTestId' in base ? base : (base as Page);
      return target.getByTestId(segment.testId);
    }
    case 'nth':
      return (base as Locator).nth(segment.index);
    default:
      throw new Error('Unhandled locator segment');
  }
}

export function buildLocatorFromChain(root: LocatorRoot, locatorChain: string): Locator {
  const segments = parseLocatorSegments(locatorChain);
  let current: LocatorRoot | FrameLocator = root;

  for (const segment of segments) {
    current = applySegment(current, segment);
  }

  return current as Locator;
}

export function formatGetByRoleLocator(
  role: string,
  name: string,
  options?: { exact?: boolean; scopeChain?: string },
): string {
  const exact = options?.exact ?? true;
  const roleLocator = `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)}, exact: ${exact} })`;
  if (options?.scopeChain) {
    return `${options.scopeChain}.${roleLocator}`;
  }
  return roleLocator;
}

export function formatFrameLocatorChain(iframeSelector: string, innerChain: string): string {
  return `${formatFrameLocator(iframeSelector)}.${innerChain}`;
}

export function formatFrameLocator(iframeSelector: string): string {
  return `frameLocator(${JSON.stringify(iframeSelector)})`;
}

export function formatLocatorSegment(selector: string): string {
  return `locator(${JSON.stringify(selector)})`;
}
