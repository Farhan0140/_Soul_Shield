// The data-only "data-change" push (B5) reaches the notification task in
// different shapes per platform; all of them must be recognised.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dataChangeType } from '../lib/background-sync/data-change-payload.ts';

test('Android: Expo data as a JSON dataString', () => {
  assert.equal(dataChangeType({ notification: null, data: { dataString: '{"type":"data-change"}' } }), 'data-change');
});

test('iOS: custom keys at the top level of data', () => {
  assert.equal(dataChangeType({ notification: null, data: { type: 'data-change' } }), 'data-change');
});

test('data under body, as an object or a JSON string', () => {
  assert.equal(dataChangeType({ data: { body: { type: 'data-change' } } }), 'data-change');
  assert.equal(dataChangeType({ data: { body: '{"type":"data-change"}' } }), 'data-change');
});

test('a notification tap (response) is not a data push', () => {
  assert.equal(dataChangeType({ actionIdentifier: 'default', notification: {} }), undefined);
});

test('garbage is ignored', () => {
  assert.equal(dataChangeType(undefined), undefined);
  assert.equal(dataChangeType({ data: { dataString: 'not json' } }), undefined);
  assert.equal(dataChangeType({ data: { type: 42 } }), undefined);
});
