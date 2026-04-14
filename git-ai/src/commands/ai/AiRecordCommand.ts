import { Command } from 'commander';
import { ConfigService } from '../../services/ConfigService.js';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { AttributionService } from '../../ai/attribution.js';
import { logger } from '../../utils/logger.js';

type RecordOptions = {
  commit?: string;
  path?: string;
  intent: string;
  prompt: string;
  model?: string;
  provider?: string;
  author?: string;
  linesFromFile?: boolean;
};

export function buildAiRecordCommand(): Command {
  const cmd = new Command('record')
    .description('Attach AI attribution metadata to a commit (stored in git notes)')
    .option('-c, --commit <sha>', 'Commit to annotate (default: HEAD)')
    .option('-p, --path <path>', 'File path this attribution primarily relates to')
    .requiredOption('--intent <intent>', 'Intent (why the code exists)')
    .requiredOption('--prompt <prompt>', 'Prompt used to generate the code')
    .option('--provider <provider>', 'AI provider (default: from config)', undefined)
    .option('--model <model>', 'Model name (default: from config)', undefined)
    .option('--author <author>', 'Human author (default: git user.name)', undefined)
    .option('--lines-from-file', 'Anchor using current file lines (best-effort)', false)
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai record --intent "refactor" --prompt "simplify parser" --path src/parser.ts',
        '  ai-git ai record --commit HEAD~1 --intent "bugfix" --prompt "fix null deref"',
      ].join('\n')
    )
    .action(async (opts: RecordOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const attribution = new AttributionService(git);

      const commitish = (opts.commit ?? 'HEAD').trim();
      let commit = commitish;
      try {
        commit = (await git.raw(['rev-parse', commitish])).trim();
      } catch {
        // keep commitish for error reporting below
        commit = commitish;
      }

      let author = opts.author?.trim();
      if (!author) {
        try {
          author = (await git.raw(['config', '--get', 'user.name'])).trim() || undefined;
        } catch {
          author = undefined;
        }
      }

      // Provider/model defaults come from config when possible.
      let provider = opts.provider?.trim();
      let model = opts.model?.trim();
      try {
        const config = new ConfigService().getConfig();
        provider ||= config.ai.provider;
        model ||= config.ai.model ?? 'unknown';
      } catch {
        provider ||= 'unknown';
        model ||= 'unknown';
      }

      let lines: string[] | undefined;
      if (opts.linesFromFile && opts.path) {
        try {
          // Anchor to the version of the file in the annotated commit.
          // This improves survivability and makes the attribution reproducible.
          const raw = await git.raw(['show', `${commit}:${opts.path}`]);
          lines = raw.split(/\r?\n/);
        } catch (error) {
          logger.warn({ err: error }, `Failed to read --lines-from-file path: ${opts.path}`);
        }
      }

      try {
        const rec = await attribution.buildRecord(commit, {
          provider,
          model,
          intent: opts.intent,
          prompt: opts.prompt,
          author,
          path: opts.path,
          lines,
        });
        await store.upsertAttribution(rec);
        console.log(`Recorded AI attribution on ${commit}: ${rec.id}`);
        console.log(`Notes ref: ${store.getNotesRef()}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to record attribution: ${msg}`);
        console.error(`Recovery: ensure you are in a git repository and the commit exists (${commitish}).`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
