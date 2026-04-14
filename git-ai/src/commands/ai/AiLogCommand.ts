import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { matchesFilter, AiFilter } from '../../ai/query.js';
import { AiIndexEntry } from '../../ai/schema.js';

type LogOptions = {
  limit?: string;
  model?: string;
  provider?: string;
  author?: string;
  intent?: string;
  since?: string;
  until?: string;
};

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildAiLogCommand(): Command {
  const cmd = new Command('log')
    .description('Show AI attribution attached to commits (from git notes)')
    .option('-n, --limit <n>', 'Number of commits to scan (default: 50)', '50')
    .option('--model <model>', 'Filter by model')
    .option('--provider <provider>', 'Filter by provider')
    .option('--author <author>', 'Filter by author')
    .option('--intent <intent>', 'Filter by intent')
    .option('--since <iso>', 'Filter by createdAt >= ISO time')
    .option('--until <iso>', 'Filter by createdAt <= ISO time')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai log -n 100',
        '  ai-git ai log --model gemini-1.5-flash --since 2026-01-01T00:00:00Z',
      ].join('\n')
    )
    .action(async (opts: LogOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const limit = toNum(opts.limit, 50);
      const filter: AiFilter = {
        model: opts.model,
        provider: opts.provider,
        author: opts.author,
        intent: opts.intent,
        since: opts.since,
        until: opts.until,
      };

      // Get recent commits quickly.
      let commits: string[] = [];
      try {
        const out = await git.raw(['rev-list', `--max-count=${limit}`, 'HEAD']);
        commits = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to list commits: ${msg}`);
        process.exitCode = 1;
        return;
      }

      const rows: { commit: string; entry: AiIndexEntry }[] = [];
      for (const commit of commits) {
        const idx = await store.listIndexForCommit(commit);
        for (const entry of idx) {
          if (matchesFilter(entry, filter)) rows.push({ commit, entry });
        }
      }

      if (rows.length === 0) {
        console.log('No AI attribution found in scanned commits.');
        console.log('Tip: use `ai-git ai record ...` to attach metadata to a commit.');
        return;
      }

      for (const row of rows) {
        const e = row.entry;
        const meta = [
          `${e.provider}/${e.model}`,
          e.intent,
          e.author ? `by ${e.author}` : undefined,
          e.path ? `path=${e.path}` : undefined,
          e.createdAt,
        ].filter(Boolean).join(' | ');
        console.log(`${row.commit.substring(0, 12)}  ${e.id}  ${meta}`);
      }
    });

  return cmd;
}
