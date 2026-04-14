import { Command } from 'commander';
import { buildAiLogCommand } from './AiLogCommand.js';
import { buildAiInspectCommand } from './AiInspectCommand.js';
import { buildAiBlameCommand } from './AiBlameCommand.js';
import { buildAiRecordCommand } from './AiRecordCommand.js';
import { buildAiExportCommand } from './AiExportCommand.js';
import { buildAiImportCommand } from './AiImportCommand.js';
import { buildAiInteractiveCommand } from './AiInteractiveCommand.js';
import { buildAiNotesCommand } from './AiNotesCommand.js';
import { buildAiExplainCommand } from './AiExplainCommand.js';
import { buildAiValidateCommand } from './AiValidateCommand.js';
import { buildAiScanCommand } from './AiScanCommand.js';

export function buildAiCommand(): Command {
  const ai = new Command('ai')
    .description('AI attribution and reasoning metadata (git notes based)');

  ai.addCommand(buildAiLogCommand());
  ai.addCommand(buildAiBlameCommand());
  ai.addCommand(buildAiInspectCommand());
  ai.addCommand(buildAiRecordCommand());
  ai.addCommand(buildAiExportCommand());
  ai.addCommand(buildAiImportCommand());
  ai.addCommand(buildAiInteractiveCommand());
  ai.addCommand(buildAiNotesCommand());
  ai.addCommand(buildAiExplainCommand());
  ai.addCommand(buildAiValidateCommand());
  ai.addCommand(buildAiScanCommand());

  ai.addHelpText(
    'after',
    [
      '',
      'Notes storage:',
      '  This tool stores metadata in `git notes --ref refs/notes/git-ai`.',
      '  Preserve notes across rebases/amends with:',
      '    git config --add notes.rewriteRef refs/notes/git-ai',
      '  Share notes with teammates by pushing/fetching that ref:',
      '    git push origin refs/notes/git-ai',
      '    git fetch origin refs/notes/git-ai:refs/notes/git-ai',
    ].join('\n')
  );

  return ai;
}
