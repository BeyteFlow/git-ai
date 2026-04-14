import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../notes-store.js';
import { AttributionService } from '../attribution.js';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return String(stdout ?? '');
}

test('notes store roundtrip', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-ai-test-'));
  try {
    await runGit(dir, ['init']);
    await runGit(dir, ['config', 'user.email', 'test@example.com']);
    await runGit(dir, ['config', 'user.name', 'Test User']);

    await fs.writeFile(path.join(dir, 'file.txt'), 'hello\nworld\n', 'utf8');
    await runGit(dir, ['add', '.']);
    await runGit(dir, ['commit', '-m', 'init']);

    const sha = (await runGit(dir, ['rev-parse', 'HEAD'])).trim();

    const git = new GitService(dir);
    const store = new AiNotesStore(git);
    const attribution = new AttributionService(git);

    const rec = await attribution.buildRecord(sha, {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      intent: 'test',
      prompt: 'generate something',
      author: 'Test User',
      path: 'file.txt',
      lines: ['hello', 'world'],
    });
    await store.upsertAttribution(rec);

    const idx = await store.listIndexForCommit(sha);
    assert.equal(idx.length, 1);
    assert.equal(idx[0].id, rec.id);

    const loaded = await store.getRecord(sha, rec.id);
    assert.ok(loaded);
    assert.equal(loaded!.prompt, 'generate something');
    assert.equal(loaded!.anchors.lineHashes.length, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
