import { FlexWidget, TextWidget, requestWidgetUpdate } from 'react-native-android-widget';
import type { ColorProp, WidgetRepresentation, WidgetTaskHandler } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JSX, ReactNode } from 'react';

import { getMainTaskCompletionForDate, getSubTaskCompletionForDate } from '@/lib/db/completions-repo';
import { deriveTasksForDate, getTaskByUuid } from '@/lib/db/tasks-repo';
import { getSubTaskByUuid } from '@/lib/db/sub-tasks-repo';
import { todayISODate } from '@/lib/date';

/**
 * Android home-screen widgets:
 *
 *  - `TaskOverviewWidget` — today's progress: date, done ratio, progress bar
 *    and as many pending task titles as the widget's height allows.
 *  - `BleCounterWidget` — the active Bluetooth (ESP32) counter: title, big
 *    current count over target, progress bar, remaining.
 *
 * REGISTRATION: `widgetTaskHandler` is registered in the app entry
 * (`index.ts`), NOT from a route file. Android renders widgets by launching
 * the JS bundle headlessly — no React tree mounts, so `app/_layout.tsx`
 * never evaluates. When the handler was registered from there, every widget
 * stayed blank because nothing answered the OS's render request.
 *
 * Rendering is headless too, so there is no React context: every size is
 * derived from the widget's own dp width/height, and every data read is
 * wrapped so a failing loader still renders a fallback instead of nothing.
 * Live data comes from the local-first SQLite store (works offline); the app
 * calls refreshAllWidgets() after each counter change / task mutation.
 * Widget declarations live in app.json's config-plugin entry.
 */

const OVERVIEW_WIDGET_NAME = 'TaskOverviewWidget';
const BLE_WIDGET_NAME = 'BleCounterWidget';

/** Same key the BLE manager persists the active counter under
 * (duplicated literal to keep this module cycle-free of counter-ble). */
const ACTIVE_TASK_STORE_KEY = 'soulshield_ble_active_task';

// --- palette: mirrors the app's Soft Paper theme ------------------------------

interface Palette {
  bg: ColorProp;
  text: ColorProp;
  muted: ColorProp;
  faint: ColorProp;
  border: ColorProp;
  track: ColorProp;
  tint: ColorProp;
  success: ColorProp;
  successSoft: ColorProp;
  tintSoft: ColorProp;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#FCFDFF',
    text: '#253248',
    muted: '#6A7A90',
    faint: '#A3AFBF',
    border: '#E5E9F0',
    track: '#EBEEF4',
    tint: '#5A6BD8',
    success: '#37946B',
    successSoft: '#DDEFE6',
    tintSoft: '#E6E9FA',
  },
  dark: {
    bg: '#161B26',
    text: '#EEF1F6',
    muted: '#98A3B5',
    faint: '#5E697C',
    border: '#252C3A',
    track: '#252C3A',
    tint: '#8D9BF0',
    success: '#5CC498',
    successSoft: '#1D3A30',
    tintSoft: '#262D4A',
  },
};

type Variant = keyof typeof PALETTES;

// --- sizing -------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Metrics {
  pad: number;
  gap: number;
  radius: number;
  trackH: number;
  fSmall: number;
  fBody: number;
  fTitle: number;
  fHero: number;
}

function metrics(width: number, height: number): Metrics {
  const min = Math.min(width, height);
  return {
    pad: clamp(Math.round(min * 0.1), 10, 18),
    gap: clamp(Math.round(min * 0.05), 4, 10),
    radius: clamp(Math.round(min * 0.12), 12, 24),
    trackH: clamp(Math.round(height * 0.04), 5, 8),
    fSmall: clamp(Math.round(min * 0.07), 10, 13),
    fBody: clamp(Math.round(min * 0.08), 11, 14),
    fTitle: clamp(Math.round(min * 0.09), 12, 16),
    fHero: clamp(Math.round(min * 0.24), 22, 44),
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(now = new Date()): string {
  return `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

// --- data loaders -------------------------------------------------------------

interface OverviewData {
  total: number;
  completed: number;
  pending: string[];
}

/** null = local store unavailable (e.g. never signed in on this device). */
function loadOverviewData(): OverviewData | null {
  try {
    const all = deriveTasksForDate(todayISODate()).filter((t) => !t.is_global);
    const completed = all.filter((t) => t.status === 'completed').length;
    const pending = all
      .filter((t) => t.status === 'pending' || t.status === 'partially_completed')
      .map((t) => t.title);
    return { total: all.length, completed, pending };
  } catch {
    return null;
  }
}

interface BleData {
  title: string;
  current: number;
  target: number;
}

/** The ACTIVE Bluetooth counter, or null for the empty state. Sub-tasks read
 * sub_task_completions, main tasks task_completions; both today-scoped. */
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

// --- shared building blocks ---------------------------------------------------

/** Rounded card filling the widget; tapping anywhere opens the app. */
function Card(props: { width: number; height: number; p: Palette; m: Metrics; children: ReactNode }): JSX.Element {
  const { width, height, p, m } = props;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width,
        height,
        backgroundColor: p.bg,
        borderRadius: m.radius,
        borderWidth: 1,
        borderColor: p.border,
        padding: m.pad,
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
      {props.children}
    </FlexWidget>
  );
}

function ProgressBar(props: { width: number; ratio: number; p: Palette; m: Metrics; done: boolean }): JSX.Element {
  const { width, ratio, p, m, done } = props;
  const fill = ratio > 0 ? Math.max(Math.round(width * Math.min(ratio, 1)), m.trackH) : 0;
  return (
    <FlexWidget style={{ width, height: m.trackH, backgroundColor: p.track, borderRadius: m.trackH / 2 }}>
      {fill > 0 ? (
        <FlexWidget
          style={{ width: fill, height: m.trackH, backgroundColor: done ? p.success : p.tint, borderRadius: m.trackH / 2 }}
        />
      ) : null}
    </FlexWidget>
  );
}

function Pill(props: { text: string; color: ColorProp; bg: ColorProp; m: Metrics }): JSX.Element {
  const { m } = props;
  return (
    <FlexWidget
      style={{
        backgroundColor: props.bg,
        borderRadius: 999,
        paddingHorizontal: clamp(Math.round(m.fSmall * 0.7), 6, 10),
        paddingVertical: 2,
      }}>
      <TextWidget text={props.text} style={{ color: props.color, fontSize: m.fSmall, fontWeight: '700' }} />
    </FlexWidget>
  );
}

/** Spacer that soaks up remaining height so the footer sits at the bottom. */
function Fill(): JSX.Element {
  return <FlexWidget style={{ flex: 1, width: 'match_parent' }} />;
}

// --- Today overview -----------------------------------------------------------

function buildOverviewWidget(width: number, height: number, v: Variant, data: OverviewData | null): JSX.Element {
  const p = PALETTES[v];
  const m = metrics(width, height);
  const inner = Math.max(width - m.pad * 2 - 2, 40);
  const compact = height < 120;

  const header = (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TextWidget text="Today" style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700' }} />
      <TextWidget text={dateLabel()} style={{ color: p.muted, fontSize: m.fSmall }} />
    </FlexWidget>
  );

  if (!data) {
    return (
      <Card width={width} height={height} p={p} m={m}>
        {header}
        <Fill />
        <TextWidget
          text="Open Soul Shield to load your tasks."
          style={{ color: p.muted, fontSize: m.fBody }}
          maxLines={2}
          truncate="END"
        />
      </Card>
    );
  }

  const allDone = data.total > 0 && data.completed === data.total;
  const ratio = data.total > 0 ? data.completed / data.total : 0;
  const percent = Math.round(ratio * 100);

  // How many pending rows fit under the summary block.
  const rowH = Math.round(m.fBody * 1.7);
  const usedH = m.pad * 2 + m.fTitle * 1.4 + m.gap + m.fHero * 1.25 + m.gap + m.trackH + m.gap;
  const maxRows = compact ? 0 : Math.max(0, Math.floor((height - usedH) / rowH));
  const shownCount = data.pending.length > maxRows && maxRows > 0 ? maxRows - 1 : Math.min(maxRows, data.pending.length);
  const shown = data.pending.slice(0, shownCount);
  const hidden = data.pending.length - shown.length;

  return (
    <Card width={width} height={height} p={p} m={m}>
      {header}

      {data.total === 0 ? (
        <>
          <Fill />
          <TextWidget text="Nothing scheduled" style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700' }} />
          <TextWidget text="Enjoy a free day." style={{ color: p.muted, fontSize: m.fBody, marginTop: 2 }} />
        </>
      ) : (
        <>
          <FlexWidget
            style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: m.gap }}>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextWidget text={String(data.completed)} style={{ color: allDone ? p.success : p.text, fontSize: m.fHero, fontWeight: '700' }} />
              <TextWidget
                text={` / ${data.total} done`}
                style={{ color: p.muted, fontSize: m.fBody, marginBottom: Math.round(m.fHero * 0.14) }}
              />
            </FlexWidget>
            <FlexWidget style={{ marginBottom: Math.round(m.fHero * 0.12) }}>
              <Pill
                text={allDone ? 'Done' : `${percent}%`}
                color={allDone ? p.success : p.tint}
                bg={allDone ? p.successSoft : p.tintSoft}
                m={m}
              />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ marginTop: m.gap }}>
            <ProgressBar width={inner} ratio={ratio} p={p} m={m} done={allDone} />
          </FlexWidget>

          {allDone && !compact ? (
            <TextWidget
              text="Everything is done for today."
              style={{ color: p.success, fontSize: m.fBody, marginTop: m.gap + 2 }}
              maxLines={1}
              truncate="END"
            />
          ) : null}

          {!allDone && shown.length > 0 ? (
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: m.gap }}>
              {shown.map((title, index) => (
                <FlexWidget
                  key={`pending-${index}`}
                  style={{ width: 'match_parent', height: rowH, flexDirection: 'row', alignItems: 'center' }}>
                  <FlexWidget
                    style={{
                      width: Math.round(m.fBody * 0.7),
                      height: Math.round(m.fBody * 0.7),
                      borderRadius: 999,
                      borderWidth: 1.5,
                      borderColor: p.faint,
                      marginRight: m.gap + 2,
                    }}
                  />
                  <TextWidget
                    text={title}
                    style={{ color: p.text, fontSize: m.fBody, width: inner - Math.round(m.fBody * 0.7) - m.gap - 2 }}
                    maxLines={1}
                    truncate="END"
                  />
                </FlexWidget>
              ))}
              {hidden > 0 ? (
                <TextWidget text={`+${hidden} more`} style={{ color: p.muted, fontSize: m.fSmall, marginTop: 2 }} />
              ) : null}
            </FlexWidget>
          ) : null}
        </>
      )}
    </Card>
  );
}

// --- Bluetooth counter --------------------------------------------------------

function buildBleCounterWidget(width: number, height: number, v: Variant, data: BleData | null): JSX.Element {
  const p = PALETTES[v];
  const m = metrics(width, height);
  const inner = Math.max(width - m.pad * 2 - 2, 40);

  const header = (connectedLabel: string) => (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: data ? p.tint : p.faint, marginRight: 6 }}
      />
      <TextWidget text={connectedLabel} style={{ color: p.muted, fontSize: m.fSmall, fontWeight: '500' }} />
    </FlexWidget>
  );

  if (!data) {
    return (
      <Card width={width} height={height} p={p} m={m}>
        {header('Bluetooth counter')}
        <Fill />
        <TextWidget text="No counter linked" style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700' }} />
        <TextWidget
          text="In Soul Shield, tap the Bluetooth icon on a counter task."
          style={{ color: p.muted, fontSize: m.fBody, marginTop: 2 }}
          maxLines={3}
          truncate="END"
        />
      </Card>
    );
  }

  const done = data.target > 0 && data.current >= data.target;
  const remaining = Math.max(data.target - data.current, 0);
  const ratio = data.target > 0 ? data.current / data.target : 0;
  const current = String(Math.min(data.current, 99999));

  return (
    <Card width={width} height={height} p={p} m={m}>
      {header('Bluetooth counter')}
      <TextWidget
        text={data.title}
        style={{ color: p.text, fontSize: m.fTitle, fontWeight: '700', marginTop: m.gap }}
        maxLines={height < 140 ? 1 : 2}
        truncate="END"
      />

      <Fill />

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-end' }}>
        <TextWidget text={current} style={{ color: done ? p.success : p.text, fontSize: m.fHero, fontWeight: '700' }} />
        {data.target > 0 ? (
          <TextWidget
            text={` / ${data.target}`}
            style={{ color: p.muted, fontSize: m.fBody, marginBottom: Math.round(m.fHero * 0.14) }}
          />
        ) : null}
      </FlexWidget>

      {data.target > 0 ? (
        <>
          <FlexWidget style={{ marginTop: m.gap }}>
            <ProgressBar width={inner} ratio={ratio} p={p} m={m} done={done} />
          </FlexWidget>
          <TextWidget
            text={done ? 'Target reached' : `${remaining} to go`}
            style={{ color: done ? p.success : p.muted, fontSize: m.fSmall, marginTop: m.gap }}
          />
        </>
      ) : null}
    </Card>
  );
}

// --- render helpers -----------------------------------------------------------

function overviewRepresentation(width: number, height: number): WidgetRepresentation {
  const data = loadOverviewData();
  return {
    light: buildOverviewWidget(width, height, 'light', data),
    dark: buildOverviewWidget(width, height, 'dark', data),
  };
}

async function bleRepresentation(width: number, height: number): Promise<WidgetRepresentation> {
  const data = await loadBleCounterData();
  return {
    light: buildBleCounterWidget(width, height, 'light', data),
    dark: buildBleCounterWidget(width, height, 'dark', data),
  };
}

// --- headless handler (registered in index.ts) --------------------------------

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, widgetInfo, renderWidget }) => {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK': {
      const { width, height } = widgetInfo;
      if (widgetInfo.widgetName === BLE_WIDGET_NAME) {
        renderWidget(await bleRepresentation(width, height));
      } else {
        renderWidget(overviewRepresentation(width, height));
      }
      return;
    }
    case 'WIDGET_DELETED':
    default:
      return;
  }
};

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
    // widget not on the home screen / native module missing in this binary
  }
}

/** Fresh render for the today-overview widget. */
export async function refreshTaskWidget(): Promise<void> {
  await requestRender(OVERVIEW_WIDGET_NAME, overviewRepresentation);
}

/** Fresh render for the BLE counter widget — called on every counter change
 * (manual or ESP32) and whenever the active Bluetooth task switches. */
export async function refreshBleCounterWidget(): Promise<void> {
  await requestRender(BLE_WIDGET_NAME, bleRepresentation);
}

/** One call from any counter mutation/press: refreshes both widgets. */
export async function refreshAllWidgets(): Promise<void> {
  await Promise.all([refreshTaskWidget(), refreshBleCounterWidget()]);
}
