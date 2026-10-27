'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DOC_DIR, DOC_NAMES, optionalRead } = require('./core');

async function safeDirectory(root) {
  let current = root;
  for (const part of DOC_DIR.split('/')) {
    current = path.join(current, part);
    try { await fs.mkdir(current); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Documentation directory must be a real directory, not a symbolic link.');
  }
  return current;
}
async function readDocs(root) {
  // Check every existing ancestor before reading, including junctions on Windows.
  let current = root;
  for (const part of DOC_DIR.split('/')) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe documentation directory.');
    } catch (e) { if (e.code === 'ENOENT') return Object.fromEntries(DOC_NAMES.map(n => [n, null])); throw e; }
  }
  const entries = [];
  for (const name of DOC_NAMES) {
    const file = path.join(current, name);
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 600000) throw new Error(`Cannot safely read ${name}: expected a regular file under 600 KB.`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    entries.push([name, await optionalRead(file)]);
  }
  return Object.fromEntries(entries);
}
async function saveJson(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  try { await fs.rename(temporary, file); } finally { await fs.rm(temporary, { force: true }); }
}
async function loadJson(file, fallback) {
  const text = await optionalRead(file);
  if (text === null) return fallback;
  try { return JSON.parse(text); } catch { throw new Error(`Invalid DocPilot state: ${path.basename(file)}. Your documents have not been changed.`); }
}
async function acquireLock(directory) {
  await fs.mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, 'run.lock');
  let handle;
  try { handle = await fs.open(lockPath, 'wx', 0o600); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const lock = await loadJson(lockPath, null);
    let active = true;
    if (Number.isInteger(lock?.pid)) {
      try { process.kill(lock.pid, 0); } catch (err) { if (err.code === 'ESRCH') active = false; }
    }
    if (active) throw new Error('Another DocPilot run is active for this project. Try again when it finishes.');
    await fs.unlink(lockPath);
    return acquireLock(directory);
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid }));
  await handle.close();
  return () => fs.rm(lockPath, { force: true });
}
async function writeDocs(root, documents, expected, storage, guard = () => {}) {
  const dir = await safeDirectory(root);
  const current = await readDocs(root);
  if (DOC_NAMES.some(n => current[n] !== expected[n])) throw new Error('Documentation changed during this run. Run again to include the latest edits.');
  guard();
  await saveJson(path.join(storage, 'backup.json'), { savedAt: new Date().toISOString(), documents: current });
  const written = [];
  const staged = [];
  try {
    for (const name of DOC_NAMES) {
      if (documents[name] === null) continue;
      const temporary = path.join(dir, '.' + name + '.' + randomUUID() + '.tmp');
      staged.push(temporary);
      await fs.writeFile(temporary, documents[name], { flag: 'wx' });
    }
    guard();
    const latest = await readDocs(root);
    if (DOC_NAMES.some(n => latest[n] !== expected[n])) throw new Error('Documentation changed while saving. Run again.');
    let index = 0;
    for (const name of DOC_NAMES) {
      guard();
      if (documents[name] === null) await fs.rm(path.join(dir, name), { force: true });
      else await fs.rename(staged[index++], path.join(dir, name));
      written.push(name);
    }
  } catch (error) {
    for (const name of written.reverse()) {
      const target = path.join(dir, name);
      if (await optionalRead(target) !== documents[name]) continue;
      if (expected[name] === null) await fs.rm(target, { force: true });
      else await fs.writeFile(target, expected[name]);
    }
    throw error;
  } finally { await Promise.all(staged.map(file => fs.rm(file, { force: true }))); }
}
module.exports = { readDocs, saveJson, loadJson, acquireLock, writeDocs };
