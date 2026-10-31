import { FlexWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import type { ColorProp, WidgetRepresentation } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMainTaskCompletionForDate, getSubTaskCompletionForDate } from '@/lib/db/completions-repo';
import { deriveTasksForDate, getTaskByUuid } from '@/lib/db/tasks-repo';
import { getSubTaskByUuid } from '@/lib/db/sub-tasks-repo';
import { todayISODate } from '@/lib/date';
import type { JSX, ReactNode } from 'react';

/**
 * Android home-screen widgets:
 *
 *  - `TaskOverviewWidget` — today's progress summary: brand row, big done
 *    ratio, progress track, and up to two pending task titles.
 *  - `BleCounterWidget` — ONLY the active Bluetooth-controlled counter:
 *    title + current / remaining / target. Nothing else (#esp32-widget).
 *
 * Both renderers are HEADLESS (the OS re-launches the bundle for widget
 * updates), so React context is unavailable — every dimension, font size and
 * gap is derived from the widget's own width/height with clamps, and all
 * rows/track/fill use exact numeric widths. That keeps every element inside
 * the widget bounds across screen sizes, resolutions, DPIs and resizes
 * (#widget-responsiveness — the old fixed-size build spilled text past the
 * box). Light/dark palettes are explicit; the library applies per system
 * setting.
 *
 * Live data: readers are synchronous over the local-first SQLite store, so
 * widgets always show the latest data the device has (offline included).
 * Renders are re-requested from the app after every counter change — manual
 * taps (buffer / sub-task hook) and ESP32 presses (counter-ble) all call
 * refreshAllWidgets(), keeping app + widgets in lock-step (subject to OS
 * scheduling, as with all Android widget updates).
 *
 * `registerWidgetTaskHandler` runs at module scope (headless launches import
 * the bundle to find it); app/_layout.tsx imports this module for its side
 * effect. Widget declarations live in app.json's config-plugin entry.
 */

const OVERVIEW_WIDGET_NAME = 'TaskOverviewWidget';
const BLE_WIDGET_NAME = 'BleCounterWidget';

/** Same key the BLE manager persists the active counter under
 * (duplicated literal to keep this module cycle-free of counter-ble). */
const ACTIVE_TASK_STORE_KEY = 'soulshield_ble_active_task';

interface Palette {
  bg: ColorProp;
  card: ColorProp;
  text: ColorProp;
  muted: ColorProp;
  success: ColorProp;
  border: ColorProp;
  accent: ColorProp;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#EDF0F7',
    card: '#FFFFFF',
    text: '#101828',
    muted: '#667085',
    success: '#12976B',
    border: '#E4E8EF',
    accent: '#5B67EA',
  },
  dark: {
    bg: '#12151C',
    card: '#191E28',
    text: '#F4F5F7',
    muted: '#98A2B3',
    success: '#4ADE80',
    border: '#262B36',
    accent: '#8B95FF',
  },
};

// --- responsive metrics: everything derives from the widget's own size -----

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Metrics {
  pad: number;
  gap: number;
  radius: number;
  accentW: number;
  trackH: number;
  fBrand: number;
  fTitle: number;
  fValue: number;
  fLabel: number;
}

function metrics(width: number, height: number): Metrics {
  const min = Math.min(width, height);
  return {
    pad: clamp(Math.round(min * 0.09), 9, 18),
    gap: clamp(Math.round(min * 0.05), 4, 10),
    radius: clamp(Math.round(min * 0.1), 8, 18),
    accentW: clamp(Math.round(width * 0.014), 3, 5),
    trackH: clamp(Math.round(height * 0.045), 4, 10),
    fBrand: clamp(Math.round(height * 0.052), 8, 11),
    fTitle: clamp(Math.round(height * 0.082), 10, 15),
    fValue: clamp(Math.round(height * 0.2), 16, 38),
    fLabel: clamp(Math.round(height * 0.048), 8, 11),
  };
}

// --- data loaders (synchronous over local SQLite) ---------------------------

interface OverviewData {
  total: number;
  completed: number;
  pendingTitles: string[];
}

function loadOverviewData(): OverviewData {
  const all = deriveTasksForDate(todayISODate()).filter((t) => !t.is_global);
  const completed = all.filter((t) => t.status === 'completed').length;
  const pendingTitles = all
    .filter((t) => t.status !== 'completed' && t.status !== 'missed')
    .slice(0, 2)
    .map((t) => t.title);
  return { total: all.length, completed, pendingTitles };
}

interface BleData {
  title: string;
  current: number;
  target: number;
}

/** The ACTIVE Bluetooth counter (title/current/target), or null for the
 * empty state. Sub-tasks resolve through sub_task_completions; main tasks
 * through task_completions; both today-scoped, offline-fresh. */
async function loadBleCounterData(): Promise<BleData | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_TASK_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { taskId?: string; subTaskId?: string | null; title?: string };
    if (!parsed?.taskId) return null;
    const date = todayISODate();

    if (parsed.subTaskId) {
      const sub = getSubTaskByUuid(parsed.subTaskId);
      if (!sub) return null;
      const completion = getSubTaskCompletionForDate(parsed.subTaskId, date);
      return {
        title: parsed.title || sub.title,
        current: completion?.progressCount ?? 0,
        target: sub.targetCount ?? 0,
      };
    }

    const task = getTaskByUuid(parsed.taskId);
    if (!task) return null;
    // Main counter tasks: the live progress row (same local row the +1 buffer
    // writes). There is no sync repository helper for this exact lookup in
    // this module chain, so read completion rows through the sub path's twin
    // below only when needed — main uses the same query via completions repo.
    const completion = getMainTaskCompletionForDate(parsed.taskId, date);
    return {
      title: parsed.title || task.title,
      current: completion?.progressCount ?? 0,
      target: task.targetCount ?? 0,
    };
  } catch {
    return null;
  }
}

// --- renderers ----------------------------------------------------------------

function buildFrame(width: number, height: number, p: Palette, children: ReactNode): JSX.Element {
  const accentW = clamp(Math.round(width * 0.014), 3, 5);
  return (
    <FlexWidget style={{ width, height, backgroundColor: p.bg, borderRadius: clamp(Math.round(Math.min(width, height) * 0.1), 8, 18), flexDirection: 'row', overflow: 'hidden' }}>
      <FlexWidget style={{ width: accentW, height: 'match_parent', backgroundColor: p.accent }} />
      <FlexWidget style={{ width: width - accentW, height: 'match_parent', backgroundColor: p.card, flexDirection: 'column', justifyContent: 'center', padding: clamp(Math.round(Math.min(width, height) * 0.09), 9, 18) }}>
        {children}
      </FlexWidget>
    </FlexWidget>
  );
}

function buildOverviewWidget(width: number, height: number, p: Palette): JSX.Element {
  const m = metrics(width, height);
  const data = loadOverviewData();
  const ratio = data.total > 0 ? Math.min(data.completed / data.total, 1) : 0;
  const inner = Math.max(width - m.pad * 2 - m.accentW, 40);
  const fill = data.completed > 0 ? Math.max(Math.round(inner * ratio), m.trackH) : 0;

  return buildFrame(width, height, p, (
    <>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget style={{ color: p.muted, fontSize: m.fBrand, fontWeight: '700' }} text="SOUL SHIELD" />
        <TextWidget style={{ color: data.total > 0 && data.completed === data.total ? p.success : p.muted, fontSize: m.fLabel, fontWeight: '700' }} text={`${data.completed}/${data.total} done`} />
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', height: m.trackH, backgroundColor: p.border, borderRadius: m.trackH / 2, marginTop: m.gap, overflow: 'hidden' }}>
        <FlexWidget style={{ width: fill, height: 'match_parent', backgroundColor: p.success, borderRadius: m.trackH / 2 }} />
      </FlexWidget>

      {data.pendingTitles.map((title, index) => (
        <TextWidget
          key={`pending-${index}`}
          style={{ color: p.muted, fontSize: m.fLabel + 1, marginTop: index === 0 ? m.gap : 4 }}
          text={`•  ${title}`}
          maxLines={1}
        />
      ))}

      {data.total === 0 ? (
        <TextWidget style={{ color: p.muted, fontSize: m.fLabel + 1, marginTop: m.gap }} text="No tasks scheduled today." />
      ) : null}
      {data.total > 0 && data.completed === data.total ? (
        <TextWidget style={{ color: p.success, fontSize: m.fLabel + 1, marginTop: m.gap, fontWeight: '700' }} text="All done ✨" />
      ) : null}
    </>
  ));
}

function buildBleCounterWidget(width: number, height: number, p: Palette, data: BleData | null): JSX.Element {
  const m = metrics(width, height);
  const inner = Math.max(width - m.pad * 2 - m.accentW, 40);

  // Empty state — only guidance, per spec.
  if (!data) {
    return buildFrame(width, height, p, (
      <>
        <TextWidget style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700' }} text="Bluetooth Counter" />
        <TextWidget
          style={{ color: p.muted, fontSize: m.fLabel, lineHeight: Math.round(m.fLabel * 1.5), marginTop: m.gap }}
          text="No counter selected yet. Open Soul Shield → tap the Bluetooth icon on a counter task."
          maxLines={3}
        />
      </>
    ));
  }

  const remaining = Math.max(data.target - data.current, 0);
  const ratio = data.target > 0 ? Math.min(data.current / data.target, 1) : 0;
  const fill = data.current > 0 ? Math.max(Math.round(inner * ratio), m.trackH) : 0;

  return buildFrame(width, height, p, (
    <>
      <TextWidget style={{ color: p.muted, fontSize: m.fBrand, fontWeight: '700' }} text="BLUETOOTH COUNTER" />

      <TextWidget
        style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700', marginTop: m.gap - Math.round(m.gap / 2) }}
        text={data.title}
        maxLines={2}
      />

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: Math.round(m.gap / 2) }}>
        <TextWidget style={{ color: p.success, fontSize: m.fValue, fontWeight: '700' }} text={String(Math.min(data.current, 99999))} />
        <FlexWidget style={{ flexDirection: 'column', marginLeft: m.gap }}>
          <TextWidget style={{ color: p.muted, fontSize: m.fLabel }} text={`remaining  ${remaining}`} />
          <TextWidget style={{ color: p.muted, fontSize: m.fLabel }} text={`target  ${data.target}`} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', height: m.trackH, backgroundColor: p.border, borderRadius: m.trackH / 2, marginTop: m.gap, overflow: 'hidden' }}>
        <FlexWidget style={{ width: fill, height: 'match_parent', backgroundColor: p.success, borderRadius: m.trackH / 2 }} />
      </FlexWidget>
    </>
  ));
}

// --- headless handler (dispatch by widget name) -------------------------------

registerWidgetTaskHandler(async ({ widgetAction, widgetInfo, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;

  if (widgetInfo.widgetName === BLE_WIDGET_NAME) {
    const data = await loadBleCounterData();
    renderWidget({
      light: buildBleCounterWidget(widgetInfo.width, widgetInfo.height, PALETTES.light, data),
      dark: buildBleCounterWidget(widgetInfo.width, widgetInfo.height, PALETTES.dark, data),
    });
    return;
  }

  const overview = buildOverviewWidget(widgetInfo.width, widgetInfo.height, PALETTES.light);
  const overviewDark = buildOverviewWidget(widgetInfo.width, widgetInfo.height, PALETTES.dark);
  renderWidget({ light: overview, dark: overviewDark });
});

// --- app-side refresh entry points --------------------------------------------

async function requestRender(
  widgetName: string,
  build: (width: number, height: number) => WidgetRepresentation | Promise<WidgetRepresentation>
): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (widgetInfo) => build(widgetInfo.width, widgetInfo.height),
    });
  } catch {
    // widget not added to the home screen / native module missing yet
  }
}

/** Fresh render for the today-overview widget. */
export async function refreshTaskWidget(): Promise<void> {
  await requestRender(OVERVIEW_WIDGET_NAME, (w, h) => ({
    light: buildOverviewWidget(w, h, PALETTES.light),
    dark: buildOverviewWidget(w, h, PALETTES.dark),
  }));
}

/** Fresh render for the BLE counter widget — called on every counter change
 * (manual or ESP32) and whenever the active Bluetooth task switches. */
export async function refreshBleCounterWidget(): Promise<void> {
  await requestRender(BLE_WIDGET_NAME, async (w, h) => {
    const data = await loadBleCounterData();
    return {
      light: buildBleCounterWidget(w, h, PALETTES.light, data),
      dark: buildBleCounterWidget(w, h, PALETTES.dark, data),
    };
  });
}

/** One call from any counter mutation/press: refreshes both widgets. */
export async function refreshAllWidgets(): Promise<void> {
  await Promise.all([refreshTaskWidget(), refreshBleCounterWidget()]);
}
