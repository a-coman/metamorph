export function getFaviconUrl(siteUrl: string, sizePx = 32): string | null {
  try {
    const hostname = new URL(siteUrl).hostname;
    if (!hostname) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${sizePx}`;
  } catch {
    return null;
  }
}
