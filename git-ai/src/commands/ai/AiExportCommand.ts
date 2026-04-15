import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';

type ExportOptions = {
  out?: string;
  limit?: string;
};

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildAiExportCommand(): Command {
  const cmd = new Command('export')
    .description('Export AI attribution notes to a JSONL file for audits/analytics')
    .option('-o, --out <file>', 'Output file (default: git-ai-attribution.jsonl)', 'git-ai-attribution.jsonl')
    .option('-n, --limit <n>', 'Number of commits to scan (default: 5000)', '5000')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai export --out audit.jsonl',
        '  ai-git ai export -n 10000',
      ].join('\n')
    )
    .action(async (opts: ExportOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const outFile = (opts.out ?? 'git-ai-attribution.jsonl').trim();
      const limit = toNum(opts.limit, 5000);

      let commits: string[] = [];
      try {
        const out = await git.raw(['rev-list', `--max-count=${limit}`, 'HEAD']);
        commits = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to list commits: ${msg}`);
        process.exitCode = 1;
        return;
      }

      const fs = await import('fs/promises');
      const lines: string[] = [];

      for (const c of commits) {
        const idx = await store.listIndexForCommit(c);
        for (const entry of idx) {
          const rec = await store.getRecord(c, entry.id);
          if (!rec) continue;
          lines.push(JSON.stringify(rec));
        }
      }

      try {
        await fs.writeFile(outFile, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
        console.log(`Exported ${lines.length} record(s) to ${outFile}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to write ${outFile}: ${msg}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
