import { FlexWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

import { deriveTasksForDate } from '@/lib/db/tasks-repo';
import { todayISODate } from '@/lib/date';

/** Android home-screen widget (#20) — "today at a glance": progress ratio and
 * the next couple of pending tasks, read straight from the local-first SQLite
 * store (deriveTasksForDate — the same read the Home screen uses, so it's
 * always as fresh as the device's data, offline included).
 *
 * The handler runs HEADLESSLY (the OS re-launches the bundle to render the
 * widget), so React context (theme, i18n) is NOT available here — instead the
 * render provides an explicit light/dark pair, which the library applies per
 * the user's system setting (colors match the app's slate/palette themes).
 *
 * `registerWidgetTaskHandler` must run at module scope (OS-driven headless
 * launches import the bundle and find it — same pattern as the background
 * sync task in lib/background-sync/task.ts); app/_layout.tsx imports this
 * module for that side effect. The config plugin react-native-android-widget
 * (registered in app.json with the TaskOverviewWidget definition) wires the
 * native AppWidgetProvider; a native dev rebuild is required on devices that
 * predate it, like every native-capability change. */

const WIDGET_NAME = 'TaskOverviewWidget';
// react-native-android-widget's ColorProp is a branded hex/rgba template —
// keep literally-typed hex here so assignments stay within it.
const PALETTES: { light: Record<WidgetColorKey, ColorProp>; dark: Record<WidgetColorKey, ColorProp> } = {
  light: { card: '#FFFFFF', text: '#111827', muted: '#6B7280', success: '#2F8A5C', border: '#E5E7EB' },
  dark: { card: '#1C1F26', text: '#F3F4F6', muted: '#9CA3AF', success: '#4ADE80', border: '#2A2E37' },
};
type WidgetColorKey = 'card' | 'text' | 'muted' | 'success' | 'border';

function buildWidget(width: number, height: number, p: Record<WidgetColorKey, ColorProp>) {
  const today = todayISODate();
  const all = deriveTasksForDate(today).filter((t) => !t.is_global);
  const completed = all.filter((t) => t.status === 'completed').length;
  const total = all.length;
  const pending = all
    .filter((t) => t.status !== 'completed' && t.status !== 'missed')
    .slice(0, 3);

  // Percent widths aren't supported by the native FlexWidget — compute the
  // progress fill from the widget's own width (14px padding on each side).
  const innerWidth = Math.max(width - 28, 40);
  const fillWidth = total > 0 ? Math.round(innerWidth * Math.min(completed / total, 1)) : 0;

  return (
    <FlexWidget
      style={{
        width,
        height,
        backgroundColor: p.card,
        borderRadius: 18,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget style={{ color: p.text, fontSize: 13, fontWeight: '700' }} text="Soul Shield" />
        <TextWidget style={{ color: p.muted, fontSize: 11 }} text={`${completed}/${total} done`} />
      </FlexWidget>

      {/* Progress track */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 8,
          backgroundColor: p.border,
          borderRadius: 999,
          marginTop: 8,
          overflow: 'hidden',
        }}>
        <FlexWidget
          style={{
            width: fillWidth,
            height: 8,
            backgroundColor: p.success,
            borderRadius: 999,
          }}
        />
      </FlexWidget>

      {pending.map((task) => (
        <TextWidget
          key={task.task_id}
          style={{ color: p.muted, fontSize: 11, marginTop: 6 }}
          text={`• ${task.title}`}
          maxLines={1}
        />
      ))}
      {pending.length === 0 ? (
        <TextWidget
          style={{ color: p.muted, fontSize: 11, marginTop: 6 }}
          text={total > 0 ? 'All done for today ✨' : 'No tasks scheduled today.'}
        />
      ) : null}
    </FlexWidget>
  );
}

/** OS-driven entry (added/resized/periodic updates): render for the widget in
 * both system modes. Deleted is a no-op (nothing to render). Raw errors are
 * swallowed — a headless crash here would surface as a notification error. */
registerWidgetTaskHandler(async ({ widgetAction, widgetInfo, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget({
    light: buildWidget(widgetInfo.width, widgetInfo.height, PALETTES.light),
    dark: buildWidget(widgetInfo.width, widgetInfo.height, PALETTES.dark),
  });
});

/** Pushes a fresh render from inside the running app — called after task
 * mutations (see app/(tabs)/index.tsx) so the widget tracks the list without
 * waiting for the OS's own refresh cadence. */
export async function refreshTaskWidget(): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (widgetInfo) => ({
        light: buildWidget(widgetInfo.width, widgetInfo.height, PALETTES.light),
        dark: buildWidget(widgetInfo.width, widgetInfo.height, PALETTES.dark),
      }),
    });
  } catch {
    // Widget not added / native part not present yet — nothing to refresh.
  }
}
