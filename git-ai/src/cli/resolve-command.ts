import { ConflictResolver } from '../services/ConflictResolver.js';
import { AIService } from '../services/AIService.js';
import { GitService } from '../core/GitService.js';
import { ConfigService } from '../services/ConfigService.js';

export async function runResolveCommand() {
  try {
    const config = new ConfigService();
    const git = new GitService();
    const ai = new AIService(config);
    const resolver = new ConflictResolver(ai, git);

    const conflicts = await resolver.getConflicts();

    if (conflicts.length === 0) {
      console.log('✅ No merge conflicts detected.');
      return;
    }

    console.log(`🔍 Found ${conflicts.length} files with conflicts.`);

    for (const conflict of conflicts) {
      try {
        console.log(`🤖 Analyzing ${conflict.file}...`);
        const suggestion = await resolver.suggestResolution(conflict);

        console.log(`\n--- AI Suggested Resolution for ${conflict.file} ---`);
        console.log(suggestion);
        console.log('--------------------------------------------------\n');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`⚠️ Failed to process conflict for ${conflict.file}: ${message}`);
      }

      // In the final UI/Ink phase, we would add a [Apply] / [Skip] prompt here.
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to initialize conflict resolution: ${message}`);
    process.exit(1);
  }
}