// Home-screen widgets must actually produce a drawing. react-native-android-widget
// turns our JSX into native views WITHOUT React: a fragment (`<>`) or a
// React-Compiler-transformed component throws there, and the widget silently
// shows an empty box on the phone. This compiles lib/widget/task-widget.tsx the
// way Metro does (TypeScript + JSX + React Compiler), runs the real
// widgetTaskHandler with stubbed data, and feeds the result through the
// library's real buildWidgetTree.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(projectDir, 'package.json'));
const babel = require('@babel/core');

const lib = path.join(projectDir, 'node_modules/react-native-android-widget/lib/commonjs');
const { FlexWidget } = require(path.join(lib, 'widgets/FlexWidget.js'));
const { TextWidget } = require(path.join(lib, 'widgets/TextWidget.js'));
const { buildWidgetTree } = require(path.join(lib, 'api/build-widget-tree.js'));

const scenario = { tasks: [], ble: null };

function loadHandler() {
  const { code } = babel.transformFileSync(path.join(projectDir, 'lib/widget/task-widget.tsx'), {
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve('@babel/preset-typescript'), { isTSX: true, allExtensions: true }],
      [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
    ],
    plugins: [
      // app.json turns the React Compiler on for the whole app.
      [require.resolve('babel-plugin-react-compiler'), { target: '19' }],
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });

  const stubs = {
    'react-native-android-widget': { FlexWidget, TextWidget, requestWidgetUpdate: async () => {} },
    '@react-native-async-storage/async-storage': {
      __esModule: true,
      default: { getItem: async () => (scenario.ble ? JSON.stringify({ taskId: 't1', title: 'Subhanallah' }) : null) },
    },
    '@/lib/db/completions-repo': {
      getMainTaskCompletionForDate: () => (scenario.ble ? { progressCount: scenario.ble.current } : null),
      getSubTaskCompletionForDate: () => null,
    },
    '@/lib/db/tasks-repo': {
      deriveTasksForDate: () => scenario.tasks,
      getTaskByUuid: () => (scenario.ble ? { title: 'Subhanallah', targetCount: scenario.ble.target } : null),
    },
    '@/lib/db/sub-tasks-repo': { getSubTaskByUuid: () => null },
    '@/lib/date': { todayISODate: () => '2026-11-22' },
  };
  const mod = { exports: {} };
  const localRequire = (name) => (name in stubs ? stubs[name] : require(name));
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports.widgetTaskHandler;
}

const widgetTaskHandler = loadHandler();

/** Runs the handler and returns every TextWidget's text (light variant). */
async function render(widgetName, width, height) {
  let texts = null;
  await widgetTaskHandler({
    widgetAction: 'WIDGET_ADDED',
    widgetInfo: { widgetName, widgetId: 1, width, height, screenInfo: {} },
    renderWidget: (rep) => {
      const light = buildWidgetTree(rep.light);
      assert.ok(buildWidgetTree(rep.dark), 'dark variant builds too');
      texts = [];
      (function walk(node) {
        if (node.type === 'TextWidget') texts.push(node.props.text);
        (node.children ?? []).forEach(walk);
      })(light);
    },
  });
  assert.ok(texts, 'renderWidget was called');
  return texts;
}

const task = (title, status) => ({ title, status, is_global: false });

test('Today widget: progress and pending tasks', async () => {
  scenario.tasks = [task('Fajr', 'completed'), task('Dhuhr', 'pending'), task('Asr', 'partially_completed')];
  const texts = await render('TaskOverviewWidget', 250, 250);
  assert.ok(texts.includes('Today'));
  assert.ok(texts.includes(' / 3 done'));
  assert.ok(texts.includes('33%'));
  assert.ok(texts.includes('Dhuhr') && texts.includes('Asr'));
});

test('Today widget: empty day, all done, and small size', async () => {
  scenario.tasks = [];
  assert.ok((await render('TaskOverviewWidget', 250, 250)).includes('Nothing scheduled'));
  scenario.tasks = [task('Fajr', 'completed')];
  assert.ok((await render('TaskOverviewWidget', 250, 250)).includes('Everything is done for today.'));
  scenario.tasks = [task('Fajr', 'pending')];
  assert.ok((await render('TaskOverviewWidget', 250, 100)).includes('0%'));
});

test('Bluetooth counter widget: linked and not linked', async () => {
  scenario.ble = { current: 33, target: 100 };
  const texts = await render('BleCounterWidget', 250, 250);
  assert.ok(texts.includes('Subhanallah') && texts.includes('33') && texts.includes('67 to go'));

  scenario.ble = null;
  assert.ok((await render('BleCounterWidget', 250, 250)).includes('No counter linked'));
});
