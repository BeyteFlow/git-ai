import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';

type ScanOptions = {
  commit?: string;
};

const RISK_RULES: { id: string; pattern: RegExp; message: string }[] = [
  { id: 'eval', pattern: /\beval\s*\(/, message: 'Use of eval() can lead to code injection.' },
  { id: 'child_process', pattern: /\bchild_process\b|\bexec\s*\(|\bexecSync\s*\(|\bspawn\s*\(/, message: 'Spawning processes is risky; validate inputs.' },
  { id: 'shell', pattern: /\bshell\s*:\s*true/, message: 'shell:true can enable command injection.' },
  { id: 'insecure_random', pattern: /\bMath\.random\b/, message: 'Math.random is not cryptographically secure.' },
  { id: 'deserialize', pattern: /\b(YAML\.load|pickle\.loads|Marshal\.load)\b/, message: 'Unsafe deserialization is a common RCE vector.' },
  { id: 'sql_concat', pattern: /SELECT\s+.*\+\s*\w+|INSERT\s+.*\+\s*\w+|UPDATE\s+.*\+\s*\w+|DELETE\s+.*\+\s*\w+/i, message: 'String-concatenated SQL can enable injection; use parameters.' },
];

export function buildAiScanCommand(): Command {
  const cmd = new Command('scan')
    .description('Heuristic scan for risky patterns in current staged diff (best-effort)')
    .option('-c, --commit <sha>', 'Commit to scan diff for (default: HEAD)', 'HEAD')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai scan',
      ].join('\n')
    )
    .action(async (opts: ScanOptions) => {
      const git = new GitService();
      const commit = (opts.commit ?? 'HEAD').trim();

      let diff = '';
      try {
        // Default: scan staged diff. If in git subcommand mode, users can still stage before scan.
        diff = await git.raw(['diff', '--cached']);
        if (!diff.trim()) {
          // Fallback: scan last commit patch.
          diff = await git.raw(['show', '--format=', commit]);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to obtain diff: ${msg}`);
        process.exitCode = 1;
        return;
      }

      const hits: { rule: string; message: string; sample: string }[] = [];
      for (const rule of RISK_RULES) {
        const m = diff.match(rule.pattern);
        if (m) {
          hits.push({ rule: rule.id, message: rule.message, sample: m[0] });
        }
      }

      if (hits.length === 0) {
        console.log('No risky patterns detected (heuristic scan).');
        return;
      }

      console.log('Potential risks detected:');
      for (const hit of hits) {
        console.log(`- ${hit.rule}: ${hit.message} (e.g. ${hit.sample})`);
      }

      process.exitCode = 2;
    });

  return cmd;
}
