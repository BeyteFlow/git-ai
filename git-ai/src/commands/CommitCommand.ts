import { GitService } from '../core/GitService.js';
import { AIService } from '../services/AIService.js';
import { ConfigService } from '../services/ConfigService.js';
import { logger } from '../utils/logger.js';

export async function commitCommand() {
  const config = new ConfigService();
  const git = new GitService();
  const ai = new AIService(config);

  try {
    const diff = await git.getDiff();
    if (!diff) {
      console.log('⚠️  No staged changes found. Use "git add" first.');
      return;
    }

    console.log('🤖 Analyzing changes with Gemini...');
    const message = await ai.generateCommitMessage(diff);
    
    console.log(`\n✨ Suggested message: "${message}"`);
    
    // For now, we commit directly. Later we can add an Ink confirmation.
    await git.commit(message);
    console.log('✅ Committed successfully!');
  } catch (error) {
    logger.error(error);
  }
}