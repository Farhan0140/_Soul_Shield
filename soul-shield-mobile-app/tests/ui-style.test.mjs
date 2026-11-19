// UI styles (Normal / Paper / Pencil) are derived from whichever color
// palette is selected — Normal must leave it untouched, and the accent/status
// colors must survive every style so the user's color choice still applies.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adaptPalette,
  buildStyleTokens,
  isUIStyleName,
  mixHex,
  UI_STYLES,
} from '../lib/ui-style/palette.ts';
import { roundedRectPath, sketchEllipsePath, sketchLinePath, sketchRectPath } from '../lib/ui-style/sketch.ts';

const light = {
  text: '#253248',
  background: '#F6F7F9',
  tint: '#5A6BD8',
  icon: '#6A7A90',
  tabIconDefault: '#6A7A90',
  tabIconSelected: '#5A6BD8',
  success: '#37946B',
  danger: '#C86A6A',
  warning: '#C08A2E',
  muted: '#6A7A90',
  border: '#E5E9F0',
  card: '#FCFDFF',
  missedTint: '#EFE0E2',
  completedTint: '#D7E7E2',
  partiallyCompletedTint: '#ECE3D4',
  categoryFallback: '#6A7A90',
};
const dark = { ...light, text: '#E6EDF7', background: '#0B1220', card: '#151E2E', tint: '#38BDF8' };
const HEX = /^#[0-9A-F]{6}$/;

test('mixHex blends endpoints and midpoint', () => {
  assert.equal(mixHex('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(mixHex('#000000', '#FFFFFF', 1), '#FFFFFF');
  assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixHex('#000', '#fff', 2), '#FFFFFF'); // clamped, 3-digit ok
});

test('normal style returns the palette unchanged', () => {
  assert.equal(adaptPalette(light, 'light', 'normal'), light);
  assert.equal(adaptPalette(dark, 'dark', 'normal'), dark);
  assert.equal(buildStyleTokens(light, 'light', 'normal').handDrawn, false);
});

test('paper and pencil keep the selected accent and status colors', () => {
  for (const style of ['paper', 'pencil']) {
    for (const [palette, scheme] of [[light, 'light'], [dark, 'dark']]) {
      const out = adaptPalette(palette, scheme, style);
      for (const key of ['tint', 'success', 'danger', 'warning', 'categoryFallback', 'tabIconSelected']) {
        assert.equal(out[key], palette[key], `${style}/${scheme}: ${key}`);
      }
      for (const [key, value] of Object.entries(out)) assert.match(value, HEX, `${style}/${scheme}: ${key}`);
      const tokens = buildStyleTokens(out, scheme, style);
      assert.equal(tokens.handDrawn, true);
      assert.equal(tokens.ink, out.text);
    }
  }
});

test('paper cards are sticky notes in the selected color', () => {
  const out = adaptPalette(light, 'light', 'paper');
  assert.notEqual(out.card, light.card);
  assert.equal(out.card, mixHex('#FFFFFF', light.tint, 0.28));
  // A different color option gives a different note color.
  const green = adaptPalette({ ...light, tint: '#4A7A61' }, 'light', 'paper');
  assert.notEqual(green.card, out.card);
});

test('dark palettes stay dark under paper and pencil', () => {
  const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  for (const style of ['paper', 'pencil']) {
    const out = adaptPalette(dark, 'dark', style);
    assert.ok(lum(out.background) < lum(out.text), `${style}: text lighter than background`);
  }
});

test('pencil is monochrome sketch paper + ink, whatever the palette', () => {
  const a = adaptPalette(light, 'light', 'pencil');
  const b = adaptPalette({ ...light, tint: '#4A7A61', text: '#24352C', background: '#F2F6F2' }, 'light', 'pencil');
  assert.equal(a.background, '#FBFAF7');
  assert.equal(a.text, '#1D1D1D');
  assert.equal(a.card, a.background);
  assert.equal(b.background, a.background);
  assert.equal(b.text, a.text);
  assert.equal(adaptPalette(dark, 'dark', 'pencil').background, '#1C1C1A');
  // ...while the selected color survives as the colored pencil.
  assert.equal(b.tint, '#4A7A61');
});

test('onAccent: white except under pencil (ink on hatching)', () => {
  assert.equal(buildStyleTokens(light, 'light', 'normal').onAccent, '#FFFFFF');
  const paper = adaptPalette(light, 'light', 'paper');
  assert.equal(buildStyleTokens(paper, 'light', 'paper').onAccent, '#FFFFFF');
  const pencil = adaptPalette(light, 'light', 'pencil');
  assert.equal(buildStyleTokens(pencil, 'light', 'pencil').onAccent, pencil.text);
});

test('isUIStyleName guards persisted values', () => {
  for (const s of UI_STYLES) assert.equal(isUIStyleName(s), true);
  for (const bad of [null, undefined, '', 'Paper', 'dark', 42]) assert.equal(isUIStyleName(bad), false);
});

test('sketch paths are deterministic per seed and stay inside the box', () => {
  const a = sketchRectPath(200, 80, 8, 123);
  assert.equal(a, sketchRectPath(200, 80, 8, 123));
  assert.notEqual(a, sketchRectPath(200, 80, 8, 124));
  assert.match(a, /^M[\d.]+ [\d.]+ C/);
  const nums = a.match(/-?[\d.]+/g).map(Number);
  // jitter (≤1.3) can push a point out by a couple of px at most
  for (const n of nums) assert.ok(n > -4 && n < 204, `coordinate ${n} escaped the box`);
  assert.match(sketchEllipsePath(60, 60, 7), /^M[\d.]+ [\d.]+ C/);
  assert.match(roundedRectPath(100, 40, 6), /Z$/);
});

test('sketch paths degrade to empty for tiny boxes', () => {
  assert.equal(sketchRectPath(3, 3, 2, 1), '');
  assert.equal(sketchEllipsePath(2, 2, 1), '');
  assert.equal(roundedRectPath(2, 2, 1), '');
  assert.equal(sketchLinePath(0, 2, 1, 1), '');
});

test('sketch rule wiggles around its baseline', () => {
  const d = sketchLinePath(0, 300, 10, 5);
  const ys = d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 1);
  for (const y of ys) assert.ok(Math.abs(y - 10) < 3, `y ${y} too far from the rule`);
});

test('ring progress sector: empty, partial and full', async () => {
  const { annularSectorPath, sketchCirclePath } = await import('../lib/ui-style/sketch.ts');
  assert.equal(annularSectorPath(100, 100, 90, 70, 0), '');
  const half = annularSectorPath(100, 100, 90, 70, 0.5);
  assert.match(half, /^M100 10 A90 90 0 0 1 100 190 L100 170 A70 70 0 0 0 100 30 Z$/);
  assert.match(annularSectorPath(100, 100, 90, 70, 0.75), / 0 1 1 /); // large arc past halfway
  assert.equal((annularSectorPath(100, 100, 90, 70, 1).match(/Z/g) ?? []).length, 2); // full ring = two loops
  assert.equal(sketchCirclePath(50, 50, 40, 9), sketchCirclePath(50, 50, 40, 9));
  assert.equal(sketchCirclePath(50, 50, 1, 9), '');
});
