'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DOC_NAMES, scanProject, compareFiles, buildRequest, parseResponse, generate, redact } = require('../src/core');
const { readDocs, writeDocs, loadJson, acquireLock } = require('../src/storage');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docpilot-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, relative, text) { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); }
const docs = suffix => Object.fromEntries(DOC_NAMES.map(n => [n, `# ${n}\n${suffix}\n`]));
const response = documents => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'Updated', documents }) }] }] });

test('scanner respects nested ignores, sensitive files, build output, custom exclusions, and docs ownership', async t => {
  const root = await fixture(t);
  for (const [name, content] of Object.entries({
    'package.json': '{"name":"fixture"}', 'src/main.js': 'const answer = 42;', '.gitignore': 'ignored/\n', 'ignored/data.js': 'hidden',
    'src/.gitignore': 'private.js\n', 'src/private.js': 'hidden', '.docpilotignore': 'custom/\n', 'custom/file.py': 'hidden',
    '.env': 'KEY=secret', '.env.example': 'KEY=secret', 'nested/credentials.json': '{}', 'nested/private.key': 'secret',
    'node_modules/pkg/index.js': 'hidden', 'dist/app.js': 'hidden', 'docs/docpilot/SETUP.md': '# previous',
    'binary.txt': '\0binary', 'extra/file.js': 'excluded', 'package-lock.json': '{}'
  })) await put(root, name, content);
  const scan = await scanProject(root, { excludes: ['extra/'] });
  assert.deepEqual(scan.files.map(f => f.path).sort(), ['package.json', 'src/main.js']);
});
test('scanner bounds context, flags truncated files, and fingerprints code changes', async t => {
  const root = await fixture(t);
  await put(root, 'a.js', 'x'.repeat(20000));
  await put(root, 'b.js', 'hello');
  const first = await scanProject(root, { maxCharacters: 100 });
  assert.equal(first.characters, 100);
  assert.equal(first.files[0].truncated, true);
  assert.deepEqual(first.omitted, ['b.js']);
  await put(root, 'a.js', 'x'.repeat(20000) + 'changed outside excerpt');
  assert.notEqual((await scanProject(root, { maxCharacters: 100 })).fingerprint, first.fingerprint);
});
test('a nested gitignore can reinclude a file ignored by a parent pattern', async t => {
  const root = await fixture(t);
  await put(root, '.gitignore', '*.js\n');
  await put(root, 'src/.gitignore', '!main.js\n');
  await put(root, 'src/main.js', 'included');
  await put(root, 'src/other.js', 'excluded');
  assert.deepEqual((await scanProject(root)).files.map(f => f.path), ['src/main.js']);
});
test('file comparison distinguishes no-longer-included context without claiming deletion', () => {
  assert.deepEqual(compareFiles([{ path: 'a', hash: 'new' }, { path: 'b', hash: 'same' }, { path: 'c', hash: 'new' }], { a: 'old', b: 'same', d: 'gone' }), { added: ['c'], changed: ['a'], noLongerIncluded: ['d'] });
});
test('request includes previous documentation, redacts credentials, and uses a closed schema', () => {
  const request = buildRequest('my-model', 'project', { files: [], omitted: [], traversalLimited: false }, { 'SETUP.md': 'api_key="secret-value"' });
  assert.equal(request.store, false);
  assert.equal(request.model, 'my-model');
  assert.ok(!request.input.includes('secret-value'));
  assert.ok(request.input.includes('previousDocumentation'));
  assert.equal(request.text.format.schema.properties.documents.additionalProperties, false);
  assert.deepEqual(request.text.format.schema.properties.documents.required, DOC_NAMES);
});
test('common secrets are removed', () => {
  const value = redact('sk-abcdefghijklmnopqrstuvwxyz password="private" https://user:secret@example.com -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
  assert.ok(!value.includes('abcdefghijklmnopqrstuvwxyz'));
  assert.ok(!value.includes('"private"'));
  assert.ok(!value.includes('user:secret'));
  assert.ok(!value.includes('\nabc'));
});
test('valid responses parse; incomplete, refused, empty, and injected paths are rejected', () => {
  assert.deepEqual(parseResponse(response(docs('new'))).documents, docs('new'));
  assert.throws(() => parseResponse({ status: 'incomplete' }), /did not finish/);
  assert.throws(() => parseResponse({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }), /declined/);
  assert.throws(() => parseResponse(response({ ...docs('new'), 'SETUP.md': '' })), /incomplete documentation/);
  assert.throws(() => parseResponse(response({ ...docs('new'), '../../evil': 'no' })), /incomplete documentation/);
  assert.throws(() => parseResponse({ status: 'completed', output: [] }), /invalid documentation JSON/);
});
test('OpenAI transport sets authorization and handles account errors without exposing credentials', async () => {
  const result = await generate('test-key', { model: 'test' }, undefined, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return { ok: true, json: async () => response(docs('new')) };
  });
  assert.equal(result.summary, 'Updated');
  for (const code of [401, 403, 429, 500]) await assert.rejects(() => generate('test-key', {}, undefined, async () => ({ ok: false, status: code })), error => !error.message.includes('test-key'));
});
test('successive runs overwrite the same documents, retain previous backup, and support restoring', async t => {
  const root = await fixture(t), storage = path.join(root, 'state');
  const release = await acquireLock(storage);
  try {
    const empty = await readDocs(root);
    await writeDocs(root, docs('session one'), empty, storage);
    await writeDocs(root, docs('session two'), await readDocs(root), storage);
    assert.deepEqual(await readDocs(root), docs('session two'));
    const backup = await loadJson(path.join(storage, 'backup.json'));
    assert.deepEqual(backup.documents, docs('session one'));
    await writeDocs(root, backup.documents, await readDocs(root), storage);
    assert.deepEqual(await readDocs(root), docs('session one'));
    assert.deepEqual((await loadJson(path.join(storage, 'backup.json'))).documents, docs('session two'));
    assert.equal((await fs.readdir(path.join(root, 'docs/docpilot'))).length, 4);
  } finally { await release(); }
});
test('manual edits and cancellation protect existing documentation', async t => {
  const root = await fixture(t), storage = path.join(root, 'state');
  await fs.mkdir(storage);
  const empty = await readDocs(root);
  await writeDocs(root, docs('original'), empty, storage);
  const expected = await readDocs(root);
  await put(root, 'docs/docpilot/SETUP.md', '# Manual change');
  await assert.rejects(() => writeDocs(root, docs('new'), expected, storage), /changed during/);
  assert.equal((await readDocs(root))['SETUP.md'], '# Manual change');
  const before = await readDocs(root);
  await assert.rejects(() => writeDocs(root, docs('new'), before, storage, () => { throw new Error('Cancelled'); }), /Cancelled/);
  assert.deepEqual(await readDocs(root), before);
});
test('ordinary commit failures roll back already-written documents', async t => {
  const root = await fixture(t), storage = path.join(root, 'state');
  await fs.mkdir(storage);
  await writeDocs(root, docs('original'), await readDocs(root), storage);
  let checks = 0;
  await assert.rejects(() => writeDocs(root, docs('replacement'), docs('original'), storage, () => { if (++checks === 4) throw new Error('Simulated write interruption'); }), /interruption/);
  assert.deepEqual(await readDocs(root), docs('original'));
  assert.deepEqual((await fs.readdir(path.join(root, 'docs/docpilot'))).sort(), [...DOC_NAMES].sort());
});
test('project lock prevents overlapping windows and releases cleanly', async t => {
  const root = await fixture(t);
  const release = await acquireLock(root);
  await assert.rejects(() => acquireLock(root), /Another DocPilot run/);
  await release();
  await (await acquireLock(root))();
});
test('symlinked output directory is rejected', async t => {
  const root = await fixture(t), outside = await fixture(t);
  await fs.symlink(outside, path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => readDocs(root), /Unsafe documentation/);
  assert.deepEqual(await fs.readdir(outside), []);
});
