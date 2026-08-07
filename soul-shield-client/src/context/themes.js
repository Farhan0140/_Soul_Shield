// Eye-comfort theme catalogue. Each entry mirrors the CSS custom properties
// defined for the matching [data-theme] selector in src/index.css.
export const THEMES = [
  { key: 'soft-paper-light', label: 'Soft Paper Light', scheme: 'light', bg: '#F6F7F9', primary: '#5A6BD8', success: '#37946B' },
  { key: 'sage-calm-light', label: 'Sage Calm Light', scheme: 'light', bg: '#F2F6F2', primary: '#4A7A61', success: '#2F8A5C' },
  { key: 'ocean-mist-light', label: 'Ocean Mist Light', scheme: 'light', bg: '#F1F6F8', primary: '#32708F', success: '#2F9368' },
  { key: 'warm-oat-light', label: 'Warm Oat Light', scheme: 'light', bg: '#F8F5F0', primary: '#A86E4C', success: '#5F8D66' },
  { key: 'lavender-haze-light', label: 'Lavender Haze Light', scheme: 'light', bg: '#F6F4FA', primary: '#6C69B8', success: '#4C9B75' },
  { key: 'slate-night-dark', label: 'Slate Night Dark', scheme: 'dark', bg: '#12161C', primary: '#7AA0F0', success: '#63B48D' },
  { key: 'deep-forest-dark', label: 'Deep Forest Dark', scheme: 'dark', bg: '#101714', primary: '#5FAF87', success: '#66BB93' },
  { key: 'midnight-ocean-dark', label: 'Midnight Ocean Dark', scheme: 'dark', bg: '#0F1722', primary: '#5FA9CB', success: '#5FB592' },
  { key: 'warm-charcoal-dark', label: 'Warm Charcoal Dark', scheme: 'dark', bg: '#171412', primary: '#D79A66', success: '#7FB08A' },
  { key: 'muted-plum-dark', label: 'Muted Plum Dark', scheme: 'dark', bg: '#171320', primary: '#A78BDB', success: '#6FBB93' },
];

export const THEME_KEYS = THEMES.map((t) => t.key);
export const DEFAULT_LIGHT_THEME = 'soft-paper-light';
export const DEFAULT_DARK_THEME = 'slate-night-dark';
