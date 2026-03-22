import { GitService } from '../core/GitService.js';
import { AIService } from '../services/AIService.js';
import { ConfigService } from '../services/ConfigService.js';
import { ConflictResolver } from '../services/ConflictResolver.js';

export async function runResolveCommand() {
  const config = new ConfigService();
  const git = new GitService();
  const ai = new AIService(config);
  const resolver = new ConflictResolver(ai, git);

  let conflicts;
  try {
    conflicts = await resolver.getConflicts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list merge conflicts in runResolveCommand: ${message}`);
    process.exitCode = 1;
    return;
  }
  
  if (conflicts.length === 0) {
    console.log('✅ No conflicts found.');
    return;
  }

  const failedFiles: string[] = [];

  for (const conflict of conflicts) {
    console.log(`🤖 Resolving: ${conflict.file}...`);
    try {
      const solution = await resolver.suggestResolution(conflict);
      await resolver.applyResolution(conflict.file, solution);
      console.log(`✅ Applied AI fix to ${conflict.file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to resolve ${conflict.file}: ${message}`);
      failedFiles.push(conflict.file);
    }
  }

  if (failedFiles.length > 0) {
    console.error(`⚠️ Resolution failed for ${failedFiles.length} file(s): ${failedFiles.join(', ')}`);
    process.exitCode = 1;
  }
}