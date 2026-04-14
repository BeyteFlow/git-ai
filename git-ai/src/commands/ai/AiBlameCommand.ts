import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { hashLine } from '../../ai/line-hash.js';

type BlameOptions = {
  commit?: string;
  maxCommits?: string;
};

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

      const lines = fileContent.split(/\r?\n/);
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
      const recordMeta: Map<string, { commit: string; intent: string; model: string; provider: string; prompt: string }> = new Map();

      for (const c of commits) {
        const idx = await store.listIndexForCommit(c);
        for (const entry of idx) {
          const rec = await store.getRecord(c, entry.id);
          if (!rec) continue;
          recordMeta.set(entry.id, {
            commit: c,
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
      const annotated: { lineNo: number; line: string; recordId?: string }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const h = lineHashes[i];
        const matches = hashToRecord.get(h);
        const recordId = matches && matches.length > 0 ? matches[0].id : undefined;
        annotated.push({ lineNo: i + 1, line: lines[i], recordId });
      }

      const any = annotated.some((a) => a.recordId);
      if (!any) {
        console.log('No AI attribution correlated to current file content.');
        console.log('Tip: record attributions with `ai-git ai record --lines-from-file --path <file> ...`');
        return;
      }

      // Print a compact blame-like output. Group consecutive lines by record.
      let currentId: string | undefined;
      let blockStart = 1;
      for (let i = 0; i < annotated.length; i++) {
        const id = annotated[i].recordId;
        if (i === 0) {
          currentId = id;
          blockStart = 1;
          continue;
        }
        if (id !== currentId) {
          printBlock(blockStart, i, currentId, recordMeta);
          currentId = id;
          blockStart = i + 1;
        }
      }
      printBlock(blockStart, annotated.length, currentId, recordMeta);
    });

  return cmd;
}

function printBlock(
  startLine: number,
  endLine: number,
  recordId: string | undefined,
  recordMeta: Map<string, { commit: string; intent: string; model: string; provider: string; prompt: string }>
): void {
  const range = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
  if (!recordId) {
    console.log(`${range}  (no-ai)  `);
    return;
  }
  const meta = recordMeta.get(recordId);
  if (!meta) {
    console.log(`${range}  ${recordId}  (missing metadata)`);
    return;
  }
  const short = meta.commit.substring(0, 12);
  console.log(`${range}  ${recordId}  ${meta.provider}/${meta.model}  intent=${meta.intent}  commit=${short}`);
  // Print prompt on its own line to keep the blame output readable.
  console.log(`         prompt: ${meta.prompt.replace(/\s+/g, ' ').trim()}`);
}
