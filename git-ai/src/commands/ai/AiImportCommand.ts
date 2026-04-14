import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { AiAttributionSchema } from '../../ai/schema.js';

type ImportOptions = {
  file?: string;
};

export function buildAiImportCommand(): Command {
  const cmd = new Command('import')
    .description('Import AI attribution records from a JSONL export into git notes')
    .option('-f, --file <file>', 'Input JSONL file', 'git-ai-attribution.jsonl')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai import --file audit.jsonl',
      ].join('\n')
    )
    .action(async (opts: ImportOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const file = (opts.file ?? 'git-ai-attribution.jsonl').trim();

      const fs = await import('fs/promises');
      let raw = '';
      try {
        raw = await fs.readFile(file, 'utf8');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to read ${file}: ${msg}`);
        process.exitCode = 1;
        return;
      }

      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let ok = 0;
      let bad = 0;

      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        try {
          const parsed = JSON.parse(line);
          const rec = AiAttributionSchema.parse(parsed);
          await store.upsertAttribution(rec);
          ok++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`Line ${lineNum}: invalid or unparseable (${msg})`);
          bad++;
        }
      }

      console.log(`Imported ${ok} record(s) into ${store.getNotesRef()}`);
      if (bad > 0) {
        console.warn(`Skipped ${bad} invalid line(s).`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
