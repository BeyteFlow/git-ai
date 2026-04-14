#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { commitCommand } from './commands/CommitCommand.js';
import { runPRCommand } from './cli/pr-command.js';
import { runResolveCommand } from './commands/ResolveCommand.js';
import { initCommand } from './commands/InitCommand.js';
import { treeCommand } from './commands/TreeCommand.js';
import { buildAiCommand } from './commands/ai/index.js';
import { buildAiLogCommand } from './commands/ai/AiLogCommand.js';
import { buildAiBlameCommand } from './commands/ai/AiBlameCommand.js';
import { buildAiInspectCommand } from './commands/ai/AiInspectCommand.js';
import { buildAiRecordCommand } from './commands/ai/AiRecordCommand.js';
import { buildAiExportCommand } from './commands/ai/AiExportCommand.js';
import { buildAiImportCommand } from './commands/ai/AiImportCommand.js';
import { buildAiInteractiveCommand } from './commands/ai/AiInteractiveCommand.js';
import { buildAiNotesCommand } from './commands/ai/AiNotesCommand.js';
import { buildAiExplainCommand } from './commands/ai/AiExplainCommand.js';
import { buildAiValidateCommand } from './commands/ai/AiValidateCommand.js';
import { buildAiScanCommand } from './commands/ai/AiScanCommand.js';

const program = new Command();

const VERSION = '1.0.0';

const binPath = process.argv[1] ? path.basename(process.argv[1]) : 'ai-git';
const nameFromBin = binPath.toLowerCase().includes('git-ai') ? 'git-ai' : 'ai-git';

// Avoid noisy banners for non-interactive usage.
if (process.stdout.isTTY) {
  const banner = `
  ${chalk.bold.magenta('●')} ${chalk.bold(nameFromBin.toUpperCase())} ${chalk.dim(`v${VERSION}`)}
  ${chalk.dim('————————————————————————————————')}
`;
  console.log(banner);
}

program
  .name(nameFromBin)
  .description(
    nameFromBin === 'git-ai'
      ? 'AI attribution metadata for git (use via: git ai <command>)'
      : 'AI-Powered Git CLI Assistant'
  )
  .version(VERSION);

if (nameFromBin === 'git-ai') {
  // Git subcommand mode: `git ai <cmd>` executes `git-ai <cmd>`.
  program.addCommand(buildAiLogCommand());
  program.addCommand(buildAiBlameCommand());
  program.addCommand(buildAiInspectCommand());
  program.addCommand(buildAiRecordCommand());
  program.addCommand(buildAiExportCommand());
  program.addCommand(buildAiImportCommand());
  program.addCommand(buildAiInteractiveCommand());
  program.addCommand(buildAiNotesCommand());
  program.addCommand(buildAiExplainCommand());
  program.addCommand(buildAiValidateCommand());
  program.addCommand(buildAiScanCommand());
} else {
  // Standalone mode: keep existing commands and also provide `ai` namespace.
  program.addCommand(buildAiCommand());

  program
    .command('commit')
    .description('Generate AI commit message for staged changes')
    .action(commitCommand);

  program
    .command('prs')
    .description('Interactively list and view GitHub PRs')
    .action(runPRCommand);

  program
    .command('resolve')
    .description('Analyze and resolve merge conflicts using AI')
    .action(runResolveCommand);

  program
    .command('init')
    .description('Initialize AI-Git-Terminal with API keys and preferences')
    .action(initCommand);

  program
    .command('tree')
    .description('Visualize git branches')
    .action(treeCommand);
}

program.parse(process.argv);
