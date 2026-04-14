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

test('git notes rewrite (amend) carries refs/notes/git-ai', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-ai-test-'));
  try {
    await runGit(dir, ['init']);
    await runGit(dir, ['config', 'user.email', 'test@example.com']);
    await runGit(dir, ['config', 'user.name', 'Test User']);

    await fs.writeFile(path.join(dir, 'file.txt'), 'hello\n', 'utf8');
    await runGit(dir, ['add', '.']);
    await runGit(dir, ['commit', '-m', 'init']);
    const sha1 = (await runGit(dir, ['rev-parse', 'HEAD'])).trim();

    const git = new GitService(dir);
    const store = new AiNotesStore(git);
    const attribution = new AttributionService(git);

    const rec = await attribution.buildRecord(sha1, {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      intent: 'test',
      prompt: 'amend rewrite',
      path: 'file.txt',
      lines: ['hello'],
    });
    await store.upsertAttribution(rec);
    assert.equal((await store.listIndexForCommit(sha1)).length, 1);

    // Enable notes rewrite for our notes ref and amend.
    await runGit(dir, ['config', '--add', 'notes.rewriteRef', 'refs/notes/git-ai']);
    await runGit(dir, ['config', 'notes.rewrite.amend', 'true']);

    // Amend commit. Make a tiny content change so the new commit id is guaranteed
    // to differ even if git's timestamp resolution is only 1 second.
    await fs.writeFile(path.join(dir, 'file.txt'), 'hello!\n', 'utf8');
    await runGit(dir, ['add', '.']);
    await runGit(dir, ['commit', '--amend', '--no-edit']);
    const sha2 = (await runGit(dir, ['rev-parse', 'HEAD'])).trim();
    assert.notEqual(sha1, sha2);

    const idx2 = await store.listIndexForCommit(sha2);
    // If git notes rewrite is working, the note should have been copied.
    assert.equal(idx2.length, 1);
    const loaded2 = await store.getRecord(sha2, idx2[0].id);
    assert.ok(loaded2);
    assert.equal(loaded2!.prompt, 'amend rewrite');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
