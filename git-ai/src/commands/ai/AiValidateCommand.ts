import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';

type ValidateOptions = {
  limit?: string;
};

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildAiValidateCommand(): Command {
  const cmd = new Command('validate')
    .description('Validate AI notes schema (useful in CI)')
    .option('-n, --limit <n>', 'Number of commits to scan (default: 500)', '500')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai validate -n 2000',
      ].join('\n')
    )
    .action(async (opts: ValidateOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const limit = toNum(opts.limit, 500);

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

      let ok = 0;
      let bad = 0;

      for (const c of commits) {
        const idx = await store.listIndexForCommit(c);
        for (const entry of idx) {
          const rec = await store.getRecord(c, entry.id);
          if (!rec) {
            bad++;
            console.error(`Invalid: missing record payload for ${entry.id} on ${c}`);
            continue;
          }
          ok++;
        }
      }

      console.log(`Validated records: ok=${ok} bad=${bad}`);
      if (bad > 0) process.exitCode = 2;
    });

  return cmd;
}
