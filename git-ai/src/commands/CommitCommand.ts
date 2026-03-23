import { GitService } from '../core/GitService.js';
import { AIService } from '../services/AIService.js';
import { ConfigService } from '../services/ConfigService.js';
import { logger } from '../utils/logger.js';
import readline from 'readline/promises';

function validateCommitMessage(message: string): string | null {
  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return 'Commit message cannot be empty or whitespace.';
  }

  if (normalizedMessage.length > 72) {
    return 'Commit message must be 72 characters or fewer.';
  }

  if (/[\x00-\x1F\x7F]/.test(normalizedMessage)) {
    return 'Commit message contains invalid control characters.';
  }

  return null;
}

export async function commitCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const config = new ConfigService();
    const git = new GitService();
    const ai = new AIService(config);
    const diff = await git.getDiff();
    if (!diff) {
      console.log('⚠️  No staged changes found. Use "git add" first.');
      return;
    }

    console.log('🤖 Analyzing changes with Gemini...');
    const suggestedMessage = await ai.generateCommitMessage(diff);
    const suggestedValidationError = validateCommitMessage(suggestedMessage);
    let commitMessage: string | null = null;

    if (suggestedValidationError) {
      logger.warn(`Invalid AI commit message: ${suggestedValidationError}`);
      console.warn(`⚠️ AI returned an invalid message: ${suggestedValidationError}`);
    } else {
      commitMessage = suggestedMessage.trim();
      console.log(`\n✨ Suggested message: "${commitMessage}"`);
    }

    while (true) {
      const choice = (await rl.question('Choose [a]ccept, [e]dit, or [r]eject: ')).trim().toLowerCase();

      if (choice === 'a' || choice === 'accept' || choice === '') {
        if (!commitMessage) {
          console.log('No valid commit message available. Please [e]dit to enter one or [r]eject to cancel.');
          continue;
        }
        break;
      }

      if (choice === 'e' || choice === 'edit') {
        while (true) {
          const editedMessage = await rl.question('✏️ Enter commit message: ');
          const editedValidationError = validateCommitMessage(editedMessage);
          if (!editedValidationError) {
            commitMessage = editedMessage.trim();
            break;
          }
          console.error(`❌ Invalid commit message: ${editedValidationError}`);
        }
        break;
      }

      if (choice === 'r' || choice === 'reject') {
        console.log('🚫 Commit canceled.');
        return;
      }

      console.log('Please choose "a", "e", or "r".');
    }

    if (!commitMessage) {
      // This should not be reachable: the loop only breaks after commitMessage is set,
      // and reject returns early. Guard defensively.
      console.error('❌ No commit message was provided.');
      return;
    }
    await git.commit(commitMessage);
    console.log('✅ Committed successfully!');
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error(`❌ Commit failed: ${errorDetails}`);
    logger.error(error);
  } finally {
    rl.close();
  }
}