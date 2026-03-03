import { Command } from 'commander';
import { GitService } from './core/GitService.js';
import { ConfigService } from './services/ConfigService.js';
import { AIService } from './services/AIService.js';
import { logger } from './utils/logger.js';

const program = new Command();
const configService = new ConfigService();
const gitService = new GitService();
const aiService = new AIService(configService);

program
  .name('ai-git')
  .version('0.1.0');

program
  .command('ai-commit')
  .description('Generate a commit message using AI and commit staged changes')
  .action(async () => {
    try {
      const diff = await gitService.getDiff();
      if (!diff) {
        console.log('No staged changes found. Please stage files first.');
        return;
      }

      console.log('🤖 Generating commit message...');
      const message = await aiService.generateCommitMessage(diff);
      
      console.log(`\nSuggested Message: "${message}"`);
      await gitService.commit(message);
      console.log('✅ Changes committed successfully.');
    } catch (err) {
      logger.error(`AI Commit failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);