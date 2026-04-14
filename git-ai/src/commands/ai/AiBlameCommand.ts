import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { hashLine } from '../../ai/line-hash.js';

type BlameOptions = {
  commit?: string;
  maxCommits?: string;
};

// Strip ANSI escape sequences and C0/C1 control characters, then truncate.
function sanitizeForTerminal(value: string, maxLen = 200): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildAiBlameCommand(): Command {
  const cmd = new Command('blame')
    .description('Explain why code exists by correlating current lines with AI attribution anchors')
    .argument('<file>', 'File to blame')
    .option('-c, --commit <sha>', 'Commit to blame (default: HEAD)', 'HEAD')
    .option('--max-commits <n>', 'Max commits to scan for notes correlation (default: 200)', '200')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai blame src/index.ts',
        '  ai-git ai blame src/index.ts --commit main --max-commits 500',
      ].join('\n')
    )
    .action(async (file: string, opts: BlameOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const commit = (opts.commit ?? 'HEAD').trim();
      const maxCommits = toNum(opts.maxCommits, 200);

      // 1) Load file content from the selected commit.
      let fileContent = '';
      try {
        fileContent = await git.raw(['show', `${commit}:${file}`]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to read ${file} at ${commit}: ${msg}`);
        console.error('Recovery: verify the file exists in that commit.');
        process.exitCode = 1;
        return;
      }

      // Strip a single trailing newline so the split does not produce a synthetic empty last element.
      const trimmedContent = fileContent.replace(/\r?\n$/, '');
      const lines = trimmedContent.split(/\r?\n/);
      const lineHashes = lines.map(hashLine);

      // 2) Get commits that last touched the file.
      let commits: string[] = [];
      try {
        const out = await git.raw(['rev-list', `--max-count=${maxCommits}`, commit, '--', file]);
        commits = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to list commits for ${file}: ${msg}`);
        process.exitCode = 1;
        return;
      }

      // 3) Load notes records for those commits and build a reverse index of hash -> record id.
      const hashToRecord: Map<string, { commit: string; id: string }[]> = new Map();
      const recordMeta: Map<
        string,
        { commit: string; createdAt: string; intent: string; model: string; provider: string; prompt: string }
      > = new Map();

      for (const c of commits) {
        const idx = await store.listIndexForCommit(c);
        for (const entry of idx) {
          const rec = await store.getRecord(c, entry.id);
          if (!rec) continue;
          const compositeKey = `${c}:${entry.id}`;
          recordMeta.set(compositeKey, {
            commit: c,
            createdAt: rec.createdAt,
            intent: rec.intent,
            model: rec.model,
            provider: rec.provider,
            prompt: rec.prompt,
          });
          for (const h of rec.anchors.lineHashes) {
            const prev = hashToRecord.get(h) ?? [];
            prev.push({ commit: c, id: entry.id });
            hashToRecord.set(h, prev);
          }
        }
      }

      // 4) Annotate each line with best match (first record that claims the hash).
      const annotated: { lineNo: number; line: string; recordKey?: string }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const h = lineHashes[i];
        const matches = hashToRecord.get(h);
        const recordKey = pickDeterministicRecordKey(matches, recordMeta);
        annotated.push({ lineNo: i + 1, line: lines[i], recordKey });
      }

      const any = annotated.some((a) => a.recordKey);
      if (!any) {
        console.log('No AI attribution correlated to current file content.');
        console.log('Tip: record attributions with `ai-git ai record --lines-from-file --path <file> ...`');
        return;
      }

      // Print a compact blame-like output. Group consecutive lines by record.
      let currentKey: string | undefined;
      let blockStart = 1;
      for (let i = 0; i < annotated.length; i++) {
        const key = annotated[i].recordKey;
        if (i === 0) {
          currentKey = key;
          blockStart = 1;
          continue;
        }
        if (key !== currentKey) {
          printBlock(blockStart, i, currentKey, recordMeta);
          currentKey = key;
          blockStart = i + 1;
        }
      }
      printBlock(blockStart, annotated.length, currentKey, recordMeta);
    });

  return cmd;
}

function printBlock(
  startLine: number,
  endLine: number,
  recordKey: string | undefined,
  recordMeta: Map<string, { commit: string; createdAt: string; intent: string; model: string; provider: string; prompt: string }>
): void {
  const range = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
  if (!recordKey) {
    console.log(`${range}  (no-ai)  `);
    return;
  }
  const meta = recordMeta.get(recordKey);
  if (!meta) {
    console.log(`${range}  ${sanitizeForTerminal(recordKey)}  (missing metadata)`);
    return;
  }
  const short = meta.commit.substring(0, 12);
  const provider = sanitizeForTerminal(meta.provider);
  const model = sanitizeForTerminal(meta.model);
  const intent = sanitizeForTerminal(meta.intent);
  const prompt = sanitizeForTerminal(meta.prompt.replace(/\s+/g, ' ').trim());
  const recordId = recordKey.includes(':') ? recordKey.split(':').slice(1).join(':') : recordKey;
  console.log(`${range}  ${sanitizeForTerminal(recordId)}  ${provider}/${model}  intent=${intent}  commit=${short}`);
  // Print prompt on its own line to keep the blame output readable.
  console.log(`         prompt: ${prompt}`);
}

function pickDeterministicRecordKey(
  matches: { commit: string; id: string }[] | undefined,
  recordMeta: Map<string, { createdAt: string }>
): string | undefined {
  if (!matches || matches.length === 0) return undefined;

  // Deterministic selection when multiple records claim the same line hash.
  // Prefer the newest record by createdAt (numeric timestamp), then by id.
  const sorted = [...matches].sort((a, b) => {
    const aKey = `${a.commit}:${a.id}`;
    const bKey = `${b.commit}:${b.id}`;
    const aRaw = recordMeta.get(aKey)?.createdAt ?? '';
    const bRaw = recordMeta.get(bKey)?.createdAt ?? '';
    const aTime = Number.isFinite(Date.parse(aRaw)) ? Date.parse(aRaw) : 0;
    const bTime = Number.isFinite(Date.parse(bRaw)) ? Date.parse(bRaw) : 0;
    if (aTime !== bTime) return bTime - aTime; // newest first
    return a.id.localeCompare(b.id);
  });
  const best = sorted[0];
  return best ? `${best.commit}:${best.id}` : undefined;
}
