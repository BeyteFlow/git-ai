import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';
import { ConfigService } from '../../services/ConfigService.js';
import { AIService } from '../../services/AIService.js';
import { AiNotesStore } from '../../ai/notes-store.js';

type ExplainOptions = {
  commit?: string;
  maxCommits?: string;
};

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildAiExplainCommand(): Command {
  const cmd = new Command('explain')
    .description('Reconstruct high-level reasoning behind a file using stored AI metadata')
    .argument('<file>', 'File to explain')
    .option('-c, --commit <sha>', 'Commit to use (default: HEAD)', 'HEAD')
    .option('--max-commits <n>', 'Max commits to scan for attribution (default: 200)', '200')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai explain src/parser.ts',
      ].join('\n')
    )
    .action(async (file: string, opts: ExplainOptions) => {
      const git = new GitService();
      const store = new AiNotesStore(git);
      const commit = (opts.commit ?? 'HEAD').trim();
      const maxCommits = toNum(opts.maxCommits, 200);

      let fileContent = '';
      try {
        fileContent = await git.raw(['show', `${commit}:${file}`]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to read ${file} at ${commit}: ${msg}`);
        process.exitCode = 1;
        return;
      }

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

      // Collect relevant records (best-effort: those that either target the path or exist on touching commits).
      const records: any[] = [];
      for (const c of commits) {
        const idx = await store.listIndexForCommit(c);
        for (const entry of idx) {
          if (entry.path && entry.path !== file) continue;
          const rec = await store.getRecord(c, entry.id);
          if (!rec) continue;
          records.push({ noteCommit: c, ...rec });
        }
      }

      if (records.length === 0) {
        console.log('No AI attribution records found for this file.');
        console.log('Tip: attach one with `ai-git ai record --path <file> --lines-from-file ...`');
        return;
      }

      let ai: AIService;
      try {
        const config = new ConfigService();
        ai = new AIService(config);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`AI not configured: ${msg}`);
        console.error('Recovery: run `ai-git init` (or set ~/.aigitrc) to configure an AI provider.');
        process.exitCode = 1;
        return;
      }

      const prompt = [
        'You are helping a developer understand why a file exists and how it evolved.',
        'Summarize intent and reasoning based on the AI attribution records and the current file content.',
        '',
        'AI ATTRIBUTION RECORDS (JSON):',
        JSON.stringify(records, null, 2),
        '',
        'CURRENT FILE CONTENT:',
        fileContent,
        '',
        'Output:',
        '- 3-6 bullet points of why the code exists / intent',
        '- note any prompt evolution you can infer',
        '- call out risky areas (security/maintainability) if obvious',
        '- keep it concise',
      ].join('\n');

      try {
        const out = await ai.generateContent(prompt);
        console.log(out.trim());
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to generate explanation: ${msg}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
