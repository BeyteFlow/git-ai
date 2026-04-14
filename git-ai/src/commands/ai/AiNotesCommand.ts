import { Command } from 'commander';
import { GitService } from '../../core/GitService.js';

type NotesOptions = {
  remote?: string;
};

export function buildAiNotesCommand(): Command {
  const cmd = new Command('notes')
    .description('Help manage sharing AI notes refs across remotes')
    .option('--remote <name>', 'Remote name (default: origin)', 'origin')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  ai-git ai notes',
        '  ai-git ai notes --remote upstream',
        '',
        'Suggested commands (run yourself):',
        '  git push <remote> refs/notes/git-ai',
        '  git fetch <remote> refs/notes/git-ai:refs/notes/git-ai',
        '  git config --add notes.displayRef refs/notes/git-ai',
        '',
        'To carry notes through rebases/cherry-picks:',
        '  git config --add notes.rewriteRef refs/notes/git-ai',
        '',
        'Why: git notes are separate objects; rewriteRef tells git to copy notes when commits are rewritten.',
      ].join('\n')
    )
    .action(async (opts: NotesOptions) => {
      const git = new GitService();
      const remote = (opts.remote ?? 'origin').trim() || 'origin';

      let remotes: any[] = [];
      try {
        remotes = await git.getRemotes(true);
      } catch {
        // ignore
      }
      const found = remotes.find((r: any) => r.name === remote);

      console.log('AI notes ref: refs/notes/git-ai');
      console.log('');
      console.log('Share notes with teammates:');
      console.log(`  git push ${remote} refs/notes/git-ai`);
      console.log(`  git fetch ${remote} refs/notes/git-ai:refs/notes/git-ai`);
      console.log('');
      console.log('Make notes visible by default:');
      console.log('  git config --add notes.displayRef refs/notes/git-ai');
      console.log('');
      console.log('Preserve notes across rebases/cherry-picks:');
      console.log('  git config --add notes.rewriteRef refs/notes/git-ai');
      console.log('');
      if (!found) {
        console.log(`Note: remote '${remote}' not found in this repo.`);
      }
    });

  return cmd;
}
