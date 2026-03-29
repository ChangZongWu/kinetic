/**
 * Font scale for web readability.
 * The app is deployed as a web app, so we size up all fonts
 * from the original mobile-first values.
 */
export function fs(size: number): number {
  if (size <= 9)  return size + 5;   // 6→11  7→12  8→13  9→14
  if (size <= 12) return size + 4;   // 10→14 11→15 12→16
  if (size <= 16) return size + 3;   // 13→16 14→17 15→18 16→19
  if (size <= 24) return size + 2;   // 22→24
  return size + 1;                   // 28→29 32→33
}

/** Max width for content areas on wide screens */
export const CONTENT_MAX_WIDTH = 860;

/** Sidebar width */
export const SIDEBAR_WIDTH = 260;
