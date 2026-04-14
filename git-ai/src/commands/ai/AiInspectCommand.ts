import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';

type InspectOptions = {
  commit?: string;
};

export function buildAiInspectCommand(): Command {
  const cmd = new Command('inspect')
    .description('Show full AI attribution record by id')
    .argument('<id>', 'Attribution record id')
    .option('-c, --commit <sha>', 'Commit containing the record (default: HEAD)', 'HEAD')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai inspect 2b3c... --commit HEAD',
      ].join('\n')
    )
    .action(async (id: string, opts: InspectOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const commit = (opts.commit ?? 'HEAD').trim();

      try {
        const resolved = (await git.raw(['rev-parse', commit])).trim();
        const rec = await store.getRecord(resolved, id);
        if (!rec) {
          console.error(`Not found: ${id} on ${resolved}`);
          console.error('Recovery: use `ai-git ai log` to list records and confirm commit/id.');
          process.exitCode = 2;
          return;
        }
        console.log(JSON.stringify(rec, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to inspect record: ${msg}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
