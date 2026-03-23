#!/usr/bin/env node
import { Command } from 'commander';
import { commitCommand } from './commands/CommitCommand.js';
import { runPRCommand } from './cli/pr-command.js';
import { runResolveCommand } from './commands/ResolveCommand.js';
import { initCommand } from './commands/InitCommand.js';

const program = new Command();

program
  .name('ai-git')
  .description('AI-Powered Git CLI Assistant')
  .version('1.0.0');

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

program.parse(process.argv);