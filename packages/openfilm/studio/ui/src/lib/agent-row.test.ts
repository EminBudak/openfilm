import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountOrg, missingActions } from './agent-row.ts';

test('an agent not found offers Locate and its installer, or its install page', () => {
  const host = { locate: true, install: true };
  assert.deepEqual(missingActions({ installer: 'irm https://example.test/install.ps1 | iex', install: 'https://example.test' }, host), { locate: true, install: 'run' });
  assert.deepEqual(missingActions({ install: 'https://example.test' }, host), { locate: true, install: 'page' });
  assert.deepEqual(missingActions({ installer: 'x', install: 'https://example.test' }, { locate: false, install: false }), { locate: false, install: 'page' });
});

test("Claude Code waiting in the Claude app offers no Install or Locate: opening the app's Code tab downloads it", () => {
  assert.deepEqual(missingActions({ setupRequired: 'code-tab', install: 'https://example.test' }, { locate: true, install: true }), { locate: false, install: null });
});

test("an account's organization is named unless it only repeats the email, as a personal Claude account's does", () => {
  assert.equal(accountOrg({ org: "me@example.test's Organization", email: 'me@example.test' }), null);
  assert.equal(accountOrg({ org: 'Acme Films', email: 'me@example.test' }), 'Acme Films');
  assert.equal(accountOrg({ org: "me@example.test's Organization" }), "me@example.test's Organization");
  assert.equal(accountOrg({ email: 'me@example.test' }), null);
});
