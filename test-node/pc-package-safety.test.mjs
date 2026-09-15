import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

test('static safety remains strict by default but can explicitly verify the two approved local data databases', () => {
  const strict = spawnSync(process.execPath, ['scripts/verify-v3-static.mjs'], { encoding: 'utf8' });
  assert.notEqual(strict.status, 0, 'strict source safety must reject bundled runtime databases');
  assert.match(`${strict.stdout}\n${strict.stderr}`, /forbidden runtime artifact: sqlite\.db/);
  assert.match(`${strict.stdout}\n${strict.stderr}`, /forbidden runtime artifact: OmniRoute-provider-reference\.sqlite\.db/);

  const pc = spawnSync(process.execPath, ['scripts/verify-v3-static.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ALLOW_LOCAL_DATA_BUNDLE: '1' },
  });
  assert.equal(pc.status, 0, `${pc.stdout}\n${pc.stderr}`);
  assert.match(pc.stdout, /STATIC SAFETY PASS/);
});


test('Windows verifier preserves the safety command exit code while clearing PC bundle mode', async () => {
  const source = await readFile('VERIFY-AND-BUILD.cmd', 'utf8');
  assert.match(source, /set "SAFETY_EXIT=%ERRORLEVEL%"/);
  assert.match(source, /if not "%SAFETY_EXIT%"=="0" goto :fail/);
});
