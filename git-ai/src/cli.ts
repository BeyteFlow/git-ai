#!/usr/bin/env node
import { program } from 'commander';

program
  .name('ai-git')
  .description('AI-Powered Visual Git CLI for modern developers')
  .version('1.0.0');

program.parse(process.argv);
