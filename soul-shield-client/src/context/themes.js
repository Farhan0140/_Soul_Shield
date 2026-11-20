// Theme catalogue. Each entry mirrors the CSS custom properties defined for
// the matching [data-theme] selector in src/index.css. Lemon green is the
// single brand accent; the only choice left to the user is light vs dark.
export const THEMES = [
  { key: 'lemon-light', label: 'Light', scheme: 'light' },
  { key: 'lemon-dark', label: 'Dark', scheme: 'dark' },
];

export const THEME_KEYS = THEMES.map((t) => t.key);
export const DEFAULT_LIGHT_THEME = 'lemon-light';
export const DEFAULT_DARK_THEME = 'lemon-dark';

/** Maps a stored preference from the old 10-palette picker (e.g.
 * 'deep-forest-dark') onto the matching Lemon scheme, so nobody's saved
 * light/dark choice flips after the redesign. */
export function migrateThemePreference(saved) {
  if (saved === 'system' || THEME_KEYS.includes(saved)) return saved;
  if (typeof saved === 'string' && saved.endsWith('-dark')) return DEFAULT_DARK_THEME;
  if (typeof saved === 'string' && saved.endsWith('-light')) return DEFAULT_LIGHT_THEME;
  return 'system';
}
