// Client mirrors of the server's register/password rules (S4).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateEmail, validateFullName, validateNewPassword } from '../lib/validation.ts';

test('email', () => {
  assert.equal(validateEmail('a@b.co'), null);
  assert.equal(validateEmail('  first.last+tag@example.com '), null);
  for (const bad of ['', 'plain', 'a@b', 'a b@c.co', '<a@b.co>']) assert.notEqual(validateEmail(bad), null, bad);
});

test('full name counts characters, not bytes', () => {
  assert.equal(validateFullName('ফ'.repeat(100)), null);
  assert.notEqual(validateFullName('a'.repeat(101)), null);
  assert.notEqual(validateFullName('   '), null);
});

test('password is 6 characters to 72 bytes', () => {
  assert.notEqual(validateNewPassword('12345'), null);
  assert.equal(validateNewPassword('123456'), null);
  assert.equal(validateNewPassword('p'.repeat(72)), null);
  assert.notEqual(validateNewPassword('p'.repeat(73)), null);
  assert.notEqual(validateNewPassword('ফ'.repeat(25)), null); // 75 bytes
});
